import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Minus, Trash2, ShoppingCart, CheckCircle, WifiOff } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAppContext } from '../store/AppContext';
import { useAuth } from '../context/AuthContext';
import { usePosStore, Product, CartItem } from '../store/PosStore';
import { generateZatcaQR } from '../utils/zatcaQR';
import { supabase } from '../lib/supabase';

const POSScreen: React.FC = () => {
  const { branchName } = useAppContext();
  const { user } = useAuth();
  const { cart, subtotal, vatTotal, grandTotal, addItem, removeItem, updateQuantity, clearCart, checkout, offlineQueue } = usePosStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'installment'>('cash');
  const [installmentMonths, setInstallmentMonths] = useState(3);

  useEffect(() => {
    let cancelled = false;
    async function loadProducts() {
      setProductsLoading(true);
      setProductsError('');
      if (!user?.tenant_id) {
        setProducts([]);
        setProductsLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('items')
          .select('id,name,sku,selling_price,cost_price,tenant_id')
          .eq('tenant_id', user.tenant_id)
          .is('deleted_at', null)
          .order('name');
        if (error) throw error;
        if (!cancelled) {
          const mapped: Product[] = (data ?? []).map((item: any) => ({
            id: item.id,
            name: item.name,
            sku: item.sku,
            price: Number(item.selling_price ?? 0),
            category: 'General',
            stock: 0,
          }));
          setProducts(mapped);
        }
      } catch (err: any) {
        if (!cancelled) {
          setProducts([]);
          setProductsError(err?.message ?? 'فشل تحميل المنتجات');
        }
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    }
    loadProducts();
    return () => {
      cancelled = true;
    };
  }, [user?.tenant_id]);

  const categories = useMemo(() => {
    const set = new Set<string>(['All']);
    products.forEach((p) => set.add(p.category || 'General'));
    return Array.from(set);
  }, [products]);

  // Filter Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = activeCategory === 'All' || p.category === activeCategory;
      return matchesSearch && matchesCat;
    });
  }, [products, searchQuery, activeCategory]);

  const handleCheckout = async () => {
    if (!user?.tenant_id || !user?.id) {
      console.warn('[POSScreen] checkout skipped: missing tenant_id or user id');
      return;
    }
    const amountPaid = paymentMethod === 'installment' ? grandTotal / Math.max(1, installmentMonths) : grandTotal;
    const orderId = await checkout({
      tenantId: user.tenant_id,
      userId: user.id,
      paymentMethod,
      amountPaid,
    });
    if (orderId) {
      const soundEnabled = localStorage.getItem('pos_sound') !== 'off';
      if (soundEnabled) {
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
          oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime + 0.1);
          gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
          oscillator.start(audioCtx.currentTime);
          oscillator.stop(audioCtx.currentTime + 0.3);
        }
      }
      setLastOrderId(orderId);
      setShowModal(true);
    }
  };

  // Generate ZATCA QR
  const qrData = useMemo(() => {
    if (!showModal || !lastOrderId) return '';
    return generateZatcaQR(
      "Nawwat Cafe",
      "310122393500003",
      new Date().toISOString(),
      grandTotal.toFixed(2),
      vatTotal.toFixed(2)
    );
  }, [showModal, lastOrderId, grandTotal, vatTotal]);

  return (
    <div className="flex flex-col h-[calc(100vh-var(--topbar-h))] -m-6 w-[calc(100%+3rem)] bg-surface-bg-2 overflow-hidden animate-fade-in relative z-0">

      {/* POS Header */}
      <div className="h-14 bg-surface-card border-b border-border flex items-center justify-between px-6 shrink-0 relative z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-dim flex items-center justify-center text-cyan">
            <ShoppingCart size={18} />
          </div>
          <div>
            <h1 className="font-nunito font-extrabold text-midnight text-[1.1rem] leading-none">Point of Sale</h1>
            <p className="text-[0.68rem] text-content-3 font-bold mt-0.5 uppercase tracking-wide">{branchName}</p>
          </div>
        </div>

        {offlineQueue.length > 0 && (
          <div className="flex items-center gap-2 bg-warning-dim text-warning px-3 py-1.5 rounded-full text-xs font-bold border border-warning/20 shadow-sm animate-pulse-slow">
            <WifiOff size={14} />
            {offlineQueue.length} Orders Pending Sync
          </div>
        )}
      </div>

      {/* POS Split Layout */}
      <div className="flex-1 flex overflow-hidden relative z-0">

        {/* Left Side: Products Grid */}
        <div className="flex-1 flex flex-col min-w-0 bg-surface-bg p-6 pb-2 overflow-hidden">

          {/* Controls */}
          <div className="flex gap-4 mb-6 shrink-0">
            <div className="flex-1 relative">
              <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 text-content-4" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by name or SKU..."
                className="w-full bg-surface-card border border-border rounded-xl ps-11 pe-4 py-3 text-sm text-content placeholder:text-content-4 outline-none transition-colors focus:border-cyan/50 focus:ring-2 focus:ring-cyan-dim shadow-sm"
              />
            </div>
            {/* Categories */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`whitespace-nowrap px-5 py-2 rounded-xl text-sm font-bold transition-all duration-200 border shadow-sm ${activeCategory === cat
                      ? 'bg-midnight text-white border-midnight'
                      : 'bg-surface-card text-content-2 border-border hover:bg-surface-bg-2'
                    }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto pb-6 scrollbar-thin pe-2 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-max pr-2">
            {productsLoading && Array.from({ length: 8 }).map((_, i) => (
              <div key={`skeleton-${i}`} className="bg-surface-card border border-border rounded-2xl p-4 shadow-sm animate-pulse">
                <div className="w-full aspect-square bg-surface-bg-2 rounded-xl mb-4" />
                <div className="h-4 bg-surface-bg-2 rounded mb-2" />
                <div className="h-3 bg-surface-bg-2 rounded w-2/3 mb-3" />
                <div className="h-4 bg-surface-bg-2 rounded w-1/2" />
              </div>
            ))}
            {!productsLoading && productsError && (
              <div className="col-span-full text-center text-danger font-bold py-10">{productsError}</div>
            )}
            {!productsLoading && !productsError && filteredProducts.length === 0 && (
              <div className="col-span-full text-center text-content-4 font-bold py-10">لا توجد منتجات متاحة</div>
            )}
            {filteredProducts.map(product => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                key={product.id}
                onClick={() => addItem(product)}
                className="bg-surface-card border border-border rounded-2xl p-4 shadow-sm cursor-pointer transition-all duration-200 hover:border-cyan/50 hover:shadow-md hover:-translate-y-1 group flex flex-col"
              >
                <div className="w-full aspect-square bg-surface-bg-2 rounded-xl mb-4 flex items-center justify-center text-4xl group-hover:bg-cyan-dim transition-colors">
                  ☕
                </div>
                <div className="font-bold text-content text-[0.9rem] leading-tight mb-1 truncate">{product.name}</div>
                <div className="text-[0.68rem] text-content-4 font-bold mb-3">{product.sku}</div>
                <div className="mt-auto flex items-center justify-between">
                  <div className="font-nunito font-extrabold text-midnight text-base">AED {product.price.toFixed(2)}</div>
                  <div className="w-7 h-7 bg-surface-bg border border-border rounded-lg flex items-center justify-center text-content-2 group-hover:bg-cyan group-hover:text-midnight group-hover:border-cyan transition-colors">
                    <Plus size={14} strokeWidth={3} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right Side: Cart Panel */}
        <div className="w-[360px] xl:w-[420px] bg-surface-card border-s border-border flex flex-col shadow-[-4px_0_24px_rgba(0,0,0,0.02)] shrink-0 z-10">

          <div className="p-5 border-b border-border flex items-center justify-between bg-surface-bg/50 shrink-0">
            <h2 className="font-nunito font-extrabold text-lg text-midnight">Current Order</h2>
            <button
              onClick={clearCart}
              disabled={cart.length === 0}
              className="text-xs font-bold text-danger/80 hover:text-danger disabled:opacity-30 transition-colors cursor-pointer bg-transparent border-none"
            >
              Clear All
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-content-4 opacity-70">
                <ShoppingCart size={48} strokeWidth={1.5} className="mb-4" />
                <p className="font-bold text-sm">Cart is empty</p>
                <p className="text-xs mt-1">Select products to start building an order.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <AnimatePresence initial={false}>
                  {cart.map(item => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                      className="bg-surface-bg border border-border rounded-xl p-3 flex gap-3 items-center group shadow-sm hover:border-cyan/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[0.85rem] text-midnight truncate leading-tignt">{item.name}</div>
                        <div className="text-[0.7rem] text-content-3 font-semibold mt-0.5">AED {item.price.toFixed(2)}</div>
                      </div>

                      <div className="flex items-center gap-2 bg-surface-card border border-border rounded-lg p-1">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-6 h-6 flex items-center justify-center text-content-3 hover:text-danger hover:bg-danger/10 rounded cursor-pointer transition-colors bg-transparent border-none">
                          {item.quantity === 1 ? <Trash2 size={13} /> : <Minus size={13} strokeWidth={3} />}
                        </button>
                        <span className="w-6 text-center text-[0.85rem] font-bold text-midnight">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-6 h-6 flex items-center justify-center text-content-3 hover:text-success hover:bg-success/10 rounded cursor-pointer transition-colors bg-transparent border-none">
                          <Plus size={13} strokeWidth={3} />
                        </button>
                      </div>

                      <div className="font-nunito font-extrabold text-[0.95rem] text-midnight w-[75px] text-end pr-1">
                        {(item.price * item.quantity).toFixed(2)}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          <div className="p-5 bg-surface-bg-2 border-t border-border shrink-0">
            <div className="mb-4 rounded-xl border border-border bg-surface-card p-3">
              <div className="text-xs font-bold text-content-3 mb-2">طريقة الدفع</div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`py-2 rounded-lg text-xs font-bold border ${paymentMethod === 'cash' ? 'bg-cyan-dim border-cyan text-midnight' : 'bg-white border-border text-content-2'}`}
                >
                  كاش 💵
                </button>
                <button
                  onClick={() => setPaymentMethod('card')}
                  className={`py-2 rounded-lg text-xs font-bold border ${paymentMethod === 'card' ? 'bg-cyan-dim border-cyan text-midnight' : 'bg-white border-border text-content-2'}`}
                >
                  بطاقة 💳
                </button>
                <button
                  onClick={() => setPaymentMethod('installment')}
                  className={`py-2 rounded-lg text-xs font-bold border ${paymentMethod === 'installment' ? 'bg-cyan-dim border-cyan text-midnight' : 'bg-white border-border text-content-2'}`}
                >
                  تقسيط 📅
                </button>
              </div>
              {paymentMethod === 'installment' && (
                <div className="mt-3">
                  <label className="text-xs font-bold text-content-3 block mb-1">عدد الأشهر</label>
                  <input
                    type="number"
                    min={1}
                    value={installmentMonths}
                    onChange={(e) => setInstallmentMonths(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2.5 mb-5 text-[0.85rem]">
              <div className="flex justify-between items-center text-content-2">
                <span className="font-bold">Subtotal</span>
                <span className="font-bold text-midnight">AED {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-content-2">
                <span className="font-bold">VAT (15%)</span>
                <span className="font-bold text-midnight">AED {vatTotal.toFixed(2)}</span>
              </div>
              <div className="h-px w-full bg-border my-1" />
              <div className="flex justify-between items-end">
                <span className="font-extrabold text-midnight text-lg">Total</span>
                <span className="font-nunito font-black text-midnight text-2xl text-cyan-600">AED {grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={cart.length === 0}
              className="w-full relative group overflow-hidden bg-midnight text-cyan rounded-xl py-4 flex items-center justify-center gap-2 font-nunito font-black text-[1.1rem] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:shadow-[0_8px_25px_rgba(0,229,255,0.25)] hover:-translate-y-1 active:translate-y-0"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan/0 via-cyan/20 to-cyan/0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              Complete Sale
              <div className="w-6 h-6 rounded-full bg-cyan text-midnight flex items-center justify-center ms-1">
                <CheckCircle size={14} strokeWidth={3} />
              </div>
            </button>
          </div>

        </div>
      </div>

      {/* Post-Sale Modal (Simplified for now, expecting qrcode logic ideally) */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-midnight/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-surface-card rounded-2xl w-full max-w-sm p-8 shadow-2xl border border-border flex flex-col items-center text-center relative overflow-hidden"
            >
              {/* Confetti backdrop effect */}
              <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-success/20 to-transparent pointer-events-none" />

              <div className="w-20 h-20 bg-success-dim rounded-full flex items-center justify-center text-success mb-6 relative z-10 border-4 border-white shadow-sm">
                <CheckCircle size={40} strokeWidth={2.5} />
              </div>

              <h2 className="font-nunito font-extrabold text-2xl text-midnight mb-2 relative z-10">Payment Successful!</h2>
              <p className="text-content-3 text-sm font-bold mb-6 max-w-[250px] mx-auto">
                Order <span className="text-midnight font-extrabold">{lastOrderId}</span> has been completed and saved.
              </p>

              <div className="bg-white p-3 rounded-xl mb-6 shadow-sm border border-border inline-block flex-col items-center justify-center text-center">
                <QRCodeSVG
                  value={qrData || "ZATCA_QR_PLACEHOLDER"}
                  size={160}
                  level="M"
                  includeMargin={false}
                />
                <div className="text-[0.6rem] text-content-4 mt-3 max-w-[160px] mx-auto uppercase font-bold tracking-wide">
                  ZATCA Phase 2 E-Invoice
                </div>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="w-full bg-surface-bg hover:bg-surface-bg-2 border border-border text-midnight font-bold text-[0.9rem] py-3.5 rounded-xl transition-colors shadow-sm"
              >
                New Transaction
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div >
  );
};

export default POSScreen;