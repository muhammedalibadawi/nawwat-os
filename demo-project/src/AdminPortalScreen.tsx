import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";

export default function AdminPortalScreen() {
    const { user } = useAuth();
    // Allow ahmed@gmail.com to bypass for testing, otherwise check role
    const isMasterAdmin = user?.email === 'ahmed@gmail.com' || user?.role === 'master_admin';
    
    // Hooks MUST execute unconditionally at the top level
    const [tenants, setTenants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTenants = useCallback(async () => {
        try {
            // Pseudo fetch resolving after 500ms
            await new Promise(res => setTimeout(res, 500));
            setTenants([{ id: 'T-1', name: 'Acme Corp', status: 'active' }]);
        } catch (error: any) {
            console.error("Failed to fetch tenants:", error?.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Prevent network fetch if unauthorized
        if (!isMasterAdmin) {
            setLoading(false);
            return;
        }

        fetchTenants();
    }, [isMasterAdmin, fetchTenants]);

    // Return purely restricted UI only AFTER all hooks are configured
    if (!isMasterAdmin) {
        return (
            <div style={{ padding: '2rem', background: '#ffebee', color: '#c62828', display: 'flex', gap: '10px' }}>
                <div>🛡️</div>
                <div>
                    <h2>Access Denied</h2>
                    <p>You must be a Master Admin to view this page.</p>
                </div>
            </div>
        );
    }

    if (loading) return <div>Loading System Tenants...</div>;

    return (
        <div style={{ padding: '2rem' }}>
            <h1>System Overlord Command</h1>
            <p>Manage global tenant instances and feature flags.</p>
            <ul>
                {tenants.map(t => (
                    <li key={t.id}>{t.name} ({t.status})</li>
                ))}
            </ul>
        </div>
    );
}
