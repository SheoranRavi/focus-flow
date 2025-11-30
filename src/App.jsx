import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Plus, Trash2, RotateCcw, CheckCircle2, MoreHorizontal, X, Pencil } from 'lucide-react';

// --- Components ---

const ProgressRing = ({ radius, stroke, progress, total }) => {
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / total) * circumference;
  
  const goalHours = Math.floor(total / 60);
  const goalMinutes = total % 60;

  return (
    <div className="relative flex items-center justify-center">
      <svg
        height={radius * 2}
        width={radius * 2}
        className="rotate-[-90deg] transition-all duration-500 ease-in-out"
      >
        <circle
          stroke="#f3f4f6"
          strokeWidth={stroke}
          fill="transparent"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke="#10b981" // emerald-500
          strokeWidth={stroke}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          fill="transparent"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          className="transition-all duration-500 ease-in-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center text-slate-700">
        <span className="text-sm font-medium text-slate-500">Daily Goal</span>
        <span className="text-3xl font-bold">{Math.floor(progress / 60)}h {progress % 60}m</span>
        <span className="text-xs text-slate-400">
          of {goalHours}h {goalMinutes > 0 ? `${goalMinutes}m` : ''} goal
        </span>
      </div>
    </div>
  );
};

const SessionCard = ({ session, isActive, onStart, onPause, onDelete, onUpdate, onReset }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(session.title);
  const [editDuration, setEditDuration] = useState(session.initialDuration / 60); // in minutes

  // Calculate progress for this specific session ring
  const progressPercent = 1 - (session.timeLeft / session.initialDuration);
  const totalMinutes = Math.floor(session.timeLeft / 60);
  const seconds = session.timeLeft % 60;

  const handleSave = () => {
    onUpdate(session.id, { 
      title: editTitle, 
      initialDuration: editDuration * 60, 
      timeLeft: editDuration * 60 
    });
    setIsEditing(false);
  };

  return (
    <div className={`
      relative flex flex-col items-center justify-between p-6 rounded-3xl bg-white shadow-sm border
      transition-all duration-300 w-full md:w-[320px] flex-shrink-0 snap-center
      ${isActive ? 'border-emerald-400 ring-2 ring-emerald-100 shadow-lg scale-[1.02]' : 'border-slate-100 hover:border-slate-200'}
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
            <div className="flex items-center gap-2">
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
                onClick={() => setIsEditing(true)} 
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

      {/* Timer Display */}
      <div className="flex flex-col items-center justify-center my-4 relative">
         {/* Simple background ring for session */}
         <div className="w-40 h-40 rounded-full border-4 border-slate-100 flex items-center justify-center relative overflow-hidden">
            {/* Progress Fill Overlay - simplistic vertical fill or conic gradient could go here, keeping it simple text for now to match style */}
            <div 
              className="absolute bottom-0 left-0 right-0 bg-emerald-50 transition-all duration-1000 ease-linear opacity-50"
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
            <Play size={20} fill="currentColor" /> {session.timeLeft === session.initialDuration ? 'Start' : 'Resume'}
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

// --- Main App Component ---

const App = () => {
  // State
  const [sessions, setSessions] = useState([
    { id: 1, title: 'Deep Work', initialDuration: 25 * 60, timeLeft: 25 * 60, isCompleted: false },
    { id: 2, title: 'Reading', initialDuration: 45 * 60, timeLeft: 45 * 60, isCompleted: false },
    { id: 3, title: 'Emails', initialDuration: 15 * 60, timeLeft: 15 * 60, isCompleted: false },
  ]);
  
  const [activeSessionId, setActiveSessionId] = useState(null);
  
  // Global stats state
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(240); // 4 hours
  const [totalFocusSeconds, setTotalFocusSeconds] = useState(0);
  const [streak, setStreak] = useState(0);

  // Edit Goal State
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [editGoalHours, setEditGoalHours] = useState(4);

  // Audio ref for timer end
  const audioRef = useRef(null);

  // Timer Effect
  useEffect(() => {
    let interval = null;

    if (activeSessionId) {
      interval = setInterval(() => {
        setSessions(prevSessions => {
          return prevSessions.map(session => {
            if (session.id === activeSessionId) {
              if (session.timeLeft <= 0) {
                // Timer finished
                setActiveSessionId(null);
                // Play sound logic here if needed
                return { ...session, timeLeft: 0, isCompleted: true };
              }
              return { ...session, timeLeft: session.timeLeft - 1 };
            }
            return session;
          });
        });

        // Increment total focus time
        setTotalFocusSeconds(prev => prev + 1);
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [activeSessionId]);

  // Handlers
  const handleTotalFocusReset = () => {
    setTotalFocusSeconds(0);
  }
  const handleStart = (id) => {
    setActiveSessionId(id);
  };

  const handlePause = (id) => {
    if (activeSessionId === id) {
      setActiveSessionId(null);
    }
  };

  const handleReset = (id) => {
    setSessions(prev => prev.map(s => 
      s.id === id ? { ...s, timeLeft: s.initialDuration, isCompleted: false } : s
    ));
    if (activeSessionId === id) setActiveSessionId(null);
  };

  const handleDelete = (id) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) setActiveSessionId(null);
  };

  const handleUpdate = (id, newDetails) => {
    setSessions(prev => prev.map(s => 
      s.id === id ? { ...s, ...newDetails, isCompleted: false } : s
    ));
  };

  const handleAddSession = () => {
    const newId = Math.max(...sessions.map(s => s.id), 0) + 1;
    setSessions([...sessions, {
      id: newId,
      title: 'New Session',
      initialDuration: 30 * 60,
      timeLeft: 30 * 60,
      isCompleted: false
    }]);
  };

  const handleSaveGoal = () => {
    // Convert hours to minutes
    setDailyGoalMinutes(editGoalHours * 60);
    setIsEditingGoal(false);
  };

  // Derived State for UI
  const activeSessionTitle = sessions.find(s => s.id === activeSessionId)?.title || "Ready to Focus";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-emerald-100">
      
      {/* Top Navigation / Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-xl flex items-center justify-center text-white shadow-emerald-200 shadow-lg">
             <CheckCircle2 size={24} />
           </div>
           <div>
             <h1 className="font-bold text-xl tracking-tight text-slate-900">Focus Flow</h1>
             <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
               {activeSessionId ? (
                 <span className="flex items-center gap-1 text-emerald-600 animate-pulse">
                   <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Focusing on {activeSessionTitle}
                 </span>
               ) : "No active session"}
             </p>
           </div>
        </div>

        <div className="hidden md:flex items-center gap-6">
            <div className="text-right">
                <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Streak</div>
                <div className="font-bold text-slate-700">{streak} Days</div>
            </div>
            <div className="h-8 w-px bg-slate-200"></div>
            <button className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <MoreHorizontal size={20} className="text-slate-500" />
            </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: Sessions List */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="flex items-center justify-between">
               <h2 className="text-2xl font-bold text-slate-800">Your Sessions</h2>
               <button 
                 onClick={handleAddSession}
                 className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
               >
                 <Plus size={16} /> New Session
               </button>
            </div>

            {/* Horizontal Scroll Area for Sessions (or Grid on large) */}
            <div className="w-full overflow-x-auto pb-8 -mx-6 px-6 md:mx-0 md:px-0 scrollbar-hide">
              <div className="flex flex-col md:flex-row gap-6 md:flex-wrap">
                {sessions.map(session => (
                  <SessionCard 
                    key={session.id}
                    session={session}
                    isActive={activeSessionId === session.id}
                    onStart={handleStart}
                    onPause={handlePause}
                    onDelete={handleDelete}
                    onUpdate={handleUpdate}
                    onReset={handleReset}
                  />
                ))}
                
                {/* Empty State / Add Button Card Placeholder */}
                {sessions.length === 0 && (
                  <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 rounded-3xl w-full text-slate-400">
                     <p className="mb-4 font-medium">No active tasks</p>
                     <button onClick={handleAddSession} className="text-emerald-600 hover:underline">Create one to get started</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Daily Progress */}
          <div className="lg:col-span-4 space-y-6">
             {/* Progress Card */}
             <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center">
                <div className="w-full flex justify-between items-center mb-6 h-8">
                    {isEditingGoal ? (
                        <div className="flex items-center gap-2 w-full animate-in fade-in slide-in-from-top-1">
                            <span className="text-sm font-medium text-slate-500 whitespace-nowrap">Goal (h):</span>
                            <input 
                                type="number"
                                min="0.5"
                                step="0.5"
                                max="24"
                                value={editGoalHours}
                                onChange={(e) => setEditGoalHours(Number(e.target.value))}
                                className="w-16 border-b border-emerald-500 focus:outline-none text-center font-bold text-slate-700"
                                autoFocus
                            />
                            <div className="flex gap-1 ml-auto">
                                <button onClick={handleSaveGoal} className="text-xs bg-emerald-500 text-white px-2 py-1 rounded hover:bg-emerald-600">Save</button>
                                <button onClick={() => setIsEditingGoal(false)} className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded hover:bg-slate-300">Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <h3 className="font-bold text-lg text-slate-800">Daily Progress</h3>
                            <div className="flex gap-1">
                              <button 
                                  onClick={() => {
                                      setEditGoalHours(dailyGoalMinutes / 60);
                                      setIsEditingGoal(true);
                                  }}
                                  className="p-1 rounded-full hover:bg-slate-100 transition-colors"
                              >
                                  <Pencil size={16} className="text-slate-400 hover:text-emerald-600" />
                              </button>
                              <button 
                                  onClick={() => {
                                      handleTotalFocusReset();
                                  }}
                                  className="p-1 rounded-full hover:bg-slate-100 transition-colors"
                              >
                                  <RotateCcw size={16} className="text-slate-400 hover:text-emerald-600" />
                              </button>
                            </div>
                        </>
                    )}
                </div>
                
                <ProgressRing 
                   radius={100} 
                   stroke={12} 
                   progress={Math.floor(totalFocusSeconds / 60)} 
                   total={dailyGoalMinutes} 
                />

                <div className="grid grid-cols-3 divide-x divide-slate-100 w-full mt-8 pt-8 border-t border-slate-50">
                    <div className="text-center px-2">
                        <div className="text-xs text-slate-400 uppercase font-medium tracking-wide mb-1">Yesterday</div>
                        <div className="font-bold text-slate-700 text-lg">3.5h</div>
                    </div>
                    <div className="text-center px-2">
                        <div className="text-xs text-slate-400 uppercase font-medium tracking-wide mb-1">Goal</div>
                        <div className="font-bold text-emerald-600 text-lg">{Math.floor(dailyGoalMinutes / 60)}h</div>
                    </div>
                    <div className="text-center px-2">
                        <div className="text-xs text-slate-400 uppercase font-medium tracking-wide mb-1">Streak</div>
                        <div className="font-bold text-slate-700 text-lg">{streak}</div>
                    </div>
                </div>
             </div>

             {/* Spotify / Music Placeholder */}
             <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer group">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center text-white shrink-0">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                   </div>
                   <div>
                      <h4 className="font-bold text-slate-800 group-hover:text-emerald-600 transition-colors">Focus Music</h4>
                      <p className="text-xs text-slate-500">Connect to Spotify</p>
                   </div>
                </div>
                <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400">
                   <Plus size={14} />
                </div>
             </div>
          </div>

        </div>

      </main>
    </div>
  );
};

export default App;