// reducer.ts
import { Session, TimerState } from '../types';

export type AppState = {
  sessions: Session[];
  streak: number;
  yesterdayMinutes: number;
  lastResetDate: string;
  resetTime: string;
  activeSessionId: number | null;
};

export type AppAction =
  | { type: 'START_SESSION'; id: number; targetTimeMs: number }
  | { type: 'PAUSE_SESSION'; id: number }
  | { type: 'RESET_SESSION'; id: number }
  | { type: 'DELETE_SESSION'; id: number }
  | { type: 'UPDATE_SESSION'; id: number; changes: Partial<Session> }
  | { type: 'ADD_SESSION'; session: Session }
  | { type: 'COMPLETE_SESSION'; id: number }
  | { type: 'TICK'; now: number }
  | { type: 'RESET_DAILY_PROGRESS'; resetDate: string }
  | { type: 'SET_RESET_TIME'; time: string }
  | { type: 'LOAD_SESSIONS'; sessions: Session[] };

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {

    case 'LOAD_SESSIONS':
      return { ...state, sessions: action.sessions };

    case 'ADD_SESSION':
      if (state.sessions.some(s => s.id === action.session.id)) {
        return state;
      }
      return { ...state, sessions: [...state.sessions, action.session] };

    case 'DELETE_SESSION':
      return {
        ...state,
        sessions: state.sessions.filter(s => s.id !== action.id),
        activeSessionId: state.activeSessionId === action.id ? null : state.activeSessionId,
      };

    case 'START_SESSION': {
      // Move started session to top
      const idx = state.sessions.findIndex(s => s.id === action.id);
      const updated = state.sessions.map(s => {
        if (s.id === action.id) return { ...s, state: TimerState.RUNNING, targetTimeMs: action.targetTimeMs };
        // if any other session was running then set it to paused
        if (s.id === state.activeSessionId) return { ...s, state: TimerState.PAUSED };
        return s;
      });
      if (idx !== -1) {
        const [session] = updated.splice(idx, 1);
        updated.unshift(session);
      }
      return { ...state, sessions: updated, activeSessionId: action.id };
    }

    case 'PAUSE_SESSION':
      return {
        ...state,
        activeSessionId: state.activeSessionId === action.id ? null : state.activeSessionId,
        sessions: state.sessions.map(s =>
          s.id === action.id ? { ...s, state: TimerState.PAUSED } : s
        ),
      };

    case 'RESET_SESSION':
      return {
        ...state,
        activeSessionId: state.activeSessionId === action.id ? null : state.activeSessionId,
        sessions: state.sessions.map(s =>
          s.id === action.id
            ? { ...s, timeLeft: s.sessionDuration, isCompleted: false, state: TimerState.PAUSED }
            : s
        ),
      };

    case 'UPDATE_SESSION':
      return {
        ...state,
        sessions: state.sessions.map(s => {
          if (s.id !== action.id) return s;
          const updated = { ...s, ...action.changes, isCompleted: false };
          if (s.id === state.activeSessionId) {
            updated.targetTimeMs = Date.now() + updated.timeLeft * 1000;
          }
          return updated;
        }),
      };

    case 'COMPLETE_SESSION':
      return {
        ...state,
        activeSessionId: null,
        sessions: state.sessions.map(s =>
          s.id === action.id ? { ...s, isCompleted: true } : s
        ),
      };

    case 'TICK': {
      if (!state.activeSessionId) return state;
      let completed = false;
      const sessions = state.sessions.map(s => {
        if (s.id !== state.activeSessionId || !s.targetTimeMs) return s;
        const secondsLeft = Math.max(0, Math.ceil((s.targetTimeMs - action.now) / 1000));
        const delta = Math.max(0, s.timeLeft - secondsLeft);
        if (secondsLeft <= 0) { completed = true; }
        return { ...s, timeLeft: secondsLeft, focusSeconds: (s.focusSeconds || 0) + delta, isCompleted: secondsLeft <= 0 };
      });
      return {
        ...state,
        sessions,
        activeSessionId: completed ? null : state.activeSessionId,
      };
    }

    // ToDo: If this comes from API, the API itself should send the args like totalGoalMinutes
    case 'RESET_DAILY_PROGRESS': {
      const totalGoalMinutes = state.sessions.reduce((sum, s) => sum + s.dailyGoalMinutes, 0);
      const yesterdaySeconds = state.sessions.reduce((sum, s) => sum + s.focusSeconds, 0);
      const yesterdayGoalSeconds = state.sessions.reduce(
        (sum, s) => sum + Math.min(s.focusSeconds, s.dailyGoalMinutes * 60), 0
      );
      const newStreak = yesterdayGoalSeconds / 60 >= totalGoalMinutes ? state.streak + 1 : 0;
      localStorage.setItem('lastResetDate', action.resetDate);
      localStorage.setItem('yesterdayMins', (yesterdaySeconds/60).toString());
      localStorage.setItem('streak', newStreak.toString());
      return {
        ...state,
        sessions: state.sessions.map(s => ({ ...s, focusSeconds: 0 })),
        yesterdayMinutes: yesterdaySeconds / 60,
        lastResetDate: action.resetDate,
        streak: newStreak,
      };
    }

    case 'SET_RESET_TIME':
      return { ...state, resetTime: action.time };

    default:
      return state;
  }
}