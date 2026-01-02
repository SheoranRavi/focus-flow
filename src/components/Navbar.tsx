import { useAuth } from "@/context/AuthContext";
import React, {useState} from "react";
import {useNavigate } from "react-router-dom";
import { CheckCircle2, MoreHorizontal, Clock, X, Menu } from "lucide-react";
import Button from "./ui/Button";
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

export interface NavbarProps{
  activeSessionTitle: string,
  activeSessionId: number | null,
  streak: number,
  resetTime: string,
  handleSetResetTime: (newTime: string) => void
}

const Navbar: React.FC<NavbarProps> = (props) => {
  const navigate = useNavigate();
  const user = useAuth();
  const isLoggedIn = !!user;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const {activeSessionTitle, activeSessionId, streak, resetTime, handleSetResetTime} = props;

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
    setIsMobileMenuOpen(false);
  }

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-4 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-xl flex items-center justify-center text-white shadow-emerald-200 shadow-lg">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight text-slate-900">Focus Flow</h1>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
              {activeSessionId ? (
                <span className="flex items-center gap-1 text-emerald-600 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Focusing on {activeSessionTitle}
                </span>
              ) : "No active session"}
            </p>
          </div>
      </div>

      {/* Right side container - visible on all screens */}
      <div className="flex items-center gap-3 md:gap-6">
        {/* Streak counter - always visible */}
        <div className="text-right">
          <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Streak</div>
          <div className="font-bold text-slate-700">{streak} Days</div>
        </div>

        {/* Desktop-only auth buttons and settings */}
        <div className="hidden md:flex items-center gap-6 relative">
          {
            !isLoggedIn ?
            <>
              <Button onClick={() => navigate("/login")} variant="outline">Login</Button>
              <Button onClick={() => navigate("/register")} variant="secondary">Signup</Button>
            </> :
              <Button onClick={handleLogout} variant="ghost">Logout</Button>
          }
          
          <div className="h-8 w-px bg-slate-200"></div>
          
          <div className="relative">
            <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`p-2 rounded-full transition-colors ${isMenuOpen ? 'bg-slate-100 text-slate-700' : 'hover:bg-slate-100 text-slate-500'}`}
            >
                <MoreHorizontal size={20} />
            </button>
            {isMenuOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)}></div>
                    <div className="absolute right-0 top-12 bg-white shadow-xl border border-slate-100 rounded-2xl p-5 w-72 z-50 animate-in fade-in zoom-in-95 duration-100">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-bold text-slate-800">Settings</h4>
                            <button onClick={() => setIsMenuOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={16} />
                            </button>
                          </div>
                          
                          <div className="space-y-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                                  <Clock size={12} /> Auto-Reset Daily Goal
                                </label>
                                <p className="text-xs text-slate-400">Progress resets at this time daily.</p>
                                <input 
                                  type="time" 
                                  value={resetTime} 
                                  onChange={(e) => handleSetResetTime(e.target.value)}
                                  className="border border-slate-200 bg-slate-50 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 w-full"
                                />
                            </div>
                          </div>
                    </div>
                </>
            )}
          </div>
        </div>

        {/* Mobile Menu Button - Visible only on mobile */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Toggle mobile menu"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/20 z-40 md:hidden" 
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Mobile Menu Panel */}
          <div className="fixed top-[73px] right-0 left-0 bg-white border-b border-slate-200 shadow-lg z-50 md:hidden animate-in slide-in-from-top duration-200">
            <div className="px-6 py-4 space-y-4">
              
              {/* Auth Buttons */}
              <div className="space-y-2">
                {!isLoggedIn ? (
                  <>
                    <Button 
                      onClick={() => {
                        navigate("/login");
                        setIsMobileMenuOpen(false);
                      }} 
                      variant="outline"
                      className="w-full"
                    >
                      Login
                    </Button>
                    <Button 
                      onClick={() => {
                        navigate("/register");
                        setIsMobileMenuOpen(false);
                      }} 
                      variant="secondary"
                      className="w-full"
                    >
                      Signup
                    </Button>
                  </>
                ) : (
                  <Button 
                    onClick={handleLogout} 
                    variant="ghost"
                    className="w-full"
                  >
                    Logout
                  </Button>
                )}
              </div>

              {/* Settings Section */}
              <div className="pt-3 border-t border-slate-100">
                <h4 className="font-bold text-slate-800 mb-3">Settings</h4>
                <div className="space-y-2">
                  <label className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Clock size={12} /> Auto-Reset Daily Goal
                  </label>
                  <p className="text-xs text-slate-400">Progress resets at this time daily.</p>
                  <input 
                    type="time" 
                    value={resetTime} 
                    onChange={(e) => handleSetResetTime(e.target.value)}
                    className="border border-slate-200 bg-slate-50 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </nav>
  )
}

export default Navbar;