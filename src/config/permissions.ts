// src/config/permissions.ts
// Definition of all application routes allowed per role

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: ['*', '/admin-portal', '/procurement', '/payroll'],
  master_admin: ['*', '/procurement', '/payroll'],
  sales: ['/dashboard', '/crm', '/pos', '/invoices', '/contacts'],
  branch_manager: [
    '/dashboard', '/pos', '/inventory', '/accounting', '/hr',
    '/crm', '/logistics', '/reports', '/settings', '/analytics', '/commerce', '/procurement'
  ],
  cashier: ['/dashboard', '/pos'],
  kitchen: ['/dashboard'],
  accountant: ['/dashboard', '/accounting', '/reports', '/analytics', '/invoices', '/collection', '/procurement', '/payroll'],
  hr: ['/dashboard', '/hr', '/payroll'],
  warehouse: ['/dashboard', '/inventory', '/logistics'],
  procurement: ['/dashboard', '/inventory', '/logistics', '/procurement'],
  doctor: ['/dashboard', '/pos'],
  pharmacist: ['/dashboard', '/pos'],
  receptionist: ['/dashboard', '/pos'],
  teacher: ['/dashboard'],
  viewer: ['/dashboard']
};
