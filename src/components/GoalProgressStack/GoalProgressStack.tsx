import React, { useMemo } from 'react';
import { Session } from '../../types';

interface GoalProgressStackProps {
  sessions: Session[];
}

const GoalProgressStack: React.FC<GoalProgressStackProps> = ({ sessions }) => {
  const goals = useMemo(() => {
    return sessions
      .filter((session) => !session.noGoal && session.dailyGoalMinutes > 0)
      .map((session) => {
        const goalSeconds = session.dailyGoalMinutes * 60;
        const progressSeconds = Math.max(0, session.focusSeconds || 0);
        const progressPercent = Math.min((progressSeconds / goalSeconds) * 100, 100);

        return { session, progressSeconds, progressPercent };
      })
      .sort((a, b) => b.progressPercent - a.progressPercent);
  }, [sessions]);

  return (
    <section aria-labelledby="goal-progress-heading" className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <h3 id="goal-progress-heading" className="font-bold text-lg text-slate-800">
        Goal Progress
      </h3>

      {goals.length > 0 ? (
        <div className="mt-3 flex flex-col gap-1">
          {goals.map(({ session, progressSeconds, progressPercent }) => (
            <div key={session.id} className="rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-2">
              <div className="flex items-center justify-between gap-4">
                <p
                  className="truncate font-semibold text-slate-800 before:block before:truncate before:content-[attr(data-goal-title)]"
                  data-goal-title={session.title}
                  aria-label={session.title}
                  title={session.title}
                >
                </p>
                <span className="shrink-0 text-sm font-bold text-brand">
                  {Math.round(progressPercent)}%
                </span>
              </div>
              <div
                className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-200"
                role="progressbar"
                aria-label={`${session.title} progress`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progressPercent)}
              >
                <div
                  className="h-full rounded-full bg-brand opacity-60 transition-[width] duration-500 ease-in-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="mt-0.5 text-[10px] text-slate-500">
                {Math.floor(progressSeconds / 60)} min of {session.dailyGoalMinutes} min
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Create a daily goal to see progress here.</p>
      )}
    </section>
  );
};

export default GoalProgressStack;
