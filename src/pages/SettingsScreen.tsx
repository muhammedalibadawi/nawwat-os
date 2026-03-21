import { useState, useEffect } from 'react';
import { Settings, Save, Mail, Globe, Blocks, ToggleLeft, ToggleRight, Loader2, Key } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

export default function SettingsScreen() {
    const { user } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'modules'>('general');
    const [tenantName, setTenantName] = useState('');
    const [modules, setModules] = useState<string[]>([]);
    const [initialModules, setInitialModules] = useState<string[]>([]);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            if (!user?.tenant_id) return;
            const { data, error } = await supabase.from('tenants').select('name, modules').eq('id', user.tenant_id).single();
            if (cancelled) return;
            if (error) {
                console.warn('[SettingsScreen]', error.message);
                return;
            }
            setTenantName(String(data?.name ?? ''));
            const raw = data?.modules;
            let parsed: string[] = [];
            try {
                if (typeof raw === 'string') parsed = JSON.parse(raw || '[]');
                else if (Array.isArray(raw)) parsed = raw as string[];
            } catch {
                parsed = [];
            }
            setModules(parsed);
            setInitialModules(parsed);
        }
        load();
        return () => {
            cancelled = true;
        };
    }, [user?.tenant_id]);

    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => setIsSaving(false), 1000);
    };

    const canEditModules = user?.role === 'owner' || user?.role === 'master_admin';

    const toggleModule = async (moduleName: string) => {
        if (!user?.tenant_id || !canEditModules) return;

        let updated = [...modules];
        if (updated.includes(moduleName)) {
            updated = updated.filter((m) => m !== moduleName);
        } else {
            updated.push(moduleName);
        }

        setModules(updated);

        try {
            const { error } = await supabase.from('tenants').update({ modules: updated }).eq('id', user.tenant_id);
            if (error) throw error;
            await supabase.auth.refreshSession();
            setInitialModules(updated);
        } catch (err) {
            console.error('Failed to toggle module', err);
            setModules(initialModules);
        }
    };

    const availableModules = [
        { id: 'POS', name: 'Point of Sale (Retail)', desc: 'Retail checkout, barcode scanning, and daily cash reconciliation.' },
        { id: 'HR', name: 'HR & Payroll', desc: 'Employee directory, attendance tracking, and monthly payroll.' },
        { id: 'Accounting', name: 'Advanced Accounting', desc: 'Double-entry ledger, banks, payables, and receivables.' },
        { id: 'Logistics', name: 'Logistics & Fleet', desc: 'Internal courier app, route assignments, and external APIs.' },
        { id: 'Manufacturing', name: 'Manufacturing & Production', desc: 'Raw material tracking, recipes/BOM, and production runs.' },
        { id: 'RealEstate', name: 'Real Estate Engine', desc: 'Property listings, AI deal scoring, and lease management.' },
        { id: 'CRM', name: 'CRM & Leads', desc: 'Lead pipelines, follow-ups, and conversion tracking.' },
    ];

    return (
        <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6 pb-32">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <Settings className="text-indigo-600" /> Platform Settings
                    </h1>
                    <p className="text-gray-500 mt-1 text-sm">Manage global system configurations and Universal App modules.</p>
                </div>
                <button
                    disabled={isSaving}
                    onClick={handleSave}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-sm shadow-indigo-200"
                >
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            <div className="flex items-center gap-2 border-b border-gray-100 pb-px">
                <button
                    onClick={() => setActiveTab('general')}
                    className={`px-5 py-2.5 text-sm font-bold border-b-2 transition-colors ${
                        activeTab === 'general' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
                    }`}
                >
                    General Info
                </button>
                <button
                    onClick={() => setActiveTab('modules')}
                    className={`px-5 py-2.5 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
                        activeTab === 'modules' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
                    }`}
                >
                    <Blocks size={16} /> App Store
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <AnimatePresence mode="wait">
                    {activeTab === 'general' && (
                        <motion.div
                            key="general"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.15 }}
                            className="divide-y divide-gray-100"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-3 p-8 gap-8">
                                <div className="md:col-span-1">
                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <Globe size={18} className="text-gray-400" /> General
                                    </h3>
                                    <p className="text-sm text-gray-500 mt-1">Basic company information and regional defaults.</p>
                                </div>
                                <div className="md:col-span-2 space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Company Legal Name</label>
                                        <input
                                            type="text"
                                            defaultValue={tenantName || 'Nawwat Enterprise'}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">System Currency</label>
                                            <select className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-gray-700 bg-white">
                                                <option value="AED">AED (Emirati Dirham)</option>
                                                <option value="USD">USD (US Dollar)</option>
                                                <option value="EUR">EUR (Euro)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Timezone</label>
                                            <select className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-gray-700 bg-white">
                                                <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                                                <option value="UTC">UTC</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 p-8 gap-8">
                                <div className="md:col-span-1">
                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <Mail size={18} className="text-gray-400" /> SMTP Configuration
                                    </h3>
                                    <p className="text-sm text-gray-500 mt-1">Configure email delivery for alerts and CRM tracking.</p>
                                </div>
                                <div className="md:col-span-2 space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">SMTP Host</label>
                                        <input
                                            type="text"
                                            defaultValue="smtp.aws.amazon.com"
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Port</label>
                                            <input
                                                type="number"
                                                defaultValue={587}
                                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Encryption</label>
                                            <select className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-gray-700 bg-white">
                                                <option value="STARTTLS">STARTTLS</option>
                                                <option value="SSL">SSL / TLS</option>
                                                <option value="None">None</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'modules' && (
                        <motion.div
                            key="modules"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.15 }}
                            className="p-8"
                        >
                            <div className="mb-6 flex items-start justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <Blocks size={20} className="text-indigo-600" /> Installed Apps
                                    </h3>
                                    <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                                        Toggle these modules to instantly adapt Nawwat OS to your industry. The unified sidebar will automatically reconfigure itself based on your active modules.
                                    </p>
                                </div>
                                {!canEditModules && (
                                    <div className="text-xs bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-200 font-bold flex items-center gap-1.5">
                                        <Key size={14} /> Read-Only
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {availableModules.map((mod) => {
                                    const isEnabled = modules.includes(mod.id);
                                    return (
                                        <div
                                            key={mod.id}
                                            className={`p-5 rounded-2xl border transition-all ${
                                                isEnabled ? 'border-indigo-100 bg-indigo-50/30' : 'border-gray-100 bg-white'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="pr-4">
                                                    <h4 className="font-bold text-gray-900 text-sm mb-1">{mod.name}</h4>
                                                    <p className="text-xs text-gray-500 leading-relaxed">{mod.desc}</p>
                                                </div>
                                                <button
                                                    onClick={() => toggleModule(mod.id)}
                                                    disabled={!canEditModules}
                                                    className={`flex-shrink-0 transition-colors ${
                                                        isEnabled ? 'text-indigo-600' : 'text-gray-300 hover:text-gray-400'
                                                    } ${!canEditModules ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    {isEnabled ? <ToggleRight size={36} strokeWidth={1.5} /> : <ToggleLeft size={36} strokeWidth={1.5} />}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
