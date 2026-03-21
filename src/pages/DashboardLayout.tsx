"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Package,
  Building2,
  ShoppingCart,
  FileText,
  Users,
  Settings,
  ChevronDown,
  Search,
  Bell,
  LogOut,
  Shield,
  User,
  CreditCard,
  HelpCircle,
  Menu,
  X,
  ChevronRight,
  BarChart3,
  Boxes,
  MessageSquare,
  Truck,
  Target,
  Briefcase,
  Hammer,
  Calendar as CalendarIcon,
  Store,
  ChevronLeft
} from "lucide-react";
import { useAuth, type AppRole } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useNavigate, useLocation } from "react-router-dom";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  badge?: number;
  roles?: AppRole[];
  module?: string;
  children?: { label: string; href: string }[];
}

interface NavGroup {
  group: string;
  roles?: AppRole[];
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    group: "Overview",
    roles: ["owner", "master_admin"],
    items: [
      { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
      { label: "Analytics", icon: BarChart3, href: "/analytics" },
    ],
  },
  {
    group: "Operations",
    items: [
      {
        label: "Inventory",
        icon: Package,
        href: "/inventory",
        badge: 3,
        roles: ["owner", "master_admin", "branch_manager", "warehouse"],
        module: "POS",
        children: [
          { label: "All Products", href: "/inventory/products" },
          { label: "Batch Tracking", href: "/inventory/batches" },
          { label: "Warehouses", href: "/inventory/warehouses" },
        ],
      },
      { label: "Real Estate", icon: Building2, href: "/real-estate", roles: ["owner", "master_admin"], module: "RealEstate" },
      { label: "Point of Sale", icon: ShoppingCart, href: "/pos", roles: ["owner", "master_admin", "branch_manager", "cashier"], module: "POS" },
      { label: "Production", icon: Hammer, href: "/production", roles: ["owner", "master_admin"] },
      { label: "Logistics", icon: Truck, href: "/logistics", roles: ["owner", "master_admin", "warehouse"] },
      { label: "Procurement", icon: Boxes, href: "/procurement", roles: ["owner", "master_admin", "procurement"] },
    ],
  },
  {
    group: "Finance",
    items: [
      { label: "Accounting", icon: CreditCard, href: "/accounting", badge: 1, roles: ["owner", "master_admin", "accountant"], module: "Accounting" },
      { label: "Collection & Dues", icon: Briefcase, href: "/collection", roles: ["owner", "master_admin", "accountant"], module: "Accounting" },
      { label: "Invoices", icon: FileText, href: "/invoices", roles: ["owner", "master_admin", "accountant"], module: "Accounting" },
    ],
  },
  {
    group: "Communications",
    roles: undefined,
    items: [
      { label: "CRM & Leads", icon: Target, href: "/crm", roles: ["owner", "master_admin", "sales"] },
      { label: "Calendar", icon: CalendarIcon, href: "/calendar" },
      { label: "Chat", icon: MessageSquare, href: "/chat" },
    ],
  },
  {
    group: "People",
    roles: ["owner", "master_admin"],
    items: [
      { label: "Contacts", icon: Users, href: "/contacts" },
      { label: "HR & Payroll", icon: Users, href: "/hr", module: "HR" },
    ],
  },
];

// ─────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────

function NawwatLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {/* Icon: nucleus + 3 dots */}
      <div className="relative flex-shrink-0 w-8 h-8 flex items-center justify-center">
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[32px] h-[32px] flex-shrink-0">
          <circle cx="16" cy="16" r="10" fill="rgba(0,229,255,0.07)" />
          <ellipse cx="9.5" cy="8" rx="4" ry="2" fill="rgba(0,229,255,0.2)" transform="rotate(-42 9.5 8)" />
          <ellipse cx="26" cy="14.5" rx="4.5" ry="1.8" fill="rgba(0,229,255,0.16)" transform="rotate(-8 26 14.5)" />
          <ellipse cx="11" cy="25" rx="4" ry="1.8" fill="rgba(0,229,255,0.18)" transform="rotate(30 11 25)" />
          <circle cx="6" cy="6" r="3" fill="#00E5FF" />
          <circle cx="27" cy="14" r="2.5" fill="#00E5FF" opacity="0.85" />
          <circle cx="8" cy="26" r="2.8" fill="#00E5FF" opacity="0.9" />
          <circle cx="16" cy="16" r="7.5" fill="white" />
        </svg>
      </div>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            className="overflow-hidden flex flex-col justify-center"
          >
            <span
              className="text-white font-[800] text-[18px] leading-none tracking-[-0.3px]"
              style={{ fontFamily: "'Nunito', sans-serif" }}
            >
              nawwat
            </span>
            <span
              className="block text-[9px] font-[700] tracking-[0.25em] uppercase"
              style={{ color: "#00E5FF", marginTop: "-1px" }}
            >
              OS
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────
// DROPDOWNS
// ─────────────────────────────────────────────

