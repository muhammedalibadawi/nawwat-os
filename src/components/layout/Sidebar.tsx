import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAppContext } from '../../store/AppContext';
import { useAuth } from '../../context/AuthContext';
import { ROLE_PERMISSIONS } from '../../config/permissions';
import { LayoutDashboard, BarChart2, MonitorSmartphone, Users, Settings, MessageSquare, FileText, Network, Calculator, Truck, Briefcase, LogOut, Lock, Package } from 'lucide-react';

export const Sidebar: React.FC = () => {
    const { sidebarMini } = useAppContext();
    const location = useLocation();
    const { user, signOut } = useAuth();

    const isActive = (path: string) => location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(path));

    const navItemClass = (active = false) =>
        `flex items-center gap-2.5 px-3 py-2 mx-2 my-px rounded-[10px] cursor-pointer text-white/40 text-[0.82rem] font-semibold whitespace-nowrap transition-all duration-250 ease-spring select-none relative hover:bg-white/5 hover:text-white/75 ${active ? 'bg-cyan-dim !text-cyan' : ''
        } ${sidebarMini ? 'justify-center !px-0 py-2.5 mx-2' : ''}`;

    const role: string = user?.role || 'viewer';
    const hasAccess = (path: string) => {
        const allowed = ROLE_PERMISSIONS[role] || ['/dashboard'];
        const baseRoute = '/' + path.split('/')[1];
        return allowed.includes('*') || allowed.includes(baseRoute);
    };

    const NavItem = ({ to, title, icon: Icon, children, badge }: { to: string; title: string; icon: React.ElementType; children: React.ReactNode; badge?: React.ReactNode }) => {
        if (!hasAccess(to)) return null;

        return (
            <NavLink to={to} className={navItemClass(isActive(to))} title={title}>
                <Icon size={18} className="shrink-0 opacity-55 transition-opacity group-hover:opacity-85" />
                <span className={`flex-1 overflow-hidden transition-all duration-400 ${sidebarMini ? 'opacity-0 max-w-0' : 'max-w-[160px]'}`}>
                    {children}
                </span>
                {badge}
            </NavLink>
        );
    };

    return (
        <nav
            className={`bg-midnight font-arabic flex flex-col overflow-hidden transition-all duration-400 ease-spring shrink-0 relative z-50 ${sidebarMini ? 'w-[var(--sidebar-mini)]' : 'w-[var(--sidebar-w)]'
                }`}
        >
            <div className="flex-1 overflow-y-auto overflow-x-hidden py-1.5 scrollbar-hide">

                {/* Main Section */}
                <div className={`px-3 py-5 pb-1.5 text-[0.6rem] font-extrabold tracking-widest uppercase text-white/20 whitespace-nowrap overflow-hidden transition-opacity duration-400 shrink-0 ${sidebarMini ? 'opacity-0 pointer-events-none' : ''}`}>
                    Main
                </div>

                <NavItem to="/dashboard" title="Dashboard" icon={LayoutDashboard}>
                    Dashboard
                </NavItem>
                <NavItem to="/analytics" title="Analytics" icon={BarChart2}>
                    Analytics
                </NavItem>

                {/* Operations Section */}
                <div className={`px-3 py-5 pb-1.5 text-[0.6rem] font-extrabold tracking-widest uppercase text-white/20 whitespace-nowrap overflow-hidden transition-opacity duration-400 shrink-0 mt-2 ${sidebarMini ? 'opacity-0 pointer-events-none' : ''}`}>
                    Operations
                </div>

                <NavItem to="/pos" title="Point of Sale" icon={MonitorSmartphone} badge={!sidebarMini ? <span className="px-1.5 py-0.5 rounded-full text-[0.62rem] font-extrabold shrink-0 bg-cyan text-midnight">Live</span> : undefined}>
                    Point of Sale
                </NavItem>
                <NavItem to="/inventory" title="Inventory" icon={Package}>
                    Inventory
                </NavItem>
                <NavItem to="/crm" title="CRM" icon={Users}>
                    CRM
                </NavItem>
                <NavItem to="/hr" title="HR" icon={Briefcase}>
                    Human Resources
                </NavItem>
                <NavItem to="/accounting" title="Accounting (GL)" icon={Calculator}>
                    Accounting & GL
                </NavItem>
                <NavItem to="/logistics" title="Logistics & Delivery" icon={Truck}>
                    Logistics & Delivery
                </NavItem>
                <NavItem to="/commerce" title="Commerce Integration" icon={Network}>
                    Commerce
                </NavItem>

                {/* Communications */}
                <div className={`px-3 py-5 pb-1.5 text-[0.6rem] font-extrabold tracking-widest uppercase text-white/20 whitespace-nowrap overflow-hidden transition-opacity duration-400 shrink-0 mt-2 ${sidebarMini ? 'opacity-0 pointer-events-none' : ''}`}>
                    Communications
                </div>
                <NavItem to="/chat" title="Chat" icon={MessageSquare}>
                    Chat
                </NavItem>
                <NavItem to="/reports" title="Reports" icon={FileText}>
                    Reports
                </NavItem>

                <NavItem to="/admin-portal" title="Admin Portal" icon={Settings}>
                    Admin Portal
                </NavItem>

            </div>

            {/* Footer / Settings */}
            <div className={`shrink-0 border-t border-white/5 p-2 ${sidebarMini ? 'p-2' : ''}`}>
                <NavItem to="/settings" title="Settings" icon={Settings}>
                    Settings
                </NavItem>

                {/* User Card */}
                <div className="flex items-center justify-between gap-1 p-2 mt-1 rounded-[10px] transition-colors hover:bg-white/5 group">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="w-8 h-8 bg-gradient-to-br from-cyan-dim to-[#071C3B] rounded-lg flex items-center justify-center font-nunito font-extrabold text-[0.72rem] text-white shrink-0 relative shadow-sm border border-cyan/30">
                            {user?.full_name?.substring(0, 2).toUpperCase() || 'AH'}
                            <div className="absolute -bottom-px -end-px w-2 h-2 bg-success rounded-full border-2 border-midnight" />
                        </div>
                        <div className={`overflow-hidden transition-all duration-400 ${sidebarMini ? 'opacity-0 max-w-0' : 'max-w-[160px]'}`}>
                            <div className="text-[0.8rem] font-bold text-white whitespace-nowrap">{user?.full_name || 'Admin User'}</div>
                            <div className="text-[0.68rem] text-white/30 whitespace-nowrap mt-px uppercase tracking-wider">{user?.role || 'owner'}</div>
                        </div>
                    </div>
                    {/* Logout Button */}
                    {!sidebarMini && (
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
