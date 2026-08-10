// reducer.ts
import { BackendUser, Session, TimerState } from '../types';
import { sortSessionsForDisplay } from '../lib/utils';

export type AppState = {
  sessions: Session[];
  streak: number;
  yesterdayMinutes: number;
  lastResetDate: string;
  lastAutoResetDate: string;
  resetTime: string;
  timezone: string;
  activeSessionId: number | null;
  lastAppliedRevision?: number;
};

type AppActionWithoutRevision =
  | { type: 'START_SESSION'; id: number; targetTimeMs: number; timeLeft: number; updatedAt: string }
  | { type: 'PAUSE_SESSION'; id: number; timeLeft: number }
  | { type: 'RESET_SESSION'; id: number }
  | { type: 'DELETE_SESSION'; id: number }
  | { type: 'UPDATE_SESSION'; id: number; changes: Partial<Session> }
  | { type: 'ADD_SESSION'; session: Session }
  | { type: 'COMPLETE_SESSION'; id: number; focusSeconds: number }
  | { type: 'TICK'; now: number; goalId?: number | null; skipGoalAttribution?: boolean }
  | { type: 'RESET_DAILY_PROGRESS'; yesterdayMins: number; streak: number; resetDate: string; fromApi: boolean; autoReset: boolean }
  | { type: 'SET_RESET_TIME'; time: string }
  | { type: 'SET_TIMEZONE'; timezone: string }
  | { type: 'LOAD_SESSIONS'; sessions: Session[]; preserveOptimisticIds?: number[] }
  | { type: 'LOAD_USER'; user: Partial<BackendUser> }
  | { type: 'SET_TIMER_DURATION'; duration: number }
  | { type: 'ACK_REVISION'; revision: number }
  | { type: 'SELECTED_SESSION_CHANGE'; id: number | null };

export type AppAction = AppActionWithoutRevision & { revision?: number };

