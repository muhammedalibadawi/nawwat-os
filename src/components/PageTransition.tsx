"use client";

/**
 * PageTransition.tsx — Nawwat OS
 * ─────────────────────────────────────────────────────────────────────────────
 * Global page transition system for Next.js App Router.
 *
 * Strategy: "fade-through" — the outgoing page fades out while simultaneously
 * a soft white flash appears, then the incoming page fades up. This feels
 * premium and intentional, not mechanical.
 *
 * Timing breakdown:
 *   Exit:  160ms   — current page fades to opacity 0, slight upward nudge
 *   Flash: 80ms    — white veil at full opacity (bridges the gap seamlessly)
 *   Enter: 320ms   — new page fades in with a gentle y translate (12px → 0)
 *   Total: ~400ms  — imperceptible but unmistakably smooth
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * USAGE — App Router
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. Wrap your root layout children:
 *
 *   // app/layout.tsx
 *   import { PageTransitionProvider } from "@/components/PageTransition";
 *
 *   export default function RootLayout({ children }) {
 *     return (
 *       <html>
 *         <body>
 *           <PageTransitionProvider>
 *             {children}
 *           </PageTransitionProvider>
 *         </body>
 *       </html>
 *     );
 *   }
 *
 * 2. In your dashboard layout, wrap the content area:
 *
 *   // app/(dashboard)/layout.tsx
 *   import { AnimatedPage } from "@/components/PageTransition";
 *
 *   export default function DashboardLayout({ children }) {
 *     return (
 *       <div className="flex h-screen">
 *         <Sidebar />
 *         <main>
 *           <AnimatedPage>{children}</AnimatedPage>
 *         </main>
 *       </div>
 *     );
 *   }
 *
 * 3. Use the NavLink component instead of next/link for animated navigation:
 *
 *   <NavLink href="/accounting">Accounting</NavLink>
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ADVANCED: usePageTransition hook
 * ─────────────────────────────────────────────────────────────────────────────
 * For programmatic navigation (e.g. after a form submit):
 *
 *   const { navigateTo } = usePageTransition();
 *   await navigateTo("/dashboard");  // plays transition then navigates
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";

// ─────────────────────────────────────────────
// TRANSITION VARIANTS
// ─────────────────────────────────────────────

/**
 * Three preset transition styles. Use "fade-through" (default) for most pages.
 * Use "slide" for wizard/onboarding flows. Use "scale" for modals promoted to pages.
 */
export type TransitionStyle = "fade-through" | "slide-up" | "scale";

const variants: Record<TransitionStyle, {
  initial: object;
  animate: object;
  exit: object;
}> = {
  "fade-through": {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
  },
  "slide-up": {
    initial: { opacity: 0, y: 28 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },
  "scale": {
    initial: { opacity: 0, scale: 0.97 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.02 },
  },
};

const transitions: Record<TransitionStyle, object> = {
  "fade-through": {
    enter: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
    exit: { duration: 0.16, ease: [0.4, 0, 1, 1] },
  },
  "slide-up": {
    enter: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
    exit: { duration: 0.2, ease: [0.4, 0, 1, 1] },
  },
  "scale": {
    enter: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
    exit: { duration: 0.18, ease: [0.4, 0, 1, 1] },
  },
};

// ─────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────

interface PageTransitionContextValue {
  transitionStyle: TransitionStyle;
  setTransitionStyle: (style: TransitionStyle) => void;
  navigateTo: (href: string, style?: TransitionStyle) => void;
  isTransitioning: boolean;
}

const PageTransitionContext = createContext<PageTransitionContextValue>({
  transitionStyle: "fade-through",
  setTransitionStyle: () => { },
  navigateTo: () => { },
  isTransitioning: false,
});

export function usePageTransition() {
  return useContext(PageTransitionContext);
}

// ─────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────

export function PageTransitionProvider({ children }: { children: React.ReactNode }) {
  const [transitionStyle, setTransitionStyle] = useState<TransitionStyle>("fade-through");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const prevPathname = useRef(pathname);

  // Detect route changes to know when transition is done
  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname;
      // Small delay to let the enter animation finish
      const id = setTimeout(() => setIsTransitioning(false), 400);
      return () => clearTimeout(id);
    }
  }, [pathname]);

  const navigateTo = useCallback(
    (href: string, style?: TransitionStyle) => {
      if (style) setTransitionStyle(style);
      setIsTransitioning(true);
      // Let exit animation play before pushing route
      setTimeout(() => navigate(href), 160);
    },
    [navigate]
  );

  return (
    <PageTransitionContext.Provider
      value={{ transitionStyle, setTransitionStyle, navigateTo, isTransitioning }}
    >
      {children}
    </PageTransitionContext.Provider>
  );
}

