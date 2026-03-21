import { create } from 'zustand';

export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'DIRTY';

export interface Table {
    id: string;
    number: string;
    capacity: number;
    status: TableStatus;
    orderId?: string;
    orderTotal?: number;
    seatingTime?: string; // ISO String
}

interface TableState {
    tables: Table[];
    updateTableStatus: (id: string, status: TableStatus) => void;
    openOrder: (id: string, orderId: string) => void;
    clearTable: (id: string) => void;
}

// Generate mock tables for the floor plan
const generateMockTables = (): Table[] => {
    const tables: Table[] = [];
    // 12 Tables total
    for (let i = 1; i <= 12; i++) {
        let status: TableStatus = 'AVAILABLE';
        let orderTotal: number | undefined;
        let seatingTime: string | undefined;

        // Make some tables occupied
        if (i === 2 || i === 7) {
            status = 'OCCUPIED';
            orderTotal = i === 2 ? 145.50 : 320.00;
            seatingTime = new Date(Date.now() - (i * 15 * 60000)).toISOString(); // 30m or 105m ago
        } else if (i === 4) {
            status = 'RESERVED';
        } else if (i === 9) {
            status = 'DIRTY';
        }

        tables.push({
            id: `T${i}`,
      number: `${i}`,
      capacity: i > 8 ? 6 : (i % 2 === 0 ? 4 : 2),
      status,
      orderTotal,
      seatingTime
    });
  }
  return tables;
};

export const useTableStore = create<TableState>((set) => ({
  tables: generateMockTables(),

  updateTableStatus: (id, status) => set((state) => ({
    tables: state.tables.map(t => 
      t.id === id ? { ...t, status } : t
    )
  })),

  openOrder: (id, orderId) => set((state) => ({
    tables: state.tables.map(t => 
      t.id === id ? { 
        ...t, 
        status: 'OCCUPIED', 
        orderId, 
        seatingTime: new Date().toISOString() 
      } : t
    )
  })),

  clearTable: (id) => set((state) => ({
    tables: state.tables.map(t => 
      t.id === id ? { 
        ...t, 
        status: 'DIRTY', 
        orderId: undefined, 
        orderTotal: undefined, 
        seatingTime: undefined 
      } : t
    )
  }))
}));
