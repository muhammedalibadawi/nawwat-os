import { AlertTriangle, Target, X } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { RestaurantRecipeIngredient, RestaurantRecipeSummary } from '@/services/restaurantService';
import { formatRestaurantMoney } from '@/services/restaurantService';

interface RecipeCostModalProps {
    open: boolean;
    summary: RestaurantRecipeSummary | null;
    ingredients: RestaurantRecipeIngredient[];
    currency?: string;
    onClose: () => void;
}

const PIE_COLORS = ['#00CFFF', '#071C3B', '#38BDF8', '#7DD3FC', '#67E8F9', '#0F172A'];

export function RecipeCostModal({ open, summary, ingredients, currency = 'AED', onClose }: RecipeCostModalProps) {
    if (!open || !summary) return null;

    const pieData = ingredients.map((ingredient) => ({
        name: ingredient.ingredient_name_ar || ingredient.ingredient_name,
        value: Number((ingredient.quantity * ingredient.cost_snapshot * (1 + ingredient.waste_pct / 100)).toFixed(2)),
    }));

    return (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#071C3B]/60 p-4" dir="rtl">
            <div className="w-full max-w-4xl overflow-hidden rounded-[32px] bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
                    <div>
                        <p className="text-[11px] font-bold tracking-[0.3em] text-slate-400">RECIPE COSTING</p>
                        <h2 className="mt-1 text-2xl font-black text-[#071C3B]">{summary.recipe_name}</h2>
                        <p className="mt-2 text-sm text-slate-500">تحليل تكلفة الوصفة مقابل سعر البيع الحالي مع اقتراح target food cost = 30%.</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200">
                        <X size={18} />
                    </button>
                </div>

                <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                    <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-4">
                            <div className="rounded-[24px] bg-slate-50 p-4">
                                <p className="text-xs font-bold text-slate-500">التكلفة</p>
                                <p className="mt-2 text-xl font-black text-[#071C3B]">{formatRestaurantMoney(summary.cost, currency)}</p>
                            </div>
                            <div className="rounded-[24px] bg-slate-50 p-4">
                                <p className="text-xs font-bold text-slate-500">سعر البيع</p>
                                <p className="mt-2 text-xl font-black text-[#071C3B]">{formatRestaurantMoney(summary.selling_price, currency)}</p>
                            </div>
                            <div className="rounded-[24px] bg-slate-50 p-4">
                                <p className="text-xs font-bold text-slate-500">نسبة Food Cost</p>
                                <p className={`mt-2 text-xl font-black ${summary.over_threshold ? 'text-rose-500' : 'text-emerald-600'}`}>
                                    {summary.food_cost_pct?.toFixed(1) ?? '0.0'}%
                                </p>
                            </div>
                            <div className="rounded-[24px] bg-slate-50 p-4">
                                <p className="text-xs font-bold text-slate-500">السعر المقترح</p>
                                <p className="mt-2 text-xl font-black text-cyan">{formatRestaurantMoney(summary.suggested_price ?? 0, currency)}</p>
                            </div>
                        </div>

                        {summary.over_threshold && (
                            <div className="flex items-start gap-3 rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-rose-700">
                                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                                <div>
                                    <p className="font-black">تحذير هامش الربح</p>
                                    <p className="mt-1 text-sm">تكلفة الطبق تتجاوز النسبة المستهدفة 30%. يفضّل تحسين الوصفة أو رفع السعر.</p>
                                </div>
                            </div>
                        )}

                        <div className="overflow-hidden rounded-[28px] border border-slate-200">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3 text-start font-bold">المكوّن</th>
                                        <th className="px-4 py-3 text-start font-bold">الكمية</th>
                                        <th className="px-4 py-3 text-start font-bold">الهدر</th>
                                        <th className="px-4 py-3 text-start font-bold">التكلفة</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ingredients.map((ingredient) => (
                                        <tr key={ingredient.id} className="border-t border-slate-100">
                                            <td className="px-4 py-3 font-bold text-[#071C3B]">{ingredient.ingredient_name_ar || ingredient.ingredient_name}</td>
                                            <td className="px-4 py-3 text-slate-500">{ingredient.quantity}</td>
                                            <td className="px-4 py-3 text-slate-500">{ingredient.waste_pct}%</td>
                                            <td className="px-4 py-3 font-bold text-slate-700">
                                                {formatRestaurantMoney(ingredient.quantity * ingredient.cost_snapshot * (1 + ingredient.waste_pct / 100), currency)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <aside className="space-y-4">
                        <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                            <div className="mb-3 flex items-center gap-2 text-[#071C3B]">
                                <Target size={18} />
                                <h3 className="text-base font-black">Pie Chart</h3>
                            </div>
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} innerRadius={52}>
                                            {pieData.map((entry, index) => (
                                                <Cell key={`${entry.name}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value) => formatRestaurantMoney(Number(value ?? 0), currency)} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
}
