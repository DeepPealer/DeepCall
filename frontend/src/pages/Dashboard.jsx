import { useState, useEffect } from 'react';
import { Users, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import ChannelList from '../components/ChannelList';
import ChatArea from '../components/ChatArea';
import VoiceArea from '../components/VoiceArea';
import FriendList from '../components/FriendList';
import DMChat from '../components/DMChat';
import api from '../api/axios';

export default function Dashboard() {
  const [servers, setServers] = useState([]);
  const [activeServer, setActiveServer] = useState(null);
  const [activeChannel, setActiveChannel] = useState(null);
  const [viewMode, setViewMode] = useState('servers');
  const [selectedFriend, setSelectedFriend] = useState(null);

  const [showCreateServerDialog, setShowCreateServerDialog] = useState(false);
  const [showCreateChannelDialog, setShowCreateChannelDialog] = useState(false);
  const [serverName, setServerName] = useState('');
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState('TEXT');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadServers();
  }, []);

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
    }
  };

  const handleCreateServer = async (e) => {
    e.preventDefault();
    if (!serverName.trim()) return;
    setLoading(true);
    try {
      await api.post('/servers/', { name: serverName });
      setServerName('');
      setShowCreateServerDialog(false);
      await loadServers();
    } catch (err) {
      console.error('Server create fail:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    if (!activeServer?.id || !channelName.trim()) return;
    setLoading(true);
    try {
      await api.post(`/servers/${activeServer.id}/channels`, {
        name: channelName,
        type: channelType
      });
      setChannelName('');
      setShowCreateChannelDialog(false);
      window.location.reload(); 
    } catch (err) {
      console.error('Channel create fail:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-screen w-screen bg-[#0a0a0b] text-gray-200 overflow-hidden flex flex-col select-none">
      <div className="flex-1 flex overflow-hidden w-full h-full relative">
        
        {/* Nav Sidebar - Fixed Width */}
        <nav className="w-[72px] premium-sidebar flex flex-col items-center py-4 gap-3 shrink-0 z-50 h-full">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setViewMode('friends');
              setSelectedFriend(null);
              setActiveChannel(null);
            }}
            className={`group flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 ${
              viewMode === 'friends' ? 'bg-primary text-white' : 'bg-surface-700 text-gray-500 hover:bg-primary hover:text-white rounded-3xl hover:rounded-2xl'
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
          />
        </nav>

        {/* Content Sidebar - Fixed Width */}
        <aside className="w-64 bg-surface-800/80 backdrop-blur-3xl border-r border-white/5 flex flex-col shrink-0 z-40 h-full overflow-hidden">
           {viewMode === 'servers' ? (
             activeServer ? (
               <ChannelList 
                 key={activeServer.id}
                 activeServer={activeServer} 
                 activeChannel={activeChannel} 
                 setActiveChannel={setActiveChannel} 
                 onOpenCreateChannel={() => setShowCreateChannelDialog(true)}
               />
             ) : (
               <div className="p-8 text-center text-gray-600 font-bold text-sm">LOADING...</div>
             )
           ) : (
             <FriendList onSelectFriend={(f) => { setSelectedFriend(f); setActiveChannel(null); }} />
           )}
        </aside>

        {/* Main View Area - Flex Fill */}
        <main className="flex-1 flex flex-col bg-[#0f1012] z-30 relative h-full overflow-hidden min-w-0">
            <AnimatePresence mode="wait">
                {viewMode === 'servers' && activeChannel ? (
                  <motion.div 
                    key={`ch-${activeChannel.id}`}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex-1 flex flex-col min-h-0 h-full"
                  >
                    <header className="h-14 border-b border-white/5 flex items-center px-6 gap-3 shrink-0">
                      <Hash size={18} className="text-gray-500" />
                      <h1 className="font-bold text-white tracking-tight truncate">{activeChannel.name}</h1>
                    </header>
                    <div className="flex-1 min-h-0">
                        <ChatArea channel={activeChannel} />
                    </div>
                  </motion.div>
                ) : viewMode === 'friends' && selectedFriend ? (
                  <motion.div 
                    key={`dm-${selectedFriend.id}`}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex-1 flex flex-col min-h-0 h-full"
                  >
                    <DMChat friend={selectedFriend} onBack={() => setSelectedFriend(null)} />
                  </motion.div>
                ) : (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex-1 flex flex-col items-center justify-center space-y-4 opacity-50"
                  >
                    <div className="w-20 h-20 rounded-3xl bg-surface-700 flex items-center justify-center">
                        <Users size={40} className="text-gray-600" />
                    </div>
                    <p className="font-bold text-gray-600 tracking-widest text-xs uppercase">Select a conversation</p>
                  </motion.div>
                )}
            </AnimatePresence>
        </main>

        {/* Voice area overlay */}
        {activeChannel?.type === 'VOICE' && (
            <div className="absolute bottom-6 right-6 w-80 z-[100]">
                <VoiceArea channel={activeChannel} />
            </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showCreateServerDialog && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
             <div className="glass-card w-full max-w-sm p-10 rounded-3xl">
                <h3 className="text-2xl font-black text-white mb-6">Create Server</h3>
                <form onSubmit={handleCreateServer}>
                    <input
                        type="text"
                        value={serverName}
                        onChange={(e) => setServerName(e.target.value)}
                        placeholder="Server Name"
                        className="w-full bg-black/40 text-white rounded-xl px-4 py-4 mb-6 border border-white/5 focus:border-primary focus:outline-none"
                    />
                    <div className="flex gap-4">
                        <button type="submit" className="flex-1 bg-primary py-4 rounded-xl font-bold">CREATE</button>
                        <button type="button" onClick={() => setShowCreateServerDialog(false)} className="px-4 text-gray-500 font-bold text-sm">BACK</button>
                    </div>
                </form>
             </div>
          </div>
        )}

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
    </div>
  );
}
