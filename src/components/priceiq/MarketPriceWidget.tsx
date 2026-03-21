import { useState } from "react";
import { supabase } from "../../lib/supabase";

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

const ONE_HOUR_MS = 60 * 60 * 1000;

export function MarketPriceWidget({
  itemId,
  itemName,
  tenantId,
  userId,
  currentSellingPrice,
  currency = "AED",
}: Props) {
  const [loading,  setLoading]  = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);

  async function checkMarketPrice() {
    if (!snapshot) setLoading(true);
    else setRefreshing(true);
    
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

    if (fnError || data?.error) {
      setError(data?.error || "تعذّر الاتصال بمحرك المقارنة");
    } else {
      setSnapshot(data.snapshot);
      setIsCached(!!data.cached);
    }
    
    setLoading(false);
    setRefreshing(false);
  }

  const initialLoading = loading && !snapshot;

  const diff = snapshot?.market_vs_selling_pct;
  const assessment =
    diff === null || diff === undefined
      ? null
      : diff > 10
      ? { label: `سعرك أعلى من السوق بـ ${Math.abs(diff).toFixed(1)}%`, color: "text-red-600",    bg: "bg-red-50",    icon: "📈" }
      : diff < -10
      ? { label: `سعرك تنافسي جداً (أرخص ${Math.abs(diff).toFixed(1)}%)`, color: "text-green-600", bg: "bg-green-50",  icon: "✅" }
      : { label: "سعرك عادل مقارنة بالسوق",                               color: "text-yellow-600", bg: "bg-yellow-50", icon: "⚖️" };

  const snapshotAge = snapshot
    ? Date.now() - new Date(snapshot.queried_at).getTime()
    : null;
  const isStale = snapshotAge !== null && snapshotAge > ONE_HOUR_MS;

  return (
    <div
      className="border border-border rounded-[14px] p-5 mt-4 bg-surface-card shadow-sm animate-fade-in"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">📊</span>
          <span className="font-extrabold text-[0.95rem] text-content flex items-center gap-2">
            مقارنة أسعار السوق
            {isCached && !isStale && (
              <span className="text-[0.6rem] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded-sm">محدّث</span>
            )}
            {isStale && (
              <span className="text-[0.6rem] bg-orange-100 text-orange-700 font-bold px-1.5 py-0.5 rounded-sm">قديم</span>
            )}
          </span>
        </div>
        <button
          onClick={checkMarketPrice}
          disabled={loading || refreshing}
          className="flex items-center gap-1.5 text-[0.85rem] px-4 py-2 rounded-[8px] bg-purple text-white hover:bg-purple-hover disabled:opacity-50 transition-colors font-bold shadow-sm"
        >
          {refreshing
            ? "⏳ جاري البحث..."
            : snapshot
            ? "🔄 تحديث"
            : "🔍 فحص السوق"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-[8px] p-3 mb-3 text-[0.8rem] text-red-600 text-center animate-fade-in font-medium">
          {error}
        </div>
      )}

      {/* Initial loading skeleton */}
      {initialLoading && (
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded-[8px]"></div>
          <div className="grid grid-cols-2 gap-3">
             <div className="h-24 bg-gray-200 rounded-[10px]"></div>
             <div className="h-24 bg-gray-200 rounded-[10px]"></div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!snapshot && !initialLoading && !error && (
        <div className="text-center py-6">
          <p className="text-[0.85rem] text-content-3">
            اضغط "فحص السوق" لمقارنة سعرك الحالي مع Amazon و Noon و Carrefour.
          </p>
        </div>
      )}

      {/* Results */}
      {snapshot && !initialLoading && (
        <div className="space-y-4 animate-fade-in transition-opacity duration-300" style={{ opacity: refreshing ? 0.6 : 1 }}>
          {/* Assessment badge */}
          {assessment && (
            <div className={`rounded-[8px] px-3.5 py-2.5 ${assessment.bg} flex items-center gap-2.5 border border-white/5`}>
              <span className="text-lg">{assessment.icon}</span>
              <span className={`text-[0.85rem] font-bold ${assessment.color}`}>
                {assessment.label}
              </span>
            </div>
          )}

          {/* Price comparison */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-purple/10 border border-purple/20 rounded-[10px] p-3 text-center flex flex-col justify-center">
              <p className="text-[0.7rem] font-bold text-purple uppercase tracking-wider mb-1">أفضل سعر في السوق</p>
              <p className="text-[1.3rem] font-black text-content">
                {snapshot.best_price_aed?.toFixed(2) ?? "—"}
              </p>
              <p className="text-[0.75rem] font-medium text-purple/80 mt-0.5">
                {snapshot.best_platform
                  ? PLATFORM_LABELS[snapshot.best_platform] ?? snapshot.best_platform
                  : "—"}
              </p>
            </div>
            <div className="bg-surface-bg-2 border border-border rounded-[10px] p-3 text-center flex flex-col justify-center">
              <p className="text-[0.7rem] font-bold text-content-3 uppercase tracking-wider mb-1">سعرك الحالي</p>
              <p className="text-[1.3rem] font-black text-content">
                {currentSellingPrice.toFixed(2)}
              </p>
              <p className="text-[0.75rem] font-medium text-content-3 mt-0.5">{currency}</p>
            </div>
          </div>

          {/* ETA */}
          {snapshot.best_eta_minutes && (
            <div className="bg-surface-bg-2 border border-border rounded-[8px] p-2.5 text-[0.8rem] text-content-2 text-center flex items-center justify-center gap-2">
              <span className="text-lg">⏱️</span>
              <span className="font-medium">وقت التوصيل المتوقع: <span className="font-bold">{snapshot.best_eta_minutes}</span> دقيقة</span>
            </div>
          )}

          {/* All options expandable */}
          {(snapshot.all_options?.length ?? 0) > 1 && (
            <details className="group">
              <summary className="text-[0.8rem] font-bold text-purple hover:text-purple-hover cursor-pointer px-1 py-1 flex items-center outline-none select-none transition-colors">
                عرض بدائل المنصات الأخرى ({snapshot.all_options.length})
              </summary>
              <div className="mt-2.5 space-y-1.5 px-1 animate-fade-in">
                {snapshot.all_options.map((opt, i) => (
                  <div
                    key={i}
                    className={`flex justify-between items-center px-3 py-2 rounded-[8px] text-[0.8rem] border
                      ${opt.is_best ? "bg-purple/10 border-purple/30" : "bg-surface-bg border-border text-content-2"}`}
                  >
                    <span className="font-medium flex items-center gap-1.5">
                      {PLATFORM_LABELS[opt.platform] ?? opt.platform}
                      {opt.is_best && (
                        <span className="text-purple text-[0.65rem] bg-purple/20 px-1.5 py-0.5 rounded-[4px] uppercase tracking-wider font-bold">الأفضل</span>
                      )}
                    </span>
                    <div className="text-left flex flex-col items-end">
                      <span className={`font-bold ${opt.is_best ? 'text-content' : 'text-content-2'}`}>
                        {opt.total_aed?.toFixed(2)} {currency}
                      </span>
                      {opt.delivery_eta_min && (
                        <span className="text-[0.65rem] text-content-3">
                          توصيل: {opt.delivery_eta_min}د
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Timestamp */}
          <div className="mt-1 flex items-center gap-1.5 px-1">
             <span className="text-content-3/60 text-[0.6rem]">🕒</span>
             <p className="text-[0.6rem] font-medium text-content-3/80">
                آخر تحديث: {new Date(snapshot.queried_at).toLocaleString("ar-AE")}
                {isCached && !isStale && " · من الكاش السريع"}
             </p>
          </div>
        </div>
      )}
    </div>
  );
}
