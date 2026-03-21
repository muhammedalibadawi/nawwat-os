// src/components/priceiq/MarketPriceWidget.tsx
// Add to item detail page in NawwatOS

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface MarketOption {
  platform: string;
  total_aed: number;
  delivery_eta_min: number;
  currency: string;
  is_best: boolean;
}

interface Snapshot {
  id: string;
  best_platform: string | null;
  best_price_aed: number | null;
  best_eta_minutes: number | null;
  market_vs_selling_pct: number | null;
  all_options: MarketOption[];
  queried_at: string;
}

interface Props {
  itemId: string;
  itemName: string;
  tenantId: string;
  userId: string;
  currentSellingPrice: number;
  currency?: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  amazon_ae:    "Amazon 🇦🇪",
  amazon_sa:    "Amazon 🇸🇦",
  noon_ae:      "Noon 🇦🇪",
  noon_sa:      "Noon 🇸🇦",
  carrefour_ae: "Carrefour 🇦🇪",
  jumia_ae:     "Jumia 🇦🇪",
};

export function MarketPriceWidget({
  itemId,
  itemName,
  tenantId,
  userId,
  currentSellingPrice,
  currency = "AED",
}: Props) {
  const [loading,  setLoading]  = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  async function checkMarketPrice() {
    setLoading(true);
    setError(null);

    const { data, error: fnError } = await supabase.functions.invoke(
      "priceiq-query",
      {
        body: {
          item_id:       itemId,
          item_name:     itemName,
          tenant_id:     tenantId,
          user_id:       userId,
          country:       "ae",
          source_module: "pricing",
        },
      }
    );

    if (fnError) {
      setError("تعذّر الاتصال بمحرك المقارنة");
    } else {
      setSnapshot(data.snapshot);
    }
    setLoading(false);
  }

  const diff = snapshot?.market_vs_selling_pct;
  const assessment =
    diff === null || diff === undefined
      ? null
      : diff > 10
      ? { label: `سعرك أعلى من السوق بـ ${Math.abs(diff).toFixed(1)}%`, color: "text-red-600",    bg: "bg-red-50",    icon: "📈" }
      : diff < -10
      ? { label: `سعرك تنافسي جداً (أرخص ${Math.abs(diff).toFixed(1)}%)`, color: "text-green-600", bg: "bg-green-50",  icon: "✅" }
      : { label: "سعرك عادل مقارنة بالسوق",                               color: "text-yellow-600", bg: "bg-yellow-50", icon: "⚖️" };

  return (
    <div
      className="border border-gray-200 rounded-xl p-4 mt-4 bg-white shadow-sm"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <span className="font-semibold text-sm text-gray-800">
            مقارنة أسعار السوق
          </span>
        </div>
        <button
          onClick={checkMarketPrice}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white
                     hover:bg-blue-700 disabled:opacity-50 transition-all font-medium"
        >
          {loading ? "⏳ جاري البحث..." : snapshot ? "🔄 تحديث" : "🔍 فحص السوق"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-2 text-xs text-red-600 text-center">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!snapshot && !loading && !error && (
        <div className="text-center py-4">
          <p className="text-xs text-gray-400">
            اضغط "فحص السوق" لمقارنة سعرك مع Amazon و Noon
          </p>
        </div>
      )}

      {/* Results */}
      {snapshot && (
        <div className="space-y-2.5">
          {/* Assessment badge */}
          {assessment && (
            <div className={`rounded-lg px-3 py-2 ${assessment.bg} flex items-center gap-2`}>
              <span>{assessment.icon}</span>
              <span className={`text-xs font-semibold ${assessment.color}`}>
                {assessment.label}
              </span>
            </div>
          )}

          {/* Price comparison */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-blue-50 rounded-lg p-2.5 text-center">
              <p className="text-xs text-blue-500 mb-1">أفضل سعر في السوق</p>
              <p className="text-base font-bold text-blue-800">
                {snapshot.best_price_aed?.toFixed(2)}
              </p>
              <p className="text-xs text-blue-400">
                {snapshot.best_platform
                  ? PLATFORM_LABELS[snapshot.best_platform] ?? snapshot.best_platform
                  : "—"}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5 text-center">
              <p className="text-xs text-gray-500 mb-1">سعرك الحالي</p>
              <p className="text-base font-bold text-gray-800">
                {currentSellingPrice.toFixed(2)}
              </p>
              <p className="text-xs text-gray-400">{currency}</p>
            </div>
          </div>

          {/* ETA */}
          {snapshot.best_eta_minutes && (
            <p className="text-xs text-gray-400 text-center">
              ⏱️ وقت التوصيل المتوقع: {snapshot.best_eta_minutes} دقيقة
            </p>
          )}

          {/* All options expandable */}
          {(snapshot.all_options?.length ?? 0) > 1 && (
            <details>
              <summary className="text-xs text-blue-500 hover:underline cursor-pointer px-1">
                عرض كل المنصات ({snapshot.all_options.length})
              </summary>
              <div className="mt-2 space-y-1">
                {snapshot.all_options.map((opt, i) => (
                  <div
                    key={i}
                    className={`flex justify-between items-center px-2 py-1.5 rounded text-xs
                      ${opt.is_best ? "bg-blue-50 border border-blue-200" : "bg-gray-50"}`}
                  >
                    <span className="text-gray-600">
                      {PLATFORM_LABELS[opt.platform] ?? opt.platform}
                      {opt.is_best && (
                        <span className="mr-1 text-blue-500 font-medium">★</span>
                      )}
                    </span>
                    <div className="text-right">
                      <span className="font-semibold text-gray-800">
                        {opt.total_aed?.toFixed(2)} {currency}
                      </span>
                      {opt.delivery_eta_min && (
                        <span className="text-gray-400 mr-1">
                          · {opt.delivery_eta_min}د
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Timestamp */}
          <p className="text-xs text-gray-300 text-left">
            آخر تحديث: {new Date(snapshot.queried_at).toLocaleString("ar-AE")}
          </p>
        </div>
      )}
    </div>
  );
}
