import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, ChefHat, Expand, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { KDSTicketCard } from '@/components/restaurant/KDSTicketCard';
import type { RestaurantBranch, RestaurantKdsTicket, RestaurantStation } from '@/services/restaurantService';
import {
    loadKdsTickets,
    loadRestaurantBranches,
    safeRestaurantErrorMessage,
    subscribeToKdsTickets,
    updateKdsTicketStatus,
} from '@/services/restaurantService';

const stations: Array<RestaurantStation | 'all'> = ['all', 'main', 'cold', 'bar', 'grill', 'dessert'];

function formatLiveClock() {
    return new Intl.DateTimeFormat('ar-AE', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).format(new Date());
}

function shouldHideTicket(ticket: RestaurantKdsTicket) {
    if (ticket.status === 'dismissed') return true;
    if (ticket.status !== 'ready') return false;
    if (!ticket.ready_at) return false;
    return Date.now() - new Date(ticket.ready_at).getTime() > 15000;
}

async function playKdsPing() {
    try {
        const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCtor) return;
        const audioContext = new AudioContextCtor();
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.type = 'triangle';
        oscillator.frequency.value = 880;
        gain.gain.value = 0.05;
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.15);
        oscillator.onended = () => {
            void audioContext.close();
        };
    } catch {
        // Ignore audio failures so the KDS remains usable on locked-down devices.
    }
}

