import { Hash, Volume2, Mic, Headphones, Settings, Plus, ChevronDown, UserPlus, LogOut } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import ServerSettingsModal from './ServerSettingsModal';
import InviteModal from './InviteModal';

import toast from 'react-hot-toast';

export default function ChannelList({ activeServer, activeChannel, setActiveChannel, onOpenCreateChannel, onLeaveServer, onOpenInvite, onOpenServerSettings }) {
    const [channels, setChannels] = useState([]);
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        // Close menu when clicking outside
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowMenu(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchChannels = async () => {
            if (!activeServer?.id) return;
            try {
                // In production, we'd filter by server_id. For MVP, we get all.
                const res = await api.get(`/channels/?server_id=${activeServer.id}`);
                const list = Array.isArray(res.data) ? res.data : [];
                // Client-side filter as fallback if API returns all
                const serverChannels = list.filter(c => c.server_id === activeServer.id);
                setChannels(serverChannels);
                
                if (serverChannels.length > 0 && (!activeChannel || activeChannel.server_id !== activeServer.id)) {
                    setActiveChannel(serverChannels[0]);
                }
            } catch (err) {
                console.error("Failed to load channels", err);
            }
        };
        fetchChannels();
    }, [activeServer?.id]);

    if (!activeServer) return <div className="w-64 bg-surface-800" />;

    const isOwner = activeServer.owner_id === localStorage.getItem('user_id');

    const handleLeaveServer = async () => {
        if (!window.confirm(`Are you sure you want to leave ${activeServer.name}?`)) return;
        
        try {
            await api.post(`/servers/${activeServer.id}/leave`);
            toast.success(`Left ${activeServer.name}`);
            if (onLeaveServer) onLeaveServer();
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.detail || "Failed to leave server");
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden select-none relative">
            <header 
                className="h-14 px-4 flex items-center justify-between border-b border-white/5 bg-surface-800/20 backdrop-blur-lg hover:bg-white/5 transition-colors cursor-pointer group relative shadow-md z-20" 
                onClick={() => setShowMenu(!showMenu)}
                ref={menuRef}
            >
                <h2 className="font-bold text-white text-sm tracking-wide truncate pr-2 flex-1">
                    {activeServer.name || 'Server'}
                </h2>
                <ChevronDown size={16} className={`text-white transition-transform duration-300 ${showMenu ? 'rotate-180' : ''}`} />

                <AnimatePresence>
                    {showMenu && (
                        <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            className="absolute top-full left-2 right-2 mt-2 bg-gray-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden py-1.5 z-50 origin-top"
                        >
                            <MenuItem 
                                icon={UserPlus} 
                                label="Invite People" 
                                className="text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-400"
                                onClick={(e) => { e.stopPropagation(); onOpenInvite(); setShowMenu(false); }}
                            />
                            {isOwner && (
                                <>
                                    <MenuItem 
                                        icon={Settings} 
                                        label="Server Settings" 
                                        onClick={(e) => { e.stopPropagation(); onOpenServerSettings(); setShowMenu(false); }}
                                    />
                                    <MenuItem 
                                        icon={Plus} 
                                        label="Create Channel" 
                                        onClick={(e) => { e.stopPropagation(); onOpenCreateChannel(); setShowMenu(false); }}
                                    />
                                </>
                            )}
                            {!isOwner && (
                                <MenuItem 
                                    icon={LogOut} 
                                    label="Leave Server" 
                                    className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
                                    onClick={(e) => { e.stopPropagation(); setShowMenu(false); handleLeaveServer(); }}
                                />
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </header>

            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5 custom-scrollbar z-10">
               <div className="flex items-center justify-between px-2 mb-2 group/header">
                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-gray-300 transition-colors">Text Channels</div>
                    {isOwner && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onOpenCreateChannel(); }}
                            className="text-gray-400 hover:text-white opacity-0 group-hover/header:opacity-100 transition-opacity"
                        >
                            <Plus size={14} />
                        </button>
                    )}
                </div>
                {channels.map((channel) => (
                    <button
                        key={channel.id}
                        onClick={() => setActiveChannel(channel)}
                        className={`flex items-center w-full px-2 py-2 rounded-md group transition-all duration-200 ${
                            activeChannel?.id === channel.id 
                            ? 'bg-white/10 text-white shadow-sm' 
                            : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                        }`}
                    >
                        <div className={`mr-1.5 ${
                            activeChannel?.id === channel.id ? 'text-gray-200' : 'text-gray-500'
                        }`}>
                            {channel.type === 'VOICE' ? <Volume2 size={18} /> : <Hash size={18} />}
                        </div>
                        <span className="truncate text-sm font-medium">
                            {channel.name || 'untitled'}
                        </span>
                    </button>
                ))}
            </div>

        </div>
    );
}

function MenuItem({ icon: Icon, label, onClick, className = "text-gray-300 hover:bg-white/5 hover:text-white" }) {
    return (
        <button 
            onClick={onClick}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm font-bold transition-colors mx-1 rounded-lg w-[calc(100%-8px)] ${className}`}
        >
            {label}
            {Icon && <Icon size={16} />}
        </button>
    );
}
