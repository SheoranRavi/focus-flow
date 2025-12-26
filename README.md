# Focus FLow

For multiple focus sessions and tracking productivity.

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