import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar as CalendarIcon, Clock, Users, Video, MapPin, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Meeting {
    id: string;
    title: string;
    description: string;
    start_time: string;
    end_time: string;
    attendees: string;
}

export default function CalendarScreen() {
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMeetings = async () => {
            try {
                const { data, error } = await supabase.from('meetings').select('*').order('start_time', { ascending: true });
                if (error) throw error;
                setMeetings((data as Meeting[]) ?? []);
            } catch (error) {
                console.error('Failed to fetch meetings', error);
                setMeetings([]);
            } finally {
                setLoading(false);
            }
        };
        fetchMeetings();
    }, []);

    const formatTime = (timeStr: string) => {
        const date = new Date(timeStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (timeStr: string) => {
        const date = new Date(timeStr);
        return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    };

    return (
        <div className="p-6 lg:p-8 space-y-8 h-full bg-[#f8fafc]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[#0A192F] tracking-tight">Team Calendar</h1>
                    <p className="text-gray-500 text-sm mt-1">Manage and view upcoming collaboration sessions.</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-[#0A192F] hover:bg-[#112240] text-white text-sm font-medium rounded-xl transition-all shadow-sm">
                    <Plus size={16} />
                    <span>New Meeting</span>
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center p-12">
                    <div className="animate-spin w-8 h-8 border-4 border-[#00E5FF] border-t-transparent rounded-full" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {meetings.length === 0 ? (
                        <div className="col-span-full p-12 text-center text-gray-500 bg-white rounded-2xl shadow-sm border border-gray-100">
                            No upcoming meetings.
                        </div>
                    ) : (
                        meetings.map((meeting, i) => {
                            let parsedAttendees: string[] = [];
                            try {
                                parsedAttendees = JSON.parse(meeting.attendees || '[]');
                            } catch (e) {
                                parsedAttendees = [];
                            }

                            return (
                                <motion.div
                                    key={meeting.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:border-cyan-200 transition-colors group relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-50 to-transparent rounded-bl-full -z-10 opacity-50 transition-transform group-hover:scale-110" />

                                    <div className="flex items-start justify-between mb-4">
                                        <div className="w-12 h-12 rounded-xl bg-cyan-50 flex items-center justify-center text-cyan-600">
                                            <CalendarIcon size={24} strokeWidth={1.5} />
                                        </div>
                                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">
                                            {formatDate(meeting.start_time)}
                                        </span>
                                    </div>

                                    <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight">{meeting.title}</h3>
                                    <p className="text-sm text-gray-500 mb-5 line-clamp-2">{meeting.description}</p>

                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3 text-sm text-gray-600">
                                            <Clock size={16} className="text-gray-400" />
                                            <span>
                                                {formatTime(meeting.start_time)} - {formatTime(meeting.end_time)}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-3 text-sm text-gray-600">
                                            <Users size={16} className="text-gray-400" />
                                            <div className="flex -space-x-2">
                                                {parsedAttendees.slice(0, 3).map((attendeeId, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[8px] font-bold text-gray-600 uppercase"
                                                        title={attendeeId}
                                                    >
                                                        {attendeeId.replace('EMP-', '')}
                                                    </div>
                                                ))}
                                                {parsedAttendees.length > 3 && (
                                                    <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] font-medium text-gray-500">
                                                        +{parsedAttendees.length - 3}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-4 border-t border-gray-50 flex gap-3">
                                        <button className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 text-[#0A192F] text-sm font-semibold rounded-lg transition-colors flex justify-center items-center gap-2">
                                            <Video size={16} className="text-cyan-600" /> Join
                                        </button>
                                        <button className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 text-[#0A192F] text-sm font-semibold rounded-lg transition-colors flex justify-center items-center gap-2">
                                            <MapPin size={16} className="text-gray-400" /> Room
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
