import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Clock,
  CreditCard,
  Coffee,
  Map as MapIcon,
  ListFilter,
  X,
  AlertCircle
} from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { useTableStore, Table, TableStatus } from '../store/TableStore';

// Helper to format elapsed time from ISO string
const useElapsedTime = (isoString?: string) => {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!isoString) {
      setElapsed('');
      return;
    }
    const start = new Date(isoString).getTime();
    const interval = setInterval(() => {
      const diffMs = Date.now() - start;
      const mins = Math.floor(diffMs / 60000);
      const hours = Math.floor(mins / 60);

      if (hours > 0) {
        setElapsed(`${hours}h ${mins % 60}m`);
      } else {
        setElapsed(`${mins}m`);
      }
    }, 1000);

    // Initial calc
    const diffMs = Date.now() - start;
    const mins = Math.floor(diffMs / 60000);
    setElapsed(mins > 59 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`);

    return () => clearInterval(interval);
  }, [isoString]);

  return elapsed;
};

// Table Tile Component
const TableTile: React.FC<{
  table: Table;
  onClick: (t: Table) => void
}> = ({ table, onClick }) => {
  const timeElapsed = useElapsedTime(table.seatingTime);

  // Status-based styling
  let borderClass = 'border-border';
  let bgClass = 'bg-surface-card hover:bg-surface-bg-2';
  let glowClass = '';
  let statusColor = 'text-content-3';
  let statusIcon = <Coffee size={14} />;

  switch (table.status) {
    case 'AVAILABLE':
      borderClass = 'border-border border-dashed';
      break;
    case 'OCCUPIED':
      borderClass = 'border-cyan';
      bgClass = 'bg-cyan/5 hover:bg-cyan/10';
      glowClass = 'shadow-[0_0_15px_rgba(0,229,255,0.15)]';
      statusColor = 'text-cyan';
      statusIcon = <Users size={14} />;
      break;
    case 'RESERVED':
      borderClass = 'border-warning';
      bgClass = 'bg-warning/5 hover:bg-warning/10';
      statusColor = 'text-warning';
      statusIcon = <Clock size={14} />;
      break;
    case 'DIRTY':
      borderClass = 'border-danger';
      bgClass = 'bg-danger/5 hover:bg-danger/10';
      statusColor = 'text-danger';
      statusIcon = <AlertCircle size={14} />;
      break;
  }

  return (
    <motion.div
      layoutId={`table-${table.id}`}
      onClick={() => onClick(table)}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={`relative cursor-pointer rounded-2xl p-4 border-2 transition-all duration-200 flex flex-col justify-between aspect-square ${bgClass} ${borderClass} ${glowClass}`}
    >
      <div className="flex justify-between items-start">
        <span className="font-nunito font-black text-xl text-midnight">
          T{table.number}
        </span>
        <div className={`flex items-center gap-1 ${statusColor}`}>
          {statusIcon}
        </div>
      </div>

      <div className="mt-auto space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-content-4">
          <Users size={12} /> {table.capacity} Seats
        </div>

        {table.status === 'OCCUPIED' && (
          <>
            {table.orderTotal && (
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-midnight">
                <CreditCard size={12} className="text-cyan" />
                <span className="text-cyan-600">AED {table.orderTotal.toFixed(2)}</span>
              </div>
            )}
            {timeElapsed && (
              <div className="flex items-center gap-1.5 text-[0.65rem] font-bold text-content-3">
                <Clock size={12} /> {timeElapsed}
              </div>
            )}
          </>
        )}

        {table.status === 'RESERVED' && (
          <div className="text-[0.65rem] font-bold text-warning-dim bg-warning/10 px-2 py-0.5 rounded inline-block">
            VIP Reservation
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Quick Action Modal Component
const TableActionModal: React.FC<{
  table: Table;
  onClose: () => void;
  onAction: (id: string, action: string) => void;
}> = ({ table, onClose, onAction }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-midnight/60 backdrop-blur-sm"
      />
      <motion.div
        layoutId={`table-${table.id}`}
        className="bg-surface-card w-full max-w-sm rounded-[24px] shadow-2xl relative z-10 overflow-hidden border border-border flex flex-col"
      >
        <div className="p-5 border-b border-border flex justify-between items-center bg-surface-bg">
          <div>
            <h3 className="font-nunito font-black text-xl text-midnight flex items-center gap-2">
              Table {table.number}
              <span className="text-xs font-bold bg-surface-bg-2 px-2 py-1 rounded-lg text-content-3">
                {table.capacity} Seats
              </span>
            </h3>
            <p className="text-xs font-bold text-content-4 uppercase tracking-wider mt-1">{table.status}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-bg-2 flex items-center justify-center text-content-3 hover:text-danger hover:bg-danger/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-3 relative">

          {table.status === 'AVAILABLE' && (
            <>
              <button onClick={() => onAction(table.id, 'OPEN_ORDER')} className="w-full bg-midnight hover:bg-[#1a2b4b] text-white font-bold py-3.5 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2">
                <Coffee size={18} className="text-cyan" /> Open New Order
              </button>
              <button onClick={() => onAction(table.id, 'RESERVE')} className="w-full bg-surface-bg hover:bg-surface-bg-2 border border-border text-midnight font-bold py-3.5 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2">
                <Clock size={18} className="text-warning" /> Mark as Reserved
              </button>
            </>
          )}

          {table.status === 'OCCUPIED' && (
            <>
              <button onClick={() => onAction(table.id, 'VIEW_ORDER')} className="w-full bg-cyan hover:bg-[#00c5db] text-midnight font-black py-4 rounded-xl shadow-[0_4px_15px_rgba(0,229,255,0.2)] transition-colors flex items-center justify-center gap-2 text-lg">
                <CreditCard size={20} /> View Order (AED {table.orderTotal?.toFixed(2) || '0.00'})
              </button>
              <button onClick={() => onAction(table.id, 'CLEAR_TABLE')} className="w-full bg-surface-bg hover:bg-surface-bg-2 border border-border text-danger font-bold py-3.5 rounded-xl transition-colors shadow-sm mt-2">
                Customer Left (Needs Cleaning)
              </button>
            </>
          )}

          {table.status === 'RESERVED' && (
            <>
              <button onClick={() => onAction(table.id, 'SEAT_GUEST')} className="w-full bg-midnight text-white font-bold py-3.5 rounded-xl shadow-sm transition-colors">
                Seat Guests & Open Order
              </button>
              <button onClick={() => onAction(table.id, 'CANCEL_RESERVE')} className="w-full bg-surface-bg border border-border text-content-2 font-bold py-3.5 rounded-xl transition-colors mt-2">
                Cancel Reservation
              </button>
            </>
          )}

          {table.status === 'DIRTY' && (
            <button onClick={() => onAction(table.id, 'MARK_CLEAN')} className="w-full bg-success-dim hover:bg-success/20 text-success-dim font-black py-4 rounded-xl shadow-sm transition-colors border border-success/30">
              Mark as Clean & Available
            </button>
          )}

        </div>
      </motion.div>
    </div>
  );
};

// Main Screen
const TableManagementScreen: React.FC = () => {
  const { branchName } = useAppContext();
  const { tables, updateTableStatus, openOrder, clearTable } = useTableStore();
  const [activeFilter, setActiveFilter] = useState<TableStatus | 'ALL'>('ALL');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  const filteredTables = tables.filter(t => activeFilter === 'ALL' || t.status === activeFilter);

  const handleAction = (id: string, action: string) => {
    switch (action) {
      case 'OPEN_ORDER':
      case 'SEAT_GUEST':
        openOrder(id, `ORD-${Date.now()}`);
        break;
      case 'RESERVE':
        updateTableStatus(id, 'RESERVED');
        break;
      case 'CLEAR_TABLE':
        clearTable(id);
        break;
      case 'CANCEL_RESERVE':
      case 'MARK_CLEAN':
        updateTableStatus(id, 'AVAILABLE');
        break;
      case 'VIEW_ORDER':
        console.log('Navigating to POS for order', id);
        break;
    }
    setSelectedTable(null);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-var(--topbar-h))] -m-6 w-[calc(100%+3rem)] bg-[#0A192F] overflow-hidden animate-fade-in relative z-0">

      {/* Dark Theme Header */}
      <div className="h-16 px-6 shrink-0 flex items-center justify-between border-b border-white/10 relative z-10 bg-midnight/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan/20 flex items-center justify-center text-cyan shadow-[0_0_15px_rgba(0,229,255,0.2)]">
            <MapIcon size={18} />
          </div>
          <div>
            <h1 className="font-nunito font-black text-white text-lg leading-none">Live Floor Plan</h1>
            <p className="text-[0.68rem] text-cyan font-bold mt-0.5 uppercase tracking-wide">{branchName}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="hidden md:flex bg-white/5 rounded-xl p-1 border border-white/10 backdrop-blur-sm">
          {(['ALL', 'AVAILABLE', 'OCCUPIED', 'RESERVED', 'DIRTY'] as const).map(filter => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${activeFilter === filter
                  ? 'bg-cyan text-midnight shadow-[0_0_10px_rgba(0,229,255,0.3)]'
                  : 'text-content-3 hover:text-white hover:bg-white/10'
                }`}
            >
              {filter}
            </button>
          ))}
        </div>

        <button className="md:hidden text-white/70 hover:text-cyan transition-colors">
          <ListFilter size={20} />
        </button>
      </div>

      {/* Floor Plan Container (Grid) */}
      <div className="flex-1 overflow-auto p-8 flex items-center justify-center relative z-0">

        {/* Decorative Grid Background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.03)_1px,_transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

        <div className="w-full max-w-5xl">
          {filteredTables.length === 0 ? (
            <div className="text-center text-white/50 py-12">
              <p className="font-bold">No tables match the current filter.</p>
            </div>
          ) : (
            <motion.div
              layout
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 auto-rows-max"
            >
              <AnimatePresence>
                {filteredTables.map(table => (
                  <TableTile
                    key={table.id}
                    table={table}
                    onClick={setSelectedTable}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>

      {/* Interactive Modal overlay */}
      <AnimatePresence>
        {selectedTable && (
          <TableActionModal
            table={selectedTable}
            onClose={() => setSelectedTable(null)}
            onAction={handleAction}
          />
        )}
      </AnimatePresence>

    </div>
  );
};

export default TableManagementScreen;