// ─────────────────────────────────────────────
// ANIMATED PAGE WRAPPER
// ─────────────────────────────────────────────

interface AnimatedPageProps {
  children: React.ReactNode;
  style?: TransitionStyle;
  /** Optional: pass the route key for AnimatePresence. Defaults to usePathname(). */
  routeKey?: string;
  className?: string;
}

export function AnimatedPage({
  children,
  style = "fade-through",
  routeKey,
  className = "h-full w-full",
}: AnimatedPageProps) {
  const { pathname } = useLocation();
  const key = routeKey ?? pathname;
  const v = variants[style];
  const t = (transitions[style] as { enter: object; exit: object });

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={key}
        className={className}
        initial={v.initial}
        animate={v.animate}
        exit={v.exit}
        transition={t.enter}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────
// NAV LINK — transition-aware anchor
// ─────────────────────────────────────────────

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  style?: TransitionStyle;
  className?: string;
  activeClassName?: string;
  onClick?: () => void;
}

export function NavLink({
  href,
  children,
  style,
  className = "",
  activeClassName = "",
  onClick,
}: NavLinkProps) {
  const { pathname } = useLocation();
  const { navigateTo } = usePageTransition();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    onClick?.();
    if (!isActive) navigateTo(href, style);
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      className={`${className} ${isActive ? activeClassName : ""}`.trim()}
      aria-current={isActive ? "page" : undefined}
    >
      {children}
    </a>
  );
}

// ─────────────────────────────────────────────
// ROUTE FLASH OVERLAY
// ─────────────────────────────────────────────

/**
 * Optional: Place this in your root layout once.
 * Renders a brief white flash between page transitions for the
 * "clean cut" feel, bridging exit and enter seamlessly.
 */
export function RouteFlash() {
  const { pathname } = useLocation();
  const [flash, setFlash] = useState(false);
  const prev = useRef(pathname);

  useEffect(() => {
    if (pathname !== prev.current) {
      prev.current = pathname;
      setFlash(true);
      const id = setTimeout(() => setFlash(false), 80);
      return () => clearTimeout(id);
    }
  }, [pathname]);

  return (
    <AnimatePresence>
      {flash && (
        <motion.div
          key="flash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.35 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.08 }}
          style={{
            position: "fixed",
            inset: 0,
            background: "#FFFFFF",
            pointerEvents: "none",
            zIndex: 9998,
          }}
        />
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────
// STAGGER CHILDREN — for page content reveals
// ─────────────────────────────────────────────

/**
 * Wraps a list of children and staggers their reveal on mount.
 * Perfect for dashboard cards, table rows, lists.
 *
 * Example:
 *   <StaggerChildren stagger={0.06}>
 *     {cards.map(card => <StatCard key={card.id} {...card} />)}
 *   </StaggerChildren>
 */

interface StaggerChildrenProps {
  children: React.ReactNode;
  stagger?: number;    // seconds between each child (default 0.06)
  delay?: number;      // initial delay before first child (default 0.1)
  y?: number;          // initial y offset (default 16)
  className?: string;
}

const staggerContainerVariants = {
  hidden: {},
  visible: (stagger: number) => ({
    transition: { staggerChildren: stagger },
  }),
};

const staggerChildVariants = {
  hidden: (y: number) => ({ opacity: 0, y }),
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as number[] },
  },
};

export function StaggerChildren({
  children,
  stagger = 0.06,
  delay = 0.1,
  y = 16,
  className = "",
}: StaggerChildrenProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      custom={stagger}
      variants={staggerContainerVariants}
      style={{ transitionDelay: `${delay}s` }}
    >
      {Array.isArray(children)
        ? children.map((child, i) => (
          <motion.div key={i} custom={y} variants={staggerChildVariants}>
            {child}
          </motion.div>
        ))
        : <motion.div custom={y} variants={staggerChildVariants}>{children}</motion.div>
      }
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// SKELETON SHIMMER — for loading states within pages
// ─────────────────────────────────────────────

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
}

export function Skeleton({
  width = "100%",
  height = 16,
  borderRadius = 8,
  className = "",
}: SkeletonProps) {
  return (
    <motion.div
      className={className}
      style={{ width, height, borderRadius, overflow: "hidden" }}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(90deg, #F0F4F8 25%, #E4EAF0 50%, #F0F4F8 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.6s infinite",
        }}
      />
      <style>{`
        @keyframes shimmer {
          from { background-position: 200% 0; }
          to   { background-position: -200% 0; }
        }
      `}</style>
    </motion.div>
  );
}
