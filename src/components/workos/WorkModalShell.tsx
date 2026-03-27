import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface WorkModalShellProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClassName?: string;
}

const WorkModalShell: React.FC<WorkModalShellProps> = ({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxWidthClassName = 'max-w-3xl',
}) => {
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#071C3B]/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className={`w-full ${maxWidthClassName} max-h-[92vh] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl`}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-black text-[#071C3B]">{title}</h2>
            {subtitle ? <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto px-6 py-5">{children}</div>

        {footer ? <div className="border-t border-slate-200 px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  );
};

export default WorkModalShell;
