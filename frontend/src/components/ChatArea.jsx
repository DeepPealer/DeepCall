import { useState, useEffect, useRef } from 'react';
import { Send, Hash, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../api/axios';

const WS_URL = 'ws://localhost:8002/ws'; 

export default function ChatArea({ channel }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const ws = useRef(null);

  useEffect(() => {
    loadMessages();
    const token = localStorage.getItem('token');
    if (token) {
        const socket = new WebSocket(`${WS_URL}?token=${token}`);
        ws.current = socket;
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            // Ensure message belongs to current channel and we don't have it yet (if broadcast comes after POST)
            if (data.channel_id === channel.id || data.type === 'message') {
                setMessages(prev => {
                    if (prev.some(m => m.id === data.id)) return prev;
                    return [...prev, data];
                });
            }
        };
    }
    return () => {
        if (ws.current) ws.current.close();
    };
  }, [channel.id]);

  const loadMessages = async () => {
    setLoading(true);
    setMessages([]);
    try {
      const res = await api.get(`/channels/${channel.id}/messages`);
      setMessages(res.data);
    } catch (err) {
      console.error('History load fail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !ws.current) return;
    const msgData = {
      channel_id: channel.id,
      content: input
    };
    ws.current.send(JSON.stringify(msgData));
    setInput('');
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-transparent">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-2 custom-scrollbar min-h-0 w-full">
        {loading ? (
           <div className="flex items-center justify-center h-full opacity-50 font-bold text-xs uppercase tracking-widest">Loading History...</div>
        ) : messages.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-full opacity-30 select-none">
              <div className="w-20 h-20 rounded-3xl bg-surface-700 flex items-center justify-center mb-4">
                 <Hash size={40} />
              </div>
              <h3 className="text-2xl font-black">Welcome to #{channel.name}</h3>
              <p className="text-sm">This is the start of the #{channel.name} channel.</p>
           </div>
        ) : (
          messages.map((msg, i) => {
            const showHeader = i === 0 || messages[i-1].user !== msg.user;
            const msgTime = new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return (
              <motion.div 
                key={msg.id || i} 
                initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}
                className={`group flex items-start px-4 -mx-4 py-1 hover:bg-white/5 transition-colors ${showHeader ? 'mt-4' : 'mt-0'}`}
              >
                {showHeader ? (
                   <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center mr-4 mt-1 font-bold text-primary select-none shrink-0">
                      {(msg.user || 'U').charAt(0).toUpperCase()}
                   </div>
                ) : (
                   <div className="w-10 mr-4 shrink-0 text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 flex items-center justify-center pt-1.5 select-none font-bold">
                      {msgTime}
                   </div>
                )}
                <div className="flex-1 min-w-0">
                  {showHeader && (
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-bold text-white hover:underline cursor-pointer">{msg.user || 'User'}</span>
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-surface-700/50 px-1.5 py-0.5 rounded">Today</span>
                    </div>
                  )}
                  <p className="text-gray-300 leading-relaxed break-words whitespace-pre-wrap">{msg.content}</p>
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="px-6 pb-8 shrink-0 bg-[#0f1012]/60 backdrop-blur-md">
          <form onSubmit={sendMessage} className="relative group">
            <button type="button" className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors bg-white/5 p-1 rounded-md">
                <Plus size={18} />
            </button>
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Message #${channel.name}`}
                className="w-full bg-surface-700/40 text-white rounded-2xl px-12 py-4 border border-white/5 focus:border-primary focus:outline-none transition-all shadow-inner"
            />
            <button
                type="submit"
                disabled={!input.trim()}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 disabled:opacity-30 transition-all"
            >
                <Send size={18} />
            </button>
          </form>
      </div>
    </div>
  );
}
