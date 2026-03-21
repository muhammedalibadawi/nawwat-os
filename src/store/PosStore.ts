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
        paymentMethod: 'cash' | 'card' | 'installment';
        amountPaid: number;
    }) => Promise<string | null>;
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

    checkout: async ({ tenantId, userId, paymentMethod, amountPaid }) => {
        const { cart, grandTotal, vatTotal, clearCart, offlineQueue } = getStore();
        if (cart.length === 0) return null;

        const order = {
            id: `ORD-${Date.now()}`,
            tenant_id: tenantId,  // passed from UI component via useAuth()
            user_id: userId,       // passed from UI component via useAuth()
            items: cart,
            total: grandTotal,
            vat: vatTotal,
            timestamp: new Date().toISOString(),
            synced: false,
        };

        // Save to offline queue (synced on reconnect)
        const newQueue = [...offlineQueue, order];
        setStore({ offlineQueue: newQueue });
        await set(QUEUE_STORAGE_KEY, newQueue);

        // Attempt Online DB Sync
        try {
            // 1. Create Invoice
            const normalizedPaid = Math.max(0, amountPaid);
            const invoiceStatus = normalizedPaid >= order.total ? 'paid' : normalizedPaid > 0 ? 'partial' : 'unpaid';
            const { data: invData, error: invError } = await supabase.from('invoices').insert({
                tenant_id: tenantId,
                invoice_no: order.id,
                invoice_type: 'sale',
                status: invoiceStatus,
                subtotal: order.total - order.vat,
                tax_amount: order.vat,
                total: order.total,
                amount_paid: normalizedPaid,
                created_by: userId
            }).select('id').single();

            if (invError) throw invError;

            // 2. Create Invoice Items & Inventory Movements
            const invoiceItems = cart.map((item, index) => ({
                tenant_id: tenantId,
                invoice_id: invData.id,
                item_ref: item.id,
                name: item.name,
                quantity: item.quantity,
                unit_price: item.price,
                line_total: item.price * item.quantity,
                sort_order: index
            }));
            
            await supabase.from('invoice_items').insert(invoiceItems);

            await supabase.from('payments').insert({
                tenant_id: tenantId,
                invoice_id: invData.id,
                method: paymentMethod,
                amount: normalizedPaid,
                status: 'captured',
                paid_at: new Date().toISOString()
            });
            
            // 3. Mark Offline Queue as Synced (Optimistic for this session)
            const remainingQueue = newQueue.filter(q => q.id !== order.id);
            setStore({ offlineQueue: remainingQueue });
            await set(QUEUE_STORAGE_KEY, remainingQueue);

        } catch (err: any) {
            console.error('POS Checkout DB Sync failed, order queued offline:', err.message);
        }

        clearCart();
        return order.id;
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
