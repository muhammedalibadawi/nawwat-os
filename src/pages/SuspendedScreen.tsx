import { motion } from "framer-motion";
import { Lock, FileX2, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAppContext } from "@/store/AppContext";
import { useNavigate } from "react-router-dom";

export default function SuspendedScreen() {
    const { signOut } = useAuth();
    const { tenantName } = useAppContext();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await signOut();
        navigate("/login", { replace: true });
    };

    return (
        <div className="min-h-screen bg-[#0A192F] flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-red-500/10 blur-[100px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-lg bg-white rounded-3xl p-10 shadow-2xl relative z-10 text-center"
            >
                <div className="w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Lock size={40} className="text-red-500" />
                </div>

                <h1 className="text-3xl font-black text-gray-900 mb-2">Workspace Suspended</h1>
                <p className="text-gray-500 mb-8 leading-relaxed text-sm">
                    Access to the <strong>{tenantName || 'Enterprise'}</strong> dashboard has been restricted.
                    This is usually due to an expired subscription or administrative lock by the central Master Admin.
                </p>

                <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 flex flex-col gap-4 mb-8">
                    <div className="flex items-start gap-4 text-left">
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm flex-shrink-0">
                            <FileX2 size={18} className="text-gray-400" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-900">Billing Issue</p>
                            <p className="text-xs text-gray-500">Please contact Nawwat Support or your system administrator to reactivate your tenant modules.</p>
                        </div>
                    </div>
                </div>

                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleLogout}
                    className="w-full bg-[#0A192F] hover:bg-[#112a4d] text-white font-bold py-4 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
                >
                    <LogOut size={18} /> Sign Out & Switch Tenant
                </motion.button>
            </motion.div>
        </div>
    );
}
