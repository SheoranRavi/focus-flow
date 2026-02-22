import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/Dialog';
import Button from '../ui/Button';

interface CreateSessionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddSession: (session: {
    title: string;
    dailyGoalMinutes: number;
    sessionDuration: number;
    noGoal: boolean;
  }) => void;
}

const CreateSession: React.FC<CreateSessionProps> = ({ open, onOpenChange, onAddSession }) => {
  const [title, setTitle] = useState('');
  const [goalHours, setGoalHours] = useState(0);
  const [goalMinutes, setGoalMinutes] = useState(30);
  const [durationHours, setDurationHours] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [noGoal, setNoGoal] = useState(false);

  const handleAdd = () => {
    if (!title.trim()) {
      alert('Please enter a session title');
      return;
    }

    const sessionDurationInSeconds = (durationHours * 60 + durationMinutes) * 60;
    
    if (sessionDurationInSeconds === 0) {
      alert('Session duration must be greater than 0');
      return;
    }

    const dailyGoalMinutes = noGoal ? 0 : (goalHours * 60 + goalMinutes);

    onAddSession({
      title: title.trim(),
      dailyGoalMinutes,
      sessionDuration: sessionDurationInSeconds,
      noGoal,
    });

    // Reset form
    setTitle('');
    setGoalHours(0);
    setGoalMinutes(30);
    setDurationHours(0);
    setDurationMinutes(25);
    setNoGoal(false);
    onOpenChange(false);
  };

  const handleCancel = () => {
    // Reset form
    setTitle('');
    setGoalHours(0);
    setGoalMinutes(30);
    setDurationHours(0);
    setDurationMinutes(25);
    setNoGoal(false);
    onOpenChange(false);
  };

  // Generate options for hours (0-23)
  const hourOptions = Array.from({ length: 24 }, (_, i) => i);
  
  // Generate options for minutes (0, 5, 10, ..., 55)
  const minuteOptions = Array.from({ length: 12 }, (_, i) => i * 5);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Session</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {/* Title Input */}
          <div className="grid gap-2">
            <label htmlFor="title" className="text-sm font-medium text-slate-700">
              Session Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Deep Work, Reading, Exercise"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Session Duration */}
          <div className="grid gap-2">
            <label className="text-sm font-medium text-slate-700">
              Session Duration
            </label>
            <div className="flex gap-3">
              <div className="flex-1">
                <label htmlFor="duration-hours" className="text-xs text-slate-500 block mb-1">
                  Hours
                </label>
                <select
                  id="duration-hours"
                  value={durationHours}
                  onChange={(e) => setDurationHours(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  {hourOptions.map((hour) => (
                    <option key={hour} value={hour}>
                      {hour}h
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label htmlFor="duration-minutes" className="text-xs text-slate-500 block mb-1">
                  Minutes
                </label>
                <select
                  id="duration-minutes"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  {minuteOptions.map((minute) => (
                    <option key={minute} value={minute}>
                      {minute}m
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* No Goal Toggle */}
          <div className="flex items-center gap-3 py-2">
            <input
              id="no-goal"
              type="checkbox"
              checked={noGoal}
              onChange={(e) => setNoGoal(e.target.checked)}
              className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-2 focus:ring-emerald-500"
            />
            <label htmlFor="no-goal" className="text-sm font-medium text-slate-700 cursor-pointer">
              No Goal (Just track time)
            </label>
          </div>

          {/* Daily Goal - Only show when NoGoal is false */}
          {!noGoal && (
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">
                Daily Goal
              </label>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label htmlFor="goal-hours" className="text-xs text-slate-500 block mb-1">
                    Hours
                  </label>
                  <select
                    id="goal-hours"
                    value={goalHours}
                    onChange={(e) => setGoalHours(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    {hourOptions.map((hour) => (
                      <option key={hour} value={hour}>
                        {hour}h
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label htmlFor="goal-minutes" className="text-xs text-slate-500 block mb-1">
                    Minutes
                  </label>
                  <select
                    id="goal-minutes"
                    value={goalMinutes}
                    onChange={(e) => setGoalMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    {minuteOptions.map((minute) => (
                      <option key={minute} value={minute}>
                        {minute}m
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            type="button"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            type="button"
          >
            Add Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateSession;
