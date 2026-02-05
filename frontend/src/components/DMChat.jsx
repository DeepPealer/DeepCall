import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Phone, Video, MoreVertical, Hash, Edit3, Trash2, Reply, Copy, Check, X, Download, ArrowDownToLine } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import MessageComposer from './MessageComposer';
import CallOverlay from './CallOverlay';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';

export default function DMChat({ 
  friend, 
  onBack, 
  globalWs, 
  onStartCall,
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
    
    // Register for global messages
    const handler = (data) => {
      if (data.type === 'dm' || data.type === 'message') {
        handleIncomingMessage(data);
      } else if (data.type === 'dm_update') {
        setMessages(prev => prev.map(m => m.id === data.id ? { ...m, content: data.content, is_edited: true } : m));
      } else if (data.type === 'dm_delete') {
        setMessages(prev => prev.filter(m => m.id !== data.id));
      }
    };
    
    registerMessageHandler(handler);
    return () => unregisterMessageHandler(handler);
  }, [friend?.id, registerMessageHandler, unregisterMessageHandler]);

  const handleIncomingMessage = (data) => {
    const currentUserId = localStorage.getItem('user_id');
    const isFromMe = String(data.sender_id || '') === String(currentUserId || '') || data.user === localStorage.getItem('username');
    const isFromFriend = String(data.sender_id || '') === String(friend.id || '') || data.user === friend.username;

    if (isFromFriend || isFromMe) {
       setMessages(prev => {
         if (prev.some(m => m.id === data.id)) return prev;
         if (isFromMe && prev.some(m => m.optimistic && m.content === data.content)) return prev;
         return [...prev, data];
       });
    }
  };

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

  const handleSendMessage = async (content, replyToId = null) => {
    if (!content.trim() || !friend?.id) return;

    const tempId = `temp-${Date.now()}`;
    const myUsername = localStorage.getItem('username');
    const myUserId = localStorage.getItem('user_id');
    
    const optimisticMsg = {
      id: tempId,
      content,
      user: myUsername || 'Me',
      sender_id: myUserId,
      sender_avatar: localStorage.getItem('user_avatar'),
      created_at: new Date().toISOString(),
      optimistic: true,
      reply_to_id: replyToId
    };
    
    setMessages(prev => [...prev, optimisticMsg]);

    // Send via global WebSocket if available
    if (globalWs?.readyState === WebSocket.OPEN) {
      globalWs.send(JSON.stringify({
        type: 'dm',
        recipient_id: friend.id,
        content: content,
        reply_to_id: replyToId
      }));
      setReplyingTo(null);
    } else {
      // Fallback to API if WS is down
      try {
        const res = await api.post(`/dms/${friend.id}`, { 
          content,
          reply_to_id: replyToId
        });
        setMessages(prev => prev.map(m => m.id === tempId ? res.data : m));
        setReplyingTo(null);
      } catch (err) {
        toast.error('Failed to send message');
        setMessages(prev => prev.filter(m => m.id !== tempId));
      }
    }
  };

  const [replyingTo, setReplyingTo] = useState(null);

  const handleEdit = async (msgId) => {
    if (!editContent.trim()) return;
    
    // Optimistic Update
    const originalMessages = [...messages];
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: editContent, is_edited: true } : m));
    setEditingId(null);

    try {
      await api.patch(`/dms/message/${msgId}`, { content: editContent });
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
      await api.delete(`/dms/message/${msgId}`);
      toast.success('Message deleted');
    } catch (err) {
      toast.error('Failed to delete message');
      setMessages(originalMessages); // Revert
    }
  };

  const handleCopy = (content) => {
    navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard');
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

  if (!friend) return null;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-transparent">
      {/* Header */}
      <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-surface-800/20 backdrop-blur-xl shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack} 
            className="p-2 -ml-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-all xl:hidden"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center font-bold text-primary overflow-hidden border border-white/5 shadow-inner">
            {friend.avatar_url ? (
               <img src={friend.avatar_url} alt={friend.username} className="w-full h-full object-cover" />
            ) : (
               <span className="text-sm">{(friend.username || '?')[0].toUpperCase()}</span>
            )}
          </div>
          <div>
            <h3 className="font-black text-white leading-tight tracking-tight">{friend.username}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
               <span className="text-[9px] font-black uppercase text-gray-500 tracking-widest">Online</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
           <button 
             onClick={() => onStartCall(friend, 'audio')}
             className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all" 
             title="Start voice call"
           >
             <Phone size={20} />
           </button>
           <button 
             onClick={() => onStartCall(friend, 'video')}
             className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all" 
             title="Start video call"
           >
             <Video size={20} />
           </button>
           <div className="w-[1px] h-6 bg-white/10 mx-1" />
           <button className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
             <MoreVertical size={20} />
           </button>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar min-h-0 w-full bg-black/5">
        {loading ? (
          <div className="flex items-center justify-center h-full opacity-50 font-bold text-[10px] uppercase tracking-[0.2em]">Loading History...</div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-30 select-none">
             <div className="w-20 h-20 rounded-[32px] bg-surface-700 flex items-center justify-center">
                <Hash size={32} />
             </div>
             <p className="font-black uppercase text-[10px] tracking-widest">No history with {friend.username}</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const myUserId = localStorage.getItem('user_id');
            const isMe = String(msg.sender_id || '') === String(myUserId || '') || msg.user === localStorage.getItem('username');
            
            const prevMsg = messages[i - 1];
            const isFirstInGroup = !prevMsg || 
                                   String(prevMsg.sender_id || '') !== String(msg.sender_id || '') ||
                                   (new Date(msg.created_at) - new Date(prevMsg.created_at) > 300000);

            const isEditing = editingId === msg.id;
            const avatarUrl = msg.sender_avatar || (isMe ? localStorage.getItem('user_avatar') : friend.avatar_url);

            return (
              <motion.div
                id={`message-${msg.id}`}
                key={msg.id || i}
                initial={isFirstInGroup ? { opacity: 0, y: 5 } : { opacity: 0 }}
                animate={{ opacity: 1, y: 0 }}
                className={`group relative flex items-start gap-4 px-4 -mx-4 py-1 hover:bg-white/5 transition-all ${isFirstInGroup ? 'mt-4' : 'mt-0'} ${isEditing ? 'bg-primary/5' : ''}`}
              >
                {/* Message Toolbar */}
                {!isEditing && !msg.optimistic && (
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
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center font-bold text-primary overflow-hidden border border-white/5 shadow-inner">
                      {avatarUrl ? (
                         <img src={avatarUrl} alt={msg.user} className="w-full h-full object-cover" />
                      ) : (
                         <span className="text-sm">{(isMe ? localStorage.getItem('username') : friend.username || '?')[0].toUpperCase()}</span>
                      )}
                    </div>
                  ) : (
                    <div className="w-10 text-[9px] font-black text-gray-600 opacity-0 group-hover:opacity-100 flex items-center justify-center pt-1.5 select-none tracking-tighter">
                       {new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
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
                         const parentUsername = parentMsg?.user || (parentMsg?.sender_id === localStorage.getItem('user_id') ? localStorage.getItem('username') : friend.username);
                         return (
                           <>
                             <span className="text-[10px] font-bold text-primary hover:underline transition-all">@{parentUsername || 'Original Message'}</span>
                             <span className="text-[10px] text-gray-500 truncate max-w-[200px] opacity-80">{parentMsg?.content || 'Message deleted or unavailable'}</span>
                           </>
                         )
                       })()}
                    </div>
                  )}
                  {isFirstInGroup && (
                     <div className="flex items-baseline gap-2 mb-1">
                        <span className={`font-black text-sm tracking-tight hover:underline cursor-pointer ${isMe ? 'text-primary' : 'text-white'}`}>
                           {isMe ? 'You' : (msg.user || friend.username)}
                        </span>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest opacity-60">
                           {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </span>
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

      {/* Input Area */}
      <div className="shrink-0 bg-transparent pb-4">
        <MessageComposer 
          placeholder={`Message @${friend.username}`}
          onSend={handleSendMessage}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
        />
      </div>
    </div>
  );
}
