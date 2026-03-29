import React, { Suspense } from "react";
import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import SplashScreen from './pages/SplashScreen';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
const RegisterPage = React.lazy(() => import('./pages/RegisterPage'));
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
const RestaurantPOSScreen = React.lazy(() => import('./pages/RestaurantPOSScreen'));
const KDSScreen = React.lazy(() => import('./pages/KDSScreen'));
const MenuManagementScreen = React.lazy(() => import('./pages/MenuManagementScreen'));
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
import CommerceShellLayout from './pages/commerce/CommerceShellLayout';
const CommerceScreen = React.lazy(() => import('./pages/CommerceScreen'));
const CommerceFoundationHubScreen = React.lazy(() => import('./pages/CommerceFoundationHubScreen'));
const CommerceChannelsOpsScreen = React.lazy(() => import('./pages/commerce/CommerceChannelsOpsScreen'));
const CommerceContractsScreen = React.lazy(() => import('./pages/commerce/CommerceContractsScreen'));
const CommercePricingScreen = React.lazy(() => import('./pages/commerce/CommercePricingScreen'));
const CustomerPortalPage = React.lazy(() => import('./pages/CustomerPortalPage'));
const EmployeePortalPage = React.lazy(() => import('./pages/EmployeePortalPage'));
const SupplierPortalPage = React.lazy(() => import('./pages/SupplierPortalPage'));
const ChequesScreen = React.lazy(() => import('./pages/ChequesScreen'));
const PharmacyPOSScreen = React.lazy(() => import('./pages/PharmacyPOSScreen'));
const PrescriptionManagementScreen = React.lazy(() => import('./pages/PrescriptionManagementScreen'));
const PharmacyInventoryScreen = React.lazy(() => import('./pages/PharmacyInventoryScreen'));
const PharmacyReceivingScreen = React.lazy(() => import('./pages/PharmacyReceivingScreen'));
const PatientMedicationHistoryScreen = React.lazy(() => import('./pages/PatientMedicationHistoryScreen'));
const PharmacyReportsScreen = React.lazy(() => import('./pages/PharmacyReportsScreen'));
const WorkHomeScreen = React.lazy(() => import('./pages/WorkHomeScreen'));
const WorkTeamSpacesScreen = React.lazy(() => import('./pages/WorkTeamSpacesScreen'));
const WorkProjectsScreen = React.lazy(() => import('./pages/WorkProjectsScreen'));
const WorkProjectDetailScreen = React.lazy(() => import('./pages/WorkProjectDetailScreen'));
const WorkDocsScreen = React.lazy(() => import('./pages/WorkDocsScreen'));
const WorkChannelsScreen = React.lazy(() => import('./pages/WorkChannelsScreen'));
const WorkInboxScreen = React.lazy(() => import('./pages/WorkInboxScreen'));
const WorkSearchScreen = React.lazy(() => import('./pages/WorkSearchScreen'));

