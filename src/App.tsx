import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Plus, RotateCcw } from 'lucide-react';
import ProgressRing from './components/ProgressRing/ProgressRing';
import SessionCard from './components/SessionCard/SessionCard';
import { Session, TimerState } from './types';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { AnimatePresence } from 'framer-motion';
import {motion} from "motion/react";


// --- Main App Component ---
const App: React.FC = () => {
  // State
  const [sessions, setSessions] = useState<Session[]>(() => {
    const stored = localStorage.getItem('sessions');
    if (stored){
      try {
            const parsedData = JSON.parse(stored);
            if (Array.isArray(parsedData)) {
                return parsedData;
            }
        } catch (e) {
            console.error("Error parsing sessions from localStorage:", e);
        }
    }
    return [
        { id: 1, title: 'Deep Work', initialDuration: 25 * 60, timeLeft: 25 * 60, isCompleted: false, dailyGoalMinutes: 90, focusSeconds: 0, state: TimerState.PAUSED },
        { id: 2, title: 'Reading', initialDuration: 45 * 60, timeLeft: 45 * 60, isCompleted: false, dailyGoalMinutes: 60, focusSeconds: 0, state: TimerState.PAUSED }, 
        { id: 3, title: 'Emails', initialDuration: 15 * 60, timeLeft: 15 * 60, isCompleted: false, dailyGoalMinutes: 30, focusSeconds: 0, state: TimerState.PAUSED },
      ];
  });
  
  const [activeSessionId, setActiveSessionId] = useState<number | null>(() => {
    if(sessions?.length > 0){
      let runningS = sessions.filter((s) => {
        if(s.state === TimerState.RUNNING){
          return s;
        }
      });
      if (runningS.length > 0){
        return runningS[0].id;
      }
      return null;
    }
    return null;
  });
  
  // Global stats state
  const [streak, setStreak] = useState(() => {
    const temp = localStorage.getItem('streak');
    if (temp !== null){
      return Number.parseInt(temp);
    }
    return 0;
  });
  const [yesterdayMinutes, setYesterdayMinutes] = useState(() => {
    const temp = localStorage.getItem('yesterdayMins');
    if (temp !== null){
      const parsed = Number.parseFloat(temp);
      return parsed;
    }
    return 0;
  });
  const [lastResetDate, setLastResetDate] = useState(() => {
    const temp = localStorage.getItem('lastResetDate');
    if (temp !== null){
      return temp;
    }
    return "";
  });

  // Settings / Menu State
  
  const [resetTime, setResetTime] = useState(() => {
    let stored = localStorage.getItem('resetTime');
    if (stored !== undefined && stored !== null){
      // ToDo: validate the format
      return stored;
    }else{
      return "00:00";
    }
  });

  // Audio ref for timer end
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Derived State: Calculate total daily goal from individual session goals
  const totalDailyGoalMinutes = sessions.reduce((sum, session) => sum + session.dailyGoalMinutes, 0);

  // Timer Effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (activeSessionId) {
      interval = setInterval(() => {
        const now = Date.now();
        
        // Use a functional update to modify session state and global stats together
        setSessions(prevSessions => {
            let delta = 0;
            const updatedSessions = prevSessions.map(session => {
                if (session.id === activeSessionId) {
                    // Safety check: ensure targetTime is set. 
                    // handleStart should set it.
                    if (!session.targetTime) return session;

                    // Calculate expected remaining seconds based on target
                    const secondsLeft = Math.max(0, Math.ceil((session.targetTime - now) / 1000));
                    
                    // The difference between what we had in state (timeLeft) and real time (secondsLeft)
                    // is how much time passed since the last tick (or since tab wake up)
                    delta = Math.max(0, session.timeLeft - secondsLeft);

                    if (secondsLeft <= 0) {
                        return { ...session, timeLeft: 0, isCompleted: true, focusSeconds: (session.focusSeconds || 0) + delta };
                    }
                    
                    return { 
                        ...session, 
                        timeLeft: secondsLeft, 
                        focusSeconds: (session.focusSeconds || 0) + delta 
                    };
                }
                return session;
            });

            // Check completion
            const activeSession = updatedSessions.find(s => s.id === activeSessionId);
            if (activeSession && activeSession.isCompleted) {
                 setActiveSessionId(null);
                 if (audioRef.current) {
                    audioRef.current.currentTime = 0;
                    audioRef.current.play().catch((e: Error) => console.log("Audio play failed:", e));
                 }
            }

            return updatedSessions;
        });

      }, 1000); // Check every second
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeSessionId]);

  // handler for resetting the total daily progress
  const handleResetDailyProgress = useCallback((resetDate: string) => {
    // the total time spent yesterday
    const yesterdaySeconds = sessions.reduce((sum, s) => sum + s.focusSeconds, 0);
    // the time that only counts towards the goals
    const yesterdayGoalSeconds = sessions.reduce((sum, s) => sum + Math.min(s.focusSeconds, s.dailyGoalMinutes * 60), 0);
    setYesterdayMinutes(yesterdaySeconds/60);
    setSessions(prev => prev.map(s => ({ ...s, focusSeconds: 0 })));
    setLastResetDate(resetDate);
    localStorage.setItem('lastResetDate', resetDate);
    localStorage.setItem('yesterdayMins', (yesterdaySeconds/60).toString());
    if(yesterdayGoalSeconds/60 >= totalDailyGoalMinutes){
      localStorage.setItem('streak', (streak+1).toString());
      setStreak(prevStreak => prevStreak+1);
    } else{
      localStorage.setItem('streak', '0');
      setStreak(0);
    }
  }, [sessions, totalDailyGoalMinutes, streak]);

  // helpers
  const getTodayDateTimeString = () => {
    const now = new Date();
    const currentTimeString = now.toLocaleTimeString("en-GB", {
      hour: '2-digit',
      minute: '2-digit'
    });
    const todayDate = now.toLocaleDateString("en-GB", { 
      day: '2-digit', 
      month: '2-digit',
      year: '2-digit'
    });
    return [todayDate, currentTimeString];
  };

  // Effect for Auto-Reset Logic
  useEffect(() => {
    const checkResetTime = setInterval(() => {
      const [todayDate, currentTimeString] = getTodayDateTimeString();

      // If time matches preference
      if (resetTime !== null && currentTimeString >= resetTime && lastResetDate !== null && todayDate > lastResetDate){
        handleResetDailyProgress(todayDate);
        console.log("Daily progress auto-reset triggered.");
      }
    }, 1000);

    return () => clearInterval(checkResetTime);
  }, [resetTime, lastResetDate, handleResetDailyProgress]);

  // update sessions in localStorage
  useEffect(() => {
    localStorage.setItem('sessions', JSON.stringify(sessions));
  }, [sessions]);

  const totalFocusSeconds = useMemo(() => {
    // do not count a session time towards daily goal once session goal is achieved
    return sessions.reduce((sum, s) => sum + Math.min(s.focusSeconds, s.dailyGoalMinutes * 60), 0);
  }, [sessions]);

  const handleStart = (id: number) => {
    handleActiveSessionChange(activeSessionId, id);
  };

  const handlePause = (id: number) => {
    handleActiveSessionChange(id, null);
    if (activeSessionId === id) {
      setActiveSessionId(null);
    }
    setSessions(prev => prev.map(s => {
        if (s.id === id) {
            return { ...s, state: TimerState.PAUSED };
        }
        return s;
    }));
  };

  const handleActiveSessionChange = (prevId: number | null, id: number | null) => {
    setSessions((prevSessions) => {
      let sessionAtTopIdx = -1;
      const newSessions = prevSessions.map((s, idx) => {
        let newSession = s;
        if (prevId !== null && s.id === prevId){
          // the one being paused
          newSession.state = TimerState.PAUSED;
        }
        if (id !== null && s.id === id){
          // the timer being started
          // When starting, set the target end time based on current time + remaining duration
          // This ensures accuracy even if the thread sleeps
          const now = Date.now();
          newSession.state = TimerState.RUNNING;
          newSession.targetTime = now + (s.timeLeft * 1000);
          sessionAtTopIdx = idx;
        }
        return newSession;
      });
      if (sessionAtTopIdx !== -1){
        const topSession = newSessions[sessionAtTopIdx];
        newSessions.splice(sessionAtTopIdx, 1);
        newSessions.unshift(topSession);
      }
      return newSessions;
    });
    setActiveSessionId(id);
  }

  const handleReset = (id: number) => {
    setSessions(prev => prev.map(s => 
      s.id === id ? { ...s, timeLeft: s.initialDuration, isCompleted: false, state: TimerState.PAUSED } : s
    ));
    if (activeSessionId === id) setActiveSessionId(null);
  };

  const handleDelete = (id: number) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) setActiveSessionId(null);
  };

  const handleUpdate = (id: number, newDetails: Partial<Session>) => {
    setSessions(prev => {
        return prev.map(s => {
            if (s.id === id) {
                const updatedSession = { ...s, ...newDetails, isCompleted: false };

                // If we are updating the currently running session (e.g. changing duration),
                // we must update the targetTime to reflect the new duration immediately
                if (id === activeSessionId) {
                    updatedSession.targetTime = Date.now() + (updatedSession.timeLeft * 1000);
                }
                return updatedSession;
            }
            return s;
        });
    });
  };

  const handleSetResetTime = (newTime: string) => {
    setResetTime(newTime);
    localStorage.setItem("resetTime", newTime);
  }

  const handleAddSession = () => {
    const newId = Math.max(...sessions.map(s => s.id), 0) + 1;
    setSessions([...sessions, {
      id: newId,
      title: 'New Session',
      initialDuration: 30 * 60,
      timeLeft: 30 * 60,
      isCompleted: false,
      dailyGoalMinutes: 30, // Default goal for new sessions
      focusSeconds: 0,
      state: TimerState.PAUSED
    }]);
  };

  // Derived State for UI
  const activeSessionTitle = sessions.find(s => s.id === activeSessionId)?.title || "Ready to Focus";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-emerald-100">
      <Navbar
        activeSessionTitle={activeSessionTitle}
        activeSessionId={activeSessionId}
        streak={streak}
        resetTime={resetTime}
        handleSetResetTime={handleSetResetTime}
      />
      <main className="max-w-7xl mx-auto p-6 md:p-8">
        {/* Hidden Audio Element */}
        <audio 
            ref={audioRef} 
            src="/piano_notification.mp3"
            preload="auto"
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: Sessions List */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="flex items-center justify-between">
               <h2 className="text-2xl font-bold text-slate-800">Your Sessions</h2>
               <button 
                 onClick={handleAddSession}
                 className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
               >
                 <Plus size={16} /> New Session
               </button>
            </div>

            {/* Horizontal Scroll Area for Sessions (or Grid on large) */}
            <div className="w-full overflow-x-auto pb-8 -mx-6 px-6 md:mx-0 md:px-0 scrollbar-hide">
              <div className="flex flex-col md:flex-row gap-6 md:flex-wrap">
                <AnimatePresence mode='popLayout'>
                  {sessions.map(session => (
                    <motion.div
                      key={session.id}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ 
                        type: "spring", 
                        stiffness: 300, 
                        damping: 30
                      }}
                    >
                      <SessionCard 
                        key={session.id}
                        session={session}
                        isActive={activeSessionId === session.id}
                        onStart={handleStart}
                        onPause={handlePause}
                        onDelete={handleDelete}
                        onUpdate={handleUpdate}
                        onReset={handleReset}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {/* Empty State / Add Button Card Placeholder */}
                {sessions.length === 0 && (
                  <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 rounded-3xl w-full text-slate-400">
                     <p className="mb-4 font-medium">No active tasks</p>
                     <button onClick={handleAddSession} className="text-emerald-600 hover:underline">Create one to get started</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Daily Progress */}
          <div className="lg:col-span-4 space-y-6">
             {/* Progress Card */}
             <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center">
                <div className="w-full flex justify-between items-center mb-6 h-8">
                   <h3 className="font-bold text-lg text-slate-800">Daily Progress</h3>
                   <div className="flex gap-1">
                       <button 
                           onClick={() => {
                              const [todayDate, _] = getTodayDateTimeString();
                              handleResetDailyProgress(todayDate);
                            }}
                           className="p-1 rounded-full hover:bg-slate-100 transition-colors"
                           title="Start New Day (Reset Progress)"
                       >
                           <RotateCcw size={16} className="text-slate-400 hover:text-emerald-600" />
                       </button>
                   </div>
                </div>
                
                <ProgressRing 
                   radius={100} 
                   stroke={12} 
                   progress={Math.floor(totalFocusSeconds / 60)} 
                   total={totalDailyGoalMinutes} 
                />

                <div className="grid grid-cols-3 divide-x divide-slate-100 w-full mt-8 pt-8 border-t border-slate-50">
                    <div className="text-center px-2">
                        <div className="text-xs text-slate-400 uppercase font-medium tracking-wide mb-1">Yesterday</div>
                        <div className="font-bold text-slate-700 text-lg">{Math.floor(yesterdayMinutes / 60)} h {Math.floor(yesterdayMinutes) % 60} min</div>
                    </div>
                    <div className="text-center px-2">
                        <div className="text-xs text-slate-400 uppercase font-medium tracking-wide mb-1">Total Goal</div>
                        {/* Display the calculated total goal from all sessions */}
                        <div className="font-bold text-emerald-600 text-lg">{Math.floor(totalDailyGoalMinutes / 60)}h {totalDailyGoalMinutes % 60} min</div>
                    </div>
                    <div className="text-center px-2">
                        <div className="text-xs text-slate-400 uppercase font-medium tracking-wide mb-1">Streak</div>
                        <div className="font-bold text-slate-700 text-lg">{streak}</div>
                    </div>
                </div>
             </div>

             {/* Spotify / Music Placeholder */}
             {/* <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer group">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center text-white shrink-0">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                   </div>
                   <div>
                      <h4 className="font-bold text-slate-800 group-hover:text-emerald-600 transition-colors">Focus Music</h4>
                      <p className="text-xs text-slate-500">Connect to Spotify</p>
                   </div>
                </div>
                <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400">
                   <Plus size={14} />
                </div>
             </div> */}
          </div>

        </div>

      </main>

      <Footer />
    </div>
  );
};

export default App;