import { useState, useRef, useEffect } from 'react';
import { Plus, Smile, Send, Mic, X, File as FileIcon, Loader2 } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import EmojiPicker from 'emoji-picker-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MessageComposer({ onSend, placeholder, replyingTo, onCancelReply }) {
  const [text, setText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const textareaRef = useRef(null);
  const emojiRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 300);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [text]);

  useEffect(() => {
    if (replyingTo) textareaRef.current?.focus();
  }, [replyingTo]);

  // Click outside emoji picker
  useEffect(() => {
    function handleClickOutside(event) {
      if (emojiRef.current && !emojiRef.current.contains(event.target)) {
        setShowEmoji(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleUpload = async (file) => {
    if (file.size > 8 * 1024 * 1024) {
      toast.error('File too large (max 8MB)');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/attachments/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setAttachments(prev => [...prev, res.data]);
    } catch (err) {
      toast.error('Failed to upload file');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const onEmojiClick = (emojiData) => {
    setText(prev => prev + emojiData.emoji);
    setShowEmoji(false);
    textareaRef.current?.focus();
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) handleUpload(file);
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      for (const file of files) {
        handleUpload(file);
      }
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!text.trim() && attachments.length === 0) return;
    
    // Format attachments as Markdown
    const attachmentText = attachments.map(a => {
      const isImage = a.content_type?.startsWith('image') || a.url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
      if (isImage) return `\n\n![${a.filename}](${a.url})`;
      return `\n\n📎 [${a.filename}](${a.url})`;
    }).join('');
    
    onSend(text.trim() + attachmentText, replyingTo?.id);
    
    setText('');
    setAttachments([]);
    if (onCancelReply) onCancelReply();
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div 
      className="flex flex-col w-full max-w-5xl mx-auto px-4 py-2 relative"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Reply Preview */}
      <AnimatePresence>
        {replyingTo && (
          <motion.div 
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: 10, height: 0 }}
            className="flex items-center justify-between bg-surface-700/60 backdrop-blur-md px-4 py-2 border-l-4 border-primary rounded-t-2xl mb-[-12px] relative z-0"
          >
             <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Replying to {replyingTo.user}</span>
                <p className="text-xs text-gray-400 truncate opacity-80 italic">{replyingTo.content}</p>
             </div>
             <button 
              onClick={onCancelReply}
              className="p-1 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-all"
             >
               <X size={14} />
             </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drop Zone Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-primary/20 backdrop-blur-sm border-2 border-dashed border-primary rounded-3xl flex items-center justify-center pointer-events-none">
           <div className="bg-surface-800 p-4 rounded-2xl shadow-2xl flex flex-col items-center gap-2">
              <Plus size={40} className="text-primary animate-bounce" />
              <p className="font-black uppercase tracking-widest text-[10px]">Drop to Upload</p>
           </div>
        </div>
      )}

      {/* Attachments Preview */}
      {attachments.length > 0 && (
         <div className="flex flex-wrap gap-2 mb-2 px-2">
            {attachments.map((att, idx) => (
               <div key={idx} className="group relative w-20 h-20 rounded-xl bg-surface-700 border border-white/5 overflow-hidden shadow-lg">
                  {att.content_type?.startsWith('image') ? (
                     <img src={att.url} alt="upload" className="w-full h-full object-cover" />
                  ) : (
                     <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                        <FileIcon size={24} className="text-gray-400" />
                        <span className="text-[8px] font-bold text-gray-500 truncate w-full px-1 text-center">{att.filename}</span>
                     </div>
                  )}
                  <button 
                    onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
               </div>
            ))}
            {uploading && (
               <div className="w-20 h-20 rounded-xl bg-surface-700/50 border border-dashed border-white/10 flex items-center justify-center">
                  <Loader2 className="animate-spin text-primary" size={24} />
               </div>
            )}
         </div>
      )}

      <div className="relative group flex items-end gap-3 bg-surface-700/40 border border-white/5 rounded-[24px] p-2 focus-within:border-primary/50 transition-all shadow-inner backdrop-blur-sm">
        
        {/* Attachment Button */}
        <input 
          type="file" 
          id="file-upload" 
          className="hidden" 
          multiple 
          onChange={(e) => {
            if (e.target.files) {
              for (const file of e.target.files) handleUpload(file);
            }
          }}
        />
        <label 
          htmlFor="file-upload"
          title="Upload file"
          className="p-2 mb-1 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all shrink-0 cursor-pointer"
        >
          <Plus size={20} />
        </label>

        {/* Dynamic Textarea */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder || "Type a message..."}
          className="flex-1 bg-transparent text-white border-0 focus:ring-0 resize-none py-2.5 font-medium leading-relaxed custom-scrollbar max-h-[300px]"
        />

        {/* Actions Group */}
        <div className="flex items-center gap-1 mb-1 pr-1">
          <div className="relative" ref={emojiRef}>
            <button 
              onClick={() => setShowEmoji(!showEmoji)}
              title="Emoji picker"
              className={`p-2 rounded-xl transition-all shrink-0 ${showEmoji ? 'text-yellow-400 bg-yellow-400/10' : 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/10'}`}
            >
              <Smile size={20} />
            </button>
            <AnimatePresence>
              {showEmoji && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full right-0 mb-4 z-[100] shadow-2xl border border-white/10 rounded-2xl overflow-hidden"
                >
                  <EmojiPicker 
                    theme="dark" 
                    onEmojiClick={onEmojiClick}
                    lazyLoadEmojis={true}
                    skinTonesDisabled
                    searchPlaceHolder="Search emojis..."
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {(text.trim() || attachments.length > 0) ? (
            <button 
              onClick={handleSubmit}
              disabled={uploading}
              className="p-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
            >
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          ) : (
            <button 
              title="Record voice"
              className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
            >
              <Mic size={20} />
            </button>
          )}
        </div>
      </div>
      
      {/* Footer info */}
      <div className="flex justify-between items-center px-4 mt-1.5 opacity-20 group-focus-within:opacity-40 transition-opacity">
         <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">
           Markdown Supported
         </p>
         <div className="flex gap-3 text-[9px] font-black uppercase tracking-widest text-gray-400">
            <span><b>Enter</b> to send</span>
            <span><b>Shift+Enter</b> for newline</span>
         </div>
      </div>
    </div>
  );
}
