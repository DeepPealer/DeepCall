import { Hash, Volume2, Mic, Headphones, Settings, Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../api/axios';

export default function ChannelList({ activeServer, activeChannel, setActiveChannel, onOpenCreateChannel }) {
    const [channels, setChannels] = useState([]);

    useEffect(() => {
        const fetchChannels = async () => {
            if (!activeServer?.id) return;
            try {
                // In production, we'd filter by server_id. For MVP, we get all.
                const res = await api.get('/channels/');
                const list = Array.isArray(res.data) ? res.data : [];
                setChannels(list);
                
                if (list.length > 0 && !activeChannel) {
                    setActiveChannel(list[0]);
                }
            } catch (err) {
                console.error("Failed to load channels", err);
            }
        };
        fetchChannels();
    }, [activeServer?.id]);

    if (!activeServer) return <div className="w-64 bg-surface-800" />;

    return (
        <div className="flex flex-col h-full overflow-hidden select-none">
            <header className="h-14 px-4 flex items-center justify-between border-b border-white/5 bg-surface-800/20 backdrop-blur-lg">
                <h2 className="font-bold text-white text-xs uppercase tracking-widest opacity-80 truncate pr-2">
                    {activeServer.name || 'Server'}
                </h2>
                <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={onOpenCreateChannel}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white"
                >
                    <Plus size={18} />
                </motion.button>
            </header>

            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5 custom-scrollbar">
                <div className="text-[10px] font-black text-gray-500 px-2 mb-2 uppercase tracking-widest">Text Channels</div>
                {channels.map((channel) => (
                    <button
                        key={channel.id}
                        onClick={() => setActiveChannel(channel)}
                        className={`flex items-center w-full px-2 py-2 rounded-lg group transition-all duration-200 ${
                            activeChannel?.id === channel.id 
                            ? 'bg-white/5 text-white shadow-sm' 
                            : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                        }`}
                    >
                        <div className={`p-1 rounded mr-2 ${
                            activeChannel?.id === channel.id ? 'text-primary' : 'text-gray-600'
                        }`}>
                            {channel.type === 'VOICE' ? <Volume2 size={16} /> : <Hash size={16} />}
                        </div>
                        <span className="truncate text-sm font-semibold tracking-tight">
                            {channel.name || 'untitled'}
                        </span>
                    </button>
                ))}
            </div>

            <div className="mt-auto p-2 bg-surface-900/50 border-t border-white/5">
                <div className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-white/5 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-primary">{(localStorage.getItem('username') || 'U')[0].toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white truncate">{localStorage.getItem('username') || 'User'}</div>
                        <div className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter">Online</div>
                    </div>
                    <div className="flex gap-1">
                        <Settings size={14} className="text-gray-500 hover:text-white transition-colors cursor-pointer" onClick={() => window.location.href = '/settings'} />
                    </div>
                </div>
            </div>
        </div>
    );
}
