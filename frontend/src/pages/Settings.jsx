import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, LogOut, Bell, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function Settings() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    // Get current user info from token
    const token = localStorage.getItem('token');
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const username = localStorage.getItem('username') || payload.sub || 'User';
      const email = localStorage.getItem('email') || 'user@example.com';
      setUser({ username, email });
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('username');
    localStorage.removeItem('email');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-[#1a1c23] to-black p-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 rounded-2xl"
        >
          <h1 className="text-3xl font-bold text-white mb-8">Settings</h1>

          {/* Profile Section */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Profile
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm">Username</label>
                <div className="mt-1 text-white font-semibold">{user?.username}</div>
              </div>
              <div>
                <label className="text-gray-400 text-sm">Email</label>
                <div className="mt-1 text-white">{user?.email}</div>
              </div>
            </div>
          </section>

          {/* Notifications */}
          <section className="mb-8 pb-8 border-b border-white/10">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Notifications
            </h2>
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <span className="text-gray-300">Friend requests</span>
                <input type="checkbox" className="toggle toggle-primary" defaultChecked />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-gray-300">Direct messages</span>
                <input type="checkbox" className="toggle toggle-primary" defaultChecked />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-gray-300">Mentions</span>
                <input type="checkbox" className="toggle toggle-primary" defaultChecked />
              </label>
            </div>
          </section>

          {/* Appearance */}
          <section className="mb-8 pb-8 border-b border-white/10">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              {darkMode ? <Moon className="w-5 h-5 text-primary" /> : <Sun className="w-5 h-5 text-primary" />}
              Appearance
            </h2>
            <label className="flex items-center justify-between">
              <span className="text-gray-300">Dark Mode</span>
              <input 
                type="checkbox" 
                className="toggle toggle-primary" 
                checked={darkMode}
                onChange={(e) => setDarkMode(e.target.checked)}
              />
            </label>
          </section>

          {/* Logout */}
          <section>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLogout}
              className="btn btn-error w-full text-lg flex items-center justify-center gap-2"
            >
              <LogOut size={20} />
              Log Out
            </motion.button>
          </section>
        </motion.div>

        <div className="mt-4 text-center">
          <button 
            onClick={() => navigate('/app')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
