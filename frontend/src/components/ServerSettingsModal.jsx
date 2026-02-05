import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Lock, Users, Hash, Save, Trash2, Camera, Plus } from 'lucide-react';
import AuditLogViewer from './AuditLogViewer';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function ServerSettingsModal({ isOpen, onClose, server, onUpdate }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [serverName, setServerName] = useState(server?.name || '');
  const [serverIconUrl, setServerIconUrl] = useState(server?.icon_url || '');
  const [members, setMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [roles, setRoles] = useState([]);
  const [editingRole, setEditingRole] = useState(null);
  const [openRolePicker, setOpenRolePicker] = useState(null);
  const [editingNickname, setEditingNickname] = useState(null); // { userId, nickname }

  if (!isOpen || !server) return null;

  useEffect(() => {
    if (activeTab === 'members') {
        fetchMembers();
        fetchRoles();
    }
    if (activeTab === 'roles') fetchRoles();
  }, [activeTab]);

  const handleToggleRole = async (userId, memberRoles, roleId) => {
    const hasRole = memberRoles.some(r => r.id === roleId);
    let newRoleIds;
    if (hasRole) {
        newRoleIds = memberRoles.filter(r => r.id !== roleId).map(r => r.id);
    } else {
        newRoleIds = [...memberRoles.map(r => r.id), roleId];
    }
    
    try {
        await api.patch(`/servers/${server.id}/members/${userId}`, { role_ids: newRoleIds });
        fetchMembers();
    } catch (err) {
        console.error(err);
        toast.error("Failed to update roles");
    }
  };

  const handleUpdateNickname = async (userId, nickname) => {
    try {
        await api.patch(`/servers/${server.id}/members/${userId}`, { nickname });
        setEditingNickname(null);
        fetchMembers();
    } catch (err) {
        console.error(err);
        toast.error("Failed to update nickname");
    }
  };

  const fetchRoles = async () => {
    try {
        const res = await api.get(`/servers/${server.id}/roles`);
        setRoles(res.data);
    } catch (err) {
        console.error(err);
        toast.error("Failed to load roles");
    }
  };

  const handleCreateRole = async () => {
    try {
        await api.post(`/servers/${server.id}/roles`, { name: "New Role", color: "#99aab5" });
        toast.success("Role created!");
        fetchRoles();
    } catch (err) {
        console.error(err);
        toast.error("Failed to create role");
    }
  };

  const handleDeleteRole = async (roleId) => {
    if (!window.confirm("Are you sure you want to delete this role?")) return;
    try {
        await api.delete(`/servers/${server.id}/roles/${roleId}`);
        toast.success("Role deleted!");
        if (editingRole?.id === roleId) setEditingRole(null);
        fetchRoles();
    } catch (err) {
        console.error(err);
        toast.error("Failed to delete role");
    }
  };

  const handleUpdateRole = async (roleId, data) => {
    try {
        await api.patch(`/servers/${server.id}/roles/${roleId}`, data);
        fetchRoles();
    } catch (err) {
        console.error(err);
        toast.error("Failed to update role");
    }
  };

  useEffect(() => {
    if (activeTab === 'members') {
        fetchMembers();
    }
  }, [activeTab]);

  const fetchMembers = async () => {
    try {
        const res = await api.get(`/servers/${server.id}/members`);
        setMembers(res.data);
    } catch (err) {
        console.error(err);
        toast.error("Failed to load members");
    }
  };

  const handleKickMember = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to kick ${username}?`)) return;
    try {
        await api.delete(`/servers/${server.id}/members/${userId}`);
        toast.success(`${username} has been kicked`);
        fetchMembers();
    } catch (err) {
        console.error(err);
        toast.error("Failed to kick member");
    }
  };

  const filteredMembers = members.filter(m => 
    m.username.toLowerCase().includes(memberSearch.toLowerCase()) || 
    (m.nickname && m.nickname.toLowerCase().includes(memberSearch.toLowerCase()))
  );

  const handleIconUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setLoading(true);
    try {
        const res = await api.post('/attachments/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        setServerIconUrl(res.data.url);
        toast.success("Icon uploaded! Don't forget to save changes.");
    } catch (err) {
        console.error(err);
        toast.error("Failed to upload icon");
    } finally {
        setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!serverName.trim()) return;
    setLoading(true);
    try {
        await api.patch(`/servers/${server.id}`, { 
            name: serverName,
            icon_url: serverIconUrl
        });
        toast.success("Server settings updated!");
        if (onUpdate) onUpdate();
    } catch (err) {
        console.error(err);
        toast.error("Failed to update server settings");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-4 overflow-hidden">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-[#0a0a0b]/90 backdrop-blur-xl" 
        onClick={onClose} 
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 10 }}
        className="relative bg-[#1e1f22] w-full max-w-[1000px] h-full md:h-[750px] border border-white/5 md:rounded-[24px] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.8)] overflow-hidden flex"
      >
        {/* Sidebar */}
        <div className="w-[280px] bg-[#2b2d31] p-6 pt-12 flex flex-col gap-1 overflow-y-auto">
          <div className="px-3 py-2 mb-4">
            <h3 className="font-black text-gray-500 text-[11px] uppercase tracking-[0.2em]">{server?.name}</h3>
          </div>
          
          <TabButton 
            active={activeTab === 'overview'} 
            onClick={() => setActiveTab('overview')} 
            label="Overview" 
            icon={Hash}
          />
          <TabButton 
            active={activeTab === 'roles'} 
            onClick={() => setActiveTab('roles')} 
            label="Roles" 
            icon={Shield}
          />
          <TabButton 
            active={activeTab === 'members'} 
            onClick={() => setActiveTab('members')} 
            label="Members" 
            icon={Users}
          />
          
          <div className="my-4 border-t border-white/5" />
          
          <div className="px-3 py-2 mb-1">
            <h3 className="font-black text-gray-500 text-[10px] uppercase tracking-[0.2em]">Management</h3>
          </div>
          <TabButton 
            active={activeTab === 'audit-log'} 
            onClick={() => setActiveTab('audit-log')} 
            label="Audit Log" 
            icon={Lock}
          />

          <div className="mt-auto pt-6 border-t border-white/5">
             <button className="w-full flex items-center justify-between px-3 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors text-sm font-bold">
                Delete Server
                <Trash2 size={16} />
             </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#313338]">
          <div className="p-12 h-full overflow-y-auto custom-scrollbar relative">
            {activeTab === 'overview' && (
              <div className="max-w-xl mx-auto md:mx-0">
                <header className="mb-10">
                    <h2 className="text-3xl font-black text-white mb-2">Server Overview</h2>
                    <p className="text-gray-400 text-sm">Fine-tune your server's appearance and basic settings.</p>
                </header>
                
                <div className="space-y-12">
                  <div className="flex flex-col md:flex-row items-start gap-10">
                    <div className="relative group">
                        <label className="cursor-pointer block">
                            <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*"
                                onChange={handleIconUpload}
                            />
                            <div className="w-32 h-32 rounded-[40px] bg-[#1e1f22] border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-gray-500 group-hover:border-primary/50 group-hover:text-primary transition-all overflow-hidden relative shadow-2xl">
                               <Camera size={32} />
                               <span className="text-[10px] font-black uppercase mt-2">Change</span>
                               
                               {serverIconUrl && (
                                   <img src={serverIconUrl} className="absolute inset-0 w-full h-full object-cover group-hover:opacity-40 transition-opacity" />
                               )}
                            </div>
                        </label>
                        <p className="text-[10px] font-bold text-gray-500 mt-3 text-center uppercase tracking-widest">Minimum size: 512x512</p>
                    </div>

                    <div className="flex-1 space-y-6 w-full">
                        <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] mb-3 block px-1">Server Name</label>
                            <input 
                                type="text" 
                                value={serverName}
                                onChange={(e) => setServerName(e.target.value)}
                                className="w-full bg-[#1e1f22] border border-white/5 rounded-2xl px-5 py-4 text-white font-bold focus:border-primary focus:outline-none transition-all shadow-inner"
                                placeholder="Enter server name"
                            />
                        </div>
                        
                        <div className="pt-4">
                            <button 
                                onClick={handleSave}
                                disabled={loading || (serverName === server.name && serverIconUrl === server.icon_url)}
                                className="px-8 py-4 bg-primary hover:bg-primary-focus text-white font-black rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                            >
                                <Save size={18} />
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'roles' && (
              <div className="h-full flex flex-col">
                <header className="mb-8 flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-black text-white mb-2">Server Roles</h2>
                        <p className="text-gray-400 text-sm">Use roles to group your server members and assign permissions.</p>
                    </div>
                    {!editingRole && (
                        <button 
                            onClick={handleCreateRole}
                            className="bg-primary hover:bg-primary-focus text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95"
                        >
                            <Plus size={18} /> Create Role
                        </button>
                    )}
                </header>

                <div className="flex-1 flex gap-8 overflow-hidden">
                    {/* Role List */}
                    <div className="w-64 flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-2">
                         {roles.map(role => (
                             <button
                                 key={role.id}
                                 onClick={() => setEditingRole(role)}
                                 className={`flex items-center justify-between p-3 rounded-xl font-bold text-sm transition-all border ${
                                     editingRole?.id === role.id 
                                     ? 'bg-white/5 border-white/10 text-white' 
                                     : 'bg-transparent border-transparent text-gray-400 hover:bg-white/5'
                                 }`}
                             >
                                 <div className="flex items-center gap-3">
                                     <div className="w-3 h-3 rounded-full" style={{ backgroundColor: role.color || '#99aab5' }} />
                                     {role.name}
                                 </div>
                             </button>
                         ))}
                    </div>

                    {/* Role Editor */}
                    <div className="flex-1 bg-white/[0.02] border border-white/5 rounded-3xl p-8 overflow-y-auto custom-scrollbar">
                         {editingRole ? (
                             <div className="space-y-8">
                                 <div className="flex items-center justify-between">
                                     <h3 className="text-xl font-black text-white">Edit Role: {editingRole.name}</h3>
                                     <div className="flex gap-2">
                                         <button 
                                            onClick={() => handleDeleteRole(editingRole.id)}
                                            className="p-3 text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                                         >
                                             <Trash2 size={18} />
                                         </button>
                                         <button 
                                            onClick={() => setEditingRole(null)}
                                            className="p-3 text-gray-400 hover:bg-white/5 rounded-xl transition-all"
                                         >
                                             <X size={18} />
                                         </button>
                                     </div>
                                 </div>

                                 <div className="space-y-6">
                                     <div>
                                         <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-3 block px-1">Role Name</label>
                                         <input 
                                            type="text" 
                                            value={editingRole.name}
                                            onChange={(e) => {
                                                const newName = e.target.value;
                                                setEditingRole(prev => ({ ...prev, name: newName }));
                                                handleUpdateRole(editingRole.id, { name: newName });
                                            }}
                                            className="w-full bg-[#1e1f22] border border-white/5 rounded-xl px-4 py-3 text-white font-bold focus:border-primary focus:outline-none transition-all"
                                         />
                                     </div>

                                     <div>
                                         <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-3 block px-1">Role Color</label>
                                         <div className="flex flex-wrap gap-3">
                                             {['#ff5555', '#ffaa00', '#55ff55', '#55ffff', '#5555ff', '#ff55ff', '#ffffff', '#99aab5'].map(color => (
                                                 <button 
                                                    key={color}
                                                    onClick={() => {
                                                        setEditingRole(prev => ({ ...prev, color }));
                                                        handleUpdateRole(editingRole.id, { color });
                                                    }}
                                                    className={`w-8 h-8 rounded-lg border-2 transition-all ${editingRole.color === color ? 'border-primary' : 'border-transparent'}`}
                                                    style={{ backgroundColor: color }}
                                                 />
                                             ))}
                                             <input 
                                                type="color" 
                                                value={editingRole.color || '#99aab5'}
                                                onChange={(e) => {
                                                    const color = e.target.value;
                                                    setEditingRole(prev => ({ ...prev, color }));
                                                    handleUpdateRole(editingRole.id, { color });
                                                }}
                                                className="w-8 h-8 rounded-lg bg-transparent border-none cursor-pointer"
                                             />
                                         </div>
                                     </div>
                                     <div>
                                         <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-3 block px-1">Permissions</label>
                                         <div className="space-y-2">
                                             {[
                                                 { label: "Administrator", value: 1 << 0, desc: "Gives all permissions. This is a dangerous permission." },
                                                 { label: "Manage Channels", value: 1 << 1, desc: "Allows creating, editing, and deleting channels." },
                                                 { label: "Manage Roles", value: 1 << 2, desc: "Allows creating, editing, and deleting roles." },
                                                 { label: "Kick Members", value: 1 << 3, desc: "Allows kicking members from the server." },
                                                 { label: "Ban Members", value: 1 << 4, desc: "Allows banning members from the server." },
                                                 { label: "Send Messages", value: 1 << 5, desc: "Allows sending messages in text channels." },
                                             ].map(perm => {
                                                 const isChecked = (editingRole.permissions & perm.value) !== 0;
                                                 return (
                                                     <div key={perm.value} className="flex items-center justify-between p-4 bg-[#1e1f22] border border-white/5 rounded-2xl hover:border-white/10 transition-all">
                                                         <div>
                                                             <div className="text-sm font-bold text-white">{perm.label}</div>
                                                             <div className="text-[11px] text-gray-500 font-bold">{perm.desc}</div>
                                                         </div>
                                                         <button 
                                                            onClick={() => {
                                                                const newPerms = isChecked 
                                                                    ? editingRole.permissions & ~perm.value 
                                                                    : editingRole.permissions | perm.value;
                                                                setEditingRole(prev => ({ ...prev, permissions: newPerms }));
                                                                handleUpdateRole(editingRole.id, { permissions: newPerms });
                                                            }}
                                                            className={`w-12 h-6 rounded-full transition-all relative ${isChecked ? 'bg-emerald-500' : 'bg-white/10'}`}
                                                         >
                                                             <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isChecked ? 'right-1' : 'left-1'}`} />
                                                         </button>
                                                     </div>
                                                 );
                                             })}
                                         </div>
                                     </div>
                                 </div>
                             </div>
                         ) : (
                             <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                                 <Shield size={48} className="text-gray-500 mb-4" />
                                 <p className="text-gray-400 font-bold">Select a role to edit its properties.</p>
                             </div>
                         )}
                    </div>
                </div>
              </div>
            )}

            {activeTab === 'members' && (
              <div className="h-full flex flex-col">
                <header className="mb-8">
                    <h2 className="text-3xl font-black text-white mb-2">Server Members</h2>
                    <p className="text-gray-400 text-sm">Manage the users who have access to this server.</p>
                </header>

                <div className="mb-6">
                    <input 
                        type="text" 
                        placeholder="Search members..."
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        className="w-full bg-[#1e1f22] border border-white/5 rounded-xl px-5 py-3 text-white font-bold focus:border-primary focus:outline-none transition-all"
                    />
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                    {filteredMembers.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-4 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-2xl transition-all group">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-primary/20 overflow-hidden border border-white/10 shrink-0">
                                    {member.avatar_url ? (
                                        <img src={member.avatar_url} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-primary font-bold">
                                            {member.username[0].toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 group/nick">
                                        {editingNickname?.userId === member.user_id ? (
                                            <input 
                                                autoFocus
                                                type="text"
                                                value={editingNickname.nickname}
                                                onChange={(e) => setEditingNickname({ ...editingNickname, nickname: e.target.value })}
                                                onBlur={() => handleUpdateNickname(member.user_id, editingNickname.nickname)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleUpdateNickname(member.user_id, editingNickname.nickname)}
                                                className="bg-[#0a0a0b] border border-primary/50 rounded px-2 py-0.5 text-white font-bold text-sm focus:outline-none"
                                            />
                                        ) : (
                                            <>
                                                <span 
                                                    className="text-white font-bold truncate cursor-pointer hover:text-primary transition-colors"
                                                    onClick={() => setEditingNickname({ userId: member.user_id, nickname: member.nickname || member.username })}
                                                >
                                                    {member.nickname || member.username}
                                                </span>
                                                {member.nickname && <span className="text-[10px] text-gray-500 font-medium hidden group-hover/nick:inline-block">({member.username})</span>}
                                            </>
                                        )}
                                        {member.is_owner && (
                                            <span className="text-[9px] font-black uppercase bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full border border-amber-500/20">Owner</span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                         {member.roles.map(role => (
                                             <div key={role.id} className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                                                 <div className="w-2 h-2 rounded-full" style={{ backgroundColor: role.color || '#99aab5' }} />
                                                 <span className="text-[10px] font-bold text-gray-300">{role.name}</span>
                                             </div>
                                         ))}
                                         <div className="relative">
                                             <button 
                                                onClick={() => setOpenRolePicker(openRolePicker === member.user_id ? null : member.user_id)}
                                                className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                                             >
                                                 <Plus size={12} />
                                             </button>
                                             {openRolePicker === member.user_id && (
                                                 <div className="absolute top-full left-0 mt-2 w-48 bg-[#1e1f22] border border-white/10 rounded-xl shadow-2xl p-2 z-[100] space-y-1">
                                                     <p className="text-[9px] font-black uppercase text-gray-500 tracking-widest px-2 py-1">Assign Roles</p>
                                                     {roles.map(role => {
                                                         const hasRole = member.roles.some(r => r.id === role.id);
                                                         return (
                                                             <button 
                                                                key={role.id}
                                                                onClick={() => handleToggleRole(member.user_id, member.roles, role.id)}
                                                                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                                    hasRole ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                                                }`}
                                                             >
                                                                 <div className="flex items-center gap-2">
                                                                     <div className="w-2 h-2 rounded-full" style={{ backgroundColor: role.color || '#99aab5' }} />
                                                                     {role.name}
                                                                 </div>
                                                                 {hasRole && <X size={12} />}
                                                             </button>
                                                         );
                                                     })}
                                                     {roles.length === 0 && <p className="text-[10px] text-gray-500 italic p-2 text-center">No roles created yet.</p>}
                                                 </div>
                                             )}
                                         </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider hidden md:block">Joined {new Date(member.joined_at).toLocaleDateString()}</div>
                                {!member.is_owner && (
                                    <button 
                                        onClick={() => handleKickMember(member.user_id, member.username)}
                                        className="p-2.5 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                        title="Kick Member"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {filteredMembers.length === 0 && (
                        <div className="text-center py-20">
                            <p className="text-gray-500 font-bold">No members found matching your search.</p>
                        </div>
                    )}
                </div>
              </div>
            )}

            {activeTab === 'audit-log' && (
                <div className="h-full flex flex-col">
                    <header className="mb-6 flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-black text-white">Audit Log</h1>
                            <p className="text-gray-400 text-sm">Every action taken on this server is recorded here.</p>
                        </div>
                    </header>
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                        <AuditLogViewer serverId={server.id} />
                    </div>
                </div>
            )}
          </div>
        </div>

        {/* Close Button / Esc Key Hint */}
        <div className="absolute right-[-80px] top-6 flex flex-col items-center gap-2 group cursor-pointer" onClick={onClose}>
            <div className="w-9 h-9 border-2 border-white/20 rounded-full flex items-center justify-center text-white/40 group-hover:border-white/60 group-hover:text-white transition-all">
                <X size={18} />
            </div>
            <span className="text-[11px] font-black text-white/20 group-hover:text-white transition-all uppercase tracking-widest px-2">Esc</span>
        </div>
      </motion.div>
    </div>
  );
}

function TabButton({ active, onClick, label, icon: Icon }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all text-sm font-bold w-full ${
                active 
                ? 'bg-white/5 text-white shadow-sm' 
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
        >
            {label}
            <Icon size={18} className={active ? 'text-primary' : 'text-gray-500'} />
        </button>
    );
}
