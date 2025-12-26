import React from 'react';

// Session interface based on README documentation
export interface Session {
  id: number;
  title: string;
  initialDuration: number; // in seconds
  timeLeft: number; // in seconds
  isCompleted: boolean;
  dailyGoalMinutes: number; // adjustable daily goal
  timeSpentToday: number; // time spent on this task today in seconds
  targetTime?: number; // the target timestamp at which this timer is supposed to complete
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

// Button component props
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}
