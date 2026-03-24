import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, LogIn, User, Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSheets } from '../contexts/SheetsContext';
import Footer from '../components/Footer';
import vprLogo from "../assets/vpr-logo.jpeg";

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { refreshAll } = useSheets();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!username || !password) {
      setError('Please enter both username and password');
      setIsLoading(false);
      return;
    }

    try {
      const success = await login(username, password);
      if (success) {
        // Pre-fetch all data so the first page is instant
        await refreshAll(true);
        navigate('/admin/dashboard');
      } else {
        setError('Invalid User ID or password. Please check your credentials.');
        setIsLoading(false);
      }
    } catch (err) {
      setError('A system error occurred. Please try again later.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col font-sans selection:bg-primary/20 relative overflow-hidden">
      
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-50" />
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
        
        {/* Central Login Card */}
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="bg-white rounded-[2rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08)] border border-gray-100/50 overflow-hidden">
            <div className="p-8 sm:p-12 space-y-10">
              
              {/* Logo & Title */}
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="inline-block p-3 rounded-2xl bg-white shadow-xl shadow-primary/10 transition-transform hover:scale-105 duration-500 border border-gray-50">
                  <img
                    src={vprLogo}
                    alt="VPR Logo"
                    className="h-16 w-auto object-contain"
                  />
                </div>
                <div className="space-y-1">
                  <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-800 leading-tight">
                    ORDER<span className="text-primary">TO</span>DELIVERY
                  </h1>
                  <p className="text-gray-400 font-bold text-[10px] sm:text-xs tracking-[0.2em] uppercase">
                    Management Portal Access
                  </p>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50/50 backdrop-blur-sm border border-red-100 p-4 rounded-2xl animate-shake">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-xl">
                      <AlertCircle size={18} className="text-red-500" />
                    </div>
                    <span className="text-red-600 text-sm font-bold">{error}</span>
                  </div>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  {/* User ID Input */}
                  <div className="space-y-1.5 group">
                    <label htmlFor="username" className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 transition-colors group-focus-within:text-primary">
                      User ID
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 transition-colors group-focus-within:text-primary pointer-events-none">
                        <User size={18} />
                      </div>
                      <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter your user ID"
                        className="w-full pl-12 pr-4 py-4 bg-gray-200/50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-primary/20 focus:outline-none transition-all duration-300 text-gray-800 font-semibold placeholder:text-gray-400 placeholder:font-medium"
                        disabled={isLoading}
                        autoComplete="username"
                      />
                    </div>
                  </div>

                  {/* Secret Key Input */}
                  <div className="space-y-1.5 group">
                    <label htmlFor="password" className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 transition-colors group-focus-within:text-primary">
                      Secret Key
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 transition-colors group-focus-within:text-primary pointer-events-none">
                        <Lock size={18} />
                      </div>
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`w-full pl-12 pr-12 py-4 bg-gray-200/50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-primary/20 focus:outline-none transition-all duration-300 text-gray-800 font-semibold placeholder:text-gray-400 placeholder:font-medium ${!showPassword ? 'text-xl tracking-[0.2em]' : 'text-base tracking-normal'}`}
                        disabled={isLoading}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors focus:outline-none"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full group relative overflow-hidden bg-primary py-4 px-6 rounded-2xl text-white font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-primary/30 hover:shadow-primary/40 active:scale-95 transition-all duration-300 disabled:opacity-70"
                >
                  <div className="relative z-10 flex items-center justify-center gap-3">
                    {isLoading ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
                        <span>Access Portal</span>
                      </>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </form>
            </div>
            
            <div className="px-12 py-6 bg-gray-50/50 text-center border-t border-gray-100">
               <p className="text-[9px] text-gray-400 font-bold uppercase tracking-[0.15em]">
                  Secure Authentication Protocol Active
               </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Component */}
      <div className="relative z-10">
        <Footer />
      </div>

      {/* Global CSS for Animations */}
      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default Login;
