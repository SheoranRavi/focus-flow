import React, { useState, useEffect, useRef, useMemo, useCallback, useReducer } from 'react';
import { AlertCircle, Loader2, RotateCcw, Target } from 'lucide-react';
import ProgressRing from './components/ProgressRing/ProgressRing';
import SessionCard from './components/SessionCard/SessionCard';
import { Session, TimerState } from './types';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { parseSessionsFromStorage, getTodayDateTimeString, normalizeDateToISO } from './lib/utils';
import { useAuth } from './context/AuthContext';
import { api } from './lib/api';
import CreateSession from './components/CreateSession/CreateSession';
import { appReducer, AppState } from './context/reducer';
import { notifySessionComplete, requestSessionNotificationPermission } from './lib/notifications';
import { sortSessionsForDisplay } from './lib/utils';
import SEO from './components/SEO';
import GoalProgressStack from './components/GoalProgressStack/GoalProgressStack';
import { motion } from 'motion/react';

const DEFAULT_SESSIONS: Session[] = [
  { id: 1, title: 'Deep Work', sessionDuration: 25 * 60, timeLeft: 25 * 60, isCompleted: false, dailyGoalMinutes: 90, focusSeconds: 0, state: TimerState.PAUSED },
  { id: 2, title: 'Reading', sessionDuration: 45 * 60, timeLeft: 45 * 60, isCompleted: false, dailyGoalMinutes: 60, focusSeconds: 0, state: TimerState.PAUSED },
  { id: 3, title: 'Emails', sessionDuration: 15 * 60, timeLeft: 15 * 60, isCompleted: false, dailyGoalMinutes: 30, focusSeconds: 0, state: TimerState.PAUSED },
];
const GENERAL_TIMER_ID = 0;
const GENERAL_TIMER: Session = { id: GENERAL_TIMER_ID, title: 'General', sessionDuration: 25 * 60, timeLeft: 25 * 60, isCompleted: false, dailyGoalMinutes: 0, focusSeconds: 0, state: TimerState.PAUSED, noGoal: true };

function buildLocalStorageState(): AppState {
  const storedSessions = localStorage.getItem('sessions');
  const loadedSessions = storedSessions
    ? sortSessionsForDisplay(parseSessionsFromStorage(storedSessions, DEFAULT_SESSIONS))
    : [GENERAL_TIMER, ...DEFAULT_SESSIONS];
  const sessions = loadedSessions.some(session => session.title === 'General')
    ? loadedSessions
    : [GENERAL_TIMER, ...loadedSessions];

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
}

