import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { KeyRound, Mail, Sparkles } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('username', email);
      formData.append('password', password);

      const response = await api.post('/auth/login', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      localStorage.setItem('token', response.data.access_token);
      
      // Decode token to get user_id
      const payload = JSON.parse(atob(response.data.access_token.split('.')[1]));
      localStorage.setItem('user_id', payload.sub);
      localStorage.setItem('username', email.split('@')[0]); // Temporary
      localStorage.setItem('email', email);
      
      toast.success("Welcome back!", {
        icon: '👋',
      });
      navigate('/app');
    } catch (err) {
      console.error("Login error:", err);
      const detail = err.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : 'Invalid credentials';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900/20 to-black relative overflow-hidden">
      {/* Animated background orbs */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3]
        }}
        transition={{ duration: 8, repeat: Infinity }}
        className="absolute top-20 right-20 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl"
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.3, 1],
          opacity: [0.3, 0.5, 0.3]
        }}
        transition={{ duration: 10, repeat: Infinity, delay: 1 }}
        className="absolute bottom-20 left-20 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl"
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
          <h2 className="text-4xl font-bold text-white">Welcome Back</h2>
        </div>
        <p className="text-center text-gray-400 mb-8">Sign in to DeepCall</p>
        
        <form onSubmit={handleLogin} className="space-y-5">
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
                Signing In...
              </span>
            ) : (
              'Log In'
            )}
          </motion.button>
        </form>
        
        <p className="text-center mt-8 text-gray-400">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary hover:text-primary-focus font-semibold hover:underline transition-colors">
            Sign up
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
