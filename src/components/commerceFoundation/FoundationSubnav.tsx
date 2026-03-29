import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const links: { to: string; label: string }[] = [
  { to: '/commerce/foundation', label: 'نظرة CommerceOS' },
  { to: '/commerce/foundation/channels', label: 'حسابات القنوات' },
  { to: '/commerce/foundation/contracts', label: 'عقود وإصدارات' },
  { to: '/commerce/foundation/pricing', label: 'تسعير ومحاكي الهامش' },
];

export const FoundationSubnav: React.FC = () => {
  const { pathname } = useLocation();
  return (
    <nav className="flex flex-wrap gap-2 border-b border-white/10 pb-3" dir="rtl">
      {links.map(({ to, label }) => (
        <Link
          key={to}
          to={to}
          className={`rounded-xl px-4 py-2 text-xs font-black transition ${
            pathname === to
              ? 'bg-white/15 text-white ring-1 ring-cyan-400/40'
              : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
          }`}
        >
          {label}
        </Link>
      ))}
      <Link
        to="/commerce"
        className="me-auto rounded-xl px-4 py-2 text-xs font-bold text-cyan-200/80 hover:text-cyan-100"
      >
        ← التكامل الفني (ويبهوك / مزامنة)
      </Link>
    </nav>
  );
};
