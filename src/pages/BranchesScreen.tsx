import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Plus, MapPin, Phone, CheckCircle2, Loader2, Store } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

interface Branch {
    id: string;
    name: string;
    location: string;
    contact: string;
    status: string;
}

export default function BranchesScreen() {
    const { user } = useAuth();
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState({ name: "", location: "", contact: "" });

    const fetchBranches = async () => {
        if (!user?.tenant_id) {
            setBranches([]);
            setLoading(false);
            return;
        }
        try {
            const { data, error } = await supabase
                .from("branches")
                .select("id, name, address, phone, status")
                .eq("tenant_id", user.tenant_id)
                .order("name");

            if (error) throw error;

            setBranches(
                (data ?? []).map((row: Record<string, unknown>) => ({
                    id: String(row.id),
                    name: String(row.name ?? ""),
                    location: String(row.address ?? row.location ?? ""),
                    contact: String(row.phone ?? row.contact ?? ""),
                    status: String(row.status ?? "active"),
                }))
            );
        } catch (err) {
            console.error("Failed to fetch branches", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBranches();
    }, [user?.tenant_id]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.tenant_id) return;
        setSaving(true);
        try {
            const { data, error } = await supabase
                .from("branches")
                .insert({
                    tenant_id: user.tenant_id,
                    name: form.name,
                    address: form.location,
                    phone: form.contact,
                    status: "active",
                })
                .select("id, name, address, phone, status")
                .single();

            if (error) throw error;

            if (data) {
                setBranches((prev) => [
                    ...prev,
                    {
                        id: String(data.id),
                        name: String(data.name ?? ""),
                        location: String(data.address ?? ""),
                        contact: String(data.phone ?? ""),
                        status: String(data.status ?? "active"),
                    },
                ]);
            }
            setShowAdd(false);
            setForm({ name: "", location: "", contact: "" });
        } catch (err) {
            console.error("Failed to add branch", err);
            alert("Error adding branch");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-8 h-[calc(100vh-64px)] overflow-y-auto bg-gray-50/50">
            <div className="flex justify-between items-center mb-8 max-w-5xl mx-auto">
                <div>
                    <h1 className="text-3xl font-black text-[#0A192F] flex items-center gap-3">
                        <Store className="text-indigo-500" size={32} /> Branches & Locations
                    </h1>
                    <p className="text-gray-500 mt-1">Manage physical stores and operational scopes</p>
                </div>
                <button
                    onClick={() => setShowAdd(true)}
                    className="bg-[#0A192F] hover:bg-[#112F5A] text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md"
                >
                    <Plus size={20} /> Add Branch
                </button>
            </div>

            <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full flex justify-center py-12">
                        <Loader2 className="animate-spin text-indigo-500" size={32} />
                    </div>
                ) : branches.length === 0 ? (
                    <div className="col-span-full bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm flex flex-col items-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-4">
                            <Building2 size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800">No branches added.</h3>
                        <p className="text-gray-500 mt-2 text-sm max-w-sm mx-auto">Start by adding your primary HQ or first retail store.</p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {branches.map((br) => (
                            <motion.div
                                key={br.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
                            >
                                <div className={`absolute top-0 left-0 w-full h-1 ${br.status === "active" ? "bg-emerald-500" : "bg-gray-300"}`} />
                                <h3 className="text-xl font-bold text-[#0A192F] mb-1">{br.name}</h3>
                                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md inline-block mb-4">
                                    {br.status}
                                </span>

                                <div className="space-y-3">
                                    <div className="flex items-start gap-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                                        <MapPin size={16} className="text-gray-400 mt-0.5 shrink-0" /> {br.location || "No address"}
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                                        <Phone size={16} className="text-gray-400" /> {br.contact || "No contact info"}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>

            {/* Add Modal */}
            <AnimatePresence>
                {showAdd && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-[#0A192F]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: -20 }}
                            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
                        >
                            <h2 className="text-2xl font-black text-[#0A192F] mb-6 flex items-center gap-3">
                                <Store className="text-indigo-500" /> New Branch
                            </h2>

                            <form onSubmit={handleSave} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Branch Name *</label>
                                    <input
                                        required
                                        autoFocus
                                        type="text"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                                        placeholder="e.g. Downtown Store"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Location / Address</label>
                                    <input
                                        type="text"
                                        value={form.location}
                                        onChange={(e) => setForm({ ...form, location: e.target.value })}
                                        className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                                        placeholder="e.g. 123 Main St"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Contact Phone</label>
                                    <input
                                        type="text"
                                        value={form.contact}
                                        onChange={(e) => setForm({ ...form, contact: e.target.value })}
                                        className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                                        placeholder="+971 4 XXX XXXX"
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowAdd(false)}
                                        className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="flex-1 py-3 bg-[#0A192F] text-white font-bold rounded-xl hover:bg-[#112F5A] transition-colors shadow-md flex items-center justify-center gap-2"
                                    >
                                        {saving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />} Save Branch
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
