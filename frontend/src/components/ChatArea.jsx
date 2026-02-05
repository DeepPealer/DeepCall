import { useState, useEffect, useRef } from 'react';
import { Hash, Edit3, Trash2, Reply, Copy, Check, X, Download, ArrowDownToLine } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import MessageComposer from './MessageComposer';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';

import UserContextMenu from './UserContextMenu';

const WS_URL = 'ws://localhost:8002/ws'; 

export default function ChatArea({ 
  channel, 
  globalWs,
  registerMessageHandler,
  unregisterMessageHandler
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadMessages();
    
    const handler = (data) => {
      if (data.type === 'message' && data.channel_id === channel.id) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.id)) return prev;
          return [...prev, data];
        });
      } else if (data.type === 'message_update') {
        setMessages(prev => prev.map(m => m.id === data.id ? { ...m, content: data.content, is_edited: true } : m));
      } else if (data.type === 'message_delete') {
        setMessages(prev => prev.filter(m => m.id !== data.id));
      }
    };

    registerMessageHandler(handler);
    return () => unregisterMessageHandler(handler);
  }, [channel.id, registerMessageHandler, unregisterMessageHandler]);

  const [replyingTo, setReplyingTo] = useState(null);

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

  const handleEdit = async (msgId) => {
    if (!editContent.trim()) return;
    
    // Optimistic Update
    const originalMessages = [...messages];
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: editContent, is_edited: true } : m));
    setEditingId(null);

    try {
      await api.patch(`/channels/message/${msgId}`, { content: editContent });
    } catch (err) {
      toast.error('Failed to edit message');
      setMessages(originalMessages); // Revert
    }
  };

  const handleDelete = async (msgId) => {
    // Optimistic Update
    const originalMessages = [...messages];
    setMessages(prev => prev.filter(m => m.id !== msgId));

    try {
      await api.delete(`/channels/message/${msgId}`);
      toast.success('Message deleted');
    } catch (err) {
      toast.error('Failed to delete message');
      setMessages(originalMessages); // Revert
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (content, replyToId = null) => {
    if (!content.trim() || !globalWs) return;
    const msgData = {
      channel_id: channel.id,
      content: content,
      reply_to_id: replyToId
    };
    globalWs.send(JSON.stringify(msgData));
    setReplyingTo(null);
  };

  const handleCopy = (content) => {
    navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard');
  };

  // Context Menu State
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, user: null });

  const handleContextMenu = (e, user) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      user: { ...user, id: user.id || user.user_id } // Ensure ID is present
    });
  };

  const closeContextMenu = () => setContextMenu({ ...contextMenu, visible: false });

  const handleModerate = async (action, userId, ...args) => {
    // Implement moderation API calls here
    try {
      if (action === 'kick') {
        const [reason] = args;
        await api.post(`/moderation/${channel.server_id}/members/${userId}/kick`, { reason });
        toast.success('User kicked');
      } else if (action === 'ban') {
        const [reason, deleteDays] = args;
        await api.post(`/moderation/${channel.server_id}/members/${userId}/ban`, { reason, delete_message_days: deleteDays });
        toast.success('User banned');
      } else if (action === 'timeout') {
        const [duration, reason] = args;
        await api.post(`/moderation/${channel.server_id}/members/${userId}/timeout`, { duration_seconds: duration, reason });
        toast.success('User timed out');
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Moderation action failed');
    }
  };

  const MarkdownComponents = {
    a: ({ href, children }) => (
      <span className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-md px-2 py-1 my-1 hover:bg-white/10 transition-all group/link text-xs">
        <span className="truncate max-w-[200px] text-primary underline">{children}</span>
        <a 
          href={href} 
          download 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-gray-400 hover:text-primary transition-colors"
          title="Download File"
        >
          <ArrowDownToLine size={14} />
        </a>
      </span>
    ),
    img: ({ src, alt }) => (
      <div className="my-2 group/img relative">
        <img src={src} alt={alt} className="rounded-xl max-h-[400px] w-auto border border-white/5 shadow-2xl transition-transform hover:scale-[1.01]" />
        <a 
          href={src} 
          download 
          className="absolute top-2 right-2 p-2 bg-black/60 backdrop-blur-md pb-1 text-white rounded-lg opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-primary"
          title="Download Image"
        >
          <Download size={16} />
          <span className="text-[10px] ml-1 font-bold uppercase">Save</span>
        </a>
      </div>
    )
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-transparent">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar min-h-0 w-full bg-black/5">
        {loading ? (
           <div className="flex items-center justify-center h-full opacity-50 font-bold text-[10px] uppercase tracking-[0.2em]">Loading History...</div>
        ) : messages.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-full opacity-30 select-none">
              <div className="w-20 h-20 rounded-[32px] bg-surface-700 flex items-center justify-center mb-4">
                 <Hash size={40} />
              </div>
              <h3 className="text-2xl font-black">Welcome to #{channel.name}</h3>
              <p className="text-sm">This is the start of the #{channel.name} channel.</p>
           </div>
        ) : (
          messages.map((msg, i) => {
            const myUserId = localStorage.getItem('user_id');
            const isMe = String(msg.user_id || msg.sender_id || '') === String(myUserId || '') || msg.user === localStorage.getItem('username');

            const prevMsg = messages[i - 1];
            const isFirstInGroup = !prevMsg || 
                                   (prevMsg.user !== msg.user) ||
                                   (new Date(msg.created_at) - new Date(prevMsg.created_at) > 300000);

            const msgTime = new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            const isEditing = editingId === msg.id;
            const avatarUrl = msg.user_avatar || (isMe ? localStorage.getItem('user_avatar') : null);

            return (
              <motion.div 
                id={`message-${msg.id}`}
                key={msg.id || i} 
                animate={{ opacity: 1, y: 0 }}
                className={`group relative flex items-start gap-4 px-4 -mx-4 py-1 hover:bg-white/5 transition-all ${isFirstInGroup ? 'mt-4' : 'mt-0'} ${isEditing ? 'bg-primary/5' : ''}`}
              >
                {/* Message Toolbar */}
                {!isEditing && (
                  <div className="absolute -top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center bg-surface-800 border border-white/10 rounded-lg overflow-hidden shadow-2xl">
                    <button 
                      onClick={() => setReplyingTo(msg)}
                      className="p-2 hover:bg-white/5 text-gray-400 hover:text-white" title="Reply"
                    >
                      <Reply size={14} />
                    </button>
                    {isMe && (
                      <>
                        <button 
                          onClick={() => { setEditingId(msg.id); setEditContent(msg.content); }}
                          className="p-2 hover:bg-white/5 text-gray-400 hover:text-white" title="Edit"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button 
                          onClick={() => handleDelete(msg.id)}
                          className="p-2 hover:bg-white/5 text-gray-400 hover:text-red-400" title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                    <button 
                      onClick={() => handleCopy(msg.content)}
                      className="p-2 hover:bg-white/5 text-gray-400 hover:text-white" title="Copy Text"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                )}

                <div className="w-10 shrink-0">
                  {isFirstInGroup ? (
                    <div 
                      onContextMenu={(e) => handleContextMenu(e, { id: msg.user_id, username: msg.user, avatar_url: avatarUrl })}
                      className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center font-bold text-primary select-none shrink-0 border border-white/5 shadow-inner overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      {avatarUrl ? (
                         <img src={avatarUrl} alt={msg.user} className="w-full h-full object-cover" />
                      ) : (
                         (msg.user || 'U').charAt(0).toUpperCase()
                      )}
                    </div>
                  ) : (
                    <div className="w-10 text-[9px] font-black text-gray-600 opacity-0 group-hover:opacity-100 flex items-center justify-center pt-1.5 select-none tracking-tighter">
                       {msgTime}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {msg.reply_to_id && (
                    <div 
                      onClick={() => document.getElementById(`message-${msg.reply_to_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                      className="flex items-center gap-2 mb-1 opacity-60 hover:opacity-100 transition-opacity cursor-pointer group/reply pl-4 relative"
                    >
                       <div className="absolute left-[-4px] top-[10px] w-6 h-4 border-l-2 border-t-2 border-white/20 rounded-tl-lg" />
                       {(() => {
                         const parentMsg = messages.find(m => String(m.id) === String(msg.reply_to_id));
                         return (
                           <>
                             <span className="text-[10px] font-bold text-primary hover:underline transition-all">@{parentMsg?.user || 'Original Message'}</span>
                             <span className="text-[10px] text-gray-500 truncate max-w-[200px] opacity-80">{parentMsg?.content || 'Message deleted or unavailable'}</span>
                           </>
                         )
                       })()}
                    </div>
                  )}
                  {isFirstInGroup && (
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className={`font-black text-sm tracking-tight hover:underline cursor-pointer ${isMe ? 'text-primary' : 'text-white'}`}>
                        {msg.user || 'User'}
                      </span>
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest opacity-60">{msgTime}</span>
                    </div>
                  )}
                  
                  {isEditing ? (
                    <div className="mt-1">
                      <textarea
                        autoFocus
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full bg-surface-700/50 text-white rounded-xl p-3 border border-primary/30 focus:outline-none resize-none text-sm leading-relaxed"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEdit(msg.id); }
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                      />
                      <div className="flex gap-2 mt-2 text-[10px] font-bold uppercase tracking-widest">
                         <button onClick={() => handleEdit(msg.id)} className="text-primary hover:underline">Save</button>
                         <button onClick={() => setEditingId(null)} className="text-gray-500 hover:underline">Cancel</button>
                         <span className="text-gray-600 normal-case font-normal ml-auto italic">Escape to cancel • Enter to save</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-300 text-sm leading-relaxed break-words whitespace-pre-wrap selection:bg-primary/30 prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={MarkdownComponents}
                      >
                        {msg.content}
                      </ReactMarkdown>
                      {(msg.is_edited || msg.updated_at) && (
                        <span className="text-[9px] text-gray-600 ml-1 select-none">(edited)</span>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="shrink-0 bg-transparent pb-4">
        <MessageComposer 
          placeholder={`Message #${channel.name}`}
          onSend={handleSendMessage}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
        />
      </div>

      {contextMenu.visible && (
        <UserContextMenu
          user={contextMenu.user}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={closeContextMenu}
          onKick={(uid, reason) => handleModerate('kick', uid, reason)}
          onBan={(uid, reason, days) => handleModerate('ban', uid, reason, days)}
          onTimeout={(uid, duration, reason) => handleModerate('timeout', uid, duration, reason)}
          canModerate={true} // TODO: Check actual permissions
          isOwner={false} // TODO: Check if target is owner
        />
      )}
    </div>
  );
}
