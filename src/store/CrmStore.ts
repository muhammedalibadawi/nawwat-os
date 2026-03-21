import { create } from 'zustand';

export type LeadStage = 'NEW_LEAD' | 'CONTACTED' | 'QUALIFIED' | 'WON';

export interface CrmLead {
    id: string;
    contactName: string;
    company: string;
    dealValue: number;
    stage: LeadStage;
    phone: string;
    email: string;
    lastContacted: string; // ISO string
    notes?: string;
}

interface CrmState {
    leads: CrmLead[];
    moveLead: (id: string, newStage: LeadStage) => void;
    updateLead: (id: string, updates: Partial<CrmLead>) => void;
    // Future: addLead, deleteLead
}

const mockLeads: CrmLead[] = [
    {
        id: 'L-1001',
        contactName: 'Ahmed Al Maktoum',
        company: 'Emaar Properties',
        dealValue: 120000,
        stage: 'NEW_LEAD',
        phone: '+971 50 123 4567',
        email: 'ahmed@emaar.mock',
        lastContacted: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
    },
    {
        id: 'L-1002',
        contactName: 'Sara Khan',
        company: 'TechCorp LLC',
        dealValue: 45000,
        stage: 'CONTACTED',
        phone: '+971 55 987 6543',
        email: 'sara.k@techcorp.mock',
        lastContacted: new Date(Date.now() - 3600000 * 5).toISOString(), // 5 hours ago
        notes: 'Requested a demo next week.'
    },
    {
        id: 'L-1003',
        contactName: 'Mohammed Rashid',
        company: 'Global Logistics',
        dealValue: 850000,
        stage: 'QUALIFIED',
        phone: '+966 50 111 2222',
        email: 'm.rashid@globallogistics.mock',
        lastContacted: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        notes: 'Contract under review by legal.'
    },
    {
        id: 'L-1004',
        contactName: 'Fatima Ali',
        company: 'Boutique Hotels',
        dealValue: 25000,
        stage: 'WON',
        phone: '+971 52 333 4444',
        email: 'fatima@boutiquehotels.mock',
        lastContacted: new Date(Date.now() - 86400000 * 7).toISOString(), // 7 days ago
    }
];

export const useCrmStore = create<CrmState>((set) => ({
    leads: mockLeads,

    moveLead: (id, newStage) => set((state) => ({
        leads: state.leads.map(lead =>
            lead.id === id ? { ...lead, stage: newStage, lastContacted: new Date().toISOString() } : lead
        )
    })),

    updateLead: (id, updates) => set((state) => ({
        leads: state.leads.map(lead =>
            lead.id === id ? { ...lead, ...updates } : lead
        )
    })),
}));
