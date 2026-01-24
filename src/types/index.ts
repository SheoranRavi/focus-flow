import React from 'react';

export interface Session {
  id: number;
  title: string;
  sessionDuration: number; // in seconds
  timeLeft: number; // in seconds
  isCompleted: boolean;
  dailyGoalMinutes: number; // adjustable daily goal
  focusSeconds: number; // time spent on this task today in seconds
  targetTimeMs?: number; // the target timestamp at which this timer is supposed to complete
  state: TimerState;
}

// Component Props
export interface ProgressRingProps {
  radius: number;
  stroke: number;
  progress: number; // in minutes
  total: number; // in minutes
}

export interface SessionCardProps {
  session: Session;
  isActive: boolean;
  onStart: (id: number) => void;
  onPause: (id: number) => void;
  onDelete: (id: number) => void;
  onUpdate: (id: number, newDetails: Partial<Session>) => void;
  onReset: (id: number) => void;
}

export enum TimerState {
  PAUSED,
  RUNNING
}
