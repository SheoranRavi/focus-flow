import React, { useState, useEffect, useRef, useMemo, useCallback, useReducer } from 'react';
import { Plus, RotateCcw } from 'lucide-react';
import ProgressRing from './components/ProgressRing/ProgressRing';
import SessionCard from './components/SessionCard/SessionCard';
import { Session, TimerState } from './types';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { AnimatePresence } from 'framer-motion';
import {motion} from "motion/react";
import { parseSessionsFromStorage } from './lib/utils';
import { useAuth } from './context/AuthContext';
import { api } from './lib/api';
import CreateSession from './components/CreateSession/CreateSession';
import { appReducer, AppState } from './context/reducer';


// --- Main App Component ---
const App: React.FC = () => {
  const user = useAuth();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  function initState(): AppState {
    const fallbackSessions: Session[] = [
      { id: 1, title: 'Deep Work', sessionDuration: 25 * 60, timeLeft: 25 * 60, isCompleted: false, dailyGoalMinutes: 90, focusSeconds: 0, state: TimerState.PAUSED },
      { id: 2, title: 'Reading', sessionDuration: 45 * 60, timeLeft: 45 * 60, isCompleted: false, dailyGoalMinutes: 60, focusSeconds: 0, state: TimerState.PAUSED },
      { id: 3, title: 'Emails', sessionDuration: 15 * 60, timeLeft: 15 * 60, isCompleted: false, dailyGoalMinutes: 30, focusSeconds: 0, state: TimerState.PAUSED },
    ];

    const sessions = parseSessionsFromStorage(localStorage.getItem('sessions'), fallbackSessions);

    const activeSessionId = sessions.find(s => s.state === TimerState.RUNNING)?.id ?? null;

    return {
      sessions,
      activeSessionId,
      streak: parseInt(localStorage.getItem('streak') ?? '0', 10),
      yesterdayMinutes: parseFloat(localStorage.getItem('yesterdayMins') ?? '0'),
      lastResetDate: localStorage.getItem('lastResetDate') ?? '',
      resetTime: localStorage.getItem('resetTime') ?? '00:00',
    };
  };

  const [state, dispatch] = useReducer(appReducer, undefined, initState);

  // Audio ref for timer end
  const audioRef = useRef<HTMLAudioElement>(null);
  const initialSessions = useRef(state.sessions);
  // Fetch sessions from API if user is logged in
  useEffect(() => {
    if (user) {
      api.getSessions()
        .then(fetchedSessions => {
          if (fetchedSessions && fetchedSessions.length > 0) {
            console.log(`fetched sessions: ${JSON.stringify(fetchedSessions)}`);
            dispatch({type: 'LOAD_SESSIONS', sessions: fetchedSessions});
          } else{
            Promise.allSettled(
              initialSessions.current.map(session => api.createSession(session))
            ).then(results => {
              const createdSessions = results
                .filter((result): result is PromiseFulfilledResult<Session> => result.status === 'fulfilled')
                .map(result => result.value);

              if (createdSessions.length > 0){
                console.log(`Created sessions: ${JSON.stringify(createdSessions)}`);
                dispatch({type: 'LOAD_SESSIONS', sessions: createdSessions});
              }
              
              // log failures
              const failures = results.filter(r => r.status === 'rejected');
              if (failures.length > 0){
                console.error(`Failed to upload ${failures.length} sessions:`, failures);
              }
            }).catch(error => {
              console.error('Failed to upload local sessions:', error);
            });
          }
        })
        .catch(error => {
          console.error('Failed to fetch sessions from API:', error);
          // Keep using localStorage sessions on error
        });
    }
  }, [user]);
  
  // Derived State: Calculate total daily goal from individual session goals
  const totalDailyGoalMinutes = state.sessions.reduce((sum, session) => sum + session.dailyGoalMinutes, 0);

  // fire up the notification for session complete
  const completeNotification = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((e: Error) => console.log("Audio play failed:", e));
    }
  }

  // fire notification by monitoring the active session complete status
  useEffect(() => {
    const justCompleted = state.sessions.find(s => s.isCompleted && s.id !== state.activeSessionId);
    if (justCompleted) {
      completeNotification();
    }
  }, [state.sessions, state.activeSessionId]);

  // Timer tick
  useEffect(() => {
    if (!state.activeSessionId) return;
    const interval = setInterval(() => {
      dispatch({type: 'TICK', now: Date.now()});
    }, 1000);
    return () => clearInterval(interval);
  }, [state.activeSessionId])

  // handler for resetting the total daily progress
  const handleResetDailyProgress = useCallback((resetDate: string) => {
    dispatch({type: 'RESET_DAILY_PROGRESS', resetDate: resetDate});
  }, []);

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
      if (state.resetTime !== null && currentTimeString >= state.resetTime && state.lastResetDate !== null && todayDate > state.lastResetDate){
        handleResetDailyProgress(todayDate);
        console.log("Daily progress auto-reset triggered.");
      }
    }, 1000);

    return () => clearInterval(checkResetTime);
  }, [state.resetTime, state.lastResetDate, handleResetDailyProgress]);

  // update sessions in localStorage (only if not logged in)
  useEffect(() => {
    if (!user) {
      localStorage.setItem('sessions', JSON.stringify(state.sessions));
    }
  }, [state.sessions, user]);

  const totalFocusSeconds = useMemo(() => {
    // do not count a session time towards daily goal once session goal is achieved
    return state.sessions.reduce((sum, s) => sum + Math.min(s.focusSeconds, s.dailyGoalMinutes * 60), 0);
  }, [state.sessions]);

  const handleStart = (id: number) => {
    dispatch({type: 'START_SESSION', id: id});
  };

  const handlePause = (id: number) => {
    dispatch({type:'PAUSE_SESSION', id:id});
  };

  const handleReset = (id: number) => {
    dispatch({type:'RESET_SESSION', id:id});
  };

  const handleDelete = (id: number) => {
    dispatch({type:'DELETE_SESSION', id:id});
    if(user){
      api.deleteSession(id).catch(e => console.error(e));
    }
  };

  const handleUpdate = (id: number, newDetails: Partial<Session>) => {
    dispatch({type:'UPDATE_SESSION', id:id, changes:newDetails});
  };

  const handleSetResetTime = (newTime: string) => {
    dispatch({type:'SET_RESET_TIME', time:newTime});
    localStorage.setItem("resetTime", newTime);
  }

  const handleAddSession = (sessionData: {
    title: string;
    dailyGoalMinutes: number;
    sessionDuration: number;
    noGoal: boolean;
  }) => {
    const newId = Math.max(...state.sessions.map(s => s.id), 0) + 1;
    const newSession: Session = {
      id: newId,
      title: sessionData.title,
      sessionDuration: sessionData.sessionDuration,
      timeLeft: sessionData.sessionDuration,
      isCompleted: false,
      dailyGoalMinutes: sessionData.dailyGoalMinutes,
      focusSeconds: 0,
      state: TimerState.PAUSED,
      noGoal: sessionData.noGoal,
    };
    console.log(`new session created with id: ${newId}`);
    dispatch({type:"ADD_SESSION", session: newSession});

    // create session in backend if user is logged in
    if (user) {
      api.createSession(newSession)
        .then(createdSession => {
          // Update with server-generated ID
          dispatch({type:"UPDATE_SESSION", id: newId, changes: createdSession});
        })
        .catch(error => {
          console.error('Failed to create session on server:', error);
          // Keep the local session even if server fails
        });
    }
  };

  // subscribe to events
  useEffect(() => {
    if (user){
      api.streamEvents(dispatch);
    }
  }, [user])

  // Derived State for UI
  const activeSessionTitle = state.sessions.find(s => s.id === state.activeSessionId)?.title || "Ready to Focus";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-emerald-100">
      <Navbar
        activeSessionTitle={activeSessionTitle}
        activeSessionId={state.activeSessionId}
        streak={state.streak}
        resetTime={state.resetTime}
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
                 onClick={() => setIsCreateDialogOpen(true)}
                 className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
               >
                 <Plus size={16} /> New Session
               </button>
            </div>

            {/* Horizontal Scroll Area for Sessions (or Grid on large) */}
            <div className="w-full overflow-x-auto pb-8 -mx-6 px-6 md:mx-0 md:px-0 scrollbar-hide">
              <div className="flex flex-col md:flex-row gap-6 md:flex-wrap">
                <AnimatePresence mode='popLayout'>
                  {state.sessions.map(session => (
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
                        isActive={state.activeSessionId === session.id}
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
                {state.sessions.length === 0 && (
                  <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 rounded-3xl w-full text-slate-400">
                     <p className="mb-4 font-medium">No active tasks</p>
                     <button onClick={() => setIsCreateDialogOpen(true)} className="text-emerald-600 hover:underline">Create one to get started</button>
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
                        <div className="font-bold text-slate-700 text-lg">{Math.floor(state.yesterdayMinutes / 60)} h {Math.floor(state.yesterdayMinutes) % 60} min</div>
                    </div>
                    <div className="text-center px-2">
                        <div className="text-xs text-slate-400 uppercase font-medium tracking-wide mb-1">Total Goal</div>
                        {/* Display the calculated total goal from all sessions */}
                        <div className="font-bold text-emerald-600 text-lg">{Math.floor(totalDailyGoalMinutes / 60)}h {totalDailyGoalMinutes % 60} min</div>
                    </div>
                    <div className="text-center px-2">
                        <div className="text-xs text-slate-400 uppercase font-medium tracking-wide mb-1">Streak</div>
                        <div className="font-bold text-slate-700 text-lg">{state.streak}</div>
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
      
      {/* Create Session Dialog */}
      <CreateSession 
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onAddSession={handleAddSession}
      />
    </div>
  );
};

export default App;