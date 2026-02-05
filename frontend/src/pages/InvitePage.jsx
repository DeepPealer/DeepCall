import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { motion } from 'framer-motion';
import { UserPlus, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function InvitePage() {
    const { code } = useParams();
    const navigate = useNavigate();
    const [invite, setInvite] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [joining, setJoining] = useState(false);

    useEffect(() => {
        fetchInvite();
    }, [code]);

    const fetchInvite = async () => {
        try {
            const res = await api.get(`/invites/${code}`);
            setInvite(res.data);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.detail || "Invalid or expired invite.");
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            // Redirect to login, preserving return url
            // For now, just go to login
            navigate(`/login?redirect=/invite/${code}`);
            return;
        }

        setJoining(true);
        try {
            const res = await api.post(`/invites/${code}/join`);
            toast.success("Joined server!");
            navigate('/app');
        } catch (err) {
            console.error(err);
            const msg = err.response?.data?.detail || "Failed to join server";
            if (err.response?.status === 401) {
                 navigate(`/login?redirect=/invite/${code}`);
            } else {
                 setError(msg);
            }
        } finally {
            setJoining(false);
        }
    };

    if (loading) {
        return (
            <div className="h-screen w-screen bg-[#0a0a0b] flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-screen w-screen bg-[#0a0a0b] flex items-center justify-center text-center p-4">
                <div className="max-w-md w-full bg-surface-800 p-8 rounded-3xl border border-white/5">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle size={32} className="text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Invite Invalid</h2>
                    <p className="text-gray-400 mb-6">{error}</p>
                    <button 
                        onClick={() => navigate('/app')}
                        className="w-full bg-surface-700 hover:bg-surface-600 text-white font-bold py-3 rounded-xl transition-all"
                    >
                        Go to App
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen bg-[url('/bg-pattern.svg')] bg-[#0a0a0b] bg-cover flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/10 via-transparent to-purple-500/10 pointer-events-none" />
            
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="relative max-w-md w-full bg-surface-800/80 backdrop-blur-xl p-8 rounded-[32px] border border-white/10 shadow-2xl flex flex-col items-center text-center"
            >
                {invite?.server_icon ? (
                    <img src={invite.server_icon} alt={invite.server_name} className="w-24 h-24 rounded-[32px] mb-6 object-cover shadow-lg" />
                ) : (
                    <div className="w-24 h-24 bg-primary rounded-[32px] flex items-center justify-center text-4xl font-bold text-white mb-6 shadow-lg shadow-primary/20">
                        {invite?.server_name?.charAt(0).toUpperCase()}
                    </div>
                )}

                <h3 className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-2">You've been invited to join</h3>
                <h1 className="text-3xl font-black text-white mb-8 leading-tight">{invite?.server_name}</h1>

                <div className="flex items-center gap-2 mb-8 bg-black/20 px-4 py-2 rounded-full border border-white/5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-gray-400">
                        Invited by <span className="text-white">{invite?.inviter_username}</span>
                    </span>
                </div>

                <button 
                    onClick={handleJoin}
                    disabled={joining}
                    className="w-full bg-primary hover:bg-primary-focus text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/30 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 text-lg"
                >
                    {joining ? (
                        <>Joining...</>
                    ) : (
                        <>Aceept Invite</>
                    )}
                </button>
            </motion.div>
        </div>
    );
}
