import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Session, TimerState } from "../types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Safe number parser with fallback
function toNumber(val: unknown, fallback: number): number {
  if (typeof val === "number" && !Number.isNaN(val)) return val
  if (typeof val === "string") {
    const n = Number.parseFloat(val)
    return Number.isNaN(n) ? fallback : n
  }
  return fallback
}

// Normalize state from various historical representations
function normalizeState(state: unknown, isRunningHint?: unknown): TimerState {
  // Numeric
  if (state === 0 || state === "0") return TimerState.PAUSED
  if (state === 1 || state === "1") return TimerState.RUNNING

  // String
  if (typeof state === "string") {
    const s = state.toUpperCase()
    if (s.includes("RUN")) return TimerState.RUNNING
    if (s.includes("PAUSE")) return TimerState.PAUSED
  }

  // Boolean/derived
  if (typeof isRunningHint === "boolean") return isRunningHint ? TimerState.RUNNING : TimerState.PAUSED

  return TimerState.PAUSED
}

// Attempt to migrate a single legacy session object to the current Session shape
export function migrateLegacySession(obj: any, defaults?: Partial<Session>): Session | null {
  if (!obj || typeof obj !== "object") return null

  const id = toNumber(obj.id ?? obj.sessionId, Date.now())
  const title = (obj.title ?? obj.name ?? defaults?.title ?? "Session") as string

  const sessionDuration = toNumber(
    obj.sessionDuration ?? obj.initialDuration ?? obj.durationSeconds ?? obj.duration ?? obj.sessionLength,
    defaults?.sessionDuration ?? 30 * 60
  )

  const timeLeft = toNumber(
    obj.timeLeft ?? obj.remainingSeconds ?? obj.remaining ?? obj.timeRemaining,
    defaults?.timeLeft ?? sessionDuration
  )

  const isCompleted = Boolean(obj.isCompleted ?? obj.completed ?? obj.isDone ?? false)

  const dailyGoalMinutes = toNumber(
    obj.dailyGoalMinutes ?? obj.goalMinutes ?? obj.dailyGoal ?? obj.targetMinutes,
    defaults?.dailyGoalMinutes ?? 30
  )

  const focusSeconds = toNumber(
    obj.focusSeconds ?? obj.progressSeconds ?? obj.accumulatedFocusSeconds ?? obj.focusTime,
    defaults?.focusSeconds ?? 0
  )

  const targetTimeMs = toNumber(
    obj.targetTimeMs ?? obj.targetTimestamp ?? obj.endTimeMs,
    defaults?.targetTimeMs ?? NaN
  )

  const state = normalizeState(obj.state ?? obj.status, obj.isRunning)

  const session: Session = {
    id,
    title,
    sessionDuration,
    timeLeft,
    isCompleted,
    dailyGoalMinutes,
    focusSeconds,
    state,
    ...(Number.isFinite(targetTimeMs) ? { targetTimeMs } : {})
  }

  return session
}

// Parse sessions from localStorage JSON with migration support
export function parseSessionsFromStorage(stored: string | null, fallback: Session[] = []): Session[] {
  if (!stored) return fallback
  try {
    const parsed = JSON.parse(stored)
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) {
        // Honor explicit empty array
        return []
      }
      const migrated = parsed
        .map((item) => migrateLegacySession(item))
        .filter((s): s is Session => Boolean(s))
      return migrated.length > 0 ? migrated : fallback
    }
  } catch (e) {
    console.error("Error parsing sessions from localStorage:", e)
  }
  return fallback
}