export function appReducer(state: AppState, action: AppAction): AppState {
  const currentRevision = state.lastAppliedRevision ?? 0;
  if (action.revision !== undefined && action.revision > 0 && action.revision <= currentRevision) {
    return state;
  }
  if (
    currentRevision > 0 &&
    (action.type === 'LOAD_SESSIONS' || action.type === 'LOAD_USER') &&
    (action.revision === undefined || action.revision <= 0)
  ) {
    return state;
  }
  const withRevision = <T extends AppState>(nextState: T): T => action.revision === undefined || action.revision <= 0
    ? nextState
    : { ...nextState, lastAppliedRevision: action.revision };

  switch (action.type) {

    case 'LOAD_USER':
      return withRevision({
        ...state,
        yesterdayMinutes: action.user.yesterdayMins ?? 0,
        streak: action.user.streak ?? 0,
        resetTime: action.user.sessionsResetTime ?? state.resetTime,
        lastResetDate: action.user.lastResetDate ?? state.lastResetDate,
        lastAutoResetDate: action.user.lastAutoResetDate ?? state.lastAutoResetDate,
        timezone: action.user.timezone ?? state.timezone,
        // activeSessionId identifies the focused goal on the server. The
        // countdown itself is restored from the running General row.
        activeSessionId: state.activeSessionId,
      });

    case 'LOAD_SESSIONS': {
      const currentGeneral = state.sessions.find(session => session.title === 'General');
      const preserveIds = new Set(action.preserveOptimisticIds ?? []);
      const preserveLocalTimer = currentGeneral?.state === TimerState.RUNNING || preserveIds.has(currentGeneral?.id ?? -1);
      const currentSessionsById = new Map(state.sessions.map(session => [session.id, session]));
      const sessions = action.sessions.map(session => {
        const currentSession = currentSessionsById.get(session.id);
        if (preserveIds.has(session.id) && currentSession) return { ...session, ...currentSession };
        if (session.title !== 'General') {
          // While the shared timer is running, focusSeconds is updated locally
          // on every tick. Do not replace that live value with a stale API
          // snapshot during a focus/resume refresh.
          return preserveLocalTimer && currentSession
            ? { ...session, focusSeconds: currentSession.focusSeconds }
            : session;
        }
        if (!currentGeneral?.sessionDuration) return session;
        return {
          ...session,
          sessionDuration: currentGeneral.sessionDuration,
          state: preserveLocalTimer ? currentGeneral.state : session.state,
          targetTimeMs: preserveLocalTimer ? currentGeneral.targetTimeMs : session.targetTimeMs,
          timeLeft: preserveLocalTimer
            ? currentGeneral.timeLeft
            : session.timeLeft,
        };
      });
      return withRevision({
        ...state,
        sessions: sortSessionsForDisplay(sessions),
        activeSessionId: preserveLocalTimer ? (currentGeneral?.id ?? state.activeSessionId) : state.activeSessionId,
      });
    }

    case 'SET_TIMER_DURATION':
      return withRevision({
        ...state,
        sessions: state.sessions.map(session => session.title === 'General'
          ? {
              ...session,
              sessionDuration: action.duration,
              timeLeft: session.state === TimerState.RUNNING ? session.timeLeft : action.duration,
            }
          : session),
      });

    case 'ADD_SESSION':
      if (state.sessions.some(s => s.id === action.session.id)) {
        return state;
      }
      return withRevision({ ...state, sessions: sortSessionsForDisplay([...state.sessions, action.session]) });

    case 'DELETE_SESSION':
      return withRevision({
        ...state,
        sessions: sortSessionsForDisplay(state.sessions.filter(s => s.id !== action.id)),
        activeSessionId: state.activeSessionId === action.id ? null : state.activeSessionId,
      });

    case 'START_SESSION': {
      const updated = state.sessions.map(s => {
        if (s.id === action.id) return { ...s, state: TimerState.RUNNING, targetTimeMs: action.targetTimeMs, timeLeft: action.timeLeft, updatedAt: action.updatedAt };
        // if any other session was running then set it to paused
        if (s.id === state.activeSessionId) return { ...s, state: TimerState.PAUSED };
        return s;
      });
      return withRevision({ ...state, sessions: sortSessionsForDisplay(updated), activeSessionId: action.id });
    }

    case 'PAUSE_SESSION':
      return withRevision({
        ...state,
        activeSessionId: state.activeSessionId === action.id ? null : state.activeSessionId,
        sessions: state.sessions.map(s =>
          s.id === action.id ? { ...s, state: TimerState.PAUSED, timeLeft: action.timeLeft, targetTimeMs: undefined } : s
        ),
      });

    case 'RESET_SESSION':
      return withRevision({
        ...state,
        activeSessionId: state.activeSessionId === action.id ? null : state.activeSessionId,
        sessions: state.sessions.map(s =>
          s.id === action.id
            ? { ...s, timeLeft: s.sessionDuration, isCompleted: false, state: TimerState.PAUSED }
            : s
        ),
      });

    case 'UPDATE_SESSION':
      return withRevision({
        ...state,
        activeSessionId: state.activeSessionId === action.id ? null : state.activeSessionId,
        sessions: sortSessionsForDisplay(state.sessions.map(s => {
          if (s.id !== action.id) return s;
          const updated = { ...s, ...action.changes, isCompleted: false, state: TimerState.PAUSED };
          return updated;
        })),
      });

    case 'COMPLETE_SESSION':
      return withRevision({
        ...state,
        activeSessionId: null,
        sessions: sortSessionsForDisplay(state.sessions.map(s =>
          s.id === action.id ? { ...s, isCompleted: true, focusSeconds: action.focusSeconds, timeLeft: s.sessionDuration, state: TimerState.PAUSED } : s
        )),
      });

    case 'TICK': {
      if (state.activeSessionId === null) return state;
      let completed = false;
      let elapsedDelta = 0;
      const sessions = state.sessions.map(s => {
        if (s.id !== state.activeSessionId || !s.targetTimeMs || s.state !== TimerState.RUNNING || s.timeLeft === undefined || s.sessionDuration === undefined) return s;
        let secondsLeft = Math.max(0, Math.ceil((s.targetTimeMs - action.now) / 1000));
        const delta = Math.max(0, s.timeLeft - secondsLeft);
        elapsedDelta = delta;
        let timerState = TimerState.RUNNING;
        if (secondsLeft <= 0) { 
          completed = true; 
          timerState = TimerState.PAUSED;
          secondsLeft = 0;
        }
        return { ...s, timeLeft: secondsLeft, focusSeconds: (s.focusSeconds || 0) + delta, isCompleted: completed, state: timerState };
      });
      const attributedSessions = action.skipGoalAttribution || action.goalId == null || elapsedDelta <= 0
        ? sessions
        : sessions.map(s => s.id === action.goalId
          ? { ...s, focusSeconds: (s.focusSeconds || 0) + elapsedDelta }
          : s);
      return withRevision({
        ...state,
        sessions: attributedSessions,
        activeSessionId: completed ? null : state.activeSessionId,
      });
    }

    // ToDo: If this comes from API, the API itself should send the args like totalGoalMinutes
    case 'RESET_DAILY_PROGRESS': {
      const totalGoalMinutes = state.sessions.reduce((sum, s) => sum + s.dailyGoalMinutes, 0);
      const yesterdaySeconds = state.sessions.reduce((sum, s) => sum + s.focusSeconds, 0);
      const yesterdayGoalSeconds = state.sessions.reduce(
        (sum, s) => sum + Math.min(s.focusSeconds, s.dailyGoalMinutes * 60), 0
      );
      
      let newStreak = yesterdayGoalSeconds / 60 >= totalGoalMinutes ? state.streak + 1 : 0;
      let yesterdayMins = yesterdaySeconds/60;
      if (action.fromApi){
        yesterdayMins = action.yesterdayMins;
        newStreak = action.streak;
      }
      localStorage.setItem('lastResetDate', action.resetDate);
      if (action.autoReset) {
        localStorage.setItem('lastAutoResetDate', action.resetDate);
      }
      localStorage.setItem('yesterdayMins', (yesterdayMins).toString());
      localStorage.setItem('streak', newStreak === undefined ? '0' : newStreak.toString());
      console.log(`Setting yesterdayMins: ${yesterdayMins}, streak: ${newStreak}`);
      return withRevision({
        ...state,
        sessions: sortSessionsForDisplay(state.sessions.map(s => ({
          ...s,
          focusSeconds: 0,
          state: TimerState.PAUSED,
          ...(s.title === 'General'
            ? { timeLeft: s.sessionDuration, targetTimeMs: 0 }
            : {}),
        }))),
        yesterdayMinutes: yesterdayMins,
        lastResetDate: action.resetDate,
        lastAutoResetDate: action.autoReset ? action.resetDate : state.lastAutoResetDate,
        streak: newStreak,
      });
    }

    case 'SET_RESET_TIME':
      return withRevision({ ...state, resetTime: action.time });

    case 'SET_TIMEZONE':
      return withRevision({ ...state, timezone: action.timezone });

    case 'ACK_REVISION':
      return action.revision > currentRevision
        ? { ...state, lastAppliedRevision: action.revision }
        : state;

    case 'SELECTED_SESSION_CHANGE':
      return withRevision(state);

    default:
      return state;
  }
}
