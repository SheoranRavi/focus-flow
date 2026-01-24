import { describe, it, expect } from 'vitest'
import { parseSessionsFromStorage } from '../lib/utils'
import { TimerState } from '../types'

describe('session migration from localStorage', () => {
  it('migrates common legacy keys to current schema', () => {
    const legacy = [
      {
        sessionId: 100,
        name: 'Legacy Task',
        duration: 1800,
        remaining: 900,
        completed: false,
        goalMinutes: 45,
        progressSeconds: 120,
        status: 'RUNNING',
        targetTimestamp: Date.now() + 900_000,
      },
      {
        id: 101,
        title: 'Legacy 2',
        durationSeconds: 1500,
        timeRemaining: 1500,
        isDone: true,
        dailyGoal: 20,
        focusTime: 300,
        // numeric state variant
        state: 0,
      },
    ]

    const migrated = parseSessionsFromStorage(JSON.stringify(legacy), [])
    expect(migrated.length).toBe(2)

    const s0 = migrated[0]
    expect(s0.id).toBe(100)
    expect(s0.title).toBe('Legacy Task')
    expect(s0.sessionDuration).toBe(1800)
    expect(s0.timeLeft).toBe(900)
    expect(s0.isCompleted).toBe(false)
    expect(s0.dailyGoalMinutes).toBe(45)
    expect(s0.focusSeconds).toBe(120)
    expect(s0.state).toBe(TimerState.RUNNING)
    expect(typeof s0.targetTimeMs === 'number').toBe(true)

    const s1 = migrated[1]
    expect(s1.id).toBe(101)
    expect(s1.title).toBe('Legacy 2')
    expect(s1.sessionDuration).toBe(1500)
    expect(s1.timeLeft).toBe(1500)
    expect(s1.isCompleted).toBe(true)
    expect(s1.dailyGoalMinutes).toBe(20)
    expect(s1.focusSeconds).toBe(300)
    expect(s1.state).toBe(TimerState.PAUSED)
  })

  it('falls back when parsed array empty or invalid', () => {
    const fallback = [
      { id: 1, title: 'Default', sessionDuration: 1800, timeLeft: 1800, isCompleted: false, dailyGoalMinutes: 30, focusSeconds: 0, state: TimerState.PAUSED },
    ]
    expect(parseSessionsFromStorage(null, fallback)).toEqual(fallback)
    expect(parseSessionsFromStorage('"not-an-array"', fallback)).toEqual(fallback)
    expect(parseSessionsFromStorage('[]', fallback)).toEqual(fallback)
  })
})
