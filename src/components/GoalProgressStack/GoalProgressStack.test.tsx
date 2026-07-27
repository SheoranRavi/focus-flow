import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import GoalProgressStack from './GoalProgressStack';
import { TimerState } from '../../types';

const session = (id: number, title: string, focusSeconds: number, dailyGoalMinutes: number) => ({
  id,
  title,
  sessionDuration: 1800,
  timeLeft: 1800,
  isCompleted: false,
  dailyGoalMinutes,
  focusSeconds,
  state: TimerState.PAUSED,
});

describe('GoalProgressStack', () => {
  it('orders goals by highest current percentage', () => {
    render(
      <GoalProgressStack
        sessions={[
          session(1, 'Study', 15 * 60, 60),
          session(2, 'Planning', 20 * 60, 60),
          session(3, 'Writing', 30 * 60, 60),
        ]}
      />,
    );

    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars.map((bar) => bar.getAttribute('aria-label'))).toEqual([
      'Writing progress',
      'Planning progress',
      'Study progress',
    ]);
  });

  it('uses the same brand color for every goal bar and ignores no-goal sessions', () => {
    render(
      <GoalProgressStack
        sessions={[
          session(1, 'Deep Work', 30 * 60, 60),
          { ...session(2, 'Break', 30 * 60, 60), noGoal: true },
        ]}
      />,
    );

    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    expect(document.querySelectorAll('.bg-brand')).toHaveLength(1);
  });
});
