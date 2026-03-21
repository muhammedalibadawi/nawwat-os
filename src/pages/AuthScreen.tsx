import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AuthScreen: React.FC = () => {
    const navigate = useNavigate();
    const { signIn } = useAuth();

    const [tenant, setTenant] = useState('T-ACME');
    const [email, setEmail] = useState('admin@acme.ae');
    const [password, setPassword] = useState('password');
    const [isRegister, setIsRegister] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await signIn(email, password);
            navigate('/dashboard');
        } catch {
            // Error surfaced by LoginPage pattern; keep minimal
        }
    };

    return (
        <div className="min-h-screen bg-midnight flex items-center justify-center relative z-0 p-6 overflow-hidden">
            <div
                className="absolute inset-0 pointer-events-none z-0"
                style={{
                    background:
                        'radial-gradient(circle at 50% 0%, rgba(0,229,255,0.08) 0%, transparent 60%), radial-gradient(circle at 80% 90%, rgba(124,58,237,0.06) 0%, transparent 50%)',
                }}
            />
            <div
                className="absolute inset-0 pointer-events-none opacity-20 z-0"
                style={{
                    backgroundImage:
                        'linear-gradient(rgba(0, 229, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 229, 255, 0.05) 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                }}
            />

            <div className="w-full max-w-4xl grid md:grid-cols-2 gap-12 items-center relative z-10">
                <div>
                    <h1 className="text-3xl font-black text-white mb-4">NawwatOS</h1>
                    <p className="text-white/60 text-sm">Enterprise ERP — {tenant}</p>
                </div>

                <motion.form
                    onSubmit={handleSubmit}
                    className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <h2 className="text-xl font-bold text-white mb-6">{isRegister ? 'Register' : 'Sign in'}</h2>
                    <label className="block text-white/70 text-sm mb-2">Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full mb-4 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                    />
                    <label className="block text-white/70 text-sm mb-2">Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full mb-6 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                    />
                    <button type="submit" className="w-full py-3 rounded-xl bg-cyan text-midnight font-bold">
                        {isRegister ? 'Create account' : 'Continue'}
                    </button>
                    <button type="button" onClick={() => setIsRegister(!isRegister)} className="mt-4 text-cyan text-sm">
                        {isRegister ? 'Have an account?' : 'Need to register?'}
                    </button>
                </motion.form>
            </div>
        </div>
    );
};

export default AuthScreen;
