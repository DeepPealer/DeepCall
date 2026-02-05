import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, Clock, AlertTriangle, Trash2, 
  ChevronRight, Search, Filter, RefreshCw,
  UserX, Ban, LogOut, MessageSquare, Settings
} from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

const ACTION_ICONS = {
  MEMBER_BAN: Ban,
  MEMBER_UNBAN: Shield,
  MEMBER_KICK: LogOut,
  MEMBER_TIMEOUT: Clock,
  MEMBER_TIMEOUT_REMOVE: Clock,
  MESSAGE_DELETE: Trash2,
  MESSAGE_BULK_DELETE: Trash2,
  CHANNEL_CREATE: MessageSquare,
  CHANNEL_UPDATE: Settings,
  CHANNEL_DELETE: Trash2,
  default: AlertTriangle
};

const ACTION_COLORS = {
  MEMBER_BAN: 'text-red-500',
  MEMBER_UNBAN: 'text-green-500',
  MEMBER_KICK: 'text-orange-500',
  MEMBER_TIMEOUT: 'text-yellow-500',
  MEMBER_TIMEOUT_REMOVE: 'text-green-500',
  MESSAGE_DELETE: 'text-red-400',
  default: 'text-gray-400'
};

export default function AuditLogViewer({ serverId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let url = `/moderation/${serverId}/audit-log?limit=50`;
      if (actionTypeFilter) {
        url += `&action_type=${actionTypeFilter}`;
      }
      const res = await api.get(url);
      setLogs(res.data);
    } catch (err) {
      toast.error('Failed to load audit log');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (serverId) {
      fetchLogs();
    }
  }, [serverId, actionTypeFilter]);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionLabel = (type) => {
    const labels = {
      MEMBER_BAN: 'Banned member',
      MEMBER_UNBAN: 'Unbanned member',
      MEMBER_KICK: 'Kicked member',
      MEMBER_TIMEOUT: 'Timed out member',
      MEMBER_TIMEOUT_REMOVE: 'Removed timeout',
      MESSAGE_DELETE: 'Deleted message',
      MESSAGE_BULK_DELETE: 'Bulk deleted messages',
      CHANNEL_CREATE: 'Created channel',
      CHANNEL_UPDATE: 'Updated channel',
      CHANNEL_DELETE: 'Deleted channel',
      ROLE_CREATE: 'Created role',
      ROLE_UPDATE: 'Updated role',
      ROLE_DELETE: 'Deleted role',
      SERVER_UPDATE: 'Updated server'
    };
    return labels[type] || type;
  };

  const filteredLogs = logs.filter(log => {
    if (!filter) return true;
    const searchLower = filter.toLowerCase();
    return (
      log.action_type.toLowerCase().includes(searchLower) ||
      log.target_id?.toLowerCase().includes(searchLower) ||
      log.reason?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Shield className="text-primary" size={24} />
          Audit Log
        </h2>
        <button 
          onClick={fetchLogs}
          className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-white/10 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input
            type="text"
            placeholder="Search logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary"
          />
        </div>
        
        <div className="flex gap-2">
          <select
            value={actionTypeFilter}
            onChange={(e) => setActionTypeFilter(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary"
          >
            <option value="">All actions</option>
            <option value="MEMBER_BAN">Bans</option>
            <option value="MEMBER_KICK">Kicks</option>
            <option value="MEMBER_TIMEOUT">Timeouts</option>
            <option value="MESSAGE_DELETE">Message Deletes</option>
          </select>
        </div>
      </div>

      {/* Log List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <Shield size={32} className="mb-2 opacity-50" />
            <p>No audit log entries</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredLogs.map((log) => {
              const Icon = ACTION_ICONS[log.action_type] || ACTION_ICONS.default;
              const iconColor = ACTION_COLORS[log.action_type] || ACTION_COLORS.default;
              
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg bg-gray-800 ${iconColor}`}>
                      <Icon size={18} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">
                          {getActionLabel(log.action_type)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDate(log.created_at)}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-400 mt-1">
                        Target: <span className="text-gray-300">{log.target_id?.slice(0, 8)}...</span>
                      </p>
                      
                      {log.reason && (
                        <p className="text-sm text-gray-500 mt-1">
                          Reason: <span className="text-gray-400">{log.reason}</span>
                        </p>
                      )}
                      
                      {log.changes && (
                        <div className="mt-2 p-2 bg-gray-800/50 rounded-lg text-xs">
                          <pre className="text-gray-400 overflow-x-auto">
                            {JSON.stringify(log.changes, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
