import React, { useState, useEffect, useRef, useMemo, useCallback, useReducer } from 'react';
import { Plus, RotateCcw } from 'lucide-react';
import ProgressRing from './components/ProgressRing/ProgressRing';
import SessionCard from './components/SessionCard/SessionCard';
import { Session, TimerState } from './types';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { AnimatePresence } from 'framer-motion';
import {motion} from "motion/react";
import { parseSessionsFromStorage, getTodayDateTimeString, normalizeDateToISO } from './lib/utils';
import { useAuth } from './context/AuthContext';
import { api } from './lib/api';
import CreateSession from './components/CreateSession/CreateSession';
import { appReducer, AppState } from './context/reducer';
import { notifySessionComplete, requestSessionNotificationPermission } from './lib/notifications';
import { sortSessionsForDisplay } from './lib/utils';


// --- Main App Component ---
const App: React.FC = () => {
  const user = useAuth();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [sseKey, setSseKey] = useState(0);
  const [resetStateReady, setResetStateReady] = useState(false);

  function initState(): AppState {
    const fallbackSessions: Session[] = [
      { id: 1, title: 'Deep Work', sessionDuration: 25 * 60, timeLeft: 25 * 60, isCompleted: false, dailyGoalMinutes: 90, focusSeconds: 0, state: TimerState.PAUSED },
      { id: 2, title: 'Reading', sessionDuration: 45 * 60, timeLeft: 45 * 60, isCompleted: false, dailyGoalMinutes: 60, focusSeconds: 0, state: TimerState.PAUSED },
      { id: 3, title: 'Emails', sessionDuration: 15 * 60, timeLeft: 15 * 60, isCompleted: false, dailyGoalMinutes: 30, focusSeconds: 0, state: TimerState.PAUSED },
    ];

    const storedSessions = localStorage.getItem('sessions');
    const sessions = storedSessions
      ? sortSessionsForDisplay(parseSessionsFromStorage(storedSessions, fallbackSessions))
      : fallbackSessions;

    const activeSessionId = sessions.find(s => s.state === TimerState.RUNNING)?.id ?? null;

    return {
      sessions,
      activeSessionId,
      streak: parseInt(localStorage.getItem('streak') ?? '0', 10),
      yesterdayMinutes: parseFloat(localStorage.getItem('yesterdayMins') ?? '0'),
      lastResetDate: normalizeDateToISO(localStorage.getItem('lastResetDate')),
      lastAutoResetDate: normalizeDateToISO(localStorage.getItem('lastAutoResetDate')),
      resetTime: localStorage.getItem('resetTime') ?? '00:00',
      timezone: localStorage.getItem('timezone') ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  };

  const [state, dispatch] = useReducer(appReducer, undefined, initState);

  // Audio ref for timer end
  const audioRef = useRef<HTMLAudioElement>(null);
  const initialSessions = useRef(state.sessions);
  const completedSessionIdsRef = useRef<Set<number> | null>(null);
  const sessionSyncPromiseRef = useRef<Promise<void> | null>(null);
  const sseHandleRef = useRef<ReturnType<typeof api.streamEvents> | null>(null);
  const lastResumeCheckRef = useRef(0);
  const setCompletedSessionBaseline = useCallback((sessions: Session[]) => {
    completedSessionIdsRef.current = new Set(sessions.filter(s => s.isCompleted).map(s => s.id));
  }, []);

  const syncSessionsFromApi = useCallback(async () => {
    if (!user) return;
    if (sessionSyncPromiseRef.current) {
      return sessionSyncPromiseRef.current;
    }

    sessionSyncPromiseRef.current = (async () => {
      const fetchedSessions = await api.getSessions();
      if (fetchedSessions && fetchedSessions.length > 0) {
        console.log(`fetched sessions: ${JSON.stringify(fetchedSessions)}`);
        setCompletedSessionBaseline(fetchedSessions);
        dispatch({type: 'LOAD_SESSIONS', sessions: fetchedSessions});
        const runningSess = fetchedSessions.filter((s) => s.state === TimerState.RUNNING)
        if (runningSess && runningSess.length > 0){
          // ToDo: Figure out a better way
          const targetTime = runningSess[0].targetTimeMs !== undefined ? runningSess[0].targetTimeMs : Date.now();
          dispatch({
            type: 'START_SESSION',
            id: runningSess[0].id,
            targetTimeMs: targetTime,
            updatedAt: runningSess[0].updatedAt ?? new Date().toISOString(),
          });
        }
      } else{
        const results = await Promise.allSettled(
          initialSessions.current.map(session => api.createSession(session))
        );
        const createdSessions = results
          .filter((result): result is PromiseFulfilledResult<Session> => result.status === 'fulfilled')
          .map(result => result.value);

        if (createdSessions.length > 0){
          console.log(`Created sessions: ${JSON.stringify(createdSessions)}`);
          setCompletedSessionBaseline(createdSessions);
          dispatch({type: 'LOAD_SESSIONS', sessions: createdSessions});
        }
        
        // log failures
        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length > 0){
          console.error(`Failed to upload ${failures.length} sessions:`, failures);
        }
      }
    })();

    try {
      await sessionSyncPromiseRef.current;
    } catch (error) {
      console.error('Failed to sync sessions from API:', error);
      // Keep using localStorage sessions on error.
    } finally {
      sessionSyncPromiseRef.current = null;
    }
  }, [user, setCompletedSessionBaseline]);

  const syncUserFromApi = useCallback(async () => {
    if (!user) return;

    const userObj = await api.getUser();
    if (userObj != null){
      dispatch({type: "LOAD_USER", user: userObj});
      localStorage.setItem('lastResetDate', userObj.lastResetDate);
      localStorage.setItem('lastAutoResetDate', userObj.lastAutoResetDate ?? '');
    }
  }, [user]);

  const syncStateFromApi = useCallback(async () => {
    await Promise.allSettled([
      syncSessionsFromApi(),
      syncUserFromApi(),
    ]);
  }, [syncSessionsFromApi, syncUserFromApi]);

  // Fetch sessions and user details from API if user is logged in
  useEffect(() => {
    let cancelled = false;
    if (!user){
      setResetStateReady(true);
      return;
    }

    setResetStateReady(false);
    syncStateFromApi()
      .catch((error) => {
        console.error('Failed to sync initial state from API:', error);
      })
      .finally(() => {
        if (!cancelled) {
          setResetStateReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user, syncStateFromApi])
  
  // Derived State: Calculate total daily goal from individual session goals
  const totalDailyGoalMinutes = state.sessions.reduce((sum, session) => sum + session.dailyGoalMinutes, 0);

  // fire up the notification for session complete
  const completeNotification = useCallback((session: Session) => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((e: Error) => console.log("Audio play failed:", e));
    }
    notifySessionComplete(session).then((shown) => {
      if (!shown) {
        console.info("Session completion notification was not shown.");
      }
    });
  }, []);

  // fire notification by monitoring the active session complete status
  useEffect(() => {
    const completedIds = new Set(state.sessions.filter(s => s.isCompleted).map(s => s.id));
    if (completedSessionIdsRef.current === null) {
      completedSessionIdsRef.current = completedIds;
      return;
    }

    const justCompleted = state.sessions.find(s => s.isCompleted && !completedSessionIdsRef.current?.has(s.id));
    if (justCompleted) {
      completeNotification(justCompleted);
    }
    completedSessionIdsRef.current = completedIds;
  }, [state.sessions, completeNotification]);

  // Timer tick
  useEffect(() => {
    if (!state.activeSessionId) return;
    const interval = setInterval(() => {
      dispatch({type: 'TICK', now: Date.now()});
    }, 1000);
    return () => clearInterval(interval);
  }, [state.activeSessionId])

  // handler for resetting the total daily progress
  const handleResetDailyProgress = useCallback((resetDate: string, source: "manual" | "auto") => {
    dispatch({
      type: 'RESET_DAILY_PROGRESS',
      resetDate: resetDate,
      fromApi: false,
      yesterdayMins: 0,
      streak: 0,
      autoReset: source === "auto",
    });
    if (user && source === "manual"){
      api.sendUserEvent('reset_progress', { manualReset: true }).catch(err => {
        console.error(err);
      });
    }
  }, [user]);

  

  // Effect for Auto-Reset Logic
  useEffect(() => {
    if (!resetStateReady) {
      return;
    }
    const checkResetTime = setInterval(() => {
      const [todayDate, currentTimeString] = getTodayDateTimeString(state.timezone);
      const hasLastAutoResetDate = /^\d{4}-\d{2}-\d{2}$/.test(state.lastAutoResetDate);

      // If time matches preference
      if (state.resetTime !== null && currentTimeString >= state.resetTime && hasLastAutoResetDate && todayDate > state.lastAutoResetDate){
        handleResetDailyProgress(todayDate, "auto");
        console.log("Daily progress auto-reset triggered.");
      }
    }, 1000);

    return () => clearInterval(checkResetTime);
  }, [resetStateReady, state.resetTime, state.lastAutoResetDate, state.timezone, handleResetDailyProgress]);

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
    void requestSessionNotificationPermission();
    const activeSess = state.sessions.filter((x) => x.id === id);
    const s = activeSess[0];
    const newTargetTimeMs = Date.now() + s.timeLeft*1000;
    dispatch({type: 'START_SESSION', id: id, targetTimeMs: newTargetTimeMs, updatedAt: new Date().toISOString()});
    if(user)
      api.sendSessionEvent(id, 'start', {targetTimeMs: newTargetTimeMs}).catch(e => console.error(e));
  };

  const handlePause = (id: number) => {
    // get timeLeft
    const s = state.sessions.filter(s => s.id === id);
    dispatch({type:'PAUSE_SESSION', id:id, timeLeft: s[0].timeLeft});
    if(user)
      api.sendSessionEvent(id, 'pause', {timeLeft: s[0].timeLeft}).catch(e => console.error(e));
  };

  const handleReset = (id: number) => {
    dispatch({type:'RESET_SESSION', id:id});
    if(user)
      api.sendSessionEvent(id, 'reset_session').catch(e => console.error(e));
  };

  const handleDelete = (id: number) => {
    dispatch({type:'DELETE_SESSION', id:id});
    if(user){
      api.deleteSession(id).catch(e => console.error(e));
    }
  };

  const handleUpdate = (id: number, newDetails: Partial<Session>) => {
    if (id === state.activeSessionId && typeof newDetails.timeLeft === 'number') {
      newDetails.targetTimeMs = Date.now() + newDetails.timeLeft * 1000;
    }
    dispatch({type:'UPDATE_SESSION', id:id, changes:newDetails});
    if (user)
      api.sendSessionEvent(id, 'edit', newDetails).catch(e => console.error(e));
  };

  const handleSaveSettings = (newResetTime: string, newTimezone: string) => {
    dispatch({type:'SET_RESET_TIME', time:newResetTime});
    dispatch({type:'SET_TIMEZONE', timezone:newTimezone});
    localStorage.setItem("resetTime", newResetTime);
    localStorage.setItem("timezone", newTimezone);
    if (user){
      console.log('saving settings to backend');
      api.sendUserEvent('auto_reset_time_change', {sessionsResetTime: newResetTime, timezone: newTimezone}).catch(e => console.error(e));
    }
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
      updatedAt: new Date().toISOString(),
    };
    console.log(`new session created with local id: ${newId}`);

    // create session in backend if user is logged in
    if (user) {
      api.createSession(newSession)
        .then(createdSession => {
          // no need to add if this session is already added through SSE
          // but dispatch add anyway
          newSession.id = createdSession.id;
          dispatch({type:"ADD_SESSION", session: newSession});
        })
        .catch(error => {
          console.error('Failed to create session on server:', error);
        });
    }else{
      dispatch({type:"ADD_SESSION", session: newSession});
    }
  };

  // Reconnect SSE when tab becomes visible again (e.g. mobile browser returning from background)
  useEffect(() => {
    if (!user) return;
    const handleResume = (trigger: string) => {
      if (document.visibilityState === 'hidden') {
        return;
      }

      const now = Date.now();
      if (now - lastResumeCheckRef.current < 1000) {
        return;
      }
      lastResumeCheckRef.current = now;

      syncStateFromApi().catch((error) => {
        console.error(`Failed to sync state after ${trigger}:`, error);
      });

      if (!sseHandleRef.current?.hasActiveConnection()) {
        console.log(`resume detected from ${trigger} without open SSE connection`);
        setSseKey(k => k + 1);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleResume('visibilitychange');
      }
    };

    const handlePageShow = () => {
      handleResume('pageshow');
    };

    const handleWindowFocus = () => {
      handleResume('focus');
    };

    const handleOnline = () => {
      handleResume('online');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [user, syncStateFromApi]);

  // subscribe to events
  useEffect(() => {
    if (user){
      const handle = api.streamEvents(dispatch, syncStateFromApi);
      sseHandleRef.current = handle;

      return () => {
        if (sseHandleRef.current === handle) {
          sseHandleRef.current = null;
        }
        handle.cleanup();
      };
    }
  }, [user, syncStateFromApi, sseKey])

  // Derived State for UI
  const activeSessionTitle = state.sessions.find(s => s.id === state.activeSessionId)?.title || "Ready to Focus";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-emerald-100">
      <Navbar
        activeSessionTitle={activeSessionTitle}
        activeSessionId={state.activeSessionId}
        streak={state.streak}
        resetTime={state.resetTime}
        timezone={state.timezone}
        handleSaveSettings={handleSaveSettings}
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
                           const [todayDate] = getTodayDateTimeString(state.timezone);
                           handleResetDailyProgress(todayDate, "manual");
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