function NotificationsDropdown({ isOpen }: { isOpen: boolean }) {
  if (!isOpen) return null;
  return (
    <div className="absolute right-0 top-[calc(100%+8px)] w-[312px] bg-white rounded-2xl border border-[#F0F4F8] z-50 overflow-hidden shadow-[0_20px_60px_rgba(10,25,47,0.12)] animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0F4F8]">
        <span className="text-[13.5px] font-semibold text-[#0A192F]">Notifications</span>
        <button className="text-[11.5px] font-semibold text-[#00E5FF] hover:text-cyan-600 transition-colors">Mark all read</button>
      </div>
      <div>
        <div className="flex items-start gap-3 px-4 py-3 bg-[rgba(0,229,255,0.04)] border-b border-[#F9FAFB] cursor-pointer hover:bg-gray-50">
          <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0 bg-[#F59E0B]"></div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-medium text-[#1F2937] leading-snug">3 batches expiring soon</div>
            <div className="text-[11px] text-[#9CA3AF] mt-0.5">2m ago</div>
          </div>
          <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-[#00E5FF]"></div>
        </div>
        <div className="flex items-start gap-3 px-4 py-3 bg-[rgba(0,229,255,0.04)] border-b border-[#F9FAFB] cursor-pointer hover:bg-gray-50">
          <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0 bg-[#EF4444]"></div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-medium text-[#1F2937] leading-snug">Rent overdue — Unit 7B</div>
            <div className="text-[11px] text-[#9CA3AF] mt-0.5">1h ago</div>
          </div>
          <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-[#00E5FF]"></div>
        </div>
      </div>
      <div className="p-2.5 text-center border-t border-[#F0F4F8]">
        <button className="text-[12px] text-[#9CA3AF] font-medium hover:text-[#374151]">View all notifications</button>
      </div>
    </div>
  );
}

function UserDropdown({ isOpen, onLock, onLogout }: { isOpen: boolean, onLock: () => void, onLogout: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="absolute right-0 top-[calc(100%+8px)] w-[220px] bg-white rounded-2xl border border-[#F0F4F8] z-50 overflow-hidden shadow-[0_20px_60px_rgba(10,25,47,0.12)] animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="px-4 py-3.5 border-b border-[#F0F4F8] flex items-center gap-2.5">
        <div className="w-[38px] h-[38px] rounded-full flex items-center justify-center text-[#0A192F] text-[12px] font-[800]" style={{ background: "linear-gradient(135deg,rgba(0,229,255,0.15),rgba(0,229,255,0.3))" }}>
          AH
        </div>
        <div>
          <div className="text-[13px] font-semibold text-[#111]">Ahmed Hassan</div>
          <div className="text-[11px] text-[#9CA3AF] mt-px">ahmed@nawwat.io</div>
        </div>
      </div>
      <div className="py-1.5">
        <button className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-[#F9FAFB] transition-colors text-left group">
          <User size={15} className="text-[#9CA3AF] group-hover:text-[#6B7280]" />
          <span className="text-[13px] text-[#4B5563] group-hover:text-[#111]">Profile</span>
        </button>
        <button className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-[#F9FAFB] transition-colors text-left group">
          <Settings size={15} className="text-[#9CA3AF] group-hover:text-[#6B7280]" />
          <span className="text-[13px] text-[#4B5563] group-hover:text-[#111]">Account Settings</span>
        </button>
      </div>
      <div className="border-t border-[#F0F4F8] py-1">
        <button onClick={onLock} className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-[#F9FAFB] transition-colors text-left group">
          <Shield size={15} className="text-[#9CA3AF] group-hover:text-[#6B7280]" />
          <span className="text-[13px] text-[#4B5563] group-hover:text-[#111]">Lock Session</span>
        </button>
        <button onClick={onLogout} className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-[#FEF2F2] transition-colors text-left group">
          <LogOut size={15} className="text-[#9CA3AF] group-hover:text-[#EF4444]" />
          <span className="text-[13px] text-[#4B5563] group-hover:text-[#EF4444]">Sign out</span>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN LAYOUT
// ─────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const role = user?.role;

  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [allowedModules, setAllowedModules] = useState<string[]>([]);

  useEffect(() => {
    if (!user?.tenant_id) return;
    supabase
      .from("tenants")
      .select("modules")
      .eq("id", user.tenant_id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return;
        const raw = data.modules;
        let parsed: string[] = [];
        try {
          if (typeof raw === "string") parsed = JSON.parse(raw || "[]");
          else if (Array.isArray(raw)) parsed = raw as string[];
        } catch {
          parsed = [];
        }
        setAllowedModules(parsed);
      });
  }, [user?.tenant_id]);

  const currentPath = location.pathname;
  const isFullAccess = role === "owner" || role === "master_admin";

  // Filter Nav
  const filteredNav = NAV.filter((group) => {
    if (isFullAccess) return true;
    if (!role) return false;
    return !group.roles || group.roles.includes(role as AppRole);
  })
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (isFullAccess) return true;
        if (item.roles && !item.roles.includes(role as AppRole)) return false;
        if (allowedModules.length === 0) return true;
        if (item.module && !allowedModules.includes(item.module)) return false;
        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);

  // Click outside handler for dropdowns
  const topbarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (topbarRef.current && !topbarRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
        setUserOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNavigate = (href: string) => {
    navigate(href);
    if (!collapsed && window.innerWidth < 768) {
      setCollapsed(true);
    }
  };

  const handleLock = () => {
    localStorage.setItem("isLocked", "true");
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const routeLabel = (() => {
    for (const group of NAV) {
      for (const item of group.items) {
        if (currentPath === item.href || currentPath.startsWith(item.href + "/")) {
          return item.label;
        }
      }
    }
    return "Dashboard";
  })();

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC] font-['Plus_Jakarta_Sans',sans-serif] text-[#0A192F]">

      {/* ── SIDEBAR ── */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 68 : 240 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex-shrink-0 flex flex-col h-full overflow-hidden bg-[#0A192F] z-40 shadow-xl md:shadow-none"
      >
        {/* Glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(circle at 20% 15%, rgba(0,229,255,0.05) 0%, transparent 55%), radial-gradient(circle at 85% 85%, rgba(0,229,255,0.03) 0%, transparent 55%)"
        }}></div>

        {/* Logo Area */}
        <div className="flex items-center justify-between px-4 pt-[18px] pb-[14px] flex-shrink-0 relative z-10">
          <NawwatLogo collapsed={collapsed} />
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="text-white/30 hover:text-white/70 hover:bg-white/5 p-1.5 rounded-lg transition-all"
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>

        <div className="mx-4 mb-2.5 border-t border-white/5 relative z-10"></div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 pb-3 relative z-10" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          {filteredNav.map((group, gIdx) => (
            <div key={group.group} className="mb-4.5">
              {!collapsed && (
                <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-white/20 px-2 mb-1 truncate transition-opacity duration-150">
                  {group.group}
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const isActive = currentPath === item.href || currentPath.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.href}
                      onClick={() => handleNavigate(item.href)}
                      title={collapsed ? item.label : undefined}
                      className={`
                        w-full flex items-center justify-start gap-2.5 px-2.5 py-2.5 flex-shrink-0
                        rounded-xl transition-all duration-150 relative text-left group
                        ${isActive ? "text-white bg-white/10" : "text-white/40 hover:text-white/80 hover:bg-white/5"}
                      `}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="sidebarActiveIndicator"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[#00E5FF]"
                        />
                      )}
                      <div className="w-[18px] h-[18px] flex-shrink-0 flex items-center justify-center">
                        <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} className={isActive ? "text-[#00E5FF]" : ""} />
                      </div>

                      {!collapsed && (
                        <motion.div
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                          className="flex-1 flex items-center justify-between min-w-0"
                        >
                          <span className="text-[13.5px] font-medium truncate">{item.label}</span>
                          {item.badge && (
                            <span className="text-[10px] font-bold px-1.5 py-[1px] rounded-full bg-[#00E5FF] text-[#0A192F] leading-[1.4] flex-shrink-0">
                              {item.badge}
                            </span>
                          )}
                        </motion.div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom Nav */}
        <div className="mt-auto px-2.5 pt-2.5 pb-3 border-t border-white/5 flex-shrink-0 relative z-10">
          <button
            onClick={() => handleNavigate("/settings")}
            title={collapsed ? "Settings" : undefined}
            className={`
              w-full flex items-center justify-start gap-2.5 px-2.5 py-2.5 flex-shrink-0
              rounded-xl transition-all duration-150 relative text-left group
              ${currentPath === "/settings" ? "text-white bg-white/10" : "text-white/40 hover:text-white/80 hover:bg-white/5"}
            `}
          >
            {currentPath === "/settings" && (
              <motion.div
                layoutId="sidebarActiveIndicator"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[#00E5FF]"
              />
            )}
            <div className="w-[18px] h-[18px] flex-shrink-0 flex items-center justify-center">
              <Settings size={18} strokeWidth={currentPath === "/settings" ? 2.2 : 1.8} className={currentPath === "/settings" ? "text-[#00E5FF]" : ""} />
            </div>
            {!collapsed && <span className="text-[13.5px] font-medium truncate">Settings</span>}
          </button>

          {collapsed && (
            <button onClick={() => setCollapsed(false)} className="w-full flex items-center justify-center p-2 rounded-xl text-white/30 hover:text-white/60 hover:bg-white/5 transition-all mt-1">
              <Menu size={16} />
            </button>
          )}

          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 p-2.5 rounded-xl bg-white/5 flex items-center gap-2.5 border border-white/5 cursor-pointer hover:bg-white/10 transition-colors" onClick={() => setUserOpen(!userOpen)}>
                  <div className="w-8 h-8 rounded-full bg-[#00E5FF] text-[#0A192F] text-[11px] font-[800] flex items-center justify-center flex-shrink-0 uppercase">
                    {role ? role.substring(0, 2) : "US"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-semibold text-white truncate leading-tight">Ahmed Hassan</div>
                    <div className="text-[11px] text-white/40 truncate">{role || "Guest"}</div>
                  </div>
                  <ChevronDown size={14} className="text-white/30" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.aside>

      {/* ── MAIN COLUMN ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">

        {/* TOPBAR */}
        <header ref={topbarRef} className="h-[64px] bg-white flex items-center px-6 gap-4 border-b border-[#F0F4F8] flex-shrink-0 relative z-30" style={{ boxShadow: "0 1px 0 rgba(10,25,47,0.04)" }}>

          {/* Mobile hamburger */}
          {collapsed && (
            <button onClick={() => setCollapsed(false)} className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-[#F4F7FA] transition-colors">
              <Menu size={18} />
            </button>
          )}

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mr-auto">
            <span className="text-[13px] text-[#9CA8BB] font-medium hidden sm:inline">Nawwat OS</span>
            <ChevronRight size={12} className="text-[#DDE2EC] hidden sm:inline" />
            <span className="text-[14px] font-bold text-[#0A192F]">{routeLabel}</span>
          </div>

          {/* Search */}
          <div
            className={`hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all duration-200 ${searchFocused ? "bg-white ring-2 ring-[#00E5FF]/30 w-[260px]" : "bg-[#F4F7FA] w-[220px]"}`}
            style={searchFocused ? { boxShadow: "0 0 0 2px rgba(0,229,255,0.25)" } : {}}
          >
            <Search size={14} className={searchFocused ? "text-[#00E5FF]" : "text-[#9CA3AF]"} />
            <input
              type="text"
              placeholder="Search anything…"
              className="flex-1 bg-transparent border-none outline-none text-[13px] text-[#374151] placeholder:text-[#9CA3AF] min-w-0"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            {searchFocused && <span className="text-[10px] text-[#C4C9D4] bg-[#EEF1F5] px-1.5 py-0.5 rounded-[5px] font-mono leading-none">⌘K</span>}
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => { setNotifOpen(!notifOpen); setUserOpen(false); }}
              className="p-2 rounded-xl text-[#6B7280] hover:bg-[#F4F7FA] hover:text-[#374151] transition-colors relative"
            >
              <Bell size={18} strokeWidth={1.8} />
              <div className="absolute top-[7px] right-[7px] w-[7px] h-[7px] bg-[#00E5FF] rounded-full ring-[1.5px] ring-white" />
            </button>
            <NotificationsDropdown isOpen={notifOpen} />
          </div>

          {/* User Profile */}
          <div className="relative hidden md:block">
            <button
              onClick={() => { setUserOpen(!userOpen); setNotifOpen(false); }}
              className="flex items-center gap-2.5 pl-1 pr-2.5 py-1 rounded-xl hover:bg-[#F4F7FA] transition-colors group"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#CCF7FF] to-[#80EEFF] text-[#0A192F] text-[11px] font-[800] flex items-center justify-center">
                {role ? role.substring(0, 2) : "AH"}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-[12.5px] font-bold text-[#0A192F] leading-[1.1]">Ahmed</div>
                <div className="text-[10.5px] text-[#9CA3AF]">{role || "Admin"}</div>
              </div>
              <ChevronDown size={13} className={`text-[#C4C9D4] transition-transform duration-200 ${userOpen ? "rotate-180" : ""}`} />
            </button>
            <UserDropdown isOpen={userOpen} onLock={handleLock} onLogout={handleLogout} />
          </div>

        </header>

        {/* PAGE CONTENT */}
        <main className="flex-1 overflow-y-auto w-full relative bg-[#F8FAFC]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPath}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="w-full h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

      </div>
    </div>
  );
}
