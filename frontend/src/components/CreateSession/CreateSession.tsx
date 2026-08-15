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

  const handleAdd = () => {
    if (!title.trim()) {
      alert('Please enter a session title');
      return;
    }

    const dailyGoalMinutes = goalHours * 60 + goalMinutes;

    onAddSession({
      title: title.trim(),
      dailyGoalMinutes,
      sessionDuration: 25 * 60,
      noGoal: false,
    });

    // Reset form
    setTitle('');
    setGoalHours(0);
    setGoalMinutes(30);
    onOpenChange(false);
  };

  const handleCancel = () => {
    // Reset form
    setTitle('');
    setGoalHours(0);
    setGoalMinutes(30);
    onOpenChange(false);
  };

  // Goal length options (0-23)
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
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            />
          </div>

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
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
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
