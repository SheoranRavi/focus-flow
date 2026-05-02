import { AppAction } from '@/context/reducer';
import React from "react";
import { Session, BackendUser } from '../types';
import { getTodayDateTimeString } from './utils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

async function getAuthToken(): Promise<string | null> {
  const { auth } = await import('../firebase');
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

async function fetchWithAuth(url: string, options: FetchOptions = {}): Promise<Response> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response;
}

export interface BackendSession {
  id: number;
  userId: string;
  title: string;
  dailyGoalMinutes: number;
  state: number;
  focusSeconds: number;
  groupId: number | null;
  sessionDuration: number;
  timeLeft: number;
  isCompleted: boolean;
  targetTimeMs: number;
  noGoal: boolean;
  createdAt: string;
  isDeleted: boolean;
}

// Convert backend session format to frontend format
function mapBackendToFrontend(backendSession: BackendSession): Session {
  return {
    id: backendSession.id,
    title: backendSession.title,
    sessionDuration: backendSession.sessionDuration,
    timeLeft: backendSession.timeLeft,
    isCompleted: backendSession.isCompleted,
    dailyGoalMinutes: backendSession.dailyGoalMinutes,
    focusSeconds: backendSession.focusSeconds,
    targetTimeMs: backendSession.targetTimeMs,
    state: backendSession.state,
    noGoal: backendSession.noGoal,
  };
}

// Convert frontend session format to backend format
function mapFrontendToBackend(session: Partial<Session>): Partial<BackendSession> {
  const backend: Partial<BackendSession> = {};
  
  if (session.id !== undefined) backend.id = session.id;
  if (session.title !== undefined) backend.title = session.title;
  if (session.sessionDuration !== undefined) backend.sessionDuration = session.sessionDuration;
  if (session.timeLeft !== undefined) backend.timeLeft = session.timeLeft;
  if (session.isCompleted !== undefined) backend.isCompleted = session.isCompleted;
  if (session.dailyGoalMinutes !== undefined) backend.dailyGoalMinutes = session.dailyGoalMinutes;
  if (session.focusSeconds !== undefined) backend.focusSeconds = session.focusSeconds;
  if (session.targetTimeMs !== undefined) backend.targetTimeMs = session.targetTimeMs;
  if (session.state !== undefined) backend.state = session.state;
  if (session.noGoal !== undefined) backend.noGoal = session.noGoal;
  
  return backend;
}

