import React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_PERMISSIONS } from '../config/permissions';
import { getRuntimeClassificationMessage } from '@/utils/runtimeClassification';

function AccessDeniedNotice({ role, baseRoute }: { role: string; baseRoute: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-xl rounded-[24px] border border-amber-200 bg-amber-50 p-6 text-center shadow-sm">
        <h2 className="text-xl font-black text-[#071C3B]">الصفحة غير متاحة لهذا الدور</h2>
        <p className="mt-3 text-sm font-bold leading-7 text-amber-900">
          {getRuntimeClassificationMessage(
            'access_denied',
            'السبب: لا تتوفر صلاحية الوصول لهذه الصفحة ضمن الدور الحالي.'
          )}
        </p>
        <p className="mt-2 text-xs font-bold text-slate-600">
          المسار المطلوب: {baseRoute} • الدور الحالي: {role}
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <Link
            to="/dashboard"
            className="rounded-2xl bg-[#071C3B] px-5 py-2.5 text-sm font-black text-white transition hover:opacity-90"
          >
            الانتقال إلى لوحة التحكم
          </Link>
        </div>
      </div>
    </div>
  );
}

export function RoleBasedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
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
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    const baseRoute = '/' + location.pathname.split('/')[1];
    console.warn(`[RoleBasedRoute] Access Denied: role '${role}' not in allowedRoles for ${baseRoute}.`);
    return <AccessDeniedNotice role={role} baseRoute={baseRoute} />;
  }

  const allowed = ROLE_PERMISSIONS[role] || ['/dashboard'];
  
  // Extract base route (e.g. from '/inventory/products' -> '/inventory')
  const baseRoute = '/' + location.pathname.split('/')[1];

  if (allowed.includes('*') || allowed.includes(baseRoute)) {
    return <>{children}</>;
  }

  console.warn(`[RoleBasedRoute] Access Denied: User role '${role}' cannot access ${baseRoute}.`);
  return <AccessDeniedNotice role={role} baseRoute={baseRoute} />;
}
