import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, Users, ArrowLeft, MessageSquare, Image } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface Contact {
    id: string;
    name: string;
    avatar: string;
    role: string;
    status: string;
}

interface ChatMessage {
    id: string;
    sender_id: string;
    receiver_id: string | null;
    message: string;
    is_group_chat: number;
    timestamp: string;
}

export default function ChatScreen() {
    const { user } = useAuth();
    const currentUserId = user?.id ?? '';

    const [contacts, setContacts] = useState<Contact[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [activeChat, setActiveChat] = useState<Contact | 'GROUP' | null>(null);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const loadContacts = async () => {
            try {
                const { data, error } = await supabase.from('profiles').select('id, full_name').limit(50);
                if (error) throw error;
                setContacts(
                    (data ?? []).map((row: { id: string; full_name: string | null }) => ({
                        id: row.id,
                        name: row.full_name ?? 'User',
                        avatar: '',
                        role: '',
                        status: 'online',
                    }))
                );
            } catch (e) {
                console.error(e);
                setContacts([]);
            }
        };
        loadContacts();
    }, []);

    const fetchMessages = async () => {
        if (!activeChat) return;
        try {
            const { data, error } = await supabase
                .from('chat_messages')
                .select('*')
                .order('created_at', { ascending: true })
                .limit(200);

            if (error) throw error;

            const rows = (data ?? []) as Record<string, unknown>[];
            const filtered =
                activeChat === 'GROUP'
                    ? rows.filter((row) => Number(row.is_group_chat ?? 0) === 1)
                    : rows.filter((row) => {
                          const otherId = activeChat.id;
                          const sid = String(row.sender_id ?? '');
                          const rid = row.receiver_id ? String(row.receiver_id) : '';
                          return (
                              (sid === currentUserId && rid === otherId) ||
                              (sid === otherId && rid === currentUserId)
                          );
                      });

            setMessages(
                filtered.map((row) => ({
                    id: String(row.id),
                    sender_id: String(row.sender_id ?? ''),
                    receiver_id: row.receiver_id ? String(row.receiver_id) : null,
                    message: String(row.message ?? row.body ?? ''),
                    is_group_chat: Number(row.is_group_chat ?? 0),
                    timestamp: String(row.created_at ?? row.timestamp ?? new Date().toISOString()),
                }))
            );
        } catch (e) {
            console.error(e);
            setMessages([]);
        }
    };

    useEffect(() => {
        fetchMessages();
        const interval = setInterval(fetchMessages, 3000);
        return () => clearInterval(interval);
    }, [activeChat, currentUserId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeChat || !user?.id) return;

        try {
            const payload = {
                sender_id: user.id,
                receiver_id: activeChat === 'GROUP' ? null : activeChat.id,
                message: newMessage,
                is_group_chat: activeChat === 'GROUP' ? 1 : 0,
            };
            const { error } = await supabase.from('chat_messages').insert(payload);
            if (error) throw error;
            setNewMessage('');
            fetchMessages();
        } catch (e) {
            console.error('Failed to send', e);
        }
    };

    const formatTime = (ts: string) => {
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-white">
            <div className={`w-full md:w-80 border-r border-gray-100 flex-col bg-gray-50/50 ${activeChat ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-gray-100 bg-white">
                    <h2 className="text-lg font-bold text-[#0A192F]">Messages</h2>
                    <div className="mt-3 relative">
                        <input
                            type="text"
                            placeholder="Search contacts..."
                            className="w-full bg-gray-100 text-sm rounded-xl py-2 px-4 outline-none focus:ring-2 focus:ring-cyan-500/20"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <button
                        onClick={() => setActiveChat('GROUP')}
                        className={`w-full p-4 flex items-center gap-3 hover:bg-white transition-colors border-b border-gray-50 ${
                            activeChat === 'GROUP' ? 'bg-white border-l-4 border-l-cyan-400' : 'border-l-4 border-l-transparent'
                        }`}
                    >
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white flex-shrink-0">
                            <Users size={20} />
                        </div>
                        <div className="text-left flex-1 min-w-0">
                            <p className="font-semibold text-[14px] text-gray-900 truncate">Company General</p>
                            <p className="text-[12px] text-gray-500 truncate mt-0.5">Everyone in this tenant</p>
                        </div>
                    </button>

                    {contacts.map((contact) => (
                        <button
                            key={contact.id}
                            onClick={() => setActiveChat(contact)}
                            className={`w-full p-4 flex items-center gap-3 hover:bg-white transition-colors border-b border-gray-50 ${
                                activeChat !== 'GROUP' && activeChat?.id === contact.id
                                    ? 'bg-white border-l-4 border-l-cyan-400'
                                    : 'border-l-4 border-l-transparent'
                            }`}
                        >
                            <div className="relative flex-shrink-0">
                                <div className="w-12 h-12 rounded-full bg-gray-200 border border-gray-100 flex items-center justify-center text-gray-600 font-bold uppercase overflow-hidden">
                                    {contact.avatar || contact.name.substring(0, 2)}
                                </div>
                                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-400 border-2 border-white rounded-full" />
                            </div>
                            <div className="text-left flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-0.5">
                                    <p className="font-semibold text-[14px] text-gray-900 truncate">{contact.name}</p>
                                </div>
                                <p className="text-[12px] text-gray-500 truncate">{contact.role}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            <div className={`flex-1 flex-col bg-white ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
                {!activeChat ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <MessageSquare size={48} className="mb-4 text-gray-200" strokeWidth={1} />
                        <p className="text-sm">Select a contact to start chatting</p>
                    </div>
                ) : (
                    <>
                        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100 bg-white shadow-sm z-10">
                            <div className="flex items-center gap-4">
                                <button className="md:hidden text-gray-500 hover:text-gray-800" onClick={() => setActiveChat(null)}>
                                    <ArrowLeft size={20} />
                                </button>
                                <div className="flex items-center gap-3">
                                    {activeChat === 'GROUP' ? (
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white">
                                            <Users size={18} />
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold uppercase">
                                                {(activeChat as Contact).avatar || (activeChat as Contact).name.substring(0, 2)}
                                            </div>
                                            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-white rounded-full" />
                                        </div>
                                    )}
                                    <div>
                                        <h2 className="text-[15px] font-bold text-[#0A192F]">
                                            {activeChat === 'GROUP' ? 'Company General' : (activeChat as Contact).name}
                                        </h2>
                                        <p className="text-[11px] text-cyan-600 font-medium">
                                            {activeChat === 'GROUP' ? 'Company Group Chat' : (activeChat as Contact).role}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-[#f8fafc] space-y-6">
                            {messages.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                                    No messages yet. Send the first message!
                                </div>
                            ) : (
                                messages.map((msg) => {
                                    const isMe = msg.sender_id === currentUserId;
                                    const senderName =
                                        activeChat === 'GROUP' && !isMe
                                            ? contacts.find((c) => c.id === msg.sender_id)?.name || msg.sender_id
                                            : null;

                                    return (
                                        <motion.div
                                            key={msg.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div className={`max-w-[75%] lg:max-w-[60%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                                {senderName && <span className="text-[11px] text-gray-500 mb-1 ml-1">{senderName}</span>}
                                                <div
                                                    className={`px-4 py-3 rounded-2xl ${
                                                        isMe
                                                            ? 'bg-[#00E5FF] text-[#0A192F] rounded-br-none'
                                                            : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none shadow-sm'
                                                    }`}
                                                >
                                                    <p className={`text-[13.5px] leading-relaxed ${isMe ? 'font-medium' : ''}`}>{msg.message}</p>
                                                </div>
                                                <span className="text-[10px] text-gray-400 mt-1 mx-1">{formatTime(msg.timestamp)}</span>
                                            </div>
                                        </motion.div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="p-4 bg-white border-t border-gray-100">
                            <form onSubmit={handleSendMessage} className="flex gap-2 items-end max-w-4xl mx-auto">
                                <button type="button" className="p-3 text-gray-400 hover:text-gray-600 transition-colors bg-gray-50 rounded-xl">
                                    <Image size={20} />
                                </button>
                                <div className="flex-1 bg-gray-50 rounded-2xl px-4 py-2 border border-gray-100 flex items-center focus-within:ring-2 focus-within:ring-cyan-500/20 focus-within:border-cyan-300 transition-all">
                                    <textarea
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        placeholder="Type your message..."
                                        className="w-full bg-transparent outline-none text-sm resize-none max-h-32 py-1"
                                        rows={1}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage(e);
                                            }
                                        }}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={!newMessage.trim()}
                                    className="p-3 bg-[#0A192F] hover:bg-[#112240] text-white rounded-xl disabled:opacity-50 transition-colors flex items-center justify-center shadow-sm"
                                >
                                    <Send size={18} className={newMessage.trim() ? 'translate-x-0.5 -translate-y-0.5' : ''} />
                                </button>
                            </form>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