export default function KDSScreen() {
    const { user } = useAuth();
    const [branches, setBranches] = useState<RestaurantBranch[]>([]);
    const [branchId, setBranchId] = useState('');
    const [station, setStation] = useState<RestaurantStation | 'all'>('all');
    const [tickets, setTickets] = useState<RestaurantKdsTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [mutatingTicketId, setMutatingTicketId] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [clock, setClock] = useState(formatLiveClock());
    const [realtimeIssue, setRealtimeIssue] = useState('');
    const [reloadTick, setReloadTick] = useState(0);
    const branchIdRef = useRef('');

    useEffect(() => {
        if (!success) return;
        const timer = window.setTimeout(() => setSuccess(''), 5000);
        return () => window.clearTimeout(timer);
    }, [success]);

    useEffect(() => {
        const timer = window.setInterval(() => setClock(formatLiveClock()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!user?.tenant_id) return;
        let cancelled = false;
        void loadRestaurantBranches(user.tenant_id)
            .then((nextBranches) => {
                if (cancelled) return;
                setBranches(nextBranches);
                const nextBranchId = user.branch_id || nextBranches[0]?.id || '';
                setBranchId(nextBranchId);
                branchIdRef.current = nextBranchId;
            })
            .catch((loadError) => {
                if (!cancelled) setError(safeRestaurantErrorMessage(loadError, 'تعذر تحميل الفروع لشاشة المطبخ'));
            });

        return () => {
            cancelled = true;
        };
    }, [user?.branch_id, user?.tenant_id]);

    useEffect(() => {
        if (!user?.tenant_id || !branchId) return;
        let cancelled = false;
        setLoading(true);
        setError('');

        void loadKdsTickets(user.tenant_id, branchId, station)
            .then((nextTickets) => {
                if (!cancelled) setTickets(nextTickets);
            })
            .catch((loadError) => {
                if (!cancelled) setError(safeRestaurantErrorMessage(loadError, 'تعذر تحميل تذاكر المطبخ'));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [branchId, reloadTick, station, user?.tenant_id]);

    useEffect(() => {
        if (!branchId || !user?.tenant_id) return;
        const unsubscribe = subscribeToKdsTickets(branchId, async (eventType) => {
            try {
                if (eventType === 'INSERT') {
                    await playKdsPing();
                }
                const nextTickets = await loadKdsTickets(user.tenant_id!, branchIdRef.current, station);
                setTickets(nextTickets);
                setRealtimeIssue('');
            } catch (refreshError) {
                setRealtimeIssue(safeRestaurantErrorMessage(refreshError, 'تعذر تحديث شاشة المطبخ لحظيًا، يرجى التحديث اليدوي.'));
            }
        });

        return () => {
            unsubscribe();
        };
    }, [branchId, station, user?.tenant_id]);

    const visibleTickets = useMemo(
        () => tickets.filter((ticket) => !shouldHideTicket(ticket)),
        [tickets]
    );

    const pendingCount = visibleTickets.filter((ticket) => ticket.status === 'pending').length;
    const preparingCount = visibleTickets.filter((ticket) => ticket.status === 'preparing').length;

    const handleAdvance = async (ticket: RestaurantKdsTicket) => {
        const nextStatus = ticket.status === 'pending' ? 'preparing' : ticket.status === 'preparing' ? 'ready' : 'dismissed';
        setMutatingTicketId(ticket.id);
        try {
            await updateKdsTicketStatus(ticket.id, nextStatus);
            if (user?.tenant_id && branchId) {
                const nextTickets = await loadKdsTickets(user.tenant_id, branchId, station);
                setTickets(nextTickets);
            }
            const nextStatusLabel =
                nextStatus === 'preparing' ? 'قيد التحضير' : nextStatus === 'ready' ? 'جاهز' : 'مغلق';
            setSuccess(`تم تحديث حالة التذكرة: ${nextStatusLabel}.`);
            setError('');
        } catch (advanceError) {
            setError(safeRestaurantErrorMessage(advanceError, 'تعذر تحديث حالة التذكرة'));
        } finally {
            setMutatingTicketId('');
        }
    };

    return (
        <div className="-m-6 min-h-[calc(100vh-var(--topbar-h))] w-[calc(100%+3rem)] bg-[radial-gradient(circle_at_top,#15396b_0%,#071C3B_38%,#041126_100%)] text-white" dir="rtl">
            <div className="border-b border-white/10 bg-[#071C3B]/80 px-6 py-5 backdrop-blur">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-cyan/15 text-cyan">
                            <ChefHat size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black">Kitchen Display System</h1>
                            <p className="mt-1 text-sm text-white/55">شاشة مطبخ لحظية للمحطات الرئيسية مع ألوان زمنية وتنبيهات آمنة.</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-cyan">
                            {clock}
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                void document.documentElement.requestFullscreen?.().catch(() => undefined);
                            }}
                            className="inline-flex items-center gap-2 rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                        >
                            <Expand size={16} />
                            ملء الشاشة
                        </button>
                    </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-wrap gap-2">
                        {stations.map((entry) => (
                            <button
                                key={entry}
                                type="button"
                                onClick={() => setStation(entry)}
                                className={`rounded-full px-4 py-2 text-sm font-black transition ${
                                    station === entry ? 'bg-cyan text-[#071C3B]' : 'bg-white/5 text-white/65 hover:bg-white/10'
                                }`}
                            >
                                {entry === 'all' ? 'كل المحطات' : entry}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {branches.length > 0 ? (
                            <select
                                value={branchId}
                                onChange={(event) => {
                                    setBranchId(event.target.value);
                                    branchIdRef.current = event.target.value;
                                }}
                                className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white outline-none"
                            >
                                {branches.map((branch) => (
                                    <option key={branch.id} value={branch.id} className="text-slate-900">
                                        {branch.name_ar || branch.name}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <span className="rounded-[18px] border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-bold text-amber-100">
                                لا يوجد فرع نشط — أضف فرعًا أولاً
                            </span>
                        )}
                        <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/75">
                            Pending: <span className="text-cyan">{pendingCount}</span>
                        </div>
                        <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/75">
                            Preparing: <span className="text-amber-200">{preparingCount}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setReloadTick((value) => value + 1)}
                            className="inline-flex items-center gap-2 rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                        >
                            <RefreshCw size={16} />
                            تحديث
                        </button>
                    </div>
                </div>

                {(error || realtimeIssue || success) && (
                    <div className="mt-4 space-y-2">
                        {success ? (
                            <div className="rounded-[18px] border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100">
                                {success}
                            </div>
                        ) : null}
                        {error && <div className="rounded-[18px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-100">{error}</div>}
                        {realtimeIssue && <div className="rounded-[18px] border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-100">{realtimeIssue}</div>}
                    </div>
                )}
            </div>

            <div className="px-6 py-6">
                {loading ? (
                    <div className="flex min-h-[55vh] items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-cyan" />
                    </div>
                ) : visibleTickets.length === 0 ? (
                    <div className="flex min-h-[55vh] flex-col items-center justify-center rounded-[36px] border border-dashed border-white/15 bg-white/5 text-center text-white/60">
                        <Bell className="mb-4 h-14 w-14 text-cyan" />
                        <h2 className="text-3xl font-black text-white">المطبخ جاهز</h2>
                        <p className="mt-2 max-w-lg text-sm">
                            لا توجد تذاكر مطبخ لهذا الفرع والمحطة المختارة حاليًا — وهذا طبيعي قبل أول طلب يُرسَل من نقطة البيع. تأكد أن الفرع هنا يطابق فرع نقطة المطعم، ثم أرسل طلبًا للمطبخ من الطاولة. ستظهر التذاكر لحظيًا مع تنبيه عند وصول طلب جديد.
                        </p>
                        {station !== 'all' ? (
                            <p className="mt-4 max-w-lg text-xs text-white/45">
                                المحطة الحالية: <span className="font-bold text-cyan/90">{station}</span>. إن كان الطلب يُحضَّر على محطة أخرى (حسب إعداد الصنف)، جرّب زر «كل المحطات» أعلاه.
                            </p>
                        ) : null}
                    </div>
                ) : (
                    <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
                        {visibleTickets.map((ticket) => (
                            <div key={ticket.id} className={mutatingTicketId === ticket.id ? 'opacity-70' : ''}>
                                <KDSTicketCard ticket={ticket} onAdvance={handleAdvance} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
