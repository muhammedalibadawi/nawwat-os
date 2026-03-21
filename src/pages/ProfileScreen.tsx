import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/store/AppContext';
import { supabase } from '@/lib/supabase';
import { User, LogOut, Shield, MapPin, Building2, Phone } from 'lucide-react';

export default function ProfileScreen() {
    const { user, signOut } = useAuth();
    const { tenantName } = useAppContext();
    const [modules, setModules] = useState<string[]>([]);

    useEffect(() => {
        if (!user?.tenant_id) return;
        supabase
            .from('tenants')
            .select('modules')
            .eq('id', user.tenant_id)
            .single()
            .then(({ data }) => {
                const raw = data?.modules;
                let parsed: string[] = [];
                try {
                    if (typeof raw === 'string') parsed = JSON.parse(raw || '[]');
                    else if (Array.isArray(raw)) parsed = raw as string[];
                } catch {
                    parsed = [];
                }
                setModules(parsed);
            });
    }, [user?.tenant_id]);

    const initials = user?.full_name ? user.full_name.substring(0, 2).toUpperCase() : 'NA';
    const userTitle = user?.role?.replace(/_/g, ' ') || 'Employee';

    return (
        <div className="p-8 max-w-3xl mx-auto space-y-6 pb-32">
            <h1 className="text-2xl font-bold text-gray-900 mb-8">My Profile</h1>

            {/* Top Card: Cover & Avatar */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="h-32 bg-gradient-to-r from-indigo-500 to-cyan-500 w-full relative">
                    <div className="absolute inset-0 bg-white/10 pattern-grid-lg"></div>
                </div>

                <div className="px-8 pb-8 flex flex-col sm:flex-row items-center sm:items-end gap-6 relative -mt-12">
                    <div className="w-24 h-24 rounded-2xl bg-white p-1.5 shadow-lg border border-gray-100 z-10">
                        <div className="w-full h-full rounded-xl bg-gradient-to-br from-indigo-100 to-cyan-100 flex items-center justify-center text-3xl font-bold text-indigo-700 shadow-inner">
                            {initials}
                        </div>
                    </div>

                    <div className="flex-1 text-center sm:text-left mb-2">
                        <h2 className="text-2xl font-bold text-gray-900">{tenantName || user?.full_name || 'Nawwat User'}</h2>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-semibold text-xs border border-indigo-100 shadow-sm">
                                <Shield size={12} className="text-indigo-500" />
                                {userTitle}
                            </span>
                            <span className="text-sm text-gray-500">ID: {user?.tenant_id?.split('-')[0] || 'SYS-001'}</span>
                        </div>
                    </div>

                    <button
                        onClick={() => signOut()}
                        className="flex items-center gap-2 px-6 py-2.5 bg-red-50 text-red-600 rounded-xl font-semibold hover:bg-red-100 hover:text-red-700 active:scale-95 transition-all mb-2 shadow-sm border border-red-100"
                    >
                        <LogOut size={18} /> Logout
                    </button>
                </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-4">
                        <User size={18} className="text-gray-400" /> Personal Information
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Full Name</span>
                            <span className="text-gray-900 font-medium">{user?.full_name ?? '—'}</span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Email Address</span>
                            <span className="text-gray-900 font-medium">admin@nawwat.os</span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Mobile Number</span>
                            <span className="text-gray-900 font-medium flex items-center gap-2">
                                <Phone size={14} className="text-gray-400" /> +971 50 123 4567
                            </span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-4">
                        <Building2 size={18} className="text-gray-400" /> Organization Data
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Company Status</span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-medium text-xs border border-emerald-100">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
                            </span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Headquarters</span>
                            <span className="text-gray-900 font-medium flex items-center gap-2">
                                <MapPin size={14} className="text-gray-400" /> Dubai, UAE
                            </span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Licensed Modules</span>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {modules.length > 0 ? modules.map((mod: string) => (
                                    <span key={mod} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium border border-slate-200">
                                        {mod}
                                    </span>
                                )) : (
                                    <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-xs font-bold border border-indigo-100">
                                        ALL ACCESS
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
