import { create } from 'zustand';
import { CartItem } from './PosStore';

export interface KdsOrder {
    id: string;
    tableInfo: string;
    items: (CartItem & { notes?: string })[];
    timestamp: string;
    status: 'PENDING' | 'PREPARING' | 'READY';
    targetTimeMs: number; // For gamification tracking (e.g., 5 mins = 300000)
}

interface KdsState {
    activeOrders: KdsOrder[];
    addOrder: (order: KdsOrder) => void;
    markAsPrepared: (orderId: string) => void;
    // Gamification mock callback
    onOrderCompleted?: (orderId: string, timeTakenMs: number, targetTimeMs: number) => void;
}

// Mock initial orders for demonstration
const mockInitialOrders: KdsOrder[] = [
    {
        id: 'ORD-1001',
        tableInfo: 'Table 14 - Dine In',
        timestamp: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
        status: 'PENDING',
        targetTimeMs: 5 * 60 * 1000, // 5 mins
        items: [
            {
                id: 'p1',
                name: 'Espresso',
                selling_price: 15,
                category_id: null,
                sku: 'COF-001',
                quantity: 2,
                notes: 'Extra hot',
            },
            {
                id: 'p3',
                name: 'Croissant',
                selling_price: 12,
                category_id: null,
                sku: 'PAS-001',
                quantity: 1,
            },
        ]
    },
    {
        id: 'ORD-1002',
        tableInfo: 'Takeaway - Walk-in',
        timestamp: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
        status: 'PREPARING',
        targetTimeMs: 6 * 60 * 1000, // 6 mins
        items: [
            {
                id: 'p2',
                name: 'Latte',
                selling_price: 18,
                category_id: null,
                sku: 'COF-002',
                quantity: 1,
                notes: 'Almond milk',
            },
            {
                id: 'p4',
                name: 'Sandwich',
                selling_price: 25,
                category_id: null,
                sku: 'FOD-001',
                quantity: 1,
                notes: 'No mayo',
            },
        ]
    }
];

export const useKdsStore = create<KdsState>((set, get) => ({
    activeOrders: mockInitialOrders,

    addOrder: (order) => set((state) => ({
        activeOrders: [...state.activeOrders, order]
    })),

    markAsPrepared: (orderId) => {
        const order = get().activeOrders.find(o => o.id === orderId);
        if (!order) return;

        const timeTakenMs = Date.now() - new Date(order.timestamp).getTime();

        // Trigger mock gamification callback
        if (get().onOrderCompleted) {
            get().onOrderCompleted!(orderId, timeTakenMs, order.targetTimeMs);
        }

        // Remove from active view
        set((state) => ({
            activeOrders: state.activeOrders.filter(o => o.id !== orderId)
        }));
    }
}));
