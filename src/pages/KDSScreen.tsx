import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckSquare, Zap, UtensilsCrossed, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { useKdsStore, KdsOrder } from '../store/KdsStore';

// Gamification mock store (Simplified version of what HR might use)
const useGamificationMock = () => {
  const [points, setPoints] = useState(1250);
  const addPoints = (pts: number) => setPoints(p => p + pts);
  return { points, addPoints };
};

// Individual Order Card Component
const OrderCard: React.FC<{ order: KdsOrder; onPrepared: (id: string, time: number, target: number) => void }> = ({ order, onPrepared }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(order.timestamp).getTime();
    const interval = setInterval(() => {
      setElapsed(Date.now() - start);
    }, 1000);
    return () => clearInterval(interval);
  }, [order.timestamp]);

  const isWarning = elapsed > order.targetTimeMs * 0.75; // 75% of target time
  const isDanger = elapsed > order.targetTimeMs;

  let timerColor = 'text-cyan';
  let timerBg = 'bg-cyan-dim';
  if (isDanger) {
    timerColor = 'text-danger';
    timerBg = 'bg-danger/10';
  } else if (isWarning) {
    timerColor = 'text-warning';
    timerBg = 'bg-warning-dim';
  }

  // Format mm:ss
  const mins = Math.floor(elapsed / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.3 } }}
      className="bg-surface-card rounded-[20px] shadow-sm border border-border flex flex-col overflow-hidden relative group"
    >
      {/* Top Header */}
      <div className="bg-midnight p-4 flex items-center justify-between text-white shrink-0">
        <div>
          <h3 className="font-nunito font-black text-lg">{order.id}</h3>
          <p className="text-xs text-content-4 font-bold flex items-center gap-1.5 mt-0.5">
            <UtensilsCrossed size={12} /> {order.tableInfo}
          </p>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-black ${timerBg} ${timerColor}`}>
          {isDanger ? <AlertTriangle size={15} /> : <Clock size={15} />}
          {timeStr}
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-surface-bg-2">
        <ul className="space-y-4">
          {order.items.map((item, idx) => (
            <li key={idx} className="flex gap-3">
              <div className="w-7 h-7 bg-surface-bg-2 rounded-lg flex items-center justify-center font-bold text-midnight text-sm shrink-0">
                {item.quantity}x
              </div>
              <div>
                <div className="font-bold text-content text-[0.95rem]">{item.name}</div>
                {item.notes && (
                  <div className="text-[0.75rem] text-danger font-bold mt-1 bg-danger/5 px-2 py-1 rounded-md inline-block">
                    Note: {item.notes}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Action Footer */}
      <div className="p-4 bg-surface-bg-2 border-t border-border shrink-0">
        <button
          onClick={() => onPrepared(order.id, elapsed, order.targetTimeMs)}
          className="w-full relative overflow-hidden bg-cyan hover:bg-[#00c5db] text-midnight rounded-xl py-3.5 flex items-center justify-center gap-2 font-nunito font-black transition-all duration-300 shadow-[0_4px_15px_rgba(0,229,255,0.2)] hover:shadow-[0_8px_25px_rgba(0,229,255,0.4)] hover:-translate-y-0.5 active:translate-y-0 group-hover:after:animate-[shimmer_1.5s_infinite]"
        >
          <CheckSquare size={18} strokeWidth={2.5} />
          Mark as Prepared
        </button>
      </div>
    </motion.div>
  );
};

const KDSScreen: React.FC = () => {
  const { branchName } = useAppContext();
  const { activeOrders, markAsPrepared } = useKdsStore();
  const { points, addPoints } = useGamificationMock();
  const [pointsEarned, setPointsEarned] = useState<number | null>(null);

  const handleOrderPrepared = (id: string, time: number, target: number) => {
    // Gamification Logic:
    let earned = 0;
    if (time <= target) {
      earned = 50;
    } else if (time <= target + 120000) {
      earned = 10;
    }

    if (earned > 0) {
      addPoints(earned);
      setPointsEarned(earned);
      setTimeout(() => setPointsEarned(null), 3000);
    }

    markAsPrepared(id);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-var(--topbar-h))] -m-6 w-[calc(100%+3rem)] bg-surface-bg overflow-hidden animate-fade-in relative">

      {/* Header */}
      <div className="h-16 bg-midnight border-b border-white/10 flex items-center justify-between px-6 shrink-0 shadow-md z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-cyan/20 flex items-center justify-center text-cyan shadow-[0_0_15px_rgba(0,229,255,0.2)]">
            <UtensilsCrossed size={20} />
          </div>
          <div>
            <h1 className="font-nunito font-black text-white text-[1.2rem] leading-none">Kitchen Display System</h1>
            <p className="text-[0.7rem] justify-center text-cyan font-bold mt-1 uppercase tracking-wider">{branchName}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[0.65rem] text-content-4 uppercase font-bold tracking-widest">Active Orders</span>
            <span className="font-nunito font-black text-white text-xl leading-none mt-0.5">{activeOrders.length}</span>
          </div>

          <div className="h-10 bg-surface-card/10 border border-white/10 rounded-xl px-4 flex items-center gap-2 relative">
            <Zap size={16} className="text-warning" fill="currentColor" />
            <span className="font-nunito font-black text-white text-base">{points}</span>
            <span className="text-[0.6rem] text-content-4 font-bold uppercase tracking-wider pt-0.5">PTS</span>

            <AnimatePresence>
              {pointsEarned !== null && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.5 }}
                  animate={{ opacity: 1, y: -25, scale: 1 }}
                  exit={{ opacity: 0, y: -40 }}
                  className="absolute top-0 right-0 font-black text-success text-sm drop-shadow-md"
                >
                  +{pointsEarned}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
        {activeOrders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-content-4 opacity-60">
            <CheckSquare size={64} strokeWidth={1} className="mb-4" />
            <h2 className="font-nunito font-extrabold text-2xl text-midnight mb-2">Kitchen is Clear</h2>
            <p className="font-bold">Waiting for new orders from the POS...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 auto-rows-[380px]">
            <AnimatePresence>
              {activeOrders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onPrepared={handleOrderPrepared}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

    </div>
  );
};

export default KDSScreen;
