import { Hash, Volume2, Mic, MicOff, Headphones, HeadphoneOff, PhoneOff, Settings, Plus, ChevronDown, UserPlus, LogOut, Signal } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function ChannelList({
    activeServer,
    activeChannel,
    setActiveChannel,
    onOpenCreateChannel,
    onLeaveServer,
    onOpenInvite,
    onOpenServerSettings,
    voiceStates = {},
    joinedVoiceChannel,
    onJoinVoice,
    onLeaveVoice,
    voiceConnectionStatus,
    unreadCounts = {}
}) {
    const [channels, setChannels] = useState([]);
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef(null);

    // Local mute/deafen state synced from VoiceArea via window globals
    const [isMuted, setIsMuted] = useState(false);
    const [isDeafened, setIsDeafened] = useState(false);

    // Sync voice state from window globals
    useEffect(() => {
        const interval = setInterval(() => {
            if (window.__voiceState) {
                setIsMuted(window.__voiceState.isMuted);
                setIsDeafened(window.__voiceState.isDeafened);
            }
        }, 200);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
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
                const res = await api.get(`/channels/?server_id=${activeServer.id}`);
                const list = Array.isArray(res.data) ? res.data : [];
                const serverChannels = list.filter(c => c.server_id === activeServer.id);
                setChannels(serverChannels);

                if (serverChannels.length > 0 && (!activeChannel || activeChannel.server_id !== activeServer.id)) {
                    // Default to first TEXT channel
                    const firstText = serverChannels.find(c => c.type === 'TEXT') || serverChannels[0];
                    setActiveChannel(firstText);
                }
            } catch (err) {
                console.error("Failed to load channels", err);
            }
        };
        fetchChannels();
    }, [activeServer?.id]);

    if (!activeServer) return <div className="w-64 bg-surface-800" />;

    const isOwner = activeServer.owner_id === localStorage.getItem('user_id');
    const textChannels = channels.filter(c => c.type === 'TEXT');
    const voiceChannels = channels.filter(c => c.type === 'VOICE');

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

    const handleChannelClick = (channel) => {
        if (channel.type === 'VOICE') {
            // Clicking a voice channel = join voice (don't change active text channel)
            if (joinedVoiceChannel?.id === channel.id) {
                // Already in this channel, do nothing
                return;
            }
            onJoinVoice?.(channel);
        } else {
            // Text channel — set active
            setActiveChannel(channel);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden select-none relative">
            {/* Server Header */}
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

            {/* Channel List */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5 custom-scrollbar z-10">
                {/* Text Channels */}
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
                {textChannels.map((channel) => (
                    <button
                        key={channel.id}
                        onClick={() => handleChannelClick(channel)}
                        className={`flex items-center w-full px-2 py-1.5 rounded-md group transition-all duration-200 ${activeChannel?.id === channel.id
                            ? 'bg-white/10 text-white shadow-sm'
                            : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                            }`}
                    >
                        <Hash size={18} className={`mr-1.5 ${activeChannel?.id === channel.id ? 'text-gray-200' : (unreadCounts?.channels?.[channel.id] ? 'text-white' : 'text-gray-500')}`} />
                        <span className={`truncate text-sm ${unreadCounts?.channels?.[channel.id] ? 'font-bold text-white' : 'font-medium'}`}>{channel.name || 'untitled'}</span>
                        {unreadCounts?.channels?.[channel.id] > 0 && (
                            <div className="w-2 h-2 rounded-full bg-white ml-auto shrink-0" />
                        )}
                    </button>
                ))}

                {/* Voice Channels */}
                {voiceChannels.length > 0 && (
                    <>
                        <div className="flex items-center justify-between px-2 mt-4 mb-2 group/header">
                            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-gray-300 transition-colors">Voice Channels</div>
                            {isOwner && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onOpenCreateChannel(); }}
                                    className="text-gray-400 hover:text-white opacity-0 group-hover/header:opacity-100 transition-opacity"
                                >
                                    <Plus size={14} />
                                </button>
                            )}
                        </div>
                        {voiceChannels.map((channel) => (
                            <div key={channel.id}>
                                <button
                                    onClick={() => handleChannelClick(channel)}
                                    className={`flex items-center w-full px-2 py-1.5 rounded-md group transition-all duration-200 ${joinedVoiceChannel?.id === channel.id
                                        ? 'bg-emerald-500/10 text-emerald-400'
                                        : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                                        }`}
                                >
                                    <Volume2 size={18} className={`mr-1.5 ${joinedVoiceChannel?.id === channel.id ? 'text-emerald-400' : 'text-gray-500'
                                        }`} />
                                    <span className="truncate text-sm font-medium">{channel.name || 'untitled'}</span>
                                </button>

                                {/* Users in this voice channel */}
                                {voiceStates[channel.id] && voiceStates[channel.id].length > 0 && (
                                    <div className="ml-7 space-y-0.5 mb-1 mt-0.5">
                                        {voiceStates[channel.id].map(u => (
                                            <div key={u.id} className="flex items-center gap-2 py-0.5 group/user">
                                                <div className="relative">
                                                    <div className="w-6 h-6 rounded-full bg-surface-600 overflow-hidden flex-shrink-0 border border-white/5">
                                                        {u.avatar ? (
                                                            <img src={u.avatar.startsWith('http') ? u.avatar : `${api.defaults.baseURL}${u.avatar}`} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-gray-400">
                                                                {u.username.charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="text-[12px] text-gray-500 group-hover/user:text-gray-300 transition-colors truncate">
                                                    {u.username}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </>
                )}
            </div>

            {/* Voice Connection Panel — Discord-style, above user bar */}
            <AnimatePresence>
                {joinedVoiceChannel && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-white/5 bg-surface-900/80 overflow-hidden"
                    >
                        <div className="px-3 py-2">
                            {/* Connection status */}
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Signal size={14} className={
                                        voiceConnectionStatus === 'connected' ? 'text-emerald-400' :
                                            voiceConnectionStatus === 'error' ? 'text-red-400' :
                                                'text-amber-400 animate-pulse'
                                    } />
                                    <div>
                                        <div className={`text-[11px] font-bold ${voiceConnectionStatus === 'connected' ? 'text-emerald-400' :
                                            voiceConnectionStatus === 'error' ? 'text-red-400' :
                                                'text-amber-400'
                                            }`}>
                                            {voiceConnectionStatus === 'connected' ? 'Voice Connected' :
                                                voiceConnectionStatus === 'error' ? 'Connection Error' :
                                                    'Connecting...'}
                                        </div>
                                        <div className="text-[10px] text-gray-500 truncate max-w-[120px]">
                                            {joinedVoiceChannel.name}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => window.__voiceMute?.()}
                                    className={`flex-1 p-2 rounded-md transition-all flex items-center justify-center ${isMuted
                                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                        }`}
                                    title={isMuted ? 'Unmute' : 'Mute'}
                                >
                                    {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                                </button>
                                <button
                                    onClick={() => window.__voiceDeafen?.()}
                                    className={`flex-1 p-2 rounded-md transition-all flex items-center justify-center ${isDeafened
                                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                        }`}
                                    title={isDeafened ? 'Undeafen' : 'Deafen'}
                                >
                                    {isDeafened ? <HeadphoneOff size={18} /> : <Headphones size={18} />}
                                </button>
                                <button
                                    onClick={() => {
                                        window.__voiceDisconnect?.();
                                        onLeaveVoice?.();
                                    }}
                                    className="flex-1 p-2 rounded-md bg-white/5 text-gray-400 hover:bg-red-500/20 hover:text-red-400 transition-all flex items-center justify-center"
                                    title="Disconnect"
                                >
                                    <PhoneOff size={18} />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
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
