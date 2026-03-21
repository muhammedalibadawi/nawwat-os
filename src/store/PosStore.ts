/**
 * PosStore.ts — NawwatOS (v2)
 *
 * State Management for the Point-of-Sale module.
 * Uses idb-keyval for offline-first cart persistence.
 * Auth context is intentionally NOT imported here — the checkout function
 * receives user/tenant context as arguments from the calling component.
 *
 * Migration note: AuthStore import removed (it was tombstoned).
 * The checkout() function now accepts explicit tenantId and userId params.
 */

import { create } from 'zustand';
import { get, set } from 'idb-keyval';
import { supabase } from '../lib/supabase';

export interface Product {
    id: string;
    name: string;
    price: number;
    category: string;
    stock: number;
    image?: string;
    sku: string;
}

export interface CartItem extends Product {
    quantity: number;
}

interface PosState {
    cart: CartItem[];
    subtotal: number;
    vatTotal: number;
    grandTotal: number;
    offlineQueue: any[];
    isInitialized: boolean;

    initStore: () => Promise<void>;
    addItem: (product: Product) => void;
    removeItem: (productId: string) => void;
    updateQuantity: (productId: string, qty: number) => void;
    clearCart: () => void;

    checkout: (params: {
        tenantId: string;
        userId: string;
        contactId?: string | null;
        paymentMethod: 'cash' | 'card' | 'installment';
        amountPaid: number;
    }) => Promise<{ orderId: string; invoiceId: string | null } | null>;
    syncOfflineOrders: () => Promise<void>;
}

const VAT_RATE = 0.15; // 15% KSA/UAE Standard VAT
const CART_STORAGE_KEY = 'nawwat_pos_cart';
const QUEUE_STORAGE_KEY = 'nawwat_offline_orders';

const calculateTotals = (cart: CartItem[]) => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const vatTotal = subtotal * VAT_RATE;
    return { subtotal, vatTotal, grandTotal: subtotal + vatTotal };
};

export const usePosStore = create<PosState>((setStore, getStore) => ({
    cart: [],
    subtotal: 0,
    vatTotal: 0,
    grandTotal: 0,
    offlineQueue: [],
    isInitialized: false,

    initStore: async () => {
        const savedCart = await get(CART_STORAGE_KEY) || [];
        const savedQueue = await get(QUEUE_STORAGE_KEY) || [];
        setStore({
            cart: savedCart,
            offlineQueue: savedQueue,
            isInitialized: true,
            ...calculateTotals(savedCart),
        });
    },

    addItem: (product) => {
        const { cart } = getStore();
        const existing = cart.find(item => item.id === product.id);
        const newCart = existing
            ? cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
            : [...cart, { ...product, quantity: 1 }];
        setStore({ cart: newCart, ...calculateTotals(newCart) });
        set(CART_STORAGE_KEY, newCart);
    },

    removeItem: (productId) => {
        const { cart } = getStore();
        const newCart = cart.filter(item => item.id !== productId);
        setStore({ cart: newCart, ...calculateTotals(newCart) });
        set(CART_STORAGE_KEY, newCart);
    },

    updateQuantity: (productId, qty) => {
        if (qty <= 0) { getStore().removeItem(productId); return; }
        const { cart } = getStore();
        const newCart = cart.map(item => item.id === productId ? { ...item, quantity: qty } : item);
        setStore({ cart: newCart, ...calculateTotals(newCart) });
        set(CART_STORAGE_KEY, newCart);
    },

    clearCart: () => {
        setStore({ cart: [], subtotal: 0, vatTotal: 0, grandTotal: 0 });
        set(CART_STORAGE_KEY, []);
    },

    checkout: async ({ tenantId, userId, contactId, paymentMethod, amountPaid }) => {
        const { cart, grandTotal, vatTotal, clearCart, offlineQueue } = getStore();
        if (cart.length === 0) return null;

        const order = {
            id: `POS-${Date.now()}`,
            tenant_id: tenantId,
            user_id: userId,
            items: cart,
            total: grandTotal,
            vat: vatTotal,
            timestamp: new Date().toISOString(),
            synced: false,
        };

        const newQueue = [...offlineQueue, order];
        setStore({ offlineQueue: newQueue });
        await set(QUEUE_STORAGE_KEY, newQueue);

        let invoiceId: string | null = null;
        try {
            const normalizedPaid = Math.max(0, amountPaid);
            const invoiceStatus =
                normalizedPaid >= order.total - 0.01 ? 'paid' : normalizedPaid > 0 ? 'partial' : 'sent';
            const subtotalExVat = order.total - order.vat;
            const payMethod =
                paymentMethod === 'installment'
                    ? 'online'
                    : paymentMethod === 'cash'
                      ? 'cash'
                      : 'card';

            const { data: invData, error: invError } = await supabase
                .from('invoices')
                .insert({
                    tenant_id: tenantId,
                    invoice_no: order.id,
                    invoice_type: 'sale',
                    status: invoiceStatus,
                    contact_id: contactId ?? null,
                    issue_date: new Date().toISOString().slice(0, 10),
                    subtotal: subtotalExVat,
                    tax_amount: order.vat,
                    total: order.total,
                    amount_paid: normalizedPaid,
                    created_by: userId,
                })
                .select('id')
                .single();

            if (invError) throw invError;
            invoiceId = invData.id;

            const invoiceItems = cart.map((item, index) => {
                const lineNet = item.price * item.quantity;
                const lineTax =
                    subtotalExVat > 0 ? order.vat * (lineNet / subtotalExVat) : 0;
                return {
                    tenant_id: tenantId,
                    invoice_id: invData.id,
                    item_ref: item.id,
                    name: item.name,
                    quantity: item.quantity,
                    unit_price: item.price,
                    tax_rate: VAT_RATE * 100,
                    tax_amount: lineTax,
                    net_amount: lineNet,
                    line_total: lineNet + lineTax,
                    sort_order: index,
                };
            });

            const { error: itemsErr } = await supabase.from('invoice_items').insert(invoiceItems);
            if (itemsErr) {
                await supabase.from('invoices').delete().eq('id', invData.id).eq('tenant_id', tenantId);
                throw itemsErr;
            }

            if (normalizedPaid > 0) {
                const { error: payErr } = await supabase.from('payments').insert({
                    tenant_id: tenantId,
                    reference_type: 'invoice',
                    reference_id: invData.id,
                    amount: normalizedPaid,
                    method: payMethod,
                    status: 'completed',
                    paid_at: new Date().toISOString(),
                });
                if (payErr) throw payErr;
            }

            const remainingQueue = newQueue.filter((q) => q.id !== order.id);
            setStore({ offlineQueue: remainingQueue });
            await set(QUEUE_STORAGE_KEY, remainingQueue);
        } catch (err: any) {
            console.error('POS Checkout DB Sync failed, order queued offline:', err.message);
            invoiceId = null;
        }

        clearCart();
        return { orderId: order.id, invoiceId };
    },

    syncOfflineOrders: async () => {
        const { offlineQueue } = getStore();
        if (offlineQueue.length === 0) return;
        console.log(`[PosStore] Syncing ${offlineQueue.length} offline orders to Supabase...`);
        // TODO: Implement real Supabase sync
        await new Promise(resolve => setTimeout(resolve, 1000));
        setStore({ offlineQueue: [] });
        await set(QUEUE_STORAGE_KEY, []);
    },
}));
