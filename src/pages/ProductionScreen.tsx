"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Hammer, Search, PlusCircle, CheckCircle2, Package, Box } from "lucide-react";
import { supabase } from "../lib/supabase"; // Migrated from @/api/client

interface Product {
    id: string;
    name: string;
    price: number;
    stock: number;
    min_stock_level: number;
    category: string;
    barcode: string;
}

export default function ProductionScreen() {
    const [inventory, setInventory] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [showModal, setShowModal] = useState(false);

    // Form State
    const [producedItem, setProducedItem] = useState("");
    const [producedQty, setProducedQty] = useState(1);
    const [selectedRawMaterials, setSelectedRawMaterials] = useState<{ id: string, qty: number }[]>([]);

    const fetchInventory = async () => {
        try {
            // TODO: Replace with real Supabase query once `products` table has RLS
            // const { data, error } = await supabase.from('products').select('*');
            // if (error) throw error;
            // setInventory(data || []);
            setInventory([]); // stub: empty until DB is wired
        } catch (err) {
            console.error("Failed to load inventory:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInventory();
    }, []);

    const handleProduce = async () => {
        // TODO: Replace with supabase.rpc('run_production', {...}) once backend is ready
        console.log('[ProductionScreen] Production run (stub):', { producedItem, producedQty, selectedRawMaterials });
        await fetchInventory(); // re-fetch after production
        setShowModal(false);
        setProducedItem("");
        setProducedQty(1);
        setSelectedRawMaterials([]);
    };

    const toggleRawMaterial = (productId: string) => {
        if (selectedRawMaterials.find(rm => rm.id === productId)) {
            setSelectedRawMaterials(prev => prev.filter(rm => rm.id !== productId));
        } else {
            setSelectedRawMaterials(prev => [...prev, { id: productId, qty: 1 }]);
        }
    };

    const updateRmQty = (productId: string, qty: number) => {
        setSelectedRawMaterials(prev => prev.map(rm => rm.id === productId ? { ...rm, qty: Math.max(1, qty) } : rm));
    };

    const filteredInventory = inventory.filter(
        (item: any) =>
            item.name.toLowerCase().includes(search.toLowerCase()) ||
            item.category.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[#0A192F] tracking-tight flex items-center gap-2">
                        <Hammer className="text-amber-500" /> Manufacturing & Production
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Transform raw materials into finished goods.</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-amber-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-amber-600 transition-colors shadow-sm"
                >
                    <PlusCircle size={18} /> New Production Run
                </button>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search inventory..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-[#F8FAFC] border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                            <tr>
                                <th className="px-6 py-4">Item ID</th>
                                <th className="px-6 py-4">Product Name</th>
                                <th className="px-6 py-4">Category</th>
                                <th className="px-6 py-4 text-right">Current Stock</th>
                                <th className="px-6 py-4 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-gray-700">
                            {loading ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">Loading inventory...</td></tr>
                            ) : filteredInventory.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No matching components found.</td></tr>
                            ) : (
                                <AnimatePresence>
                                    {filteredInventory.map((item: any) => (
                                        <motion.tr
                                            key={item.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="hover:bg-gray-50 transition-colors"
                                        >
                                            <td className="px-6 py-4 font-mono text-xs text-gray-500">{item.id}</td>
                                            <td className="px-6 py-4 font-medium text-[#0A192F]">{item.name}</td>
                                            <td className="px-6 py-4"><span className="bg-gray-100 px-2 py-1 rounded text-xs font-medium text-gray-600">{item.category}</span></td>
                                            <td className="px-6 py-4 text-right font-mono font-bold text-[#0A192F]">{item.stock}</td>
                                            <td className="px-6 py-4 text-center">
                                                {item.stock < item.min_stock_level ? (
                                                    <span className="text-red-500 text-xs font-bold bg-red-50 px-2.5 py-1 rounded-md">Low Stock</span>
                                                ) : (
                                                    <span className="text-emerald-500 text-xs font-bold bg-emerald-50 px-2.5 py-1 rounded-md">Optimal</span>
                                                )}
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Production Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
                        >
                            <div className="p-6 border-b border-gray-100 bg-[#F8FAFC]">
                                <h2 className="text-xl font-bold text-[#0A192F] flex items-center gap-2">
                                    <Hammer className="text-amber-500" /> Complete Production Run
                                </h2>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Finished Good Section */}
                                <div className="space-y-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
                                    <h3 className="font-bold text-amber-900 flex items-center gap-2"><Package size={18} /> Finished Product</h3>
                                    <div className="flex gap-4">
                                        <select
                                            className="flex-1 p-2 border border-gray-200 rounded-lg outline-none"
                                            value={producedItem}
                                            onChange={(e) => setProducedItem(e.target.value)}
                                        >
                                            <option value="">Select product to manufacture...</option>
                                            {inventory.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                        </select>
                                        <input
                                            type="number" min="1"
                                            className="w-24 p-2 border border-gray-200 rounded-lg outline-none"
                                            value={producedQty}
                                            onChange={(e) => setProducedQty(parseInt(e.target.value))}
                                        />
                                    </div>
                                </div>

                                {/* Raw Materials Section */}
                                <div className="space-y-3">
                                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><Box size={18} /> Deduct Ingredients/Materials</h3>
                                    <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto p-1">
                                        {inventory.map(item => {
                                            const isSelected = selectedRawMaterials.find(rm => rm.id === item.id);
                                            return (
                                                <div key={item.id} className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${isSelected ? 'border-amber-500 bg-amber-50/30' : 'border-gray-200 hover:border-gray-300'}`}>
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!isSelected}
                                                            onChange={() => toggleRawMaterial(item.id)}
                                                            className="w-4 h-4 text-amber-500 border-gray-300 rounded focus:ring-amber-500"
                                                        />
                                                        <div>
                                                            <div className="font-medium text-sm text-gray-800">{item.name}</div>
                                                            <div className="text-xs text-gray-500">Stock: {item.stock}</div>
                                                        </div>
                                                    </div>
                                                    {isSelected && (
                                                        <input
                                                            type="number" min="1" max={item.stock}
                                                            className="w-20 p-1.5 border border-gray-200 rounded-md text-sm outline-none"
                                                            value={isSelected.qty}
                                                            onChange={(e) => updateRmQty(item.id, parseInt(e.target.value))}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="px-5 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    disabled={!producedItem || selectedRawMaterials.length === 0}
                                    onClick={handleProduce}
                                    className="px-5 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    <CheckCircle2 size={16} /> Finalize Run
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

