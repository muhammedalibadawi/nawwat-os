import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { sha256Hex } from '../../utils/pinHash';
import { Delete, Lock } from 'lucide-react';

const SESSION_KEY = 'employee_pin_session';
const LOCK_KEY = 'pos_pin_lock_until';
const ATTEMPTS_KEY = 'pos_pin_attempts';

const SESSION_MS = 8 * 60 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const PIN_LEN = 4;

export function readPinSessionValid(): boolean {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return false;
        const s = JSON.parse(raw) as { validUntil?: number };
        return typeof s.validUntil === 'number' && s.validUntil > Date.now();
    } catch {
        return false;
    }
}

export function clearPinSession() {
    localStorage.removeItem(SESSION_KEY);
}

type Props = {
    tenantId: string;
    onUnlocked: (info: { userId: string; fullName: string | null }) => void;
};

/**
 * Full-screen PIN gate: 4 dots, keypad, SHA-256(pin+salt) vs employee_pins.pin_hash
 */
export const EmployeePinPad: React.FC<Props> = ({ tenantId, onUnlocked }) => {
    const [digits, setDigits] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [lockUntil, setLockUntil] = useState(0);

    const refreshLock = useCallback(() => {
        const t = Number(localStorage.getItem(LOCK_KEY) || 0);
        setLockUntil(t);
    }, []);

    useEffect(() => {
        refreshLock();
        const id = setInterval(refreshLock, 1000);
        return () => clearInterval(id);
    }, [refreshLock]);

    const locked = Date.now() < lockUntil;
    const lockRemainingSec = locked ? Math.ceil((lockUntil - Date.now()) / 1000) : 0;

    const applyLockout = useCallback(() => {
        const until = Date.now() + LOCK_MS;
        localStorage.setItem(LOCK_KEY, String(until));
        localStorage.setItem(ATTEMPTS_KEY, '0');
        setLockUntil(until);
    }, []);

    const verify = useCallback(
        async (pin: string) => {
            if (locked || pin.length !== PIN_LEN) return;
            setBusy(true);
            setError('');
            try {
                const { data: rows, error: qErr } = await supabase
                    .from('employee_pins')
                    .select('user_id, salt, pin_hash')
                    .eq('tenant_id', tenantId);
                if (qErr) throw qErr;

                let matchedUserId: string | null = null;
                for (const row of rows ?? []) {
                    const h = await sha256Hex(pin + (row as { salt: string }).salt);
                    if (h === (row as { pin_hash: string }).pin_hash) {
                        matchedUserId = (row as { user_id: string }).user_id;
                        break;
                    }
                }

                if (matchedUserId) {
                    const { data: urow } = await supabase
                        .from('users')
                        .select('full_name')
                        .eq('tenant_id', tenantId)
                        .eq('id', matchedUserId)
                        .maybeSingle();
                    const fullName = (urow as { full_name?: string } | null)?.full_name ?? null;
                    localStorage.setItem(
                        SESSION_KEY,
                        JSON.stringify({
                            validUntil: Date.now() + SESSION_MS,
                            userId: matchedUserId,
                            fullName,
                        })
                    );
                    localStorage.setItem(ATTEMPTS_KEY, '0');
                    onUnlocked({ userId: matchedUserId, fullName });
                } else {
                    let attempts = Number(localStorage.getItem(ATTEMPTS_KEY) || 0) + 1;
                    localStorage.setItem(ATTEMPTS_KEY, String(attempts));
                    setError('رمز غير صحيح');
                    if (attempts >= MAX_ATTEMPTS) {
                        applyLockout();
                        setError('تم القفل لمدة 15 دقيقة بعد محاولات متعددة');
                    }
                }
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : 'فشل التحقق');
            } finally {
                setBusy(false);
                setDigits('');
            }
        },
        [tenantId, locked, applyLockout, onUnlocked]
    );

    useEffect(() => {
        if (digits.length === PIN_LEN && !busy && !locked) {
            void verify(digits);
        }
    }, [digits, busy, locked, verify]);

    const append = (d: string) => {
        if (locked || busy) return;
        if (digits.length >= PIN_LEN) return;
        setDigits((prev) => prev + d);
        setError('');
    };

    const backspace = () => {
        if (locked || busy) return;
        setDigits((prev) => prev.slice(0, -1));
        setError('');
    };

    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

    return (
        <div
            dir="rtl"
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#0A192F] text-white p-6"
        >
            <div className="mb-8 text-center">
                <Lock className="mx-auto mb-3 text-cyan-400" size={40} />
                <h1 className="text-xl font-black">دخول الكاشير</h1>
                <p className="text-sm text-white/60 mt-1">أدخل رمز الموظف (4 أرقام)</p>
            </div>

            {locked ? (
                <p className="text-amber-400 font-bold mb-6">
                    محظور — حاول بعد {Math.floor(lockRemainingSec / 60)}:
                    {(lockRemainingSec % 60).toString().padStart(2, '0')}
                </p>
            ) : null}

            <div className="flex gap-4 mb-8">
                {Array.from({ length: PIN_LEN }).map((_, i) => (
                    <div
                        key={i}
                        className={`h-3 w-3 rounded-full border-2 ${
                            i < digits.length ? 'bg-cyan-400 border-cyan-400' : 'border-white/40'
                        }`}
                    />
                ))}
            </div>

            {error ? <p className="text-red-400 text-sm font-bold mb-4">{error}</p> : null}

            <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
                {keys.map((k) => (
                    <button
                        key={k}
                        type="button"
                        disabled={busy || locked}
                        onClick={() => append(k)}
                        className="h-14 rounded-xl bg-white/10 hover:bg-white/20 font-black text-xl disabled:opacity-40"
                    >
                        {k}
                    </button>
                ))}
                <button
                    type="button"
                    disabled={busy || locked}
                    onClick={backspace}
                    className="h-14 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center disabled:opacity-40"
                    aria-label="حذف"
                >
                    <Delete size={22} />
                </button>
                <button
                    type="button"
                    disabled={busy || locked}
                    onClick={() => append('0')}
                    className="h-14 rounded-xl bg-white/10 hover:bg-white/20 font-black text-xl disabled:opacity-40"
                >
                    0
                </button>
                <span className="h-14" />
            </div>

            {busy ? <p className="mt-6 text-cyan-300 text-sm">جاري التحقق...</p> : null}
        </div>
    );
};
