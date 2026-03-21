import React from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import AICopilot from '../AICopilot';
import { LockScreen } from '../LockScreen';

export const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <div className="flex flex-col h-screen w-full overflow-hidden bg-surface-bg text-content font-sans">
            <Topbar />
            <div dir="ltr" className="flex flex-1 overflow-hidden relative">
                <Sidebar />
                <main dir="rtl" className="flex-1 overflow-y-auto overflow-x-hidden p-6 scroll-smooth bg-surface-bg relative z-0">
                    {children}
                </main>
            </div>
            <AICopilot />
            <LockScreen />
        </div>
    );
};
