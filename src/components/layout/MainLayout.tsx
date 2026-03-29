import React, { useCallback, useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import AICopilot from '../AICopilot';
import { LockScreen } from '../LockScreen';
import OnboardingWizard from '../OnboardingWizard';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useAppContext } from '../../store/AppContext';
import { useLocation } from 'react-router-dom';

type TenantOnboardingState = {
    setup_state?: string | null;
    onboarded_at?: string | null;
};

export const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading: authLoading } = useAuth();
    const { mobileSidebarOpen, closeMobileSidebar } = useAppContext();
    const location = useLocation();
    const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const loadOnboardingState = useCallback(async () => {
        if (!user?.tenant_id || user.role === 'master_admin') {
            setOnboardingDone(true);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('tenants')
                .select('setup_state, onboarded_at')
                .eq('id', user.tenant_id)
                .single();

            if (error) throw error;

            const tenantState = (data ?? null) as TenantOnboardingState | null;
            const done = Boolean(tenantState?.onboarded_at) || tenantState?.setup_state === 'completed';
            setOnboardingDone(done);
            localStorage.setItem('nawwat_onboarding_done', done ? 'true' : 'false');
        } catch (error) {
            console.warn('[MainLayout] Failed to load onboarding state:', error);
            setOnboardingDone(null);
        }
    }, [user?.role, user?.tenant_id]);

    useEffect(() => {
        if (authLoading) return;
        void loadOnboardingState();
    }, [authLoading, loadOnboardingState, refreshKey]);

    useEffect(() => {
        closeMobileSidebar();
    }, [closeMobileSidebar, location.pathname]);

    return (
        <div className="flex flex-col h-screen w-full overflow-hidden bg-surface-bg text-content font-sans">
            <Topbar />
            <div dir="ltr" className="flex flex-1 overflow-hidden relative">
                <div className="hidden md:flex">
                    <Sidebar />
                </div>
                {mobileSidebarOpen && (
                    <div className="fixed inset-0 z-[120] md:hidden">
                        <button
                            type="button"
                            aria-label="Close sidebar"
                            onClick={closeMobileSidebar}
                            className="absolute inset-0 bg-black/45"
                        />
                        <div className="absolute inset-y-0 start-0 w-[82vw] max-w-[320px] shadow-2xl">
                            <Sidebar forceExpanded onNavigate={closeMobileSidebar} />
                        </div>
                    </div>
                )}
                <main dir="rtl" className="flex-1 overflow-y-auto overflow-x-hidden p-6 scroll-smooth bg-surface-bg relative z-0">
                    {children}
                </main>
            </div>
            <AICopilot />
            <LockScreen />
            {onboardingDone === false && <OnboardingWizard onDone={() => setRefreshKey((value) => value + 1)} />}
        </div>
    );
};
