import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Link as LinkIcon, RefreshCw, Send } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function InviteModal({ isOpen, onClose, server }) {
  const [inviteCode, setInviteCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [settings] = useState({ max_uses: 0, expires_seconds: 604800 });

  useEffect(() => {
    if (isOpen && !inviteCode) {
        generateInvite();
    }
  }, [isOpen]);

  const generateInvite = async () => {
    setLoading(true);
    try {
        const res = await api.post(`/servers/${server.id}/invites`, settings);
        setInviteCode(res.data.code);
    } catch (err) {
        console.error("Failed to create invite", err);
        toast.error("Failed to generate invite link");
    } finally {
        setLoading(false);
    }
  };

  const copyToClipboard = () => {
    const link = `${window.location.origin}/invite/${inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Invite link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const link = inviteCode ? `${window.location.origin}/invite/${inviteCode}` : 'Generating...';

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 overflow-hidden">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-md" 
        onClick={onClose} 
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative bg-[#1e1f22] w-full max-w-md border border-white/5 rounded-[32px] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.7)] overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-indigo-500 to-purple-500" />
        
        <div className="p-10">
            <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 shadow-inner">
                        <UserPlusIcon size={28} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-white tracking-tight">Invite friends</h3>
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">to {server?.name}</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-all active:scale-90">
                    <X size={20} />
                </button>
            </div>

            <p className="text-gray-400 text-sm mb-8 leading-relaxed font-medium">
                Invite links are the best way to grow your server. Shared links expire after 7 days by default.
            </p>

            <div className="space-y-6">
                <div>
                    <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] mb-3 block px-1">Shareable Link</label>
                    <div className="bg-black/30 border border-white/5 rounded-[24px] p-2 flex items-center gap-2 focus-within:border-primary/50 transition-all shadow-inner group">
                        <div className="bg-[#2b2d31] p-4 rounded-[20px] shadow-sm text-gray-400 group-focus-within:text-primary transition-colors">
                            <LinkIcon size={20} />
                        </div>
                        <input 
                            readOnly 
                            value={link} 
                            className="flex-1 bg-transparent border-none focus:outline-none text-white font-mono text-xs px-3 font-bold"
                            onClick={(e) => e.target.select()}
                        />
                        <button 
                            onClick={copyToClipboard}
                            className={`px-6 py-4 rounded-[20px] font-black text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95 ${
                                copied 
                                ? 'bg-emerald-500 text-white' 
                                : 'bg-primary hover:bg-primary-focus text-white'
                            }`}
                        >
                            {copied ? 'Copied' : 'Copy'}
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2 text-[11px] font-black text-gray-500 uppercase tracking-widest italic opacity-60">
                         Expires in 7 days
                    </div>
                    <button 
                        onClick={generateInvite}
                        disabled={loading}
                        className="text-[11px] font-black text-primary hover:text-primary-focus uppercase tracking-[0.15em] flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        Refresh Link
                    </button>
                </div>
            </div>
            
            <div className="mt-10 pt-8 border-t border-white/5 flex gap-4">
                 <button 
                    onClick={onClose} 
                    className="flex-1 py-5 text-gray-400 font-black text-[12px] uppercase tracking-widest hover:text-white hover:bg-white/5 rounded-2xl transition-all active:scale-95"
                 >
                    Dismiss
                 </button>
                 <button 
                    onClick={copyToClipboard}
                    className="flex-1 py-5 bg-[#2b2d31] hover:bg-[#313338] text-white font-black text-[12px] uppercase tracking-widest rounded-2xl transition-all border border-white/5 shadow-2xl active:scale-95"
                 >
                    Copy Link
                 </button>
            </div>
        </div>
      </motion.div>
    </div>
  );
}

function UserPlusIcon({ size }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
        </svg>
    );
}