const GlobalLoadingSpinner = () => (
  <div className="w-full h-full min-h-[50vh] flex flex-col items-center justify-center gap-4">
    <Loader2 className="animate-spin w-8 h-8 text-cyan-400" />
    <span className="text-sm font-medium text-gray-500">جاري التحميل...</span>
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

function ChequesRoute() {
  return (
    <RoleBasedRoute allowedRoles={['owner', 'master_admin', 'accountant']}>
      <ChequesScreen />
    </RoleBasedRoute>
  );
}

const WORK_OS_ALLOWED_ROLES = [
  'owner',
  'master_admin',
  'branch_manager',
  'accountant',
  'hr',
  'procurement',
  'sales',
  'doctor',
  'pharmacist',
  'receptionist',
  'teacher',
  'viewer',
  'cashier',
  'kitchen',
  'warehouse',
] as const;

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <Routes>
          <Route path="/splash" element={<SplashScreen onComplete={() => { }} />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/register"
            element={
              <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#071C3B] text-white font-arabic">جاري التحميل...</div>}>
                <RegisterPage />
              </Suspense>
            }
          />
          <Route path="/register/success" element={<Suspense fallback={<GlobalLoadingSpinner />}><RegisterSuccess /></Suspense>} />
          <Route path="/suspended" element={<SuspendedScreen />} />
          <Route path="/portal" element={<Suspense fallback={<GlobalLoadingSpinner />}><CustomerPortalPage /></Suspense>} />
          <Route path="/employee-portal" element={<Suspense fallback={<GlobalLoadingSpinner />}><EmployeePortalPage /></Suspense>} />
          <Route path="/supplier-portal" element={<Suspense fallback={<GlobalLoadingSpinner />}><SupplierPortalPage /></Suspense>} />
          <Route path="/" element={
            <ProtectedRoute>
              <MainLayout><Outlet /></MainLayout>
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route element={<Suspense fallback={<GlobalLoadingSpinner />}><ErrorBoundaryWrapper /></Suspense>}>
              <Route path="dashboard" element={<DashboardScreen />} />
              <Route path="admin-portal" element={<RoleBasedRoute allowedRoles={['master_admin']}><AdminPortalScreen /></RoleBasedRoute>} />
              <Route path="pos" element={<RoleBasedRoute><POSScreen /></RoleBasedRoute>} />
              <Route path="restaurant-pos" element={<RoleBasedRoute allowedRoles={['owner', 'master_admin', 'branch_manager', 'cashier']}><RestaurantPOSScreen /></RoleBasedRoute>} />
              <Route path="kds" element={<RoleBasedRoute allowedRoles={['owner', 'master_admin', 'branch_manager', 'kitchen']}><KDSScreen /></RoleBasedRoute>} />
              <Route path="menu-management" element={<RoleBasedRoute allowedRoles={['owner', 'master_admin', 'branch_manager']}><MenuManagementScreen /></RoleBasedRoute>} />
              <Route path="pharmacy-pos" element={<RoleBasedRoute allowedRoles={['owner', 'master_admin', 'branch_manager', 'pharmacist', 'cashier', 'doctor', 'receptionist']}><PharmacyPOSScreen /></RoleBasedRoute>} />
              <Route path="prescriptions" element={<RoleBasedRoute allowedRoles={['owner', 'master_admin', 'branch_manager', 'pharmacist', 'doctor', 'receptionist']}><PrescriptionManagementScreen /></RoleBasedRoute>} />
              <Route path="pharmacy-inventory" element={<RoleBasedRoute allowedRoles={['owner', 'master_admin', 'branch_manager', 'pharmacist', 'warehouse', 'procurement']}><PharmacyInventoryScreen /></RoleBasedRoute>} />
              <Route path="pharmacy-receiving" element={<RoleBasedRoute allowedRoles={['owner', 'master_admin', 'branch_manager', 'pharmacist', 'warehouse', 'procurement']}><PharmacyReceivingScreen /></RoleBasedRoute>} />
              <Route path="patient-med-history" element={<RoleBasedRoute allowedRoles={['owner', 'master_admin', 'branch_manager', 'pharmacist', 'doctor']}><PatientMedicationHistoryScreen /></RoleBasedRoute>} />
              <Route path="pharmacy-reports" element={<RoleBasedRoute allowedRoles={['owner', 'master_admin', 'branch_manager', 'pharmacist', 'accountant']}><PharmacyReportsScreen /></RoleBasedRoute>} />
              <Route path="work" element={<RoleBasedRoute allowedRoles={[...WORK_OS_ALLOWED_ROLES]}><WorkHomeScreen /></RoleBasedRoute>} />
              <Route path="work/team-spaces" element={<RoleBasedRoute allowedRoles={[...WORK_OS_ALLOWED_ROLES]}><WorkTeamSpacesScreen /></RoleBasedRoute>} />
              <Route path="work/projects" element={<RoleBasedRoute allowedRoles={[...WORK_OS_ALLOWED_ROLES]}><WorkProjectsScreen /></RoleBasedRoute>} />
              <Route path="work/projects/:id" element={<RoleBasedRoute allowedRoles={[...WORK_OS_ALLOWED_ROLES]}><WorkProjectDetailScreen /></RoleBasedRoute>} />
              <Route path="work/docs" element={<RoleBasedRoute allowedRoles={[...WORK_OS_ALLOWED_ROLES]}><WorkDocsScreen /></RoleBasedRoute>} />
              <Route path="work/channels" element={<RoleBasedRoute allowedRoles={[...WORK_OS_ALLOWED_ROLES]}><WorkChannelsScreen /></RoleBasedRoute>} />
              <Route path="work/inbox" element={<RoleBasedRoute allowedRoles={[...WORK_OS_ALLOWED_ROLES]}><WorkInboxScreen /></RoleBasedRoute>} />
              <Route path="work/search" element={<RoleBasedRoute allowedRoles={[...WORK_OS_ALLOWED_ROLES]}><WorkSearchScreen /></RoleBasedRoute>} />
              <Route path="tables" element={<RoleBasedRoute><TableManagementScreen /></RoleBasedRoute>} />
              <Route path="crm" element={<RoleBasedRoute><CRMScreen /></RoleBasedRoute>} />
              <Route path="real-estate" element={<RoleBasedRoute><RealEstateScreen /></RoleBasedRoute>} />
              <Route path="hr" element={<RoleBasedRoute><HRScreen /></RoleBasedRoute>} />
              <Route
                path="commerce"
                element={
                  <RoleBasedRoute>
                    <CommerceShellLayout />
                  </RoleBasedRoute>
                }
              >
                <Route
                  index
                  element={
                    <Suspense fallback={<GlobalLoadingSpinner />}>
                      <CommerceScreen />
                    </Suspense>
                  }
                />
                <Route
                  path="foundation"
                  element={
                    <Suspense fallback={<GlobalLoadingSpinner />}>
                      <CommerceFoundationHubScreen />
                    </Suspense>
                  }
                />
                <Route
                  path="foundation/channels"
                  element={
                    <Suspense fallback={<GlobalLoadingSpinner />}>
                      <CommerceChannelsOpsScreen />
                    </Suspense>
                  }
                />
                <Route
                  path="foundation/contracts"
                  element={
                    <Suspense fallback={<GlobalLoadingSpinner />}>
                      <CommerceContractsScreen />
                    </Suspense>
                  }
                />
                <Route
                  path="foundation/pricing"
                  element={
                    <Suspense fallback={<GlobalLoadingSpinner />}>
                      <CommercePricingScreen />
                    </Suspense>
                  }
                />
              </Route>
              <Route path="accounting" element={<RoleBasedRoute><AccountingScreen /></RoleBasedRoute>} />
              <Route path="cheques" element={<Suspense fallback={<GlobalLoadingSpinner />}><ChequesRoute /></Suspense>} />
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
