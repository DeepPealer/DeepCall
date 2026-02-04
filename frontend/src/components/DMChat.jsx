import { useState, useEffect, useRef } from 'react';
import { Send, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../api/axios';

export default function DMChat({ friend, onBack }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const ws = useRef(null);

  useEffect(() => {
    loadMessages();
    
    // Connect to WebSocket for real-time updates
    const token = localStorage.getItem('token');
    if (token) {
      const socket = new WebSocket(`ws://localhost:8002/ws?token=${token}`);
      ws.current = socket;
      
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("DM Received:", data);
        
        if (data.type === 'dm' || data.type === 'message') {
           const currentUserId = localStorage.getItem('user_id');
           const currentUsername = localStorage.getItem('username');
           
           // Normalize IDs to strings for comparison
           const senderId = String(data.sender_id || '');
           const myId = String(currentUserId || '');
           const friendId = String(friend.id || '');

           const isFromMe = senderId === myId || data.user === currentUsername;
           const isFromFriend = senderId === friendId || data.user === friend.username;

           if (isFromFriend || isFromMe) {
              setMessages(prev => {
                // Check if message already exists by ID or content+time parity
                // This prevents duplicates from WebSocket broadcasts of messages we already have optimistically or via POST response
                if (prev.some(m => m.id === data.id)) return prev;
                // If we find an optimistic message with same content, it will be replaced by the POST response handler, 
                // so we ignore it here if it's from us.
                if (isFromMe && prev.some(m => m.optimistic && m.content === data.content)) return prev;
                
                return [...prev, data];
              });
           }
        }
      };
    }

    return () => {
      if (ws.current) ws.current.close();
    };
  }, [friend?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    if (!friend?.id) return;
    try {
      const res = await api.get(`/dms/${friend.id}`);
      setMessages(res.data);
    } catch (err) {
      console.error('Failed to load messages', err);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !friend?.id) return;

    const content = input;
    setInput('');

    // Optimistic Update
    const tempId = `temp-${Date.now()}`;
    const myUsername = localStorage.getItem('username');
    const myUserId = localStorage.getItem('user_id');
    
    const optimisticMsg = {
      id: tempId,
      content,
      user: myUsername || 'Me',
      sender_id: myUserId,
      created_at: new Date().toISOString(),
      optimistic: true
    };
    
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const res = await api.post(`/dms/${friend.id}`, { content });
      // Replace optimistic message with real one from server
      setMessages(prev => prev.map(m => m.id === tempId ? res.data : m));
    } catch (err) {
      console.error('Failed to send message', err);
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== tempId));
      alert("Failed to send message. Is the server running?");
    }
  };

  if (!friend) return null;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-transparent">
      {/* Header - Fixed Height */}
      <header className="h-14 border-b border-white/5 flex items-center px-6 gap-3 bg-surface-800/20 backdrop-blur-xl shrink-0 z-10">
        <button 
          onClick={onBack} 
          className="p-2 -ml-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center font-bold text-primary">
            {friend.username ? friend.username[0].toUpperCase() : '?'}
          </div>
          <h3 className="font-bold text-white tracking-tight">{friend.username}</h3>
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
        </div>
      </header>

      {/* Messages Area - Flex Fill with Scroll */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar min-h-0 w-full">
        {loading ? (
          <div className="flex items-center justify-center h-full opacity-50 font-bold text-xs uppercase tracking-widest">Loading Conversation...</div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-30 select-none">
             <div className="w-16 h-16 rounded-3xl bg-surface-700 flex items-center justify-center">
                <Send size={32} />
             </div>
             <p className="font-bold">No history with {friend.username}</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const myUserId = localStorage.getItem('user_id');
            const isMe = msg.sender_id === myUserId || msg.user === localStorage.getItem('username');
            
            return (
              <motion.div
                key={msg.id || i}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl shadow-xl ${
                  isMe 
                    ? 'bg-primary text-white rounded-tr-none' 
                    : 'bg-surface-700 text-gray-200 rounded-tl-none border border-white/5'
                }`}>
                  <p className="text-[15px] leading-relaxed break-words">{msg.content}</p>
                  <div className={`text-[9px] mt-1 font-black uppercase opacity-40 ${isMe ? 'text-right' : 'text-left'}`}>
                    {new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Fixed Height */}
      <div className="p-6 shrink-0 bg-[#0f1012]/80 backdrop-blur-md">
        <form onSubmit={sendMessage} className="relative group max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message @${friend.username}`}
            className="w-full bg-surface-700/40 text-white rounded-2xl px-5 py-4 border border-white/5 focus:border-primary focus:outline-none transition-all pr-14 shadow-inner"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 disabled:opacity-20 transition-all"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
