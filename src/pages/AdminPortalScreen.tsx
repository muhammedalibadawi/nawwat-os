"use client";

import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldAlert, Database, Building2, ToggleLeft, ToggleRight, Loader2, Key } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface Tenant {
    id: string;
    name: string;
    status: string;
    modules: string[];
}

const availableModules = ["POS", "HR", "Accounting", "RealEstate"];
const backendBaseUrl = typeof import.meta.env.VITE_API_URL === "string"
    ? import.meta.env.VITE_API_URL.replace(/\/$/, "")
    : "";

export default function AdminPortalScreen() {
    const { user, session, loading: authLoading } = useAuth();
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busyKey, setBusyKey] = useState<string | null>(null);

    const isMasterAdmin = user?.role === "master_admin";
    const accessToken = session?.access_token ?? "";

    const authHeaders = useMemo(
        () => ({
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        }),
        [accessToken]
    );

    const apiRequest = async <T,>(path: string, init?: RequestInit): Promise<T> => {
        if (!backendBaseUrl) {
            throw new Error("VITE_API_URL is not configured. Admin API calls are disabled in this environment.");
        }
        if (!accessToken) {
            throw new Error("Missing admin access token");
        }

        const response = await fetch(`${backendBaseUrl}${path}`, {
            ...init,
            headers: {
                ...authHeaders,
                ...(init?.headers ?? {}),
            },
        });

        if (!response.ok) {
            let detail = `Request failed with status ${response.status}`;
            try {
                const payload = await response.json();
                if (payload?.detail) {
                    detail = String(payload.detail);
                }
            } catch {
                const text = await response.text();
                if (text.trim()) {
                    detail = text.trim();
                }
            }
            throw new Error(detail);
        }

        return (await response.json()) as T;
    };

    const fetchTenants = async () => {
        if (!isMasterAdmin || !accessToken) {
            setTenants([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError("");
        try {
            const data = await apiRequest<Tenant[]>("/api/v1/admin/tenants/");
            setTenants(Array.isArray(data) ? data : []);
        } catch (requestError) {
            const message = requestError instanceof Error ? requestError.message : "Failed to fetch tenants";
            console.error("Failed to fetch tenants:", requestError);
            setError(message);
            setTenants([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchTenants();
    }, [accessToken, isMasterAdmin]);

    const toggleStatus = async (tenantId: string) => {
        setBusyKey(`status:${tenantId}`);
        setError("");
        try {
            const result = await apiRequest<{ id: string; status: string }>(`/api/v1/admin/tenants/${tenantId}/toggle-status`, {
                method: "POST",
            });
            setTenants((current) =>
                current.map((tenant) =>
                    tenant.id === tenantId ? { ...tenant, status: result.status } : tenant
                )
            );
        } catch (requestError) {
            const message = requestError instanceof Error ? requestError.message : "Status toggle failed";
            console.error("Status toggle failed:", requestError);
            setError(message);
        } finally {
            setBusyKey(null);
        }
    };

    const toggleModule = async (tenantId: string, moduleName: string, currentModules: string[]) => {
        const updatedModules = currentModules.includes(moduleName)
            ? currentModules.filter((module) => module !== moduleName)
            : [...currentModules, moduleName];

        setBusyKey(`modules:${tenantId}`);
        setError("");
        try {
            const result = await apiRequest<{ id: string; modules: string[] }>(`/api/v1/admin/tenants/${tenantId}/modules`, {
                method: "PUT",
                body: JSON.stringify({ modules: updatedModules }),
            });
            setTenants((current) =>
                current.map((tenant) =>
                    tenant.id === tenantId ? { ...tenant, modules: result.modules } : tenant
                )
            );
        } catch (requestError) {
            const message = requestError instanceof Error ? requestError.message : "Module toggle failed";
            console.error("Module toggle failed:", requestError);
            setError(message);
        } finally {
            setBusyKey(null);
        }
    };

    if (authLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={40} className="animate-spin text-purple-600" />
            </div>
        );
    }

    if (!isMasterAdmin) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <div className="p-8 pb-32">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <Key className="text-purple-600" /> System Overlord Command
                    </h1>
                    <p className="text-gray-500 mt-1">Manage global tenant instances through verified backend controls.</p>
                </div>
                <div className="bg-purple-50 text-purple-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 border border-purple-100">
                    <ShieldAlert size={18} /> Master Admin Active
                </div>
            </div>

            {error && (
                <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 size={40} className="animate-spin text-purple-600" />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {tenants.map((tenant, idx) => {
                        const isSuspended = tenant.status === "suspended";
                        const isBusy = busyKey === `status:${tenant.id}` || busyKey === `modules:${tenant.id}`;

                        return (
                            <motion.div
                                key={tenant.id}
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
                                            <h2 className="text-xl font-bold text-gray-900">{tenant.name}</h2>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 font-mono mt-1">
                                                <Database size={12} /> {tenant.id}
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => toggleStatus(tenant.id)}
                                        disabled={isBusy}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-60 ${
                                            isSuspended
                                                ? "bg-green-100 text-green-700 hover:bg-green-200"
                                                : "bg-red-50 text-red-600 hover:bg-red-100"
                                        }`}
                                    >
                                        {isBusy ? (
                                            <Loader2 size={18} className="animate-spin" />
                                        ) : isSuspended ? (
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
                                        {availableModules.map((moduleName) => {
                                            const isActive = tenant.modules.includes(moduleName);
                                            return (
                                                <button
                                                    key={moduleName}
                                                    onClick={() => toggleModule(tenant.id, moduleName, tenant.modules)}
                                                    disabled={isSuspended || isBusy}
                                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all border ${
                                                        isActive
                                                            ? "bg-purple-50 text-purple-700 border-purple-200 shadow-sm"
                                                            : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100"
                                                    } ${isSuspended || isBusy ? "opacity-50 cursor-not-allowed" : ""}`}
                                                >
                                                    {moduleName}
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
