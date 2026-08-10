import { describe, expect, it } from 'vitest';
import { appReducer, AppState } from './reducer';
import { TimerState } from '../types';

describe('appReducer LOAD_SESSIONS', () => {
  it('ignores a snapshot older than the applied event revision', () => {
    const state: AppState = {
      sessions: [{ id: 1, title: 'General', sessionDuration: 1500, timeLeft: 1000, state: TimerState.RUNNING, isCompleted: false, dailyGoalMinutes: 0, focusSeconds: 0 }],
      activeSessionId: 1,
      streak: 0, yesterdayMinutes: 0, lastResetDate: '', lastAutoResetDate: '', resetTime: '00:00', timezone: 'UTC',
      lastAppliedRevision: 12,
    };

    const next = appReducer(state, {
      type: 'LOAD_SESSIONS',
      revision: 11,
      sessions: [{ ...state.sessions[0], state: TimerState.PAUSED, timeLeft: 1500 }],
    });

    expect(next).toBe(state);
  });

  it('applies the newest pause revision and rejects an older start revision', () => {
    const state: AppState = {
      sessions: [{ id: 1, title: 'General', sessionDuration: 1500, timeLeft: 1000, state: TimerState.RUNNING, isCompleted: false, dailyGoalMinutes: 0, focusSeconds: 0 }],
      activeSessionId: 1,
      streak: 0, yesterdayMinutes: 0, lastResetDate: '', lastAutoResetDate: '', resetTime: '00:00', timezone: 'UTC',
    };
    const paused = appReducer(state, { type: 'PAUSE_SESSION', id: 1, timeLeft: 900, revision: 20 });
    const staleStart = appReducer(paused, { type: 'START_SESSION', id: 1, targetTimeMs: 3000, timeLeft: 900, updatedAt: 'now', revision: 19 });

    expect(paused.activeSessionId).toBeNull();
    expect(staleStart).toBe(paused);
  });

  it('preserves an optimistic running General timer during a stale refresh', () => {
    const state: AppState = {
      sessions: [{
        id: 1,
        title: 'General',
        sessionDuration: 1500,
        timeLeft: 1499,
        targetTimeMs: 200000,
        state: TimerState.RUNNING,
        isCompleted: false,
        dailyGoalMinutes: 0,
        focusSeconds: 1,
      }],
      activeSessionId: 1,
      streak: 0,
      yesterdayMinutes: 0,
      lastResetDate: '',
      lastAutoResetDate: '',
      resetTime: '00:00',
      timezone: 'UTC',
    };

    const next = appReducer(state, {
      type: 'LOAD_SESSIONS',
      sessions: [{
        id: 1,
        title: 'General',
        sessionDuration: 1500,
        timeLeft: 1500,
        targetTimeMs: 0,
        state: TimerState.PAUSED,
        isCompleted: false,
        dailyGoalMinutes: 0,
        focusSeconds: 0,
      }],
    });

    expect(next.activeSessionId).toBe(1);
    expect(next.sessions[0]).toMatchObject({
      state: TimerState.RUNNING,
      targetTimeMs: 200000,
      timeLeft: 1499,
    });
  });

  it('preserves live goal progress during a running-timer refresh', () => {
    const state: AppState = {
      sessions: [
        {
          id: 1,
          title: 'General',
          sessionDuration: 1500,
          timeLeft: 1490,
          targetTimeMs: 200000,
          state: TimerState.RUNNING,
          isCompleted: false,
          dailyGoalMinutes: 0,
          focusSeconds: 0,
        },
        {
          id: 7,
          title: 'Writing',
          sessionDuration: undefined,
          timeLeft: undefined,
          state: TimerState.PAUSED,
          isCompleted: false,
          dailyGoalMinutes: 30,
          focusSeconds: 120,
        },
      ],
      activeSessionId: 1,
      streak: 0,
      yesterdayMinutes: 0,
      lastResetDate: '',
      lastAutoResetDate: '',
      resetTime: '00:00',
      timezone: 'UTC',
    };

    const next = appReducer(state, {
      type: 'LOAD_SESSIONS',
      sessions: state.sessions.map(session => ({ ...session, focusSeconds: 0 })),
    });

    expect(next.sessions.find(session => session.id === 7)?.focusSeconds).toBe(120);
  });
});
