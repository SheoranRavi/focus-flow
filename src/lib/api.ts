import { Session } from '../types';

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
  user_id: string;
  title: string;
  daily_goal_minutes: number;
  state: number;
  focus_seconds: number;
  group_id: number | null;
  session_duration: number;
  time_left: number;
  is_completed: boolean;
  target_time_ms: number;
  no_goal: boolean;
  created_at: string;
  is_deleted: boolean;
}

// Convert backend session format to frontend format
function mapBackendToFrontend(backendSession: BackendSession): Session {
  return {
    id: backendSession.id,
    title: backendSession.title,
    sessionDuration: backendSession.session_duration,
    timeLeft: backendSession.time_left,
    isCompleted: backendSession.is_completed,
    dailyGoalMinutes: backendSession.daily_goal_minutes,
    focusSeconds: backendSession.focus_seconds,
    targetTimeMs: backendSession.target_time_ms,
    state: backendSession.state,
  };
}

// Convert frontend session format to backend format
function mapFrontendToBackend(session: Partial<Session>): Partial<BackendSession> {
  const backend: Partial<BackendSession> = {};
  
  if (session.title !== undefined) backend.title = session.title;
  if (session.sessionDuration !== undefined) backend.session_duration = session.sessionDuration;
  if (session.timeLeft !== undefined) backend.time_left = session.timeLeft;
  if (session.isCompleted !== undefined) backend.is_completed = session.isCompleted;
  if (session.dailyGoalMinutes !== undefined) backend.daily_goal_minutes = session.dailyGoalMinutes;
  if (session.focusSeconds !== undefined) backend.focus_seconds = session.focusSeconds;
  if (session.targetTimeMs !== undefined) backend.target_time_ms = session.targetTimeMs;
  if (session.state !== undefined) backend.state = session.state;
  
  return backend;
}

export const api = {
  // Get all sessions for the authenticated user
  async getSessions(): Promise<Session[] | null> {
    const response = await fetchWithAuth('/sessions/');
    const data: BackendSession[] = await response.json();
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
    return mapBackendToFrontend(data);
  },

  // Delete a session
  async deleteSession(sessionId: number): Promise<void> {
    await fetchWithAuth(`/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  },

  // Send session events (start, pause, reset, etc.)
  async sendSessionEvent(
    sessionId: number,
    eventType: string,
    payload: Partial<Session>
  ): Promise<void> {
    await fetchWithAuth(`/sessions/event?type=${eventType}`, {
      method: 'POST',
      body: JSON.stringify({
        session_id: sessionId,
        ...mapFrontendToBackend(payload),
      }),
    });
  },
};
