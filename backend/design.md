# Requirements
- Keep a client list of some kind (on every login the client gets added), then send the start, pause, etc. events to all the connected clients.
- Event based system
  - AddSession
  - Start
  - Stop
  - ResetSession
  - ResetAll
  - DeleteSession
  - EditSession
  - AutoResetTimeChange
- Compute analytics
  - Time spent per task per unit of time (day, week, month)
- Store data

## Schema
```mermaid
---
Title: DB Schema
---
erDiagram
Session {
    number id PK
    string title
    number sessionDuration
    number timeLeft
    boolean isCompleted
    number dailyGoalMinutes
    number focusSeconds
    number targetTimeMs
    number state
    string userId FK
}

User {
    string id PK
    string name
    string email
    datetime createdat
    datetime sessionsResetTime
}

User ||--o{ Session : owns

Event {
    number id PK
    string name
}

TaskDailyTime {
    number id PK
    number sessionId FK
    date date
    number numMinutesSpent
    number goalMinutes
}

Session ||--o{ TaskDailyTime : has

```

## Computing analytics
#### Requirements:
- Time spent on each goal by day
- 


### Notes
- targetTimeMs: milliseconds since epoch when this session is supposed to finish (only meaningful when the session is running)
- sessionDuration: sessionDuration when it starts
- dailyGoalMinutes: total daily goal for a particular Session
- focusSeconds: time spent today in focus on this session