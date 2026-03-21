"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, Database, Building2, ToggleLeft, ToggleRight, Loader2, Key } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

interface Tenant {
    id: string;
    name: string;
    status: string;
    modules: string;
}

function normalizeModules(raw: unknown): string {
    if (raw == null) return "[]";
    if (typeof raw === "string") return raw;
    try {
        return JSON.stringify(raw);
    } catch {
        return "[]";
    }
}

export default function AdminPortalScreen() {
    const { user } = useAuth();
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);

    const isAllowedRole = user?.role === "master_admin" || user?.role === "owner";

    const fetchTenants = async () => {
        try {
            const { data, error } = await supabase.from("tenants").select("id, name, status, modules").order("name");
            if (error) throw error;
            setTenants(
                (data ?? []).map((row: Record<string, unknown>) => ({
                    id: String(row.id),
                    name: String(row.name ?? ""),
                    status: String(row.status ?? "active"),
                    modules: normalizeModules(row.modules),
                }))
            );
        } catch (error) {
            console.error("Failed to fetch tenants:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAllowedRole) fetchTenants();
        else setLoading(false);
    }, [isAllowedRole]);

    const toggleStatus = async (tenantId: string) => {
        try {
            const t = tenants.find((x) => x.id === tenantId);
            if (!t) return;
            const next = t.status === "suspended" ? "active" : "suspended";
            const { error } = await supabase.from("tenants").update({ status: next }).eq("id", tenantId);
            if (error) throw error;
            fetchTenants();
        } catch (error) {
            console.error("Status toggle failed:", error);
        }
    };

    const toggleModule = async (tenantId: string, moduleName: string, currentModulesStr: string) => {
        try {
            const currentModules = JSON.parse(currentModulesStr || "[]") as string[];
            let updated: string[];
            if (currentModules.includes(moduleName)) {
                updated = currentModules.filter((m) => m !== moduleName);
            } else {
                updated = [...currentModules, moduleName];
            }
            const { error } = await supabase.from("tenants").update({ modules: updated }).eq("id", tenantId);
            if (error) throw error;
            fetchTenants();
        } catch (error) {
            console.error("Module toggle failed:", error);
        }
    };

    const availableModules = ["POS", "HR", "Accounting", "RealEstate"];

    if (!isAllowedRole) {
        return (
            <div className="p-8 text-center text-gray-500">
                <ShieldAlert className="inline-block mb-2" /> غير مصرّح — يتطلب دور owner أو master_admin
            </div>
        );
    }

    return (
        <div className="p-8 pb-32">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <Key className="text-purple-600" /> System Overlord Command
                    </h1>
                    <p className="text-gray-500 mt-1">Manage global tenant instances and feature flags.</p>
                </div>
                <div className="bg-purple-50 text-purple-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 border border-purple-100">
                    <ShieldAlert size={18} /> Master Admin Active
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 size={40} className="animate-spin text-purple-600" />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {tenants.map((t, idx) => {
                        let modules: string[] = [];
                        try {
                            modules = JSON.parse(t.modules) as string[];
                        } catch {
                            modules = [];
                        }
                        const isSuspended = t.status === "suspended";

                        return (
                            <motion.div
                                key={t.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className={`rounded-2xl border p-6 shadow-sm transition-all duration-300 relative overflow-hidden ${
                                    isSuspended ? "border-red-200 bg-red-50/50" : "border-gray-100 bg-white hover:shadow-md"
                                }`}
                            >
                                {isSuspended && (
                                    <div className="absolute top-0 right-0 py-1 px-4 bg-red-500 text-white text-[10px] font-black uppercase tracking-widest rounded-bl-xl shadow-sm">
                                        Suspended
                                    </div>
                                )}

                                <div className="flex items-start justify-between mb-6">
                                    <div className="flex items-center gap-4">
                                        <div
                                            className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${
                                                isSuspended ? "bg-red-100" : "bg-gradient-to-br from-indigo-500 to-purple-600"
                                            }`}
                                        >
                                            <Building2 size={24} className={isSuspended ? "text-red-500" : "text-white"} />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-gray-900">{t.name}</h2>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 font-mono mt-1">
                                                <Database size={12} /> {t.id}
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => toggleStatus(t.id)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                                            isSuspended
                                                ? "bg-green-100 text-green-700 hover:bg-green-200"
                                                : "bg-red-50 text-red-600 hover:bg-red-100"
                                        }`}
                                    >
                                        {isSuspended ? (
                                            <>
                                                <ToggleRight size={18} /> Reactivate
                                            </>
                                        ) : (
                                            <>
                                                <ToggleLeft size={18} /> Suspend
                                            </>
                                        )}
                                    </button>
                                </div>

                                <div>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Provisioned Modules</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {availableModules.map((mod) => {
                                            const isActive = modules.includes(mod);
                                            return (
                                                <button
                                                    key={mod}
                                                    onClick={() => toggleModule(t.id, mod, t.modules)}
                                                    disabled={isSuspended}
                                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all border ${
                                                        isActive
                                                            ? "bg-purple-50 text-purple-700 border-purple-200 shadow-sm"
                                                            : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100"
                                                    } ${isSuspended ? "opacity-50 cursor-not-allowed" : ""}`}
                                                >
                                                    {mod}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
