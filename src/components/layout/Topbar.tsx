import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '../../store/AppContext';
import { Menu, Search, Bell, HelpCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

export const Topbar: React.FC = () => {
    const { toggleSidebar, toggleMobileSidebar, tenantName, branchName, isRTL, toggleRTL } = useAppContext();
    const { user } = useAuth();
    const navigate = useNavigate();
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<{ items: any[]; contacts: any[]; invoices: any[] }>({ items: [], contacts: [], invoices: [] });
    const [showResults, setShowResults] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [showNotifs, setShowNotifs] = useState(false);

    useEffect(() => {
        const t = setTimeout(async () => {
            if (!user?.tenant_id || searchQuery.length < 2) {
                setSearchResults({ items: [], contacts: [], invoices: [] });
                return;
            }
            const [items, contacts, invoices] = await Promise.all([
                supabase.from('items').select('id, name, sku').eq('tenant_id', user.tenant_id).ilike('name', `%${searchQuery}%`).limit(3),
                supabase.from('contacts').select('id, name, email, phone').eq('tenant_id', user.tenant_id).ilike('name', `%${searchQuery}%`).limit(3),
                supabase.from('invoices').select('id, invoice_no, total, status').eq('tenant_id', user.tenant_id).ilike('invoice_no', `%${searchQuery}%`).limit(3),
            ]);
            setSearchResults({
                items: items.data ?? [],
                contacts: contacts.data ?? [],
                invoices: invoices.data ?? [],
            });
            setShowResults(true);
        }, 300);
        return () => clearTimeout(t);
    }, [searchQuery, user?.tenant_id]);

    useEffect(() => {
        const load = async () => {
            if (!user?.tenant_id) return;
            const { data } = await supabase
                .from('notifications')
                .select('id, title, body, type, is_read, created_at')
                .eq('tenant_id', user.tenant_id)
                .order('created_at', { ascending: false })
                .limit(15);
            setNotifications(data ?? []);
        };
        load();
    }, [user?.tenant_id]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
            if (e.key === 'Escape') {
                setShowResults(false);
                setShowNotifs(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const unreadCount = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications]);

    const openResult = (path: string) => {
        navigate(path);
        setShowResults(false);
        setSearchQuery('');
    };

    const openNotif = async (notif: any) => {
        navigate('/dashboard');
        if (!notif.is_read) {
            await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
            setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)));
        }
    };

    return (
        <div className="h-[var(--topbar-h)] bg-surface-card border-b border-border flex items-center pe-4 gap-0 shrink-0 relative z-50 shadow-xs">

            {/* Sidebar Toggle */}
            <button
                onClick={() => {
                    if (window.matchMedia('(max-width: 1023px)').matches) {
                        toggleMobileSidebar();
                    } else {
                        toggleSidebar();
                    }
                }}
                className="w-[var(--sidebar-mini)] h-full border-none bg-transparent flex items-center justify-center cursor-pointer text-content-3 shrink-0 transition-colors hover:bg-surface-bg hover:text-content border-e border-border"
            >
                <Menu size={18} strokeWidth={2.2} />
            </button>

            {/* Brand */}
            <div className="font-nunito font-black text-lg text-midnight px-4 whitespace-nowrap shrink-0">
                Nawwat<span className="text-cyan">OS</span>
            </div>

            <div className="w-px h-6 bg-border shrink-0" />

            {/* Breadcrumb / Branch Name */}
            <div className="flex items-center gap-1.5 px-4 text-xs text-content-3">
                <span className="opacity-40">{tenantName}</span>
                <span className="opacity-40">/</span>
                <span className="text-content font-semibold">{branchName}</span>
            </div>

            <div className="flex-1" />


            {/* Search */}
            <div className="hidden md:flex items-center bg-surface-bg border border-border rounded-[10px] px-3 py-1.5 gap-2 w-60 me-3 transition-colors focus-within:border-cyan/40 focus-within:bg-white focus-within:ring-2 focus-within:ring-cyan-dim relative">
                <Search size={14} className="text-content-4 shrink-0" />
                <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="ابحث... (Ctrl+K)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setShowResults(true)}
                    className="border-none bg-transparent outline-none text-[0.82rem] text-content w-full placeholder:text-content-4"
                />
                {showResults && (searchResults.items.length + searchResults.contacts.length + searchResults.invoices.length > 0) && (
                    <div className="absolute top-11 end-0 w-96 max-h-96 overflow-auto bg-white border border-border rounded-xl shadow-lg p-3 z-[120] text-sm">
                        <div className="font-bold text-xs text-gray-500 mb-1">📦 منتجات</div>
                        {searchResults.items.map((r) => <button key={r.id} onClick={() => openResult('/inventory')} className="w-full text-start py-1 hover:bg-gray-50 rounded px-2">{r.name} ({r.sku || '-'})</button>)}
                        <div className="font-bold text-xs text-gray-500 mt-2 mb-1">👥 جهات اتصال</div>
                        {searchResults.contacts.map((r) => <button key={r.id} onClick={() => openResult('/contacts')} className="w-full text-start py-1 hover:bg-gray-50 rounded px-2">{r.name}</button>)}
                        <div className="font-bold text-xs text-gray-500 mt-2 mb-1">📄 فواتير</div>
                        {searchResults.invoices.map((r) => <button key={r.id} onClick={() => openResult('/invoices')} className="w-full text-start py-1 hover:bg-gray-50 rounded px-2">{r.invoice_no || r.id}</button>)}
                    </div>
                )}
            </div>

            {/* Status Pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-success-dim border border-success/20 rounded-full text-[0.71rem] font-bold text-success me-3 whitespace-nowrap">
                <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
                كل الأنظمة تعمل
            </div>

            {/* Action Icons */}
            <button onClick={() => setShowNotifs((v) => !v)} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer text-content-3 relative transition-colors hover:bg-surface-bg-2 hover:text-content me-1 bg-surface-bg border-none">
                <Bell size={16} strokeWidth={2} />
                {unreadCount > 0 && <span className="absolute -top-1 -end-1 min-w-4 h-4 px-1 text-[10px] bg-danger text-white rounded-full border border-white">{unreadCount}</span>}
            </button>
            {showNotifs && (
                <div className="absolute top-12 end-8 w-96 max-h-96 overflow-auto bg-white border border-border rounded-xl shadow-lg p-3 z-[120] text-sm">
                    {notifications.map((n) => (
                        <button key={n.id} onClick={() => openNotif(n)} className={`w-full text-start rounded p-2 mb-1 ${n.is_read ? 'bg-white' : 'bg-cyan-50'}`}>
                            <div className="font-bold text-[#071C3B]">{n.title || 'إشعار'}</div>
                            <div className="text-xs text-gray-500">{n.body || '-'}</div>
                        </button>
                    ))}
                </div>
            )}
            <button className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer text-content-3 relative transition-colors hover:bg-surface-bg-2 hover:text-content me-1 bg-surface-bg border-none">
                <HelpCircle size={16} strokeWidth={2} />
            </button>

            {/* Avatar & Tenant Info */}
            <div className="w-8 h-8 bg-gradient-to-br from-cyan to-blue-600 rounded-lg flex items-center justify-center font-nunito font-extrabold text-xs text-white cursor-pointer me-1 shrink-0 shadow-[0_2px_8px_rgba(0,229,255,0.3)]">
                AH
            </div>
            <div className="text-[0.7rem] text-content-3 font-semibold border-s border-border ps-3 ms-1 whitespace-nowrap">
                {tenantName || '—'}
            </div>

        </div>
    );
};
