import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, MessageSquare, Clock, LogOut, Ban, AlertTriangle, 
  X, ChevronRight 
} from 'lucide-react';

const TIMEOUT_OPTIONS = [
  { label: '60 seconds', value: 60 },
  { label: '5 minutes', value: 300 },
  { label: '10 minutes', value: 600 },
  { label: '1 hour', value: 3600 },
  { label: '1 day', value: 86400 },
  { label: '1 week', value: 604800 },
];

export default function UserContextMenu({ 
  user, 
  position, 
  onClose, 
  onViewProfile,
  onMessage,
  onTimeout,
  onKick,
  onBan,
  canModerate = false,
  isOwner = false
}) {
  const [showTimeoutOptions, setShowTimeoutOptions] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  const [showKickModal, setShowKickModal] = useState(false);
  const [reason, setReason] = useState('');
  const [deleteMessages, setDeleteMessages] = useState(0);
  const [selectedTimeout, setSelectedTimeout] = useState(null);

  if (!user) return null;

  const handleTimeout = (duration) => {
    onTimeout?.(user.id, duration, reason);
    onClose();
  };

  const handleKick = () => {
    onKick?.(user.id, reason);
    onClose();
  };

  const handleBan = () => {
    onBan?.(user.id, reason, deleteMessages);
    onClose();
  };

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed z-[100] min-w-[200px] bg-gray-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden"
          style={{ left: position.x, top: position.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* User Header */}
          <div className="p-3 border-b border-white/10 bg-gray-800/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  user.username?.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <p className="font-semibold text-white">{user.username}</p>
                <p className="text-xs text-gray-400">#{user.id?.slice(0, 8)}</p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="p-1">
            <MenuItem icon={User} label="Profile" onClick={onViewProfile} />
            <MenuItem icon={MessageSquare} label="Message" onClick={onMessage} />

            {canModerate && !isOwner && (
              <>
                <div className="my-1 border-t border-white/10" />
                
                {/* Timeout with submenu */}
                <div className="relative">
                  <MenuItem 
                    icon={Clock} 
                    label="Timeout" 
                    onClick={() => setShowTimeoutOptions(!showTimeoutOptions)}
                    danger
                    hasSubmenu
                  />
                  
                  {showTimeoutOptions && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="absolute left-full top-0 ml-1 min-w-[140px] bg-gray-900 border border-white/10 rounded-lg overflow-hidden shadow-xl"
                    >
                      {TIMEOUT_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => handleTimeout(opt.value)}
                          className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </div>

                <MenuItem 
                  icon={LogOut} 
                  label="Kick" 
                  onClick={() => setShowKickModal(true)}
                  danger
                />
                <MenuItem 
                  icon={Ban} 
                  label="Ban" 
                  onClick={() => setShowBanModal(true)}
                  danger
                />
              </>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Kick Modal */}
      <ModerationModal
        isOpen={showKickModal}
        onClose={() => setShowKickModal(false)}
        title={`Kick ${user.username}`}
        actionLabel="Kick"
        actionColor="red"
        onConfirm={handleKick}
      >
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">
            This will remove <span className="text-white font-semibold">{user.username}</span> from the server. They can rejoin with a new invite.
          </p>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Reason (optional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason..."
              className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:border-primary"
              rows={3}
            />
          </div>
        </div>
      </ModerationModal>

      {/* Ban Modal */}
      <ModerationModal
        isOpen={showBanModal}
        onClose={() => setShowBanModal(false)}
        title={`Ban ${user.username}`}
        actionLabel="Ban"
        actionColor="red"
        onConfirm={handleBan}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertTriangle className="text-red-500 shrink-0" size={20} />
            <p className="text-sm text-red-400">
              This will permanently ban <span className="font-semibold">{user.username}</span> from the server.
            </p>
          </div>
          
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Delete message history</label>
            <select
              value={deleteMessages}
              onChange={(e) => setDeleteMessages(Number(e.target.value))}
              className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
            >
              <option value={0}>Don't delete any</option>
              <option value={1}>Last 24 hours</option>
              <option value={7}>Last 7 days</option>
            </select>
          </div>
          
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Reason (optional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason..."
              className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:border-primary"
              rows={3}
            />
          </div>
        </div>
      </ModerationModal>

      {/* Click outside to close */}
      <div 
        className="fixed inset-0 z-[99]" 
        onClick={onClose}
      />
    </>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger = false, hasSubmenu = false }) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
        danger 
          ? 'text-red-400 hover:bg-red-500/10' 
          : 'text-gray-300 hover:bg-white/5 hover:text-white'
      }`}
    >
      <Icon size={16} />
      <span className="text-sm flex-1 text-left">{label}</span>
      {hasSubmenu && <ChevronRight size={14} className="text-gray-500" />}
    </button>
  );
}

function ModerationModal({ isOpen, onClose, title, children, actionLabel, actionColor, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {children}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              actionColor === 'red' 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-primary hover:bg-primary/80 text-white'
            }`}
          >
            {actionLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export { ModerationModal };