export const api = {
  // Get all sessions for the authenticated user
  async getSessions(): Promise<Session[] | null> {
    const response = await fetchWithAuth('/sessions/');
    const data: BackendSession[] = await response.json();
    console.log(`fetched sessions response: ${JSON.stringify(data)}`);
    if (!data){
      return data;
    }
    return data.map(mapBackendToFrontend);
  },

  // Create a new session
  async createSession(session: Omit<Session, 'id'>): Promise<Session> {
    const response = await fetchWithAuth('/sessions/', {
      method: 'POST',
      body: JSON.stringify(mapFrontendToBackend(session)),
    });
    const data: BackendSession = await response.json();
    console.log(`Backend response for session: ${JSON.stringify(data)}`);
    return mapBackendToFrontend(data);
  },

  // Delete a session
  async deleteSession(sessionId: number): Promise<void> {
    await fetchWithAuth(`/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  },

  streamEvents(
    dispatch: React.Dispatch<AppAction>,
    onOpen?: () => void | Promise<void>
  ): () => void {
    let eventSrc: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = 1000; // Start with 1 second
    const maxReconnectDelay = 30000; // Max 30 seconds
    let isClosed = false;

    const connect = async () => {
      if (isClosed) return;

      try {
        const idToken = await getAuthToken();
        eventSrc = new EventSource(`${API_URL}/events?token=${idToken}`);

        // Reset delay on successful connection
        eventSrc.onopen = () => {
          console.log('SSE connection established');
          reconnectDelay = 1000;
          if (onOpen) {
            Promise.resolve(onOpen()).catch((error) => {
              console.error('Failed to sync after SSE connection:', error);
            });
          }
        };

        // Handle "new_session" event
        eventSrc.addEventListener("new_session", (e) => {
          try {
            const session: BackendSession = JSON.parse(e.data);
            console.log(`adding new session: ${JSON.stringify(session)}`);
            dispatch({type: 'ADD_SESSION', session: mapBackendToFrontend(session)});
          } catch (error) {
            console.error('Error handling new_session event:', error);
          }
        });

        // Handle "delete_session" event
        eventSrc.addEventListener("delete_session", (e) => {
          try {
            const sessionId = parseInt(e.data, 10);
            dispatch({type: 'DELETE_SESSION', id: sessionId});
          } catch (error) {
            console.error('Error handling delete_session event:', error);
          }
        });

        // Handle "pause" event
        eventSrc.addEventListener("pause", (e) => {
          try {
            const data = JSON.parse(e.data);
            const sessionId = data.id;
            const timeLeft = data.timeLeft;
            dispatch({type: 'PAUSE_SESSION', id: sessionId, timeLeft: timeLeft});
          } catch (error) {
            console.error('Error handling pause event:', error);
          }
        });

        // Handle "reset_session" event
        eventSrc.addEventListener("reset_session", (e) => {
          try {
            const sessionId = parseInt(e.data, 10);
            dispatch({type: 'RESET_SESSION', id: sessionId});
          } catch (error) {
            console.error('Error handling reset_session event:', error);
          }
        });

        // Handle "start" event
        eventSrc.addEventListener("start", (e) => {
          try {
            const session: BackendSession = JSON.parse(e.data);
            const frontEndSession = mapBackendToFrontend(session);
            // ToDo: Figure out a better way
            const targetTime = frontEndSession.targetTimeMs !== undefined ? frontEndSession.targetTimeMs : Date.now();
            dispatch({type: 'START_SESSION', id: frontEndSession.id, targetTimeMs: targetTime});
          } catch (error) {
            console.error('Error handling start event:', error);
          }
        });

        // Handle "edit" event
        eventSrc.addEventListener("edit", (e) => {
          try {
            const session: BackendSession = JSON.parse(e.data);
            dispatch({type: 'UPDATE_SESSION', id: session.id, changes: mapBackendToFrontend(session)});
          } catch (error) {
            console.error('Error handling edit event:', error);
          }
        });

        // Handle "session_complete" event
        eventSrc.addEventListener("session_complete", (e) => {
          try {
            const data = JSON.parse(e.data);
            const sessionId = data.sessionId;
            const focusSeconds = data.focusSeconds;
            dispatch({type: 'COMPLETE_SESSION', id: sessionId, focusSeconds: focusSeconds});
          } catch (error) {
            console.error('Error handling session_complete event:', error);
          }
        });

        // Handle "auto_reset_time_change" event
        eventSrc.addEventListener("auto_reset_time_change", (e) => {
          try {
            const data = JSON.parse(e.data);
            // Backend sends timestamp, convert to time string (HH:MM format)
            const resetTime = data.resetTime;
            const timezone = data.timezone;
            dispatch({type: 'SET_RESET_TIME', time: resetTime});
            dispatch({type: 'SET_TIMEZONE', timezone: timezone});
            console.log(`Set the resetTime: ${resetTime}, timezone: ${timezone}`);
          } catch (error) {
            console.error('Error handling auto_reset_time_change event:', error);
          }
        });

        // Handle "reset_progress" event
        eventSrc.addEventListener("reset_progress", (e) => {
          try {
            const data = JSON.parse(e.data);
            const yesterdayMins = data.yesterdayMins;
            const streak = data.streak;
            const [todayDate, _] = getTodayDateTimeString();
            console.log(`From API yesterdayMins: ${yesterdayMins}, streak: ${streak}`);
            dispatch({type: 'RESET_DAILY_PROGRESS', yesterdayMins: yesterdayMins, streak: streak, fromApi: true, resetDate: todayDate});
          } catch (error) {
            console.error('Error handling reset_progress event:', error);
          }
        });

        // Handle connection errors with reconnection
        eventSrc.onerror = () => {
          console.error('SSE connection error, will reconnect in', reconnectDelay, 'ms');
          eventSrc?.close();

          if (!isClosed) {
            reconnectTimeout = setTimeout(() => {
              reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay);
              connect();
            }, reconnectDelay);
          }
        };
      } catch (error) {
        console.error('Failed to establish SSE connection:', error);
        if (!isClosed) {
          reconnectTimeout = setTimeout(() => {
            reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay);
            connect();
          }, reconnectDelay);
        }
      }
    };

    connect();

    // Return cleanup function
    return () => {
      isClosed = true;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (eventSrc) {
        eventSrc.close();
      }
    };
  },

  // Send session events (start, pause, reset, etc.)
  async sendSessionEvent(
    id: number,
    eventType: string,
    payload: Partial<Session> = {}
  ): Promise<void> {
    await fetchWithAuth(`/sessions/event?type=${eventType}&id=${id}`, {
      method: 'POST',
      body: JSON.stringify({
        ...mapFrontendToBackend(payload),
      }),
    });
  },

  // Send user events (progress reset, autoreset time change)
  async sendUserEvent(
    eventType: string,
    payload: Partial<BackendUser> = {}
  ): Promise<void> {
    await fetchWithAuth(`/users/event?type=${eventType}`, {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
      }),
    });
  },

  async getUser(): Promise<BackendUser | null> {
    const response = await fetchWithAuth(`/users/me`);
    const user: BackendUser = await response.json();
    console.log(`fetched user: ${JSON.stringify(user)}`);
    return user
  },
};
