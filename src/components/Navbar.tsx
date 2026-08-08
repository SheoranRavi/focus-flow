import { useAuth } from "@/context/AuthContext";
import React, {useState, useEffect} from "react";
import {useNavigate } from "react-router-dom";
import { CheckCircle2, MoreHorizontal, Clock, X, Menu, BarChart3, Plus } from "lucide-react";
import Button from "./ui/Button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/Dialog";
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

export interface NavbarProps{
  activeSessionTitle: string,
  activeSessionId: number | null,
  resetTime: string,
  timezone: string,
  handleSaveSettings: (newResetTime: string, newTimezone: string) => void,
  onCreateSession?: () => void,
  subscriptionStatus?: string,
  subscriptionCancelAtPeriodEnd?: boolean,
  isCancellingSubscription?: boolean,
  onCancelSubscription?: () => void,
}

const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland',
];

const Navbar: React.FC<NavbarProps> = (props) => {
  const navigate = useNavigate();
  const user = useAuth();
  const isLoggedIn = !!user;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCancelConfirmationOpen, setIsCancelConfirmationOpen] = useState(false);

  const {
    activeSessionTitle,
    activeSessionId,
    resetTime,
    timezone,
    handleSaveSettings,
    onCreateSession,
    subscriptionStatus,
    subscriptionCancelAtPeriodEnd,
    isCancellingSubscription = false,
    onCancelSubscription,
  } = props;

  // Local state for form editing
  const [localResetTime, setLocalResetTime] = useState(resetTime);
  const [localTimezone, setLocalTimezone] = useState(timezone);

  // Sync local state when props change (e.g., after fetching from backend)
  useEffect(() => {
    setLocalResetTime(resetTime);
  }, [resetTime]);

  useEffect(() => {
    setLocalTimezone(timezone);
  }, [timezone]);

  // Check if there are unsaved changes
  const hasChanges = localResetTime !== resetTime || localTimezone !== timezone;

  const handleSave = () => {
    handleSaveSettings(localResetTime, localTimezone);
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
    setIsMobileMenuOpen(false);
  }

  const openCancelConfirmation = () => {
    setIsCancelConfirmationOpen(true);
  };

  const closeCancelConfirmation = () => {
    setIsCancelConfirmationOpen(false);
  };

  const confirmCancellation = () => {
    if (!onCancelSubscription) {
      return;
    }

    onCancelSubscription();
    closeCancelConfirmation();
    setIsMenuOpen(false);
    setIsMobileMenuOpen(false);
  };

  const subscriptionCancellationSection = onCancelSubscription && subscriptionStatus === "active" ? (
    <div className="pt-3 border-t border-slate-100 space-y-3">
      <div>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Subscription</p>
        <p className="text-sm text-slate-600 mt-1">
          {subscriptionCancelAtPeriodEnd
            ? "Cancellation scheduled for the end of the current billing period."
            : "Your subscription renews monthly."}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-center border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          onClick={openCancelConfirmation}
          disabled={isCancellingSubscription}
        >
          {isCancellingSubscription ? "Working..." : "Cancel subscription"}
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <>
      <header className="sticky top-0 z-30 w-full px-3 py-2">
        <nav className="max-w-7xl mx-auto bg-white/60 backdrop-blur-lg border border-white/20 rounded-2xl px-4 py-2 flex items-center justify-between shadow-lg shadow-slate-200/50">
          <div className="flex items-center gap-3">
          <div className="brand-gradient shadow-brand w-10 h-10 rounded-xl flex items-center justify-center text-white">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight text-slate-900">Task Quota</h1>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
              {activeSessionId !== null ? (
                <span className="flex items-center gap-1 text-brand animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-brand"></span> Focusing on {activeSessionTitle}
                </span>
              ) : "No active session"}
            </p>
          </div>
      </div>

      {/* Right side container - visible on all screens */}
      <div className="flex items-center gap-3 md:gap-6">
        {/* Desktop-only auth buttons and settings */}
        <div className="hidden md:flex items-center gap-6 relative">
          {onCreateSession && (
            <Button onClick={onCreateSession} className="bg-slate-900 text-white hover:bg-slate-800">
              <Plus size={16} />
              New Session
            </Button>
          )}
          {
            !isLoggedIn ?
            <>
              <Button onClick={() => navigate("/login")} variant="outline">Login</Button>
              <Button onClick={() => navigate("/register")} variant="secondary">Signup</Button>
            </> :
              <>
                <Button onClick={() => navigate("/analytics")} variant="ghost" className="text-slate-600">
                  <BarChart3 size={16} />
                  Analytics
                </Button>
                <Button onClick={handleLogout} variant="ghost">Logout</Button>
              </>
          }
          
          <div className="h-8 w-px bg-slate-200"></div>
          
          <div className="relative">
            <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-label="Open settings"
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
                                  value={localResetTime}
                                  onChange={(e) => setLocalResetTime(e.target.value)}
                                  className="border border-slate-200 bg-slate-50 rounded-lg p-2 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft w-full"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                                  Timezone
                                </label>
                                <select
                                  value={localTimezone}
                                  onChange={(e) => setLocalTimezone(e.target.value)}
                                  className="border border-slate-200 bg-slate-50 rounded-lg p-2 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft w-full"
                                >
                                  {!COMMON_TIMEZONES.includes(localTimezone) && (
                                    <option value={localTimezone}>{localTimezone}</option>
                                  )}
                                  {COMMON_TIMEZONES.map(tz => (
                                    <option key={tz} value={tz}>{tz}</option>
                                  ))}
                                </select>
                            </div>
                            {hasChanges && (
                              <button
                                onClick={handleSave}
                                className="w-full bg-brand hover:bg-brand/90 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                              >
                                Save Changes
                              </button>
                            )}
                            {subscriptionCancellationSection}
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
        </nav>
      </header>

      {/* Mobile Menu Dropdown - Outside navbar for proper backdrop */}
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
                {onCreateSession && (
                  <Button
                    onClick={() => {
                      onCreateSession();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full bg-slate-900 text-white hover:bg-slate-800"
                  >
                    <Plus size={16} />
                    New Session
                  </Button>
                )}
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

              {isLoggedIn && (
                <div className="space-y-2">
                  <Button
                    onClick={() => {
                      navigate("/analytics");
                      setIsMobileMenuOpen(false);
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    <BarChart3 size={16} />
                    Analytics
                  </Button>
                </div>
              )}

              {/* Settings Section */}
              <div className="pt-3 border-t border-slate-100">
                <h4 className="font-bold text-slate-800 mb-3">Settings</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Clock size={12} /> Auto-Reset Daily Goal
                    </label>
                    <p className="text-xs text-slate-400">Progress resets at this time daily.</p>
                    <input
                      type="time"
                      value={localResetTime}
                      onChange={(e) => setLocalResetTime(e.target.value)}
                      className="border border-slate-200 bg-slate-50 rounded-lg p-2 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                      Timezone
                    </label>
                    <select
                      value={localTimezone}
                      onChange={(e) => setLocalTimezone(e.target.value)}
                      className="border border-slate-200 bg-slate-50 rounded-lg p-2 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft w-full"
                    >
                      {!COMMON_TIMEZONES.includes(localTimezone) && (
                        <option value={localTimezone}>{localTimezone}</option>
                      )}
                      {COMMON_TIMEZONES.map(tz => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  </div>
                  {hasChanges && (
                    <button
                      onClick={handleSave}
                      className="w-full bg-brand hover:bg-brand/90 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                    >
                      Save Changes
                    </button>
                  )}
                  {subscriptionCancellationSection}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <Dialog open={isCancelConfirmationOpen} onOpenChange={(open) => {
        if (!open) {
          closeCancelConfirmation();
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm cancellation</DialogTitle>
            <DialogDescription>
              This will schedule your subscription to end at the close of the current billing period.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={closeCancelConfirmation}>
              Keep subscription
            </Button>
            <Button type="button" variant="destructive" className="w-full sm:w-auto" onClick={confirmCancellation}>
              Confirm cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default Navbar;