function buildBlankAuthenticatedState(): AppState {
  return {
    sessions: [],
    activeSessionId: null,
    streak: 0,
    yesterdayMinutes: 0,
    lastResetDate: '',
    lastAutoResetDate: '',
    resetTime: '00:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}


// --- Main App Component ---
const App: React.FC = () => {
  const user = useAuth();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [clockNow, setClockNow] = useState(Date.now());
  const [pendingTimerTargetMs, setPendingTimerTargetMs] = useState<number | null>(null);
  const [sseKey, setSseKey] = useState(0);
  const [resetStateReady, setResetStateReady] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);

  const [state, dispatch] = useReducer(appReducer, undefined, () => (
    user ? buildBlankAuthenticatedState() : buildLocalStorageState()
  ));

  // Audio ref for timer end
  const audioRef = useRef<HTMLAudioElement>(null);
  const initialSessions = useRef<Session[]>(
    user
      ? DEFAULT_SESSIONS.map((session) => ({ ...session }))
      : state.sessions.map((session) => ({ ...session }))
  );
  const completedSessionIdsRef = useRef<Set<number> | null>(null);
  const localTimerActionAtRef = useRef(0);
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
      let fetchedSessions = await api.getSessions();
      // General is the single shared timer. Existing rows are retained as goals.
      if (fetchedSessions && !fetchedSessions.some(session => session.title === 'General')) {
        const createdGeneral = await api.createSession(GENERAL_TIMER);
        fetchedSessions = [createdGeneral, ...fetchedSessions];
      }
      if (fetchedSessions && fetchedSessions.length > 0) {
        console.log(`fetched sessions: ${JSON.stringify(fetchedSessions)}`);
        setCompletedSessionBaseline(fetchedSessions);
        dispatch({type: 'LOAD_SESSIONS', sessions: fetchedSessions});
        const generalTimer = fetchedSessions.find(session => session.title === 'General');
        if (generalTimer?.state === TimerState.RUNNING && generalTimer.targetTimeMs && generalTimer.targetTimeMs > Date.now()) {
          dispatch({
            type: 'START_SESSION',
            id: generalTimer.id,
            targetTimeMs: generalTimer.targetTimeMs,
            updatedAt: generalTimer.updatedAt ?? new Date().toISOString(),
          });
        }
      } else{
        const results = await Promise.allSettled(
          [GENERAL_TIMER, ...initialSessions.current.filter(session => session.title !== 'General')].map(session => api.createSession(session))
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
    } finally {
      sessionSyncPromiseRef.current = null;
    }
  }, [user, setCompletedSessionBaseline]);

  const syncUserFromApi = useCallback(async () => {
    if (!user) return;

    const userObj = await api.getUser();
    if (userObj != null){
      dispatch({type: "LOAD_USER", user: userObj});
      const selectedId = userObj.selectedSessionId ?? userObj.activeSessionId;
      setSelectedGoalId(selectedId ?? null);
      localStorage.setItem('lastResetDate', userObj.lastResetDate);
      localStorage.setItem('lastAutoResetDate', userObj.lastAutoResetDate ?? '');
    }
  }, [user]);

  const syncStateFromApi = useCallback(async () => {
    const [sessionsResult, userResult] = await Promise.allSettled([
      syncSessionsFromApi(),
      syncUserFromApi(),
    ]);

    if (sessionsResult.status === 'fulfilled' && userResult.status === 'fulfilled') {
      setStartupError(null);
      return;
    }

    const localFallbackState = buildLocalStorageState();
    const failedSources: string[] = [];

    if (sessionsResult.status === 'rejected') {
      console.error('Failed to sync sessions from API:', sessionsResult.reason);
      failedSources.push('sessions');
      dispatch({type: 'LOAD_SESSIONS', sessions: localFallbackState.sessions});
    }

    if (userResult.status === 'rejected') {
      console.error('Failed to sync user from API:', userResult.reason);
      failedSources.push('user');
      dispatch({
        type: 'LOAD_USER',
        user: {
          streak: localFallbackState.streak,
          yesterdayMins: localFallbackState.yesterdayMinutes,
          sessionsResetTime: localFallbackState.resetTime,
          lastResetDate: localFallbackState.lastResetDate,
          lastAutoResetDate: localFallbackState.lastAutoResetDate,
          timezone: localFallbackState.timezone,
          activeSessionId: localFallbackState.activeSessionId,
        },
      });
    }

    if (failedSources.length > 0) {
      setStartupError(`Failed to sync ${failedSources.join(' and ')} from the server. Loaded local data where needed.`);
    }
  }, [syncSessionsFromApi, syncUserFromApi]);

  // Fetch sessions and user details from API if user is logged in
  useEffect(() => {
    let cancelled = false;
    if (!user){
      setResetStateReady(true);
      setStartupError(null);
      return;
    }

    setResetStateReady(false);
    setStartupError(null);
    syncStateFromApi()
      .catch((error) => {
        console.error('Unexpected error while syncing initial state from API:', error);
        if (!cancelled) {
          setStartupError(error instanceof Error ? error.message : 'Failed to load your account from the server');
        }
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

  const loadingView = user && !resetStateReady;

  // Derived State: Calculate total daily goal from individual session goals
  const totalDailyGoalMinutes = state.sessions.reduce((sum, session) => sum + session.dailyGoalMinutes, 0);
  const timerSession = state.sessions.find(session => session.title === 'General') ?? GENERAL_TIMER;
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);
  const goals = state.sessions
    .filter(session => session.title !== 'General' && !session.noGoal && session.dailyGoalMinutes > 0)
    .sort((a, b) => (a.id === selectedGoalId ? -1 : b.id === selectedGoalId ? 1 : 0));
  const selectedGoal = goals.find(goal => goal.id === selectedGoalId);

  // The backend persists General by its real session ID. The UI represents
  // that choice as null so it remains distinct from a selected goal.
  useEffect(() => {
    if (selectedGoalId === timerSession.id) {
      setSelectedGoalId(null);
    }
  }, [selectedGoalId, timerSession.id]);

  const handleSelectGoal = (goalId: number | null) => {
    setSelectedGoalId(goalId);
    if (!user) return;
    const selectedSessionId = goalId ?? timerSession.id;
    api.sendUserEvent('selected_session_change', { selectedSessionId }).catch(e => console.error(e));
  };

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
    if (state.activeSessionId === null && pendingTimerTargetMs === null) return;
    const interval = setInterval(() => {
      setClockNow(Date.now());
      dispatch({type: 'TICK', now: Date.now()});
    }, 1000);
    return () => clearInterval(interval);
  }, [state.activeSessionId, pendingTimerTargetMs])

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
    if (user){
      api.sendUserEvent('reset_progress', { manualReset: source === "manual" }).catch(err => {
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
  const displayTimerSession = useMemo(() => {
    const targetTimeMs = pendingTimerTargetMs ?? timerSession.targetTimeMs;
    if (
      (state.activeSessionId !== timerSession.id && pendingTimerTargetMs === null) ||
      !targetTimeMs ||
      targetTimeMs <= clockNow
    ) return timerSession;
    return {
      ...timerSession,
      timeLeft: Math.max(0, Math.ceil((targetTimeMs - clockNow) / 1000)),
    };
  }, [clockNow, pendingTimerTargetMs, timerSession]);

  useEffect(() => {
    if (pendingTimerTargetMs !== null && pendingTimerTargetMs <= clockNow) {
      setPendingTimerTargetMs(null);
    }
  }, [clockNow, pendingTimerTargetMs]);

  const handleStart = () => {
    void requestSessionNotificationPermission();
    localTimerActionAtRef.current = Date.now();
    const currentTimeLeft = displayTimerSession.timeLeft ?? timerSession.timeLeft ?? 1500;
    const newTargetTimeMs = Date.now() + currentTimeLeft * 1000;
    setPendingTimerTargetMs(newTargetTimeMs);
    dispatch({type: 'START_SESSION', id: timerSession.id, targetTimeMs: newTargetTimeMs, updatedAt: new Date().toISOString()});
    if(user)
      api.sendSessionEvent(timerSession.id, 'start', {
        targetTimeMs: newTargetTimeMs,
        timeLeft: currentTimeLeft,
      }).catch(e => console.error(e));
  };

  const handlePause = () => {
    localTimerActionAtRef.current = Date.now();
    setPendingTimerTargetMs(null);
    const currentTimeLeft = displayTimerSession.timeLeft ?? timerSession.timeLeft ?? 1500;
    // get timeLeft
    dispatch({type:'PAUSE_SESSION', id:timerSession.id, timeLeft: currentTimeLeft});
    if(user)
      api.sendSessionEvent(timerSession.id, 'pause', {timeLeft: currentTimeLeft}).catch(e => console.error(e));
  };

  const handleReset = () => {
    localTimerActionAtRef.current = Date.now();
    setPendingTimerTargetMs(null);
    dispatch({type:'RESET_SESSION', id:timerSession.id});
    if(user)
      api.sendSessionEvent(timerSession.id, 'reset_session').catch(e => console.error(e));
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

  const handleGoalDurationChange = (goal: Session, value: string) => {
    const dailyGoalMinutes = Math.max(0, Number.parseInt(value, 10) || 0);
    dispatch({ type: 'UPDATE_SESSION', id: goal.id, changes: { dailyGoalMinutes } });
    if (user) {
      api.sendSessionEvent(goal.id, 'edit', { dailyGoalMinutes }).catch(e => console.error(e));
    }
  };

  const handleDeleteGoal = (goal: Session) => {
    dispatch({ type: 'DELETE_SESSION', id: goal.id });
    if (selectedGoalId === goal.id) setSelectedGoalId(null);
    if (user) api.deleteSession(goal.id).catch(e => console.error(e));
  };

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
      // SSE events can reference the selected goal, but the UI countdown is
      // always the shared General timer.
      const eventDispatch = (action: Parameters<typeof dispatch>[0]) => {
        if (action.type === 'START_SESSION' || action.type === 'PAUSE_SESSION' || action.type === 'RESET_SESSION' || action.type === 'COMPLETE_SESSION') {
          // The current tab applies these actions optimistically. Ignore the
          // same user's delayed SSE echo while the local transition settles.
          if (action.type !== 'COMPLETE_SESSION' && Date.now() - localTimerActionAtRef.current < 2000) {
            return;
          }
          if (action.type !== 'START_SESSION') setPendingTimerTargetMs(null);
          if (action.type === 'START_SESSION' && action.targetTimeMs <= Date.now() && timerSession.targetTimeMs && timerSession.targetTimeMs > Date.now()) {
            dispatch({ ...action, id: timerSession.id, targetTimeMs: timerSession.targetTimeMs } as typeof action);
          } else {
            dispatch({ ...action, id: timerSession.id } as typeof action);
          }
          return;
        }
        dispatch(action);
      };
      const handle = api.streamEvents(eventDispatch);
      sseHandleRef.current = handle;

      return () => {
        if (sseHandleRef.current === handle) {
          sseHandleRef.current = null;
        }
        handle.cleanup();
      };
    }
  }, [user, syncStateFromApi, sseKey, timerSession.id])

  // Derived State for UI
  const activeSessionTitle = selectedGoal?.title || "General";

  if (loadingView) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-brand-soft flex items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-slate-200 bg-white px-8 py-10 shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Loading workspace</p>
            <p className="mt-2 text-sm text-slate-600">Fetching your sessions and settings from the server.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-brand-soft">
      <SEO title="Focus sessions | Task Quota" description="Run task-based focus sessions, track daily progress, and build consistent focus streaks with Task Quota." path="/app" indexable={false} />
      <Navbar
        activeSessionTitle={activeSessionTitle}
        activeSessionId={state.activeSessionId}
        resetTime={state.resetTime}
        timezone={state.timezone}
        handleSaveSettings={handleSaveSettings}
        onCreateSession={() => setIsCreateDialogOpen(true)}
      />
      <main className="max-w-7xl mx-auto p-6 md:p-8">
        {startupError && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Loaded local data after server sync failed</p>
                <p className="text-sm text-amber-800">{startupError}</p>
              </div>
            </div>
          </div>
        )}
        {/* Hidden Audio Element */}
        <audio 
            ref={audioRef} 
            src="/piano_notification.mp3"
            preload="auto"
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: One shared timer */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="flex flex-col items-center rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">Shared focus timer</p>
              <div className="mt-6"><SessionCard session={displayTimerSession} isActive={state.activeSessionId === timerSession.id || pendingTimerTargetMs !== null} onStart={handleStart} onPause={handlePause} onDelete={() => undefined} onUpdate={() => undefined} onReset={handleReset} /></div>
              <p className="mt-4 text-sm text-slate-500">{selectedGoal ? `Tracking time for ${selectedGoal.title}` : 'General focus — select a goal below if you want to track it.'}</p>
            </div>
            <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm" aria-labelledby="goals-heading">
              <div className="flex items-center justify-between"><h2 id="goals-heading" className="text-lg font-bold">Goals</h2><Target className="text-brand" size={20} /></div>
              <div className="mt-4 flex flex-col gap-2">
                <button onClick={() => handleSelectGoal(null)} className={`rounded-xl border px-4 py-3 text-left ${selectedGoalId === null ? 'border-brand bg-brand-soft' : 'border-slate-200'}`}><span className="font-semibold">General</span></button>
                {goals.map(goal => <motion.div layout key={goal.id} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${selectedGoalId === goal.id ? 'border-brand bg-brand-soft' : 'border-slate-200'}`}>
                  <button onClick={() => handleSelectGoal(goal.id)} className="min-w-0 flex-1 text-left"><span className="block truncate font-semibold">{goal.title}</span><span className="block text-xs text-slate-500">{selectedGoalId === goal.id ? 'Selected for the shared timer' : 'Select to attribute focus time'}</span></button>
                  <label className="flex shrink-0 items-center gap-2 text-xs text-slate-500">Daily goal
                    <input aria-label={`${goal.title} daily goal`} type="number" min="0" value={goal.dailyGoalMinutes} onChange={event => handleGoalDurationChange(goal, event.target.value)} className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1 text-right text-sm text-slate-700" />
                    min
                  </label>
                  <button type="button" aria-label={`Delete ${goal.title}`} onClick={() => handleDeleteGoal(goal)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500">×</button>
                </motion.div>)}
                {goals.length === 0 && <p className="text-sm text-slate-500">No active goals. Add one when you want to track focused time against it.</p>}
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN: Daily Progress */}
          <div className="lg:col-span-4 space-y-6">
             {/* Progress Card */}
             <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center">
                <div className="w-full flex justify-between items-center mb-2 h-5">
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
                           <RotateCcw size={16} className="text-slate-400 hover:text-brand" />
                       </button>
                   </div>
                </div>
                
                <ProgressRing 
                   radius={100}
                   stroke={12}
                   progress={Math.floor(totalFocusSeconds / 60)} 
                   total={totalDailyGoalMinutes} 
                />

                <div className="grid grid-cols-3 divide-x divide-slate-100 w-full mt-4 pt-4 border-t border-slate-50">
                    <div className="text-center px-2">
                        <div className="text-xs text-slate-400 uppercase font-medium tracking-wide mb-1">Yesterday</div>
                        <div className="font-bold text-slate-700 text-lg">{Math.floor(state.yesterdayMinutes / 60)} h {Math.floor(state.yesterdayMinutes) % 60} min</div>
                    </div>
                    <div className="text-center px-2">
                        <div className="text-xs text-slate-400 uppercase font-medium tracking-wide mb-1">Total Goal</div>
                        {/* Display the calculated total goal from all sessions */}
                        <div className="font-bold text-brand text-lg">{Math.floor(totalDailyGoalMinutes / 60)}h {totalDailyGoalMinutes % 60} min</div>
                    </div>
                    <div className="text-center px-2">
                        <div className="text-xs text-slate-400 uppercase font-medium tracking-wide mb-1">Streak</div>
                        <div className="font-bold text-slate-700 text-lg">{state.streak}</div>
                    </div>
                </div>
             </div>
             <GoalProgressStack sessions={state.sessions} />
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
