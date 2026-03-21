import { create } from 'zustand';

export interface Employee {
    id: string;
    name: string;
    role: string;
    points: number;
    avatar: string; // Initials or URL
}

interface HrState {
    employees: Employee[];
    addPoints: (id: string, amount: number) => void;
}

const mockEmployees: Employee[] = [
    { id: 'EMP-01', name: 'Khalid Al Fayed', role: 'Head Chef', points: 14500, avatar: 'KA' },
    { id: 'EMP-02', name: 'Aisha Rahman', role: 'Sales Lead', points: 12100, avatar: 'AR' },
    { id: 'EMP-03', name: 'Zayed Saif', role: 'Sr. Cashier', points: 9850, avatar: 'ZS' },
    { id: 'EMP-04', name: 'Fatima Naser', role: 'Customer Service', points: 8400, avatar: 'FN' },
    { id: 'EMP-05', name: 'Omar Tariq', role: 'Logistics Coord.', points: 7600, avatar: 'OT' },
];

export const useHrStore = create<HrState>((set) => ({
    employees: mockEmployees,
    addPoints: (id, amount) => set((state) => ({
        employees: state.employees.map(emp =>
            emp.id === id ? { ...emp, points: emp.points + amount } : emp
        )
    })),
}));
