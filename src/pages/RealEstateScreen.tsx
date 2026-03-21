"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, TrendingUp, AlertCircle, Sparkles, MapPin, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface AIDeal {
    id: string;
    property: string;
    price_usd: number;
    estimated_roi: string;
    ai_score: number;
    category: "HOT DEALS" | "WARM DEALS" | "COLD DEALS";
    reasoning: string;
}

export default function RealEstateScreen() {
    const [deals, setDeals] = useState<AIDeal[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        async function fetchDeals() {
            try {
                const { data, error } = await supabase.from("real_estate_deals").select("*").order("ai_score", { ascending: false });
                if (error) throw error;
                setDeals((data as AIDeal[]) ?? []);
            } catch (err) {
                console.error("Failed to load Real Estate AI Deals:", err);
                setDeals([]);
            } finally {
                setLoading(false);
            }
        }
        fetchDeals();
    }, []);

    const filteredDeals = deals.filter(
        (deal) =>
            deal.property.toLowerCase().includes(search.toLowerCase()) ||
            deal.category.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 font-nunito h-full bg-transparent text-gray-800">
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-3xl p-8 bg-white border border-gray-100 shadow-sm"
            >
                <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none text-[#0A192F]">
                    <Building2 size={240} />
                </div>
                <div className="absolute top-[-50%] left-[-10%] w-[80%] h-[200%] bg-gradient-to-br from-cyan-500/10 to-transparent blur-3xl rounded-full pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-100 text-cyan-600 text-xs font-bold uppercase tracking-widest mb-4">
                            <Sparkles size={14} /> Nawwat AI Engine
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black mb-3 leading-tight text-[#0A192F] tracking-tight">
                            Real Estate Deal Intel
                        </h1>
                        <p className="text-gray-500 text-sm md:text-base max-w-xl leading-relaxed">
                            Our AI continuously analyzes market trends, historical rental yields, and infrastructure upgrades to surface the most lucrative property investments in real-time.
                        </p>
                    </div>

                    <div className="relative w-full md:w-[320px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search properties or categories..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none text-gray-800 placeholder:text-gray-400 font-medium transition-all focus:bg-white"
                        />
                    </div>
                </div>
            </motion.div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full" />
                </div>
            ) : filteredDeals.length === 0 ? (
                <div className="text-center py-16 text-gray-500 bg-white rounded-2xl border border-gray-100">
                    <AlertCircle className="mx-auto mb-3 text-gray-300" size={40} />
                    No deals found. Add rows to <code className="text-xs">real_estate_deals</code> or adjust filters.
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <AnimatePresence>
                        {filteredDeals.map((deal) => (
                            <motion.div
                                key={deal.id}
                                layout
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <span
                                        className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md ${
                                            deal.category === "HOT DEALS"
                                                ? "bg-red-50 text-red-600"
                                                : deal.category === "WARM DEALS"
                                                  ? "bg-amber-50 text-amber-700"
                                                  : "bg-gray-100 text-gray-600"
                                        }`}
                                    >
                                        {deal.category}
                                    </span>
                                    <TrendingUp className="text-emerald-500" size={20} />
                                </div>
                                <h3 className="font-bold text-lg text-[#0A192F] mb-2">{deal.property}</h3>
                                <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                                    <MapPin size={14} /> ${deal.price_usd.toLocaleString()}
                                </div>
                                <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{deal.reasoning}</p>
                                <div className="mt-4 flex justify-between text-xs font-bold text-gray-400">
                                    <span>ROI {deal.estimated_roi}</span>
                                    <span>Score {deal.ai_score}</span>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
