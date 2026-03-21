"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Clock, Search, Briefcase, FileText, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

interface PayableEntry {
    id: string;
    supplier_name: string;
    amount: number;
    due_date: string;
    status: string;
    description: string;
}

interface ReceivableEntry {
    id: string;
    client_name: string;
    amount: number;
    due_date: string;
    status: string;
    description: string;
}

export default function CollectionScreen() {
    const { user } = useAuth();
    const [view, setView] = useState<"receivables" | "payables">("receivables");
    const [search, setSearch] = useState("");

    const [payables, setPayables] = useState<PayableEntry[]>([]);
    const [receivables, setReceivables] = useState<ReceivableEntry[]>([]);

    useEffect(() => {
        const fetchCollections = async () => {
            if (!user?.tenant_id) {
                setPayables([]);
                setReceivables([]);
                return;
            }
            try {
                const { data: inv, error } = await supabase.from("invoices").select("*").eq("tenant_id", user.tenant_id);

                if (error) throw error;

                const rows = (inv ?? []) as Record<string, unknown>[];
                const rec: ReceivableEntry[] = rows
                    .filter((r) => (r.invoice_type as string) !== "purchase")
                    .map((r) => ({
                        id: String(r.id),
                        client_name: String(r.counterparty_name ?? r.customer_name ?? "Client"),
                        amount: Number(r.total ?? 0),
                        due_date: String(r.due_date ?? r.created_at ?? ""),
                        status: String(r.status ?? "Pending"),
                        description: String(r.notes ?? r.invoice_no ?? ""),
                    }));

                const pay: PayableEntry[] = rows
                    .filter((r) => (r.invoice_type as string) === "purchase")
                    .map((r) => ({
                        id: String(r.id),
                        supplier_name: String(r.counterparty_name ?? r.vendor_name ?? "Supplier"),
                        amount: Number(r.total ?? 0),
                        due_date: String(r.due_date ?? r.created_at ?? ""),
                        status: String(r.status ?? "Pending"),
                        description: String(r.notes ?? r.invoice_no ?? ""),
                    }));

                setReceivables(rec);
                setPayables(pay);
            } catch (err) {
                console.error("Failed to load collections data", err);
                setPayables([]);
                setReceivables([]);
            }
        };
        fetchCollections();
    }, [user?.tenant_id]);

    const totalReceivables = receivables.reduce((sum, r) => sum + r.amount, 0);
    const totalPayables = payables.reduce((sum, p) => sum + p.amount, 0);

    const filteredData = (view === "receivables" ? receivables : payables).filter(
        (item: PayableEntry | ReceivableEntry) =>
            ("client_name" in item ? item.client_name : item.supplier_name).toLowerCase().includes(search.toLowerCase()) ||
            item.description.toLowerCase().includes(search.toLowerCase())
    );

    const generateStatement = (name: string) => {
        alert(`PDF statements via Supabase Storage / Edge Functions — ${name}`);
    };

    const emailStatement = async (name: string) => {
        try {
            alert(`Email integration pending — ${name}`);
        } catch (err) {
            alert("Failed to email statement.");
        }
    };

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[#0A192F] tracking-tight flex items-center gap-2">
                        <Briefcase className="text-indigo-500" /> Collection & Dues
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Manage accounts receivable and accounts payable.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                    onClick={() => setView("receivables")}
                    className={`cursor-pointer p-5 rounded-2xl border transition-all ${
                        view === "receivables"
                            ? "bg-indigo-50 border-indigo-200 shadow-md ring-2 ring-indigo-500 ring-offset-2"
                            : "bg-white border-gray-100 hover:shadow-sm"
                    }`}
                >
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Accounts Receivable (Clients)</p>
                    <p className="text-2xl font-black text-[#0A192F] flex items-center gap-2">
                        ${totalReceivables.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <TrendingUp size={18} className="text-emerald-500" />
                    </p>
                </div>
                <div
                    onClick={() => setView("payables")}
                    className={`cursor-pointer p-5 rounded-2xl border transition-all ${
                        view === "payables"
                            ? "bg-rose-50 border-rose-200 shadow-md ring-2 ring-rose-500 ring-offset-2"
                            : "bg-white border-gray-100 hover:shadow-sm"
                    }`}
                >
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Accounts Payable (Suppliers)</p>
                    <p className="text-2xl font-black text-[#0A192F] flex items-center gap-2">
                        ${totalPayables.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <TrendingDown size={18} className="text-rose-500" />
                    </p>
                </div>
            </div>

            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder={`Search ${view} by name or description...`}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-[#F8FAFC] border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                            <tr>
                                <th className="px-6 py-4">ID</th>
                                <th className="px-6 py-4">{view === "receivables" ? "Client" : "Supplier"}</th>
                                <th className="px-6 py-4 text-right">Amount</th>
                                <th className="px-6 py-4">Due Date</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-gray-700">
                            <AnimatePresence mode="popLayout">
                                {filteredData.map((item: PayableEntry | ReceivableEntry) => (
                                    <motion.tr
                                        key={item.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="hover:bg-gray-50 transition-colors"
                                    >
                                        <td className="px-6 py-4 font-mono text-xs text-gray-500">{item.id}</td>
                                        <td className="px-6 py-4 font-medium text-[#0A192F]">
                                            {"client_name" in item ? item.client_name : item.supplier_name}
                                            <div className="text-xs text-gray-400 font-normal mt-0.5">{item.description}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono font-bold text-[#0A192F]">
                                            ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4 flex items-center gap-1.5 whitespace-nowrap">
                                            <Clock size={14} className={item.status === "Overdue" ? "text-red-500" : "text-gray-400"} />
                                            <span className={item.status === "Overdue" ? "text-red-600 font-semibold text-xs" : "text-xs"}>
                                                {item.due_date}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span
                                                className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                                                    item.status === "Pending"
                                                        ? "bg-amber-100 text-amber-700"
                                                        : item.status === "Overdue"
                                                          ? "bg-red-100 text-red-700"
                                                          : "bg-emerald-100 text-emerald-700"
                                                }`}
                                            >
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right flex justify-end gap-2">
                                            <button
                                                onClick={() =>
                                                    emailStatement("client_name" in item ? item.client_name : item.supplier_name)
                                                }
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-white border border-gray-100 shadow-sm transition-all rounded-lg text-gray-500 hover:text-cyan-600 font-semibold text-xs"
                                            >
                                                <Mail size={14} /> Email
                                            </button>
                                            <button
                                                onClick={() =>
                                                    generateStatement("client_name" in item ? item.client_name : item.supplier_name)
                                                }
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-white border border-gray-100 shadow-sm transition-all rounded-lg text-gray-500 hover:text-indigo-600 font-semibold text-xs"
                                            >
                                                <FileText size={14} /> Statement
                                            </button>
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                                        No matching {view} found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
