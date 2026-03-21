import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Star, Zap } from "lucide-react";

export default function GamificationWidget() {
    const [points, setPoints] = useState(0);
    const [level, setLevel] = useState("Level 1 Rookie");
    const [progress, setProgress] = useState(0);
    const [showTooltip, setShowTooltip] = useState(false);

    // Simulate fetching points/level on mount
    useEffect(() => {
        const fetchPoints = () => {
            // In a real flow, this would be an API call to GET /api/v1/employee/points
            setTimeout(() => {
                setPoints(prev => prev === 0 ? 1450 : prev + 15); // Add 15 pts dummy increment per refresh
                setLevel("Level 5 Closer");
                setProgress(prev => prev === 0 ? 72 : Math.min(100, prev + 5)); // Increment progress
            }, 800);
        };

        fetchPoints();
        window.addEventListener("gamification:refresh", fetchPoints);
        return () => window.removeEventListener("gamification:refresh", fetchPoints);
    }, []);

    return (
        <div
            className="relative flex items-center gap-3 px-3 py-1.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50 rounded-full cursor-pointer hover:shadow-md transition-shadow group"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            {/* Level Badge Icon */}
            <div className="w-7 h-7 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-inner relative overflow-hidden">
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
                <Trophy size={14} className="text-white relative z-10" />
            </div>

            {/* Stats */}
            <div className="flex flex-col">
                <div className="flex items-baseline gap-1.5">
                    <span className="text-[11px] font-black text-amber-600 uppercase tracking-wider leading-none">
                        {level}
                    </span>
                    <span className="text-gray-400 text-[10px] font-bold leading-none hidden md:inline">
                        • {points.toLocaleString()} PTS
                    </span>
                </div>

                {/* Mini Progress Bar */}
                <div className="w-24 h-1.5 bg-amber-100 rounded-full mt-1 overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                    />
                </div>
            </div>

            {/* Sparkle effects on hover */}
            <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end pr-2">
                <motion.div
                    animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                >
                    <Star size={10} className="text-amber-500 drop-shadow-sm" />
                </motion.div>
            </div>

            {/* Floating Details Tooltip */}
            <AnimatePresence>
                {showTooltip && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-12 right-0 w-64 bg-white rounded-2xl shadow-xl shadow-amber-900/10 border border-gray-100 p-4 z-50 origin-top-right"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <h4 className="text-gray-900 font-bold flex items-center gap-1.5">
                                    <Zap size={16} className="text-amber-500" />
                                    {level}
                                </h4>
                                <p className="text-xs text-gray-500 mt-0.5">Top 15% of employees</p>
                            </div>
                            <div className="bg-amber-100 text-amber-700 px-2 py-1 rounded-md text-xs font-black">
                                +450 this week
                            </div>
                        </div>

                        <div className="space-y-2 mb-3">
                            <div className="flex justify-between text-xs">
                                <span className="font-semibold text-gray-600">Current Progress</span>
                                <span className="font-bold text-gray-900">{progress}%</span>
                            </div>
                            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full" style={{ width: `${progress}%` }} />
                            </div>
                            <p className="text-[10px] text-gray-400 text-right">280 pts to Level 6</p>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                            <p className="text-[11px] font-bold text-gray-700 mb-2 uppercase tracking-wider">Recent Achievements</p>
                            <ul className="space-y-1.5">
                                <li className="text-xs text-gray-600 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> 100th Sale Closed!
                                </li>
                                <li className="text-xs text-gray-600 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> 30-Day Streak
                                </li>
                            </ul>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
