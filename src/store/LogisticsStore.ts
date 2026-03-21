import { create } from 'zustand';

export interface Location {
    lat: number;
    lng: number;
    name: string;
}

export interface Shipment {
    id: string;
    route: string;
    origin: Location;
    destination: Location;
    currentLocation: Location;
    status: 'PENDING' | 'IN_TRANSIT' | 'DELIVERED';
    progress: number;
    driver: string;
    eta: string;
    // Positioning data for our CSS-based map representation (percentages)
    mapPos: { top: string; left: string };
    isPulsing?: boolean;
}

interface LogisticsState {
    shipments: Shipment[];
}

// Dummy data for visual representation
const mockShipments: Shipment[] = [
    {
        id: 'SHP-9921',
        route: 'Dubai → Riyadh',
        origin: { lat: 25.2048, lng: 55.2708, name: 'Dubai' },
        destination: { lat: 24.7136, lng: 46.6753, name: 'Riyadh' },
        currentLocation: { lat: 24.95, lng: 51.0, name: 'In Transit Road' },
        status: 'IN_TRANSIT',
        progress: 65,
        driver: 'Ahmed S.',
        eta: '2 Hours',
        mapPos: { top: '45%', left: '60%' },
        isPulsing: true
    },
    {
        id: 'SHP-9922',
        route: 'Abu Dhabi → Jeddah',
        origin: { lat: 24.4539, lng: 54.3773, name: 'Abu Dhabi' },
        destination: { lat: 21.4858, lng: 39.1925, name: 'Jeddah' },
        currentLocation: { lat: 22.5, lng: 45.0, name: 'In Transit Road' },
        status: 'IN_TRANSIT',
        progress: 40,
        driver: 'Mohammed K.',
        eta: '5 Hours',
        mapPos: { top: '55%', left: '30%' },
        isPulsing: true
    },
    {
        id: 'SHP-9923',
        route: 'Sharjah → Doha',
        origin: { lat: 25.3463, lng: 55.4209, name: 'Sharjah' },
        destination: { lat: 25.2854, lng: 51.5310, name: 'Doha' },
        currentLocation: { lat: 25.2854, lng: 51.5310, name: 'Doha' },
        status: 'DELIVERED',
        progress: 100,
        driver: 'Omar R.',
        eta: 'Delivered',
        mapPos: { top: '40%', left: '55%' },
        isPulsing: false
    },
    {
        id: 'SHP-9924',
        route: 'Dubai → Muscat',
        origin: { lat: 25.2048, lng: 55.2708, name: 'Dubai' },
        destination: { lat: 23.5859, lng: 58.4059, name: 'Muscat' },
        currentLocation: { lat: 25.2048, lng: 55.2708, name: 'Dubai' },
        status: 'PENDING',
        progress: 0,
        driver: 'Unassigned',
        eta: 'Pending',
        mapPos: { top: '38%', left: '75%' },
        isPulsing: false
    }
];

export const useLogisticsStore = create<LogisticsState>(() => ({
    shipments: mockShipments,
}));
