import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_PERMISSIONS } from '../config/permissions';

export function RoleBasedRoute({ children }: { children: React.ReactNode }) {
  const { session, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;

  const role: string = user?.role || 'viewer';
  const allowed = ROLE_PERMISSIONS[role] || ['/dashboard'];
  
  // Extract base route (e.g. from '/inventory/products' -> '/inventory')
  const baseRoute = '/' + location.pathname.split('/')[1];

  if (allowed.includes('*') || allowed.includes(baseRoute)) {
    return <>{children}</>;
  }

  // Denied access 
  console.warn(`[RoleBasedRoute] Access Denied: User role '${role}' cannot access ${baseRoute}. Redirecting to /dashboard.`);
  return <Navigate to="/dashboard" replace />;
}
