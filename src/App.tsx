import React, { Suspense } from "react";
import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import SplashScreen from './pages/SplashScreen';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
const RegisterIndex = React.lazy(() => import('./pages/register/index'));
const RegisterSuccess = React.lazy(() => import('./pages/register/success'));
import SuspendedScreen from './pages/SuspendedScreen';
import { MainLayout } from './components/layout/MainLayout';
import { AppProvider } from './store/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from './components/ErrorBoundary';
import { RoleBasedRoute } from './components/RoleBasedRoute';

const DashboardScreen = React.lazy(() => import('./pages/DashboardScreen'));
const POSScreen = React.lazy(() => import('./pages/POSScreen'));
const KDSScreen = React.lazy(() => import('./pages/KDSScreen'));
const TableManagementScreen = React.lazy(() => import('./pages/TableManagementScreen'));
const CRMScreen = React.lazy(() => import('./pages/CRMScreen'));
const RealEstateScreen = React.lazy(() => import('./pages/RealEstateScreen'));
const HRScreen = React.lazy(() => import('./pages/HRScreen'));
const AccountingScreen = React.lazy(() => import('./pages/AccountingScreen'));
const AdminPortalScreen = React.lazy(() => import('./pages/AdminPortalScreen'));
const CalendarScreen = React.lazy(() => import('./pages/CalendarScreen'));
const ChatScreen = React.lazy(() => import('./pages/ChatScreen'));
const LogisticsScreen = React.lazy(() => import('./pages/LogisticsScreen'));
const CollectionScreen = React.lazy(() => import('./pages/CollectionScreen'));
const ProductionScreen = React.lazy(() => import('./pages/ProductionScreen'));
const InventoryScreen = React.lazy(() => import('./pages/InventoryScreen'));
const BranchesScreen = React.lazy(() => import('./pages/BranchesScreen'));
const AnalyticsScreen = React.lazy(() => import('./pages/AnalyticsScreen'));
const InvoicesScreen = React.lazy(() => import('./pages/InvoicesScreen'));
const ProcurementScreen = React.lazy(() => import('./pages/ProcurementScreen'));
const PayrollScreen = React.lazy(() => import('./pages/PayrollScreen'));
const ContactsScreen = React.lazy(() => import('./pages/ContactsScreen'));
const ReportsScreen = React.lazy(() => import('./pages/ReportsScreen'));
const SettingsScreen = React.lazy(() => import('./pages/SettingsScreen'));
const ProfileScreen = React.lazy(() => import('./pages/ProfileScreen'));
const CommerceScreen = React.lazy(() => import('./pages/CommerceScreen'));

const GlobalLoadingSpinner = () => (
  <div className="w-full h-full min-h-[50vh] flex flex-col items-center justify-center gap-4">
    <Loader2 className="animate-spin w-8 h-8 text-cyan-400" />
    <span className="text-sm font-medium text-gray-500">Loading...</span>
  </div>
);

/**
 * ProtectedRoute — Only renders children when a valid Supabase session exists.
 * Shows a full-screen spinner while the auth state is being rehydrated.
 * Redirects to /login if no session is found after loading completes.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A192F]">
        <GlobalLoadingSpinner />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  
  // Globally guard orphaned signups without a tenant_id (except for master_admin who doesn't need one)
  if (user && !user.tenant_id && user.role !== 'master_admin') {
    return <Navigate to="/suspended" replace />;
  }

  return <>{children}</>;
}

function ErrorBoundaryWrapper() {
  const location = useLocation();
  // Using location.pathname as prop prevents ErrorBoundary from completely unmounting the view tree during sibling route changes
  return <ErrorBoundary pathname={location.pathname}><Outlet /></ErrorBoundary>;
}


export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <Routes>
          <Route path="/splash" element={<SplashScreen onComplete={() => { }} />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/register" element={<Suspense fallback={<GlobalLoadingSpinner />}><RegisterIndex /></Suspense>} />
          <Route path="/register/success" element={<Suspense fallback={<GlobalLoadingSpinner />}><RegisterSuccess /></Suspense>} />
          <Route path="/suspended" element={<SuspendedScreen />} />
          <Route path="/" element={
            <ProtectedRoute>
              <MainLayout><Outlet /></MainLayout>
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route element={<Suspense fallback={<GlobalLoadingSpinner />}><ErrorBoundaryWrapper /></Suspense>}>
              <Route path="dashboard" element={<DashboardScreen />} />
              <Route path="admin-portal" element={<RoleBasedRoute><AdminPortalScreen /></RoleBasedRoute>} />
              <Route path="pos" element={<RoleBasedRoute><POSScreen /></RoleBasedRoute>} />
              <Route path="kds" element={<RoleBasedRoute><KDSScreen /></RoleBasedRoute>} />
              <Route path="tables" element={<RoleBasedRoute><TableManagementScreen /></RoleBasedRoute>} />
              <Route path="crm" element={<RoleBasedRoute><CRMScreen /></RoleBasedRoute>} />
              <Route path="real-estate" element={<RoleBasedRoute><RealEstateScreen /></RoleBasedRoute>} />
              <Route path="hr" element={<RoleBasedRoute><HRScreen /></RoleBasedRoute>} />
              <Route path="commerce" element={<RoleBasedRoute><CommerceScreen /></RoleBasedRoute>} />
              <Route path="accounting" element={<RoleBasedRoute><AccountingScreen /></RoleBasedRoute>} />
              <Route path="collection" element={<RoleBasedRoute><CollectionScreen /></RoleBasedRoute>} />
              <Route path="logistics" element={<RoleBasedRoute><LogisticsScreen /></RoleBasedRoute>} />
              <Route path="production" element={<RoleBasedRoute><ProductionScreen /></RoleBasedRoute>} />
              <Route path="inventory/*" element={<RoleBasedRoute><InventoryScreen /></RoleBasedRoute>} />
              <Route path="branches" element={<RoleBasedRoute><BranchesScreen /></RoleBasedRoute>} />
              <Route path="analytics" element={<RoleBasedRoute><AnalyticsScreen /></RoleBasedRoute>} />
              <Route path="invoices" element={<RoleBasedRoute><InvoicesScreen /></RoleBasedRoute>} />
              <Route path="procurement" element={<RoleBasedRoute allowedRoles={['owner','master_admin','branch_manager','procurement','accountant']}><ProcurementScreen /></RoleBasedRoute>} />
              <Route path="payroll" element={<RoleBasedRoute allowedRoles={['owner','master_admin','hr','accountant']}><PayrollScreen /></RoleBasedRoute>} />
              <Route path="contacts" element={<RoleBasedRoute><ContactsScreen /></RoleBasedRoute>} />
              <Route path="calendar" element={<CalendarScreen />} />
              <Route path="chat" element={<ChatScreen />} />
              <Route path="reports" element={<ReportsScreen />} />
              <Route path="settings" element={<SettingsScreen />} />
              <Route path="profile" element={<ProfileScreen />} />
            </Route>
          </Route>
        </Routes>
      </AppProvider>
    </AuthProvider>
  );
}
