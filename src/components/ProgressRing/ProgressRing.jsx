import React from 'react';

const ProgressRing = ({ radius, stroke, progress, total }) => {
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  // Handle case where total is 0 to prevent division by zero, set offset to 0 (full progress)
  const strokeDashoffset = total > 0 ? circumference - (progress / total) * circumference : 0;
  
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
        {/* <span className="text-sm font-medium text-slate-500">Daily Goal</span> */}
        <span className="text-3xl font-bold">{Math.floor(progress / 60)}h {progress % 60}m</span>
        <span className="text-xs text-slate-400">
          of {goalHours}h {goalMinutes > 0 ? `${goalMinutes}m` : ''} goal
        </span>
      </div>
    </div>
  );
};
export default ProgressRing;