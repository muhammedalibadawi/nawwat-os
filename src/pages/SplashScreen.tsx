import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 2800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-midnight flex flex-col items-center justify-center z-[9999]">
      {/* Subtle animated grid background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 229, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 229, 255, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />

      {/* Center Content */}
      <div className="relative z-10 flex flex-col items-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, boxShadow: "0 0 40px rgba(0, 229, 255, 0.4)" }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 20,
            delay: 0.2
          }}
          className="w-16 h-16 bg-cyan-dim border border-cyan/20 rounded-2xl flex items-center justify-center mb-6"
        >
          <Zap size={32} className="text-cyan fill-cyan/20" />
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="font-nunito text-4xl font-black text-white tracking-tight mb-2"
        >
          Nawwat<span className="text-cyan">OS</span>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="text-white/30 text-xs font-bold tracking-[0.2em] uppercase"
        >
          Enterprise ERP · UAE / KSA
        </motion.div>

        {/* Progress Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.3 }}
          className="w-48 h-1 bg-white/10 rounded-full mt-10 overflow-hidden"
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ delay: 1.2, duration: 1.5, ease: "easeInOut" }}
            className="h-full bg-gradient-to-r from-cyan to-success rounded-full"
          />
        </motion.div>
      </div>
    </div>
  );
};

export default SplashScreen;
