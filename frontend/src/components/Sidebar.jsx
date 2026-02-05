import { Plus } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Sidebar({ servers = [], activeServer, setActiveServer, onOpenCreateServer }) {
    return (
        <div className="flex flex-col items-center gap-3 w-full">
            {Array.isArray(servers) && servers.map((server, index) => {
                const sid = server?.id || index;
                const isActive = activeServer?.id === server?.id;
                
                return (
                    <div key={sid} className="relative group flex items-center justify-center">
                        <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                            onClick={() => setActiveServer(server)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className={`relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 overflow-hidden ${
                                isActive 
                                ? 'bg-primary rounded-[14px] shadow-lg shadow-primary/20' 
                                : 'bg-surface-700 hover:bg-primary rounded-3xl hover:rounded-[14px]'
                            }`}
                        >
                            {server?.icon_url ? (
                                <img 
                                    src={server.icon_url} 
                                    alt={server.name} 
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span className={`font-bold transition-colors duration-300 ${
                                    isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'
                                }`}>
                                    {(server?.name || '?').charAt(0).toUpperCase()}
                                </span>
                            )}
                        </motion.button>
                        
                        {/* Indicator */}
                        <div className="absolute -left-3 flex items-center h-full">
                             <motion.div 
                                className="w-1 bg-white rounded-r-full"
                                animate={{ height: isActive ? 36 : 0, opacity: isActive ? 1 : 0 }}
                             />
                        </div>
                    </div>
                );
            })}

            <div className="w-8 h-[2px] bg-white/5 my-1" />

            <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onOpenCreateServer}
                className="flex items-center justify-center w-12 h-12 rounded-3xl bg-surface-700 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all duration-300"
            >
                <Plus size={24} />
            </motion.button>
        </div>
    );
}
