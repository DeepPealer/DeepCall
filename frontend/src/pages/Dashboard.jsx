import { useState, useEffect } from 'react';
import {
  Hash, Volume2, Mic, Headphones, Settings, Plus, Send,
  Search, Users, Smile, Paperclip, MoreVertical, X,
  Save, Camera, LogOut, User as UserIcon, Shield, Bell, Palette, Moon, Sun
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Sidebar from '../components/Sidebar';
import ChannelList from '../components/ChannelList';
import ChatArea from '../components/ChatArea';
import VoiceArea from '../components/VoiceArea';
import FriendList from '../components/FriendList';
import DMChat from '../components/DMChat';
import CallOverlay from '../components/CallOverlay';
import CreateJoinServerModal from '../components/CreateJoinServerModal';
import InviteModal from '../components/InviteModal';
import ServerSettingsModal from '../components/ServerSettingsModal';
import api from '../api/axios';
import { useRef } from 'react';

export default function Dashboard() {
  const [servers, setServers] = useState([]);
  const [activeServer, setActiveServer] = useState(null);
  const [activeChannel, setActiveChannel] = useState(null);
  const [viewMode, setViewMode] = useState('servers');
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [user, setUser] = useState(null);

  const [showCreateServerDialog, setShowCreateServerDialog] = useState(false);
  const [showCreateChannelDialog, setShowCreateChannelDialog] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState('TEXT');
  const [loading, setLoading] = useState(false);

  // Settings state
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editTheme, setEditTheme] = useState('system');
  const [editPrivacyDM, setEditPrivacyDM] = useState('everyone');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [notifFriendRequests, setNotifFriendRequests] = useState(true);
  const [notifDirectMessages, setNotifDirectMessages] = useState(true);
  const [notifMentions, setNotifMentions] = useState(true);
  const [inputVolume, setInputVolume] = useState(80);
  const [outputVolume, setOutputVolume] = useState(100);
  const [settingsTab, setSettingsTab] = useState('account');
  const [hoveredUser, setHoveredUser] = useState(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  // Global WebSocket and Call state
  const ws = useRef(null);
  const [callState, setCallState] = useState('idle'); // 'idle' | 'incoming' | 'outgoing' | 'connected'
  const [callType, setCallType] = useState('video');
  const [roomName, setRoomName] = useState(null);
  const [incomingCallData, setIncomingCallData] = useState(null);
  const [callFriend, setCallFriend] = useState(null); // The friend object for calling
  const [joinedVoiceChannel, setJoinedVoiceChannel] = useState(null);
  const [voiceStates, setVoiceStates] = useState({}); // channel_id -> Array of users [{id, username, avatar}]
  const [voiceConnectionStatus, setVoiceConnectionStatus] = useState('disconnected'); // connecting | connected | error | disconnected
  const [onlineUsers, setOnlineUsers] = useState({}); // user_id -> {status, username, avatar}
  const [typingUsers, setTypingUsers] = useState({}); // channel_id or recipient_id -> {user_id: {username, timeout}}
  const [unreadCounts, setUnreadCounts] = useState({ channels: {}, dms: {}, servers: {} });

  // Hands for child components - Use ref to avoid WS reconnects on register
  const handlersRef = useRef(new Set());
  const [wsStatus, setWsStatus] = useState('connecting'); // 'connecting' | 'open' | 'closed'

  const connectWebSocket = () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    if (ws.current) ws.current.close();

    const host = window.location.hostname;
    const socket = new WebSocket(`ws://${host}:8002/ws?token=${token}`);
    ws.current = socket;

    socket.onopen = () => {
      console.log('Global WS Connected');
      setWsStatus('open');
    };

    socket.onclose = () => {
      console.log('Global WS Closed');
      setWsStatus('closed');
      // Reconnect after 3 seconds
      setTimeout(connectWebSocket, 3000);
    };

    socket.onerror = (err) => {
      console.error('Global WS Error:', err);
      setWsStatus('closed');
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('DEBUG: Global WS Received', data);

      const myId = localStorage.getItem('user_id');
      console.log('DEBUG: current user_id', myId);

      if (data.type === 'pong') {
        console.log('DEBUG: Received Pong');
        return;
      }

      // Handle call signaling globally
      if (data.type === 'call_invite') {
        console.log('DEBUG: Processing call_invite', data);
        if (String(data.from_user_id) === String(myId)) {
          console.log('DEBUG: Received self-invite, skipping');
          return;
        }

        setIncomingCallData(data);
        setRoomName(data.room_name);
        setCallType(data.call_type || 'video');
        setCallState('incoming');
        setCallFriend({
          id: data.from_user_id,
          username: data.from_username,
          avatar_url: data.from_avatar
        });
      } else if (data.type === 'call_accept') {
        console.log('DEBUG: Processing call_accept', data);
        if (String(data.from_user_id) === String(myId)) return;
        setCallState('connected');
        toast.success("Call accepted!");
      } else if (data.type === 'call_reject' || data.type === 'call_end') {
        console.log('DEBUG: Processing call_reject/end', data);
        if (String(data.from_user_id) === String(myId)) return;
        const wasConnected = callState === 'connected';
        setCallState('idle');
        setRoomName(null);
        setIncomingCallData(null);
        setCallFriend(null);
        if (data.type === 'message_reject') toast.error("Call rejected");
        else if (wasConnected) toast.error("Call ended");
      } else if (data.type === 'message') {
        const isCurrentChannel = activeChannel && activeChannel.id === data.channel_id;
        if (!isCurrentChannel) {
          setUnreadCounts(prev => {
            const chCount = (prev.channels[data.channel_id] || 0) + 1;
            // Find server for this channel to update server count
            let serverId = null;
            for (const s of servers) {
              if (s.channels?.some(c => c.id === data.channel_id)) {
                serverId = s.id;
                break;
              }
            }
            const srvCount = serverId ? (prev.servers[serverId] || 0) + 1 : prev.servers[serverId] || 0;

            return {
              ...prev,
              channels: { ...prev.channels, [data.channel_id]: chCount },
              servers: { ...prev.servers, [serverId]: srvCount }
            };
          });
        } else {
          // If current channel, ack immediately
          ackRead(data.channel_id, null);
        }
        handlersRef.current.forEach(handler => handler(data));
      } else if (data.type === 'dm') {
        const isCurrentDM = selectedFriend && selectedFriend.id === data.sender_id;
        if (!isCurrentDM) {
          setUnreadCounts(prev => ({
            ...prev,
            dms: { ...prev.dms, [data.sender_id]: (prev.dms[data.sender_id] || 0) + 1 }
          }));
        } else {
          ackRead(null, data.sender_id);
        }
        handlersRef.current.forEach(handler => handler(data));
      } else if (data.type === 'voice_state_update') {
        const { channel_id, users } = data;
        setVoiceStates(prev => ({
          ...prev,
          [channel_id]: users
        }));
      } else if (data.type === 'presence_update') {
        setOnlineUsers(prev => ({
          ...prev,
          [data.user_id]: { status: data.status, username: data.username, avatar: data.avatar }
        }));
      } else if (data.type === 'presence_bulk') {
        const bulk = {};
        data.users.forEach(u => {
          bulk[u.user_id] = { status: u.status, username: u.username, avatar: u.avatar };
        });
        setOnlineUsers(bulk);
      } else if (data.type === 'typing_start') {
        console.log('DEBUG: Received typing_start', data);
        if (String(data.user_id) === String(myId)) return; // Skip self
        const key = data.channel_id || data.recipient_id;
        if (!key) {
          console.error('DEBUG: No key for typing_start', data);
          return;
        }
        setTypingUsers(prev => {
          const updated = { ...prev };
          if (!updated[key]) updated[key] = {};
          // Clear existing timeout
          if (updated[key][data.user_id]?.timeout) clearTimeout(updated[key][data.user_id].timeout);
          const timeout = setTimeout(() => {
            setTypingUsers(p => {
              const u = { ...p };
              if (u[key]) {
                delete u[key][data.user_id];
                if (Object.keys(u[key]).length === 0) delete u[key];
              }
              return u;
            });
          }, 5000);
          updated[key][data.user_id] = { username: data.username, timeout };
          return updated;
        });
      } else {
        handlersRef.current.forEach(handler => handler(data));
      }
    };
  };

  // Heartbeat to keep connection alive and test bi-directional
  useEffect(() => {
    const timer = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const fetchUnreadCounts = async () => {
    try {
      const res = await api.get('/read-states/sync');
      const counts = { channels: {}, dms: {}, servers: {} };

      res.data.forEach(item => {
        if (item.channel_id) {
          counts.channels[item.channel_id] = item.unread_count;
          if (item.server_id) {
            counts.servers[item.server_id] = (counts.servers[item.server_id] || 0) + item.unread_count;
          }
        }
        if (item.dm_other_user_id) {
          counts.dms[item.dm_other_user_id] = item.unread_count;
        }
      });
      setUnreadCounts(counts);
    } catch (err) {
      console.error("Failed to sync unread counts", err);
    }
  };

  useEffect(() => {
    loadServers();
    loadUser();
    connectWebSocket();
    fetchUnreadCounts();

    return () => {
      if (ws.current) {
        ws.current.onclose = null; // Prevent reconnect on unmount
        ws.current.close();
      }
    };
  }, []);

  const loadUser = async () => {
    try {
      const res = await api.get('/users/me');
      setUser(res.data);
      setEditUsername(res.data.username);
      setEditEmail(res.data.email);
      setEditBio(res.data.bio || '');
      setEditAvatar(res.data.avatar_url || '');
      setEditTheme(res.data.theme || 'system');
      setEditPrivacyDM(res.data.privacy_dm || 'everyone');
      setNotifFriendRequests(res.data.notif_friend_requests);
      setNotifDirectMessages(res.data.notif_direct_messages);
      setNotifMentions(res.data.notif_mentions);
    } catch (err) {
      console.error('User fetch fail:', err);
      toast.error("Failed to load profile");
    }
  };

  const loadServers = async () => {
    try {
      const res = await api.get('/servers/');
      const list = Array.isArray(res.data) ? res.data : [];
      setServers(list);
      if (list.length > 0 && !activeServer) {
        setActiveServer(list[0]);
      }
    } catch (err) {
      console.error('Server fetch fail:', err);
      toast.error("Failed to load servers");
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        username: editUsername,
        email: editEmail,
        bio: editBio,
        avatar_url: editAvatar,
        theme: editTheme,
        privacy_dm: editPrivacyDM,
        notif_friend_requests: notifFriendRequests,
        notif_direct_messages: notifDirectMessages,
        notif_mentions: notifMentions
      };
      if (editPassword) payload.password = editPassword;

      const res = await api.patch('/users/me', payload);
      setUser(res.data);
      setShowSettings(false);
      setEditPassword('');
      localStorage.setItem('username', res.data.username);
      toast.success("Settings updated!");
    } catch (err) {
      const detail = err.response?.data?.detail;
      const message = Array.isArray(detail)
        ? (detail[0]?.msg || 'Validation error')
        : (typeof detail === 'string' ? detail : 'Failed to update settings');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // handleCreateServer removed (moved to modal)

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    if (!activeServer?.id || !channelName.trim()) return;
    setLoading(true);
    try {
      await api.post(`/servers/${activeServer.id}/channels`, {
        name: channelName,
        type: channelType
      });
      toast.success(`Channel "${channelName}" created!`);
      setChannelName('');
      setShowCreateChannelDialog(false);
      window.location.reload();
    } catch (err) {
      console.error('Channel create fail:', err);
      toast.error("Failed to create channel");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  // Call Handlers
  const startCall = (friend, type) => {
    console.log('DEBUG: startCall initiated', { friend, type, wsStatus: wsStatus });
    if (!friend || !friend.id) {
      toast.error("Cannot start call: invalid friend data");
      return;
    }

    if (wsStatus !== 'open') {
      toast.error("Signaling bridge is not connected. Trying to reconnect...");
      connectWebSocket();
      return;
    }

    const room = `dm-${friend.id}-${Date.now()}`;
    setRoomName(room);
    setCallType(type);
    setCallFriend(friend); // The person we are calling
    setCallState('outgoing');

    if (ws.current?.readyState === WebSocket.OPEN) {
      const payload = {
        type: 'call_invite',
        target_user_id: String(friend.id),
        room_name: room,
        call_type: type
      };
      console.log('DEBUG: Sending call_invite', payload);
      ws.current.send(JSON.stringify(payload));
      toast.success(`Calling ${friend.username}...`);
    } else {
      console.error('DEBUG: WS not open in startCall', ws.current?.readyState);
      toast.error("WebSocket connection lost");
    }
  };

  const acceptCall = () => {
    setCallState('connected');
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'call_accept',
        target_user_id: incomingCallData?.from_user_id,
        room_name: roomName
      }));
    }
  };

  const rejectCall = () => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'call_reject',
        target_user_id: incomingCallData?.from_user_id,
        room_name: roomName
      }));
    }
    setCallState('idle');
    setRoomName(null);
    setIncomingCallData(null);
    setCallFriend(null);
  };

  const endCall = () => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      const targetId = callState === 'incoming'
        ? incomingCallData?.from_user_id
        : (callFriend?.id || selectedFriend?.id);

      if (targetId) {
        ws.current.send(JSON.stringify({
          type: 'call_end',
          target_user_id: targetId,
          room_name: roomName
        }));
      }
    }
    setCallState('idle');
    setRoomName(null);
    setIncomingCallData(null);
    setCallFriend(null);
  };

  const registerMessageHandler = (handler) => {
    handlersRef.current.add(handler);
  };

  const unregisterMessageHandler = (handler) => {
    handlersRef.current.delete(handler);
  };

  return (
    <div className="relative h-screen w-screen bg-[#0a0a0b] text-gray-200 overflow-hidden flex flex-col select-none">
      <div className="flex-1 flex overflow-hidden w-full h-full relative">

        {/* Nav Sidebar */}
        <nav className="w-[72px] premium-sidebar flex flex-col items-center py-4 gap-3 shrink-0 z-50 h-full border-r border-white/5">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setViewMode('friends');
              setSelectedFriend(null);
              setActiveChannel(null);
            }}
            className={`group flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 ${viewMode === 'friends' ? 'bg-primary text-white' : 'bg-surface-700 text-gray-500 hover:bg-primary hover:text-white rounded-3xl hover:rounded-2xl'
              }`}
          >
            <Users size={24} />
          </motion.button>
          <div className="w-8 h-[2px] bg-white/5 my-1" />
          <Sidebar
            servers={servers}
            activeServer={activeServer}
            setActiveServer={(s) => { setActiveServer(s); setViewMode('servers'); setSelectedFriend(null); }}
            onOpenCreateServer={() => setShowCreateServerDialog(true)}
            unreadCounts={unreadCounts}
          />
        </nav>

        {/* Content Sidebar */}
        <aside className="w-64 bg-surface-800/80 backdrop-blur-3xl border-r border-white/5 flex flex-col shrink-0 z-40 h-full overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {viewMode === 'servers' ? (
              activeServer ? (
                <ChannelList
                  key={activeServer.id}
                  activeServer={activeServer}
                  activeChannel={activeChannel}
                  setActiveChannel={setActiveChannel}
                  voiceStates={voiceStates}
                  joinedVoiceChannel={joinedVoiceChannel}
                  voiceConnectionStatus={voiceConnectionStatus}
                  onJoinVoice={(channel) => setJoinedVoiceChannel(channel)}
                  onLeaveVoice={() => setJoinedVoiceChannel(null)}
                  onOpenCreateChannel={() => setShowCreateChannelDialog(true)}
                  onOpenInvite={() => setShowInviteModal(true)}
                  onOpenServerSettings={() => setShowServerSettings(true)}
                  onLeaveServer={() => {
                    loadServers();
                    setActiveServer(null);
                    setActiveChannel(null);
                    setViewMode('friends');
                  }}
                  unreadCounts={unreadCounts}
                />
              ) : (
                <div className="p-8 text-center text-gray-600 font-bold text-sm">LOADING...</div>
              )
            ) : (
              <FriendList
                onSelectFriend={(f) => { setSelectedFriend(f); setActiveChannel(null); }}
                onHoverUser={(user, pos) => { setHoveredUser(user); setPopoverPos(pos); }}
                onlineUsers={onlineUsers}
                unreadCounts={unreadCounts}
              />
            )}
          </div>

          {/* User Profile Bar */}
          <div className="h-16 bg-black/40 border-t border-white/5 px-3 flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden shrink-0 border border-white/5">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-primary font-bold text-xs">{(user?.username || '?').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white truncate">{user?.username}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className={`w-1.5 h-1.5 rounded-full ${wsStatus === 'open' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : wsStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'} `} />
                <span className="text-[9px] font-black uppercase text-gray-500 tracking-widest">
                  {wsStatus === 'open' ? 'Online' : wsStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-all"
            >
              <Settings size={18} />
            </button>
          </div>
        </aside>

        {/* Main View Area */}
        <main className="flex-1 flex flex-col bg-[#0f1012] z-30 relative h-full overflow-hidden min-w-0">
          <AnimatePresence mode="wait">
            {viewMode === 'servers' && activeChannel ? (
              <motion.div
                key={`ch-${activeChannel.id}`}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col min-h-0 h-full"
              >
                <header className="h-14 border-b border-white/5 flex items-center px-6 gap-3 shrink-0 bg-surface-800/20 backdrop-blur-xl">
                  <Hash size={18} className="text-gray-500" />
                  <h1 className="font-bold text-white tracking-tight truncate">{activeChannel.name}</h1>
                </header>
                <div className="flex-1 min-h-0">
                  <ChatArea
                    channel={activeChannel}
                    globalWs={ws.current}
                    registerMessageHandler={registerMessageHandler}
                    unregisterMessageHandler={unregisterMessageHandler}
                    typingUsers={typingUsers}
                  />
                </div>
              </motion.div>
            ) : viewMode === 'friends' && selectedFriend ? (
              <motion.div
                key={`dm-${selectedFriend.id}`}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col min-h-0 h-full"
              >
                <DMChat
                  friend={selectedFriend}
                  onBack={() => setSelectedFriend(null)}
                  globalWs={ws.current}
                  onStartCall={startCall}
                  registerMessageHandler={registerMessageHandler}
                  unregisterMessageHandler={unregisterMessageHandler}
                  onlineUsers={onlineUsers}
                  typingUsers={typingUsers}
                />
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex-1 flex flex-col items-center justify-center space-y-4 opacity-50"
              >
                <div className="w-32 h-32 rounded-[40px] bg-surface-700/50 flex items-center justify-center mb-4">
                  <Users size={64} className="text-gray-600" />
                </div>
                <h2 className="text-2xl font-black text-white">No Active Chat</h2>
                <p className="font-bold text-gray-600 tracking-widest text-xs uppercase">Select a channel or friend on the left</p>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Headless Voice Connection (no visible UI - sidebar handles it) */}
        {joinedVoiceChannel && (
          <VoiceArea
            channel={joinedVoiceChannel}
            onDisconnect={() => setJoinedVoiceChannel(null)}
            globalWs={ws.current}
            onConnectionChange={setVoiceConnectionStatus}
          />
        )}
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
              onClick={() => setShowSettings(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative glass-card w-full max-w-2xl bg-surface-800 rounded-[40px] overflow-hidden flex flex-col h-[600px] shadow-2xl border border-white/5"
            >
              <div className="flex h-full">
                {/* Modal Sidebar */}
                <div className="w-64 bg-black/20 border-r border-white/5 p-6 flex flex-col pt-10">
                  <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-4 px-4">User Settings</h4>
                  <div className="space-y-1">
                    {[
                      { id: 'account', label: 'My Account', icon: UserIcon },
                      { id: 'profiles', label: 'Profiles', icon: Camera },
                      { id: 'privacy', label: 'Privacy & Safety', icon: Shield },
                      { id: 'notifications', label: 'Notifications', icon: Bell },
                      { id: 'voice', label: 'Voice & Video', icon: Mic },
                      { id: 'appearance', label: 'Appearance', icon: Palette },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setSettingsTab(tab.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold text-sm transition-all focus:outline-none ${settingsTab === tab.id ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                          }`}
                      >
                        <tab.icon size={18} /> {tab.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-auto pt-6 border-t border-white/5">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-400/10 rounded-xl font-bold text-sm transition-all"
                    >
                      <LogOut size={18} /> Logout
                    </button>
                  </div>
                </div>

                {/* Modal Content */}
                <div className="flex-1 flex flex-col overflow-hidden bg-black/20">
                  <div className="flex justify-between items-center p-8 pb-4">
                    <div>
                      <h2 className="text-3xl font-black text-white">{
                        settingsTab === 'account' ? 'My Account' :
                          settingsTab === 'profiles' ? 'User Profile' :
                            settingsTab === 'privacy' ? 'Privacy & Safety' :
                              settingsTab === 'notifications' ? 'Notifications' :
                                settingsTab === 'voice' ? 'Voice & Video' : 'Appearance'
                      }</h2>
                      <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mt-1">
                        {settingsTab === 'account' ? 'Manage your account details' : 'Configure your experience'}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowSettings(false)}
                      className="p-2.5 bg-white/5 border border-white/5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-all active:scale-90"
                    >
                      <X size={24} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar">
                    <form onSubmit={handleUpdateProfile} className="space-y-8 pb-20">
                      {settingsTab === 'account' && (
                        <div className="space-y-6">
                          <div className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-4">
                            <div>
                              <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest block mb-2 px-1">Username</label>
                              <input
                                type="text"
                                value={editUsername}
                                onChange={(e) => setEditUsername(e.target.value)}
                                className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 font-bold text-white focus:border-primary focus:outline-none transition-all"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest block mb-2 px-1">Email</label>
                              <input
                                type="email"
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 font-bold text-white focus:border-primary focus:outline-none transition-all"
                              />
                            </div>
                          </div>

                          <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                            <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-4">Password Change</h4>
                            <input
                              type="password"
                              placeholder="New Password (leave blank to keep current)"
                              value={editPassword}
                              onChange={(e) => setEditPassword(e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 font-bold text-white focus:border-primary focus:outline-none transition-all"
                            />
                          </div>
                        </div>
                      )}

                      {settingsTab === 'profiles' && (
                        <div className="space-y-6">
                          <div className="flex items-center gap-6 p-6 bg-white/5 rounded-3xl border border-white/5">
                            <div className="w-28 h-28 rounded-[40px] bg-primary/20 flex items-center justify-center shrink-0 overflow-hidden relative group cursor-pointer border-2 border-dashed border-white/10 hover:border-primary/50 transition-all">
                              {editAvatar ? (
                                <img src={editAvatar} alt="avatar" className="w-full h-full object-cover" />
                              ) : (
                                <Camera size={32} className="text-primary/50" />
                              )}
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Camera size={24} className="text-white" />
                              </div>
                            </div>
                            <div className="flex-1">
                              <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest block mb-2">Avatar URL</label>
                              <input
                                type="text"
                                placeholder="https://example.com/image.jpg"
                                value={editAvatar}
                                onChange={(e) => setEditAvatar(e.target.value)}
                                className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none transition-all"
                              />
                            </div>
                          </div>
                          <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                            <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest block mb-4">About Me</label>
                            <textarea
                              value={editBio}
                              onChange={(e) => setEditBio(e.target.value)}
                              placeholder="Tell us about yourself..."
                              rows={4}
                              className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-gray-300 focus:border-primary focus:outline-none transition-all resize-none shadow-inner"
                            />
                          </div>
                        </div>
                      )}

                      {settingsTab === 'privacy' && (
                        <div className="space-y-6">
                          <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                            <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-6">Direct Messages</h4>
                            <div className="space-y-4">
                              {[
                                { id: 'everyone', label: 'Everyone', desc: 'Anyone can DM you' },
                                { id: 'friends_only', label: 'Friends Only', desc: 'Only your friends can DM you' },
                                { id: 'server_only', label: 'Only Server Members', desc: 'Only people in your servers can DM you' }
                              ].map((opt) => (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => setEditPrivacyDM(opt.id)}
                                  className={`w-full text-left p-4 rounded-2xl border transition-all ${editPrivacyDM === opt.id ? 'bg-primary/20 border-primary shadow-lg shadow-primary/5' : 'bg-black/20 border-white/5 hover:border-white/10'
                                    }`}
                                >
                                  <div className="text-sm font-bold text-white">{opt.label}</div>
                                  <div className="text-xs text-gray-500 font-bold">{opt.desc}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {settingsTab === 'notifications' && (
                        <div className="space-y-6">
                          <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                            <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-6">Push Notifications</h4>
                            <div className="space-y-4">
                              {[
                                { label: 'Friend Requests', value: notifFriendRequests, setter: setNotifFriendRequests },
                                { label: 'Direct Messages', value: notifDirectMessages, setter: setNotifDirectMessages },
                                { label: 'Mentions', value: notifMentions, setter: setNotifMentions },
                              ].map((notif, i) => (
                                <label key={i} className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5 cursor-pointer hover:border-white/10 transition-colors">
                                  <span className="text-sm font-bold text-gray-300">{notif.label}</span>
                                  <input
                                    type="checkbox"
                                    checked={notif.value}
                                    onChange={(e) => notif.setter(e.target.checked)}
                                    className="toggle toggle-primary toggle-lg"
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {settingsTab === 'voice' && (
                        <div className="space-y-6">
                          <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                            <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-8">Voice Settings</h4>
                            <div className="space-y-8">
                              <div>
                                <div className="flex justify-between mb-4">
                                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Input Volume</span>
                                  <span className="text-xs font-black text-primary">{inputVolume}%</span>
                                </div>
                                <input type="range" min="0" max="100" value={inputVolume} onChange={(e) => setInputVolume(e.target.value)} className="range range-primary range-sm" />
                              </div>
                              <div>
                                <div className="flex justify-between mb-4">
                                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Output Volume</span>
                                  <span className="text-xs font-black text-primary">{outputVolume}%</span>
                                </div>
                                <input type="range" min="0" max="100" value={outputVolume} onChange={(e) => setOutputVolume(e.target.value)} className="range range-secondary range-sm" />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {settingsTab === 'appearance' && (
                        <div className="space-y-6">
                          <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                            <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-6">Theme Selection</h4>
                            <div className="grid grid-cols-3 gap-4">
                              {[
                                { id: 'dark', label: 'Dark', icon: Moon },
                                { id: 'light', label: 'Light', icon: Sun },
                                { id: 'system', label: 'System', icon: Palette }
                              ].map((theme) => (
                                <button
                                  key={theme.id}
                                  type="button"
                                  onClick={() => setEditTheme(theme.id)}
                                  className={`flex flex-col items-center gap-3 p-6 rounded-3xl border transition-all ${editTheme === theme.id ? 'bg-primary/20 border-primary shadow-lg shadow-primary/5' : 'bg-black/20 border-white/5 hover:border-white/10'
                                    }`}
                                >
                                  <theme.icon size={24} className={editTheme === theme.id ? 'text-primary' : 'text-gray-500'} />
                                  <span className="text-xs font-black uppercase tracking-widest">{theme.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="fixed bottom-10 right-10 flex gap-4">
                        <button
                          type="submit"
                          disabled={loading}
                          className="px-10 bg-primary hover:bg-primary-focus text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/40 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                        >
                          <Save size={20} /> SAVE CHANGES
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showCreateServerDialog && (
          <CreateJoinServerModal
            isOpen={showCreateServerDialog}
            onClose={() => setShowCreateServerDialog(false)}
            onServerCreated={() => {
              loadServers();
              setShowCreateServerDialog(false);
            }}
          />
        )}

        <AnimatePresence>
          {showInviteModal && activeServer && (
            <InviteModal
              isOpen={showInviteModal}
              onClose={() => setShowInviteModal(false)}
              server={activeServer}
            />
          )}
          {showServerSettings && activeServer && (
            <ServerSettingsModal
              isOpen={showServerSettings}
              onClose={() => setShowServerSettings(false)}
              server={activeServer}
              onUpdate={loadServers}
            />
          )}
        </AnimatePresence>

        {showCreateChannelDialog && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="glass-card w-full max-w-sm p-10 rounded-3xl">
              <h3 className="text-2xl font-black text-white mb-6">Create Channel</h3>
              <form onSubmit={handleCreateChannel}>
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value.toLowerCase().replace(/\s/g, '-'))}
                  className="w-full bg-black/40 text-white rounded-xl px-4 py-4 mb-4 border border-white/5 focus:outline-none focus:border-primary"
                  placeholder="channel-name"
                />
                <select value={channelType} onChange={(e) => setChannelType(e.target.value)} className="w-full bg-black/40 text-white p-4 rounded-xl mb-6 border border-white/5">
                  <option value="TEXT">Text Channel</option>
                  <option value="VOICE">Voice Channel</option>
                </select>
                <div className="flex gap-4">
                  <button type="submit" className="flex-1 bg-primary py-4 rounded-xl font-bold">CREATE</button>
                  <button type="button" onClick={() => setShowCreateChannelDialog(false)} className="px-4 text-gray-500 font-bold text-sm">BACK</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Mini Profile Popover (Global) */}
      <AnimatePresence>
        {hoveredUser && (
          <motion.div
            initial={{ opacity: 0, x: -20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.95 }}
            className="fixed z-[1000] pointer-events-none"
            style={{
              top: popoverPos.top,
              left: popoverPos.left + 10
            }}
          >
            <div className="glass-card w-72 bg-surface-900/98 backdrop-blur-2xl border border-white/10 rounded-[32px] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)]">
              <div className="h-20 bg-gradient-to-br from-primary/30 to-secondary/10" />
              <div className="px-6 pb-6 -mt-10">
                <div className="w-20 h-20 rounded-[28px] bg-surface-800 border-[6px] border-[#0a0a0b] flex items-center justify-center overflow-hidden mb-4 shadow-xl">
                  {hoveredUser.avatar_url ? (
                    <img src={hoveredUser.avatar_url} alt={hoveredUser.username} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-black text-primary">{hoveredUser.username[0].toUpperCase()}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-black text-white">{hoveredUser.username}</h3>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" />
                </div>
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-4">DeepCall Pioneer</p>

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <div>
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 px-0.5">About Me</h4>
                    <div className="bg-black/20 rounded-2xl p-3 border border-white/5">
                      <p className="text-xs text-gray-300 leading-relaxed italic">
                        {hoveredUser.bio || "No bio set yet."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-black/20 flex justify-between items-center text-[10px] font-black text-gray-500 uppercase tracking-widest">
                <span>Joined Oct 2023</span>
                <div className="flex gap-2">
                  <div className="w-4 h-4 rounded-full bg-white/5 border border-white/5" />
                  <div className="w-4 h-4 rounded-full bg-white/5 border border-white/5" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Call Overlay */}
      <AnimatePresence>
        {callState !== 'idle' && (
          <CallOverlay
            callState={callState}
            callType={callType}
            roomName={roomName}
            friendName={callFriend?.username || (callState === 'outgoing' ? selectedFriend?.username : 'Unknown')}
            friendAvatar={callFriend?.avatar_url || (callState === 'outgoing' ? selectedFriend?.avatar_url : null)}
            onAccept={acceptCall}
            onReject={rejectCall}
            onEnd={endCall}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
