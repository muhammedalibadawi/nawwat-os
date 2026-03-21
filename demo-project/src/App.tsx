import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { ErrorBoundary } from './ErrorBoundary';
import AdminPortalScreen from './AdminPortalScreen';
import POSScreen from './POSScreen';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { user, loading } = useAuth();
    
    if (loading) return <div>Loading Auth...</div>;
    if (!user) return <Navigate to="/login" replace />;
    
    // Globally guard against orphaned signups that have no tenant_id
    if (!user.tenant_id) {
        return <Navigate to="/suspended" replace />;
    }
    
    return <>{children}</>;
};

const ErrorBoundaryWrapper = () => {
    const location = useLocation();
    // Passing the pathname as a prop so it doesn't unmount the tree during internal category/tab navigation
    return (
        <ErrorBoundary pathname={location.pathname}>
            <Outlet />
        </ErrorBoundary>
    );
};

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<div>Login Page (Mock)</div>} />
                    <Route path="/suspended" element={<div>Account Suspended - Setup Incomplete</div>} />
                    
                    <Route path="/" element={<ProtectedRoute><ErrorBoundaryWrapper /></ProtectedRoute>}>
                        <Route index element={<Navigate to="/dashboard" replace />} />
                        <Route path="dashboard" element={<div>Global Dashboard</div>} />
                        <Route path="admin-portal" element={<AdminPortalScreen />} />
                        <Route path="pos" element={<POSScreen />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}
