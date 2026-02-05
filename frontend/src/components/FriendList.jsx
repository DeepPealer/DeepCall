import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Check, X, Users } from 'lucide-react';
import api from '../api/axios';

export default function FriendList({ onSelectFriend, onHoverUser }) {
  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleMouseEnter = (e, friend) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onHoverUser && onHoverUser(friend, { top: rect.top, left: rect.right });
  };

  const handleMouseLeave = () => {
    onHoverUser && onHoverUser(null);
  };

  useEffect(() => {
    loadFriends();
    loadPending();
  }, []);

  const loadFriends = async () => {
    try {
      const res = await api.get('/friends/');
      setFriends(res.data);
    } catch (err) {
      console.error('Failed to load friends', err);
    }
  };

  const loadPending = async () => {
    try {
      const res = await api.get('/friends/pending');
      setPending(res.data);
    } catch (err) {
      console.error('Failed to load pending', err);
    }
  };

  const sendRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/friends/request', { friend_username: username });
      setUsername('');
      setShowAddDialog(false);
      alert('Friend request sent!');
    } catch (err) {
      console.error('Friend request error:', err);
      console.error('Response:', err.response?.data);
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail) || 'Failed to send request');
    } finally {
      setLoading(false);
    }
  };

  const acceptRequest = async (userId) => {
    try {
      await api.post(`/friends/${userId}/accept`);
      await loadFriends();
      await loadPending();
    } catch (err) {
      console.error('Failed to accept', err);
    }
  };

  const rejectRequest = async (userId) => {
    try {
      await api.delete(`/friends/${userId}`);
      await loadPending();
    } catch (err) {
      console.error('Failed to reject', err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-white">Friends</h2>
        </div>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddDialog(true)}
          className="btn btn-sm btn-primary"
        >
          <UserPlus size={16} />
        </motion.button>
      </div>

      {/* Pending Requests */}
      {pending.length > 0 && (
        <div className="p-3 bg-yellow-500/10 border-b border-yellow-500/20">
          <h3 className="text-sm font-semibold text-yellow-500 mb-2">Pending Requests ({pending.length})</h3>
          <div className="space-y-2">
            {pending.map(p => (
              <div key={p.id} className="flex items-center justify-between glass-card p-2 rounded-lg gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden border border-white/5">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt={p.username} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-primary text-xs font-bold">{p.username[0].toUpperCase()}</span>
                  )}
                </div>
                <span className="text-white text-sm flex-1 truncate font-medium">{p.username}</span>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => acceptRequest(p.id)} className="btn btn-xs btn-success">
                    <Check size={14} />
                  </button>
                  <button onClick={() => rejectRequest(p.id)} className="btn btn-xs btn-error">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 relative custom-scrollbar">
        {friends.map(friend => (
          <motion.div
            key={friend.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onMouseEnter={(e) => handleMouseEnter(e, friend)}
            onMouseLeave={handleMouseLeave}
            className="group"
          >
            <button
              onClick={() => onSelectFriend && onSelectFriend(friend)}
              className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-all text-left border border-transparent hover:border-white/5"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 overflow-hidden border border-white/5 shadow-inner">
                {friend.avatar_url ? (
                  <img src={friend.avatar_url} alt={friend.username} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-primary font-black">{(friend.username || '?')[0].toUpperCase()}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white truncate text-sm">{friend.username}</div>
                <div className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                   Online
                </div>
              </div>
            </button>
          </motion.div>
        ))}
        {friends.length === 0 && pending.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No friends yet</p>
            <p className="text-sm">Add someone to get started!</p>
          </div>
        )}
      </div>

      {/* Add Friend Dialog */}
      <AnimatePresence>
        {showAddDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 flex items-center justify-center z-50"
            onClick={() => setShowAddDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card p-6 rounded-xl w-96 max-w-full mx-4"
            >
              <h3 className="text-xl font-bold text-white mb-4">Add Friend</h3>
              {error && <div className="alert alert-error mb-3 text-sm">{error}</div>}
              <form onSubmit={sendRequest} className="space-y-4">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="input input-bordered w-full bg-black/40 text-white"
                  required
                />
                <div className="flex gap-2">
                  <button type="submit" disabled={loading} className="btn btn-primary flex-1">
                    {loading ? 'Sending...' : 'Send Request'}
                  </button>
                  <button type="button" onClick={() => setShowAddDialog(false)} className="btn btn-ghost">
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
