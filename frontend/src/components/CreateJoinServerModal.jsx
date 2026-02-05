import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Upload, Globe, Lock } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function CreateJoinServerModal({ isOpen, onClose, onServerCreated }) {
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'join'
  const [serverName, setServerName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!serverName.trim()) return;
    setLoading(true);
    try {
      const res = await api.post('/servers/', { name: serverName });
      toast.success(`Server "${serverName}" created!`);
      onServerCreated(res.data);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to create server");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    
    // Extract code from URL if full URL is pasted
    let code = inviteCode.trim();
    if (code.includes('/invite/')) {
        code = code.split('/invite/')[1];
    }
    
    setLoading(true);
    try {
      const res = await api.post(`/invites/${code}/join`);
      toast.success("Joined server successfully!");
      onServerCreated(); // Reload list
      onClose();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || "Failed to join server";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative bg-surface-800 w-full max-w-md border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="flex border-b border-white/5">
            <button 
                onClick={() => setActiveTab('create')}
                className={`flex-1 py-4 text-center font-black text-xs uppercase tracking-widest transition-colors ${activeTab === 'create' ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
            >
                Create Server
            </button>
            <button 
                onClick={() => setActiveTab('join')}
                className={`flex-1 py-4 text-center font-black text-xs uppercase tracking-widest transition-colors ${activeTab === 'join' ? 'bg-emerald-500/10 text-emerald-500' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
            >
                Join Server
            </button>
        </div>

        <div className="p-8">
            {activeTab === 'create' ? (
                <form onSubmit={handleCreate}>
                    <div className="text-center mb-6">
                        <div className="w-20 h-20 bg-primary/20 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                            <Lock size={32} className="text-primary" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Create Your Space</h3>
                        <p className="text-gray-400 text-sm">Create a new server to hang out with friends.</p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest block mb-2 px-1">Server Name</label>
                            <input
                                type="text"
                                value={serverName}
                                onChange={(e) => setServerName(e.target.value)}
                                placeholder="My Awesome Server"
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none transition-all font-bold"
                                autoFocus
                            />
                        </div>
                        
                        <button 
                            type="submit" 
                            disabled={loading || !serverName}
                            className="w-full bg-primary hover:bg-primary-focus text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 disabled:scale-100"
                        >
                            {loading ? 'Creating...' : 'Create Server'}
                        </button>
                    </div>
                </form>
            ) : (
                <form onSubmit={handleJoin}>
                    <div className="text-center mb-6">
                         <div className="w-20 h-20 bg-emerald-500/20 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                            <Globe size={32} className="text-emerald-500" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Join a Server</h3>
                        <p className="text-gray-400 text-sm">Enter an invite link or code to join an existing server.</p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest block mb-2 px-1">Invite Link / Code</label>
                            <input
                                type="text"
                                value={inviteCode}
                                onChange={(e) => setInviteCode(e.target.value)}
                                placeholder="https://deepcall.app/invite/..."
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 focus:outline-none transition-all font-mono text-sm"
                                autoFocus
                            />
                        </div>
                        
                        <button 
                            type="submit" 
                            disabled={loading || !inviteCode}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:scale-100"
                        >
                            {loading ? 'Joining...' : 'Join Server'}
                        </button>
                    </div>
                </form>
            )}
        </div>

        <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
        >
            <X size={20} />
        </button>
      </motion.div>
    </div>
  );
}
