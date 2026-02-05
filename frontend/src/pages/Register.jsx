import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { User, KeyRound, Mail, Sparkles } from 'lucide-react';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.post('/auth/register', {
        email,
        username,
        password
      });
      toast.success("Account created! Please log in.");
      navigate('/login');
    } catch (err) {
      console.error("Registration error:", err);
      const detail = err.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : JSON.stringify(detail) || 'Registration failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900/20 to-black relative overflow-hidden">
      {/* Animated background orbs */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3]
        }}
        transition={{ duration: 8, repeat: Infinity }}
        className="absolute top-20 left-20 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl"
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.3, 1],
          opacity: [0.3, 0.5, 0.3]
        }}
        transition={{ duration: 10, repeat: Infinity, delay: 1 }}
        className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"
      />
      
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative glass-card p-10 rounded-3xl w-full max-w-md shadow-2xl"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="w-6 h-6 text-primary" />
          <h2 className="text-4xl font-bold text-white">DeepCall</h2>
        </div>
        <p className="text-center text-gray-400 mb-8">Create your account</p>
        
        <form onSubmit={handleRegister} className="space-y-5">
          <div className="form-control">
            <label className="label">
              <span className="label-text text-gray-300 font-semibold">Username</span>
            </label>
            <div className="relative group">
              <User className="absolute left-3 top-3.5 h-5 w-5 text-gray-500 group-focus-within:text-primary transition-colors duration-200" />
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input input-bordered w-full pl-10 bg-black/40 border-gray-700 focus:border-primary focus:ring-2 focus:ring-primary/30 text-white placeholder-gray-500 transition-all duration-200" 
                placeholder="cool_username"
                required
              />
            </div>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text text-gray-300 font-semibold">Email</span>
            </label>
            <div className="relative group">
              <Mail className="absolute left-3 top-3.5 h-5 w-5 text-gray-500 group-focus-within:text-primary transition-colors duration-200" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input input-bordered w-full pl-10 bg-black/40 border-gray-700 focus:border-primary focus:ring-2 focus:ring-primary/30 text-white placeholder-gray-500 transition-all duration-200" 
                placeholder="you@example.com"
                required
              />
            </div>
          </div>
          
          <div className="form-control">
            <label className="label">
              <span className="label-text text-gray-300 font-semibold">Password</span>
            </label>
            <div className="relative group">
              <KeyRound className="absolute left-3 top-3.5 h-5 w-5 text-gray-500 group-focus-within:text-primary transition-colors duration-200" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input input-bordered w-full pl-10 bg-black/40 border-gray-700 focus:border-primary focus:ring-2 focus:ring-primary/30 text-white placeholder-gray-500 transition-all duration-200" 
                placeholder="••••••••"
                minLength={8}
                required
              />
            </div>
          </div>

          <motion.button 
            type="submit" 
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn btn-primary w-full text-lg mt-6 font-semibold shadow-lg shadow-primary/50 transition-all duration-200"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="loading loading-spinner"></span>
                Creating Account...
              </span>
            ) : (
              'Sign Up'
            )}
          </motion.button>
        </form>
        
        <p className="text-center mt-8 text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:text-primary-focus font-semibold hover:underline transition-colors">
            Log in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
