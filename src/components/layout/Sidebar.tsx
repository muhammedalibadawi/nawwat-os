import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAppContext } from '../../store/AppContext';
import { useAuth } from '../../context/AuthContext';
import { ROLE_PERMISSIONS } from '../../config/permissions';
import { LayoutDashboard, BarChart2, MonitorSmartphone, Users, Settings, MessageSquare, FileText, Network, Calculator, Truck, Briefcase, LogOut, Lock, Package, ShoppingCart, DollarSign, ExternalLink, ChefHat, ClipboardList, Pill, Clipboard, Boxes, PackagePlus, HeartPulse, LineChart, Layers3, FolderKanban, ScrollText, BellRing, Search } from 'lucide-react';

export const Sidebar: React.FC<{ forceExpanded?: boolean; onNavigate?: () => void }> = ({ forceExpanded = false, onNavigate }) => {
    const { sidebarMini } = useAppContext();
    const location = useLocation();
    const { user, signOut } = useAuth();
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
        main: true,
        coreOps: true,
        restaurants: true,
        pharmacy: true,
        contactsCrm: true,
        commerce: true,
        work: true,
        admin: true,
    });

    const isActive = (path: string) => location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(path));

    const isMini = forceExpanded ? false : sidebarMini;

    const navItemClass = (active = false) =>
        `flex items-center gap-2.5 px-3 py-2 mx-2 my-px rounded-[10px] cursor-pointer text-white/40 text-[0.82rem] font-semibold whitespace-nowrap transition-all duration-250 ease-spring select-none relative hover:bg-white/5 hover:text-white/75 ${active ? 'bg-cyan-dim !text-cyan' : ''
        } ${isMini ? 'justify-center !px-0 py-2.5 mx-2' : ''}`;

    const role: string = user?.role || 'viewer';
    const hasAccess = (path: string) => {
        const allowed = ROLE_PERMISSIONS[role] || ['/dashboard'];
        const baseRoute = '/' + path.split('/')[1];
        return allowed.includes('*') || allowed.includes(baseRoute);
    };
    const hasGroupAccess = (paths: string[]) => paths.some((path) => hasAccess(path));

    const NavItem = ({ to, title, icon: Icon, children, badge }: { to: string; title: string; icon: React.ElementType; children: React.ReactNode; badge?: React.ReactNode }) => {
        if (!hasAccess(to)) return null;

        return (
            <NavLink to={to} onClick={onNavigate} className={navItemClass(isActive(to))} title={title}>
                <Icon size={18} className="shrink-0 opacity-55 transition-opacity group-hover:opacity-85" />
                <span className={`flex-1 overflow-hidden transition-all duration-400 ${isMini ? 'opacity-0 max-w-0' : 'max-w-[160px]'}`}>
                    {children}
                </span>
                {badge}
            </NavLink>
        );
    };

    const GroupHeader = ({ groupKey, title }: { groupKey: string; title: string }) => (
        <button
            type="button"
            onClick={() => setOpenGroups((current) => ({ ...current, [groupKey]: !current[groupKey] }))}
            className={`w-full px-3 pb-1.5 pt-5 text-start text-[0.68rem] font-extrabold uppercase tracking-widest text-white/30 ${
                isMini ? 'hidden' : ''
            }`}
        >
            <span className="inline-flex w-full items-center justify-between">
                <span>{title}</span>
                <span className="text-[0.7rem] text-white/40">{openGroups[groupKey] ? '−' : '+'}</span>
            </span>
        </button>
    );

    const GroupContent = ({ groupKey, children }: { groupKey: string; children: React.ReactNode }) => {
        if (isMini || openGroups[groupKey]) return <>{children}</>;
        return null;
    };

    return (
        <nav
            className={`bg-midnight font-arabic flex flex-col overflow-hidden transition-all duration-400 ease-spring shrink-0 relative z-50 ${isMini ? 'w-[var(--sidebar-mini)]' : 'w-[var(--sidebar-w)]'
                }`}
        >
            <div className="flex-1 overflow-y-auto overflow-x-hidden py-1.5 scrollbar-hide">
                {hasGroupAccess(['/dashboard', '/analytics', '/reports', '/chat']) && (
                    <>
                        <GroupHeader groupKey="main" title="Main" />
                        <GroupContent groupKey="main">
                            <NavItem to="/dashboard" title="لوحة التحكم" icon={LayoutDashboard}>
                                لوحة التحكم
                            </NavItem>
                            <NavItem to="/analytics" title="التحليلات" icon={BarChart2}>
                                التحليلات
                            </NavItem>
                            <NavItem to="/reports" title="التقارير" icon={FileText}>
                                التقارير
                            </NavItem>
                            <NavItem to="/chat" title="المحادثات" icon={MessageSquare}>
                                المحادثات
                            </NavItem>
                        </GroupContent>
                    </>
                )}

                {hasGroupAccess(['/restaurant-pos', '/kds', '/menu-management', '/tables']) && (
                    <>
                        <GroupHeader groupKey="restaurants" title="Restaurants" />
                        <GroupContent groupKey="restaurants">
                            <NavItem to="/restaurant-pos" title="POS المطاعم" icon={ChefHat} badge={!isMini ? <span className="px-1.5 py-0.5 rounded-full text-[0.62rem] font-extrabold shrink-0 bg-cyan text-midnight">F&B</span> : undefined}>
                                POS المطاعم
                            </NavItem>
                            <NavItem to="/kds" title="شاشة المطبخ" icon={ClipboardList}>
                                شاشة المطبخ
                            </NavItem>
                            <NavItem to="/menu-management" title="إدارة القائمة" icon={FileText}>
                                إدارة القائمة
                            </NavItem>
                            <NavItem to="/tables" title="إدارة الطاولات" icon={LayoutDashboard}>
                                إدارة الطاولات
                            </NavItem>
                        </GroupContent>
                    </>
                )}

                {hasGroupAccess(['/pharmacy-pos', '/prescriptions', '/pharmacy-inventory', '/pharmacy-receiving', '/patient-med-history', '/pharmacy-reports']) && (
                    <>
                        <GroupHeader groupKey="pharmacy" title="Pharmacy" />
                        <GroupContent groupKey="pharmacy">
                            <NavItem to="/pharmacy-pos" title="صيدلية — نقطة البيع" icon={Pill} badge={!isMini ? <span className="px-1.5 py-0.5 rounded-full text-[0.62rem] font-extrabold shrink-0 bg-emerald-400/90 text-midnight">Rx</span> : undefined}>
                                صيدلية POS
                            </NavItem>
                            <NavItem to="/prescriptions" title="الوصفات الطبية" icon={Clipboard}>
                                الوصفات
                            </NavItem>
                            <NavItem to="/pharmacy-inventory" title="مخزون الصيدلية" icon={Boxes}>
                                مخزون الصيدلية
                            </NavItem>
                            <NavItem to="/pharmacy-receiving" title="استلام صيدلية" icon={PackagePlus}>
                                استلام صيدلية
                            </NavItem>
                            <NavItem to="/patient-med-history" title="سجل أدوية المريض" icon={HeartPulse}>
                                سجل أدوية المريض
                            </NavItem>
                            <NavItem to="/pharmacy-reports" title="تقارير الصيدلية" icon={LineChart}>
                                تقارير الصيدلية
                            </NavItem>
                        </GroupContent>
                    </>
                )}

                {hasGroupAccess(['/contacts', '/crm']) && (
                    <>
                        <GroupHeader groupKey="contactsCrm" title="Contacts & CRM" />
                        <GroupContent groupKey="contactsCrm">
                            <NavItem to="/contacts" title="جهات الاتصال" icon={Users}>
                                جهات الاتصال
                            </NavItem>
                            <NavItem to="/crm" title="إدارة العملاء" icon={Users}>
                                إدارة العملاء
                            </NavItem>
                        </GroupContent>
                    </>
                )}

                {hasGroupAccess(['/commerce', '/commerce/foundation/contracts', '/commerce/foundation/pricing']) && (
                    <>
                        <GroupHeader groupKey="commerce" title="Commerce & Contracts" />
                        <GroupContent groupKey="commerce">
                            <NavItem to="/commerce" title="CommerceOS — طبقة إيراد القنوات" icon={Network}>
                                CommerceOS
                            </NavItem>
                            <NavItem to="/commerce/foundation/contracts" title="عقود القنوات" icon={FileText}>
                                عقود القنوات
                            </NavItem>
                            <NavItem to="/commerce/foundation/pricing" title="محاكاة التسعير" icon={LineChart}>
                                Pricing Preview
                            </NavItem>
                        </GroupContent>
                    </>
                )}

                {hasGroupAccess(['/work']) && (
                    <>
                        <GroupHeader groupKey="work" title="Work" />
                        <GroupContent groupKey="work">
                            <NavItem to="/work" title="Work OS — الرئيسية" icon={Layers3}>
                                الرئيسية
                            </NavItem>
                            <NavItem to="/work/team-spaces" title="مساحات الفرق" icon={Users}>
                                مساحات الفرق
                            </NavItem>
                            <NavItem to="/work/projects" title="المشاريع" icon={FolderKanban}>
                                المشاريع
                            </NavItem>
                            <NavItem to="/work/docs" title="المستندات" icon={ScrollText}>
                                المستندات
                            </NavItem>
                            <NavItem to="/work/channels" title="القنوات" icon={MessageSquare}>
                                القنوات
                            </NavItem>
                            <NavItem to="/work/inbox" title="البريد الداخلي" icon={BellRing}>
                                البريد الداخلي
                            </NavItem>
                            <NavItem to="/work/search" title="البحث" icon={Search}>
                                البحث
                            </NavItem>
                        </GroupContent>
                    </>
                )}

                {hasGroupAccess(['/admin-portal', '/settings']) && (
                    <>
                        <GroupHeader groupKey="admin" title="Admin" />
                        <GroupContent groupKey="admin">
                            {role === 'master_admin' && (
                                <NavItem to="/admin-portal" title="بوابة الإدارة" icon={Settings}>
                                    بوابة الإدارة
                                </NavItem>
                            )}
                            <NavItem to="/settings" title="الإعدادات" icon={Settings}>
                                الإعدادات
                            </NavItem>
                        </GroupContent>
                    </>
                )}

                {hasGroupAccess(['/pos', '/inventory', '/procurement', '/hr', '/payroll', '/accounting', '/cheques', '/logistics']) && (
                    <>
                        <GroupHeader groupKey="coreOps" title="Core Ops" />
                        <GroupContent groupKey="coreOps">
                            <NavItem to="/pos" title="POS العام" icon={MonitorSmartphone} badge={!isMini ? <span className="px-1.5 py-0.5 rounded-full text-[0.62rem] font-extrabold shrink-0 bg-cyan text-midnight">ERP</span> : undefined}>
                                POS العام
                            </NavItem>
                            <NavItem to="/inventory" title="المخزون" icon={Package}>
                                المخزون
                            </NavItem>
                            <NavItem to="/procurement" title="المشتريات" icon={ShoppingCart}>
                                المشتريات
                            </NavItem>
                            <NavItem to="/hr" title="الموارد البشرية" icon={Briefcase}>
                                الموارد البشرية
                            </NavItem>
                            <NavItem to="/payroll" title="الرواتب" icon={DollarSign}>
                                الرواتب
                            </NavItem>
                            <NavItem to="/accounting" title="المحاسبة" icon={Calculator}>
                                المحاسبة
                            </NavItem>
                            <NavItem to="/cheques" title="الشيكات" icon={FileText}>
                                الشيكات
                            </NavItem>
                            <NavItem to="/logistics" title="الشحن والتوصيل" icon={Truck}>
                                الشحن والتوصيل
                            </NavItem>
                        </GroupContent>
                    </>
                )}

            </div>

            {/* Footer / Settings */}
            <div className={`shrink-0 border-t border-white/5 p-2 ${isMini ? 'p-2' : ''}`}>
                <a
                    href="/employee-portal"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${navItemClass(false)} no-underline`}
                    title="بوابة الموظف"
                >
                    <ExternalLink size={18} className="shrink-0 opacity-55" />
                    <span className={`flex-1 overflow-hidden transition-all duration-400 ${isMini ? 'opacity-0 max-w-0' : 'max-w-[160px]'}`}>
                        بوابة الموظف ↗
                    </span>
                </a>
                <a
                    href="/register"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${navItemClass(false)} no-underline`}
                    title="التسجيل"
                >
                    <ExternalLink size={18} className="shrink-0 opacity-55" />
                    <span className={`flex-1 overflow-hidden transition-all duration-400 ${isMini ? 'opacity-0 max-w-0' : 'max-w-[160px]'}`}>
                        التسجيل ↗
                    </span>
                </a>
                <a
                    href="/supplier-portal"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${navItemClass(false)} no-underline`}
                    title="بوابة المورد"
                >
                    <ExternalLink size={18} className="shrink-0 opacity-55" />
                    <span className={`flex-1 overflow-hidden transition-all duration-400 ${isMini ? 'opacity-0 max-w-0' : 'max-w-[160px]'}`}>
                        بوابة المورد ↗
                    </span>
                </a>

                {/* User Card */}
                <div className="flex items-center justify-between gap-1 p-2 mt-1 rounded-[10px] transition-colors hover:bg-white/5 group">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="w-8 h-8 bg-gradient-to-br from-cyan-dim to-[#071C3B] rounded-lg flex items-center justify-center font-nunito font-extrabold text-[0.72rem] text-white shrink-0 relative shadow-sm border border-cyan/30">
                            {user?.full_name?.substring(0, 2).toUpperCase() || 'AH'}
                            <div className="absolute -bottom-px -end-px w-2 h-2 bg-success rounded-full border-2 border-midnight" />
                        </div>
                        <div className={`overflow-hidden transition-all duration-400 ${isMini ? 'opacity-0 max-w-0' : 'max-w-[160px]'}`}>
                            <div className="text-[0.8rem] font-bold text-white whitespace-nowrap">{user?.full_name || 'Admin User'}</div>
                            <div className="text-[0.68rem] text-white/30 whitespace-nowrap mt-px uppercase tracking-wider">{user?.role || 'owner'}</div>
                        </div>
                    </div>
                    {/* Logout Button */}
                    {!isMini && (
                        <div className="ms-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                            <button
                                onClick={() => {
                                    localStorage.setItem('isLocked', 'true');
                                    window.dispatchEvent(new Event('nawwat:lock-screen'));
                                }}
                                className="text-white/40 hover:text-cyan hover:bg-cyan/10 p-2 rounded-lg transition-colors cursor-pointer border-none bg-transparent"
                                title="قفل الشاشة"
                            >
                                <Lock size={16} />
                            </button>
                            <button 
                                onClick={() => signOut()}
                                className="text-white/40 hover:text-danger hover:bg-danger/10 p-2 rounded-lg transition-colors cursor-pointer border-none bg-transparent"
                                title="تسجيل الخروج"
                            >
                                <LogOut size={16} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
};
