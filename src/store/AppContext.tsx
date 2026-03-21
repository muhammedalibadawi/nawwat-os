import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface AppContextType {
    sidebarMini: boolean;
    toggleSidebar: () => void;
    isRTL: boolean;
    toggleRTL: () => void;
    tenantName: string;
    branchName: string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [sidebarMini, setSidebarMini] = useState(false);
    const [isRTL, setIsRTL] = useState(true);
    const [tenantName, setTenantName] = useState('');
    const [branchName, setBranchName] = useState('');

    const toggleSidebar = () => setSidebarMini(prev => !prev);
    const toggleRTL = () => setIsRTL(prev => !prev);

    // Keep document direction/lang in sync with RTL toggle (default: RTL / Arabic)
    useEffect(() => {
        document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
        document.documentElement.lang = isRTL ? 'ar' : 'en';
    }, [isRTL]);

    useEffect(() => {
        let cancelled = false;

        async function loadTenantAndBranch() {
            if (!user?.tenant_id) {
                if (!cancelled) {
                    setTenantName('');
                    setBranchName('');
                }
                return;
            }

            const { data: tenantRow, error: tenantErr } = await supabase
                .from('tenants')
                .select('name')
                .eq('id', user.tenant_id)
                .single();

            if (!cancelled && !tenantErr && tenantRow?.name) {
                setTenantName(tenantRow.name);
            } else if (!cancelled && tenantErr) {
                console.warn('[AppContext] tenants fetch:', tenantErr.message);
                setTenantName('');
            }

            if (user.branch_id) {
                const { data: branchRow, error: branchErr } = await supabase
                    .from('branches')
                    .select('name')
                    .eq('id', user.branch_id)
                    .single();

                if (!cancelled && !branchErr && branchRow?.name) {
                    setBranchName(branchRow.name);
                } else if (!cancelled) {
                    if (branchErr) console.warn('[AppContext] branches fetch:', branchErr.message);
                    setBranchName('');
                }
            } else if (!cancelled) {
                setBranchName('');
            }
        }

        loadTenantAndBranch();
        return () => {
            cancelled = true;
        };
    }, [user?.tenant_id, user?.branch_id]);

    return (
        <AppContext.Provider
            value={{
                sidebarMini,
                toggleSidebar,
                isRTL,
                toggleRTL,
                tenantName,
                branchName
            }}
        >
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};
