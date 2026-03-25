// src/config/permissions.ts
// Definition of all application routes allowed per role

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: ['*', '/procurement', '/payroll', '/work'],
  master_admin: ['*', '/procurement', '/payroll', '/work'],
  sales: ['/dashboard', '/crm', '/pos', '/invoices', '/contacts', '/work'],
  branch_manager: [
    '/dashboard', '/pos', '/restaurant-pos', '/kds', '/menu-management', '/inventory', '/accounting', '/hr',
    '/crm', '/logistics', '/reports', '/settings', '/analytics', '/commerce', '/procurement',
    '/pharmacy-pos', '/prescriptions', '/pharmacy-inventory', '/pharmacy-receiving', '/patient-med-history', '/pharmacy-reports', '/work',
  ],
  cashier: ['/dashboard', '/pos', '/restaurant-pos', '/pharmacy-pos', '/work'],
  kitchen: ['/dashboard', '/kds', '/work'],
  accountant: ['/dashboard', '/accounting', '/reports', '/analytics', '/invoices', '/collection', '/procurement', '/payroll', '/cheques', '/pharmacy-reports', '/work'],
  hr: ['/dashboard', '/hr', '/payroll', '/work'],
  warehouse: ['/dashboard', '/inventory', '/logistics', '/pharmacy-inventory', '/pharmacy-receiving', '/work'],
  procurement: ['/dashboard', '/inventory', '/logistics', '/procurement', '/pharmacy-inventory', '/pharmacy-receiving', '/work'],
  doctor: ['/dashboard', '/pos', '/pharmacy-pos', '/prescriptions', '/patient-med-history', '/work'],
  pharmacist: [
    '/dashboard', '/pos', '/pharmacy-pos', '/prescriptions', '/pharmacy-inventory', '/pharmacy-receiving',
    '/patient-med-history', '/pharmacy-reports', '/work',
  ],
  receptionist: ['/dashboard', '/pos', '/pharmacy-pos', '/prescriptions', '/work'],
  teacher: ['/dashboard', '/work'],
  viewer: ['/dashboard', '/work']
};
