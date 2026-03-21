import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Lock, LogOut, Loader2 } from 'lucide-react';

export const LockScreen: React.FC = () => {
    const { user, signOut } = useAuth();
    const [isLocked, setIsLocked] = useState(() => localStorage.getItem('isLocked') === 'true');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;

        const handleActivity = () => {
            if (isLocked) return;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                setIsLocked(true);
                localStorage.setItem('isLocked', 'true');
            }, INACTIVITY_TIMEOUT);
        };

        if (!isLocked) {
            window.addEventListener('mousemove', handleActivity);
            window.addEventListener('keydown', handleActivity);
            window.addEventListener('click', handleActivity);
            window.addEventListener('scroll', handleActivity);
            handleActivity(); // Init timer
        }

        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('mousemove', handleActivity);
            window.removeEventListener('keydown', handleActivity);
            window.removeEventListener('click', handleActivity);
            window.removeEventListener('scroll', handleActivity);
        };
    }, [isLocked, INACTIVITY_TIMEOUT]);

    useEffect(() => {
        const handleManualLock = () => {
            setIsLocked(true);
            localStorage.setItem('isLocked', 'true');
        };

        window.addEventListener('nawwat:lock-screen', handleManualLock as EventListener);
        return () => {
            window.removeEventListener('nawwat:lock-screen', handleManualLock as EventListener);
        };
    }, []);

    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password) return;
        setLoading(true);
        setError('');

        const { error } = await supabase.auth.signInWithPassword({
            email: user?.email || '',
            password
        });

        if (error) {
            setError('كلمة المرور غير صحيحة');
        } else {
            setIsLocked(false);
            localStorage.removeItem('isLocked');
            setPassword('');
        }
        setLoading(false);
    };

    if (!isLocked) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-[#071C3B]/90 backdrop-blur-md flex items-center justify-center font-arabic animate-fade-in p-4">
            <div className="bg-[#0b2447] border border-white/10 p-8 rounded-3xl flex flex-col items-center w-full max-w-[360px] shadow-2xl relative overflow-hidden">
                {/* Glow Effect */}
                <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00CFFF] to-transparent opacity-50"></div>
                
                <div className="w-20 h-20 bg-gradient-to-br from-[#00CFFF] to-blue-600 rounded-[20px] flex items-center justify-center font-nunito font-black text-2xl text-white shadow-[0_4px_20px_rgba(0,207,255,0.3)] border-2 border-white/10 mb-5 relative">
                    {user?.full_name?.substring(0, 2).toUpperCase() || 'AH'}
                    <div className="absolute -bottom-1 -end-1 w-4 h-4 bg-success rounded-full border-2 border-[#0b2447]" />
                </div>
                
                <h2 className="text-xl font-bold text-white mb-2">{user?.full_name || 'Admin User'}</h2>
                <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-white/50 mb-7 flex items-center gap-2">
                    <Lock size={12} className="text-[#00CFFF]" /> الجلسة مقفلة للأمان
                </div>

                <form onSubmit={handleUnlock} className="w-full flex flex-col gap-4">
                    <div>
                        <input
                            type="password"
                            placeholder="كلمة المرور لفك القفل"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-[#071C3B] border border-white/10 rounded-xl px-4 py-3.5 text-[0.95rem] font-bold text-white text-center focus:outline-none focus:border-[#00CFFF] focus:ring-1 focus:ring-[#00CFFF] transition-all"
                            autoFocus
                        />
                        <p className="text-white/55 text-[0.72rem] text-center mt-2 font-semibold">
                            أدخل كلمة مرور حسابك في NawwatOS
                        </p>
                        {error && <p className="text-danger-dim text-xs text-center mt-2 font-bold">{error}</p>}
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !password}
                        className="w-full bg-[#00CFFF] hover:bg-[#00b5e0] text-[#071C3B] font-extrabold text-[0.95rem] py-3.5 rounded-xl flex justify-center items-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_16px_rgba(0,207,255,0.2)]"
                    >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : 'فك القفل'}
                    </button>
                </form>

                <button 
                    onClick={() => {
                        localStorage.removeItem('isLocked');
                        signOut();
                    }}
                    className="mt-8 flex items-center justify-center gap-2 w-full py-2 text-xs font-bold text-white/40 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
                >
                    <LogOut size={14} />
                    تسجيل الخروج بالكامل
                </button>
            </div>
        </div>
    );
};
