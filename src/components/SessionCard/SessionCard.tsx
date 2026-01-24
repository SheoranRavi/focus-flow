import React, { useState } from 'react';
import { Play, Pause, Trash2, RotateCcw, CheckCircle2, Pencil } from 'lucide-react';
import { SessionCardProps } from '@/types';

const SessionCard: React.FC<SessionCardProps> = ({ session, isActive, onStart, onPause, onDelete, onUpdate, onReset }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(session.title);
  const [editDuration, setEditDuration] = useState(session.sessionDuration / 60); // in minutes
  const [editDailyGoal, setEditDailyGoal] = useState(session.dailyGoalMinutes); // in minutes

  // Calculate progress for this specific session ring (Timer Countdown)
  const progressPercent = 1 - (session.timeLeft / session.sessionDuration);
  const totalMinutes = Math.floor(session.timeLeft / 60);
  const seconds = session.timeLeft % 60;

  // Calculate Daily Goal Progress for this session
  const goalProgressPercent = session.dailyGoalMinutes > 0 
    ? Math.min((session.focusSeconds || 0) / (session.dailyGoalMinutes * 60), 1)
    : 0;
  
  // Ring calculations for the outer goal ring
  const outerRadius = 80; // Slightly larger than the inner 80px (w-40)
  const outerStroke = 2;
  const outerNormalizedRadius = outerRadius - outerStroke * 2;
  const outerCircumference = outerNormalizedRadius * 2 * Math.PI;
  const outerStrokeDashoffset = outerCircumference - goalProgressPercent * outerCircumference;

  const handleSave = () => {
    // Ensure duration and goal are positive numbers
    const newDuration = Math.max(1, parseInt(String(editDuration)) || 1);
    const newGoal = Math.max(0, parseInt(String(editDailyGoal)) || 0);

    onUpdate(session.id, { 
      title: editTitle, 
      sessionDuration: newDuration * 60, 
      timeLeft: newDuration * 60,
      dailyGoalMinutes: newGoal,
    });
    setIsEditing(false);
  };

  return (
    <div className={`
      relative flex flex-col items-center justify-between p-6 rounded-3xl bg-white shadow-sm border
      transition-all duration-300 w-full md:w-[320px] flex-shrink-0 snap-center
      ${isActive ? 'border-emerald-400 ring-2 ring-emerald-100 shadow-lg m-1 scale-[1.02]' : 'border-slate-100 hover:border-slate-200'}
    `}>
      
      {/* Header / Edit Mode */}
      <div className="w-full flex justify-between items-start mb-4">
        {isEditing ? (
          <div className="flex flex-col gap-2 w-full z-10">
            <input 
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="font-semibold text-lg border-b border-slate-300 focus:outline-none focus:border-emerald-500"
              autoFocus
            />
            {/* Session Length Input */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-24">Session Length:</span>
              <input 
                type="number"
                min="1"
                max="180"
                value={editDuration}
                onChange={(e) => setEditDuration(parseInt(e.target.value) || 1)}
                className="w-16 p-1 border rounded text-center text-sm"
              />
              <span className="text-xs text-slate-400">min</span>
            </div>
            {/* Daily Goal Input */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-24">Daily Goal:</span>
              <input 
                type="number"
                min="0"
                max="300"
                value={editDailyGoal}
                onChange={(e) => setEditDailyGoal(parseInt(e.target.value) || 0)}
                className="w-16 p-1 border rounded text-center text-sm"
              />
              <span className="text-xs text-slate-400">min</span>
            </div>

            <div className="flex gap-2 mt-2">
              <button onClick={handleSave} className="text-xs bg-emerald-500 text-white px-2 py-1 rounded">Save</button>
              <button onClick={() => setIsEditing(false)} className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded">Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 max-w-[80%]">
               {session.isCompleted ? <CheckCircle2 size={20} className="text-emerald-500" /> : null}
               <h3 className="font-bold text-slate-800 truncate" title={session.title}>{session.title}</h3>
            </div>
            <div className="flex gap-1">
              <button 
                onClick={() => {
                  setEditTitle(session.title);
                  setEditDuration(session.sessionDuration / 60);
                  setEditDailyGoal(session.dailyGoalMinutes);
                  setIsEditing(true);
                }}
                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
              >
                <Pencil size={14} />
              </button>
              <button 
                onClick={() => onDelete(session.id)}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Timer Display with Nested Rings */}
      <div className="flex flex-col items-center justify-center my-4 relative">
         <div className="relative flex items-center justify-center">
            
            {/* Outer Ring: Daily Goal Progress */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ transform: 'scale(1.15)' }}>
               <svg height={200} width={200} className="-rotate-90">
                  <circle
                    stroke="#f1f5f9"
                    strokeWidth={outerStroke}
                    fill="transparent"
                    r={outerNormalizedRadius}
                    cx={80}
                    cy={100}
                  />
                  <circle
                    stroke="#3b82f6" // blue-500
                    strokeWidth={outerStroke}
                    strokeDasharray={outerCircumference + ' ' + outerCircumference}
                    style={{ strokeDashoffset: outerStrokeDashoffset, transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                    strokeLinecap="round"
                    fill="transparent"
                    r={outerNormalizedRadius}
                    cx={80}
                    cy={100}
                  />
               </svg>
            </div>

            {/* Inner Ring: Session Timer (Existing) */}
            <div className="w-40 h-40 rounded-full border-4 border-slate-100 flex items-center justify-center relative overflow-hidden z-10 bg-white">
                {/* Progress Fill Overlay */}
                <div 
                  className="absolute bottom-0 left-0 right-0 bg-emerald-200 transition-all duration-1000 ease-linear opacity-50"
                  style={{ height: `${progressPercent * 100}%` }}
                />
                <div className="z-10 text-center">
                  <div className="text-5xl font-bold text-slate-800 tracking-tighter">
                    {String(totalMinutes).padStart(2, '0')}
                  </div>
                  <div className="text-sm font-medium text-slate-400 uppercase tracking-widest mt-1">
                    {seconds < 10 ? `0${seconds}` : seconds}
                  </div>
                </div>
            </div>
         </div>
         
         {/* Goal Progress Text */}
         <div className="mt-2 text-xs font-medium text-slate-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Daily Goal: {Math.round(goalProgressPercent * 100)}%
         </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mt-4">
        {isActive ? (
           <button 
             onClick={() => onPause(session.id)}
             className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-6 py-3 rounded-xl font-semibold hover:bg-emerald-200 transition-colors"
           >
             <Pause size={20} fill="currentColor" /> Pause
           </button>
        ) : (
          <button 
            onClick={() => onStart(session.id)}
            disabled={session.isCompleted}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all shadow-md hover:shadow-lg
              ${session.isCompleted 
                ? 'bg-slate-300 cursor-not-allowed' 
                : 'bg-slate-800 hover:bg-slate-700'
              }`}
          >
            <Play size={20} fill="currentColor" /> {session.timeLeft === session.sessionDuration ? 'Start' : 'Resume'}
          </button>
        )}
        
        <button 
          onClick={() => onReset(session.id)}
          className="p-3 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"
          title="Reset Timer"
        >
          <RotateCcw size={18} />
        </button>
      </div>

      {session.isCompleted && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] rounded-3xl flex items-center justify-center z-20">
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-emerald-100 text-center transform animate-in zoom-in duration-200">
            <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-3" />
            <h3 className="font-bold text-xl text-slate-800">Session Complete!</h3>
            <p className="text-slate-500 mb-4">Great focus.</p>
            <button 
              onClick={() => onReset(session.id)}
              className="bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-600 w-full"
            >
              Reset Session
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionCard;