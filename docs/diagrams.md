### Session
id: number
title: string
initialDuration: number
timeLeft: number
isCompleted: boolean
dailyGoalMinutes: number  // adjustable daily goal
timeSpentToday: number   // time spent on this task today
target: number // the target time at which this timer is supposed to complete

```mermaid
flowchart TD
    A[User interacts with Timer] --> B{Timer Action}
    
    B -->|Start| C[Prepare Session Data]
    B -->|Pause| C
    B -->|Reset| C
    B -->|Edit| C

    C --> D[Call API with Session Data + Action]
    D --> E[API validates request]
    E --> F[Update Session in Database]
    F --> G[Return Success Response]
```

```mermaid
flowchart LR
    subgraph Client["Client (App)"]
        A[User interacts with Timer]
        B{Timer Action}
        C[Prepare Session Data]
    end

    subgraph Backend["Backend"]
        D[API Endpoint]
        E[Update Session in Database]
    end

    A --> B
    B -->|Start| C
    B -->|Pause| C
    B -->|Reset| C
    B -->|Edit| C

    C --> D
    D --> E
```

```mermaid
sequenceDiagram
    participant User
    participant App
    participant API
    participant DB

    User ->> App: Start / Pause / Reset / Edit Timer
    App ->> App: Update local session state
    App ->> API: Send session data + action
    API ->> DB: Update session record
    DB -->> API: Success
    API -->> App: 200 OK
```

```mermaid
erDiagram
    USER ||--o{ SESSION : owns

    USER {
        string id PK
        string email
        string name
        datetime created_at
    }

    SESSION {
        int id PK
        string user_id FK
        string title
        int initial_duration
        int time_left
        boolean is_completed
        int daily_goal_minutes
        int time_spent_today
        int target
        datetime created_at
        datetime updated_at
    }
```

## Timers State Machine
```mermaid

stateDiagram-v2
    direction TB

    state "Timer 1" as T1{
        state "Zero" as Zero_T1
        [*] --> Zero_T1
        Zero_T1 --> T1_Running : Start
        T1_Running --> T1_Paused : Pause
        T1_Paused --> T1_Running : Resume
        T1_Running --> Zero_T1 : Manual Reset
        T1_Paused --> Zero_T1 : Manual Reset

        note right of Zero_T1
            timeLeft = initialDuration
        end note
    }
    
    note left of T1
        There can be N number <br/>of Timers like Timer 1
    end note
    
    state Global_Counter{
        [*] --> Zero
        Zero --> Running : Any Timer Starts
        Running --> Paused : All Timers Paused
        Paused --> Running : Any Timer Resumed
        Paused --> Zero : Reset Triggered
        Running --> Zero : Reset Triggered
    }
    note left of Global_Counter
        totalFocusSeconds = Sum of focusSeconds
        totalDailyGoalMinutes = Sum of dailyGoalMinutes
    end note
    note right of Zero
        totalFocusSeconds = 0
    end note

```

### Reset State Machine
```mermaid
flowchart TD
    CheckTime[Check Time] --> GreaterEqualThanResetTime{>= ResetTime}
    GreaterEqualThanResetTime -- Yes --> LastResetDate{Last Reset Date}
    GreaterEqualThanResetTime -- No --> End
    LastResetDate -- Before Today --> Reset[Reset the Daily Progress]
    LastResetDate -- Today --> End
    LastResetDate -- Null String --> SaveDate[Set lastResetDate = today, but don't reset]
    ManualReset[Manual Reset Event triggered by user] --> Reset
    Reset --> SetLastResetDate[Update LastResetDate]
    Reset --> UpdateYesterdayMin
    Reset --> UpdateStreak[Update streak if goal met]
```

#### Timer states
##### Individual
* dailyGoalMinutes
* focusSeconds
* timeLeft
* initialDuration
* targetTime

##### Global
* yesterdayMinutes
* resetTime
* lastResetDate
* totalDailyGoalMinutes
* totalFocusSeconds

## State that needs to be stored in localStorage
- resetTime
- sessions
  - The state of each timer (running, stopped)

## Authentication

#### Authentication dependent features
- Data storage across devices for a user
- Analytics

```mermaid
flowchart TD

```