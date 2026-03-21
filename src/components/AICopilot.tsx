"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Send, Bot, User } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Message {
    id: string;
    sender: "user" | "ai";
    text: string;
}

export default function AICopilot() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { id: "1", sender: "ai", text: "Hi! I'm Nawwat AI. Ask me about your sales, top agents, shipments, or CRM leads!" },
    ]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const endOfMessagesRef = useRef<HTMLDivElement>(null);

    const quickPrompts = [
        "Analyze this month's sales",
        "Who are my top-performing agents?",
        "How many shipments are pending?",
        "Show my CRM leads status",
    ];

    useEffect(() => {
        if (endOfMessagesRef.current) {
            endOfMessagesRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isTyping]);

    const handleSend = async (text: string) => {
        if (!text.trim()) return;

        const userMessage: Message = { id: Date.now().toString(), sender: "user", text };
        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsTyping(true);

        try {
            await supabase.auth.getSession();

            let replyText =
                "**Nawwat AI** — ربط الاستعلام الذكي بـ Supabase قيد التطوير. جرّب لاحقاً عبر Edge Function أو `rpc`.";
            const { data, error } = await supabase.rpc("ai_copilot_query", { q: text });
            if (!error && data != null) {
                replyText = typeof data === "string" ? data : JSON.stringify(data);
            }

            setTimeout(() => {
                const aiMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    sender: "ai",
                    text: replyText,
                };
                setMessages((prev) => [...prev, aiMessage]);
                setIsTyping(false);
            }, 400);
        } catch (err) {
            console.error(err);
            setMessages((prev) => [
                ...prev,
                {
                    id: (Date.now() + 1).toString(),
                    sender: "ai",
                    text: "I'm having trouble connecting to Nawwat Core right now.",
                },
            ]);
            setIsTyping(false);
        }
    };

    return (
        <>
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsOpen(true)}
                        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-full shadow-2xl flex items-center justify-center text-white z-50 overflow-hidden group"
                    >
                        <div className="absolute inset-0 bg-white/20 group-hover:animate-pulse" />
                        <Sparkles size={24} className="relative z-10" />
                        <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-white rounded-full z-20" />
                    </motion.button>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="fixed bottom-6 right-6 w-[380px] h-[600px] bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden z-50 text-gray-800"
                    >
                        <div className="h-16 bg-gradient-to-r from-indigo-600 to-cyan-500 p-4 flex items-center justify-between text-white shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                    <Bot size={18} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm leading-tight">Nawwat AI Copilot</h3>
                                    <span className="text-[10px] text-indigo-100 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Online
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                            {messages.map((msg) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    key={msg.id}
                                    className={`flex gap-3 max-w-[85%] ${msg.sender === "user" ? "ml-auto flex-row-reverse" : ""}`}
                                >
                                    <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                            msg.sender === "user" ? "bg-indigo-100 text-indigo-600" : "bg-gradient-to-br from-indigo-500 to-cyan-500 text-white"
                                        }`}
                                    >
                                        {msg.sender === "user" ? <User size={14} /> : <Bot size={14} />}
                                    </div>
                                    <div
                                        className={`p-3 rounded-2xl text-sm leading-relaxed ${
                                            msg.sender === "user"
                                                ? "bg-indigo-600 text-white rounded-tr-sm shadow-md"
                                                : "bg-white border border-gray-100 text-gray-700 rounded-tl-sm shadow-sm"
                                        }`}
                                    >
                                        <span
                                            dangerouslySetInnerHTML={{
                                                __html: msg.text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
                                            }}
                                        />
                                    </div>
                                </motion.div>
                            ))}

                            {isTyping && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 max-w-[85%]">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shrink-0 text-white">
                                        <Bot size={14} />
                                    </div>
                                    <div className="bg-white border border-gray-100 p-4 rounded-2xl rounded-tl-sm flex items-center gap-1">
                                        <motion.div
                                            animate={{ opacity: [0.4, 1, 0.4] }}
                                            transition={{ repeat: Infinity, duration: 1 }}
                                            className="w-1.5 h-1.5 bg-gray-400 rounded-full"
                                        />
                                        <motion.div
                                            animate={{ opacity: [0.4, 1, 0.4] }}
                                            transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                                            className="w-1.5 h-1.5 bg-gray-400 rounded-full"
                                        />
                                        <motion.div
                                            animate={{ opacity: [0.4, 1, 0.4] }}
                                            transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                                            className="w-1.5 h-1.5 bg-gray-400 rounded-full"
                                        />
                                    </div>
                                </motion.div>
                            )}
                            <div ref={endOfMessagesRef} />
                        </div>

                        {messages.length < 4 && !isTyping && (
                            <div className="p-3 shrink-0 bg-white border-t border-gray-50 hide-scrollbar overflow-x-auto whitespace-nowrap space-x-2">
                                {quickPrompts.map((prompt, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSend(prompt)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-medium transition-colors border border-indigo-100"
                                    >
                                        <Sparkles size={12} className="text-indigo-500" /> {prompt}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="p-4 bg-white border-t border-gray-100 shrink-0">
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleSend(input);
                                }}
                                className="relative flex items-center"
                            >
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Ask Nawwat AI..."
                                    className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium"
                                />
                                <button
                                    type="submit"
                                    disabled={!input.trim() || isTyping}
                                    className="absolute right-2 w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
                                >
                                    <Send size={14} className="ml-0.5" />
                                </button>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
