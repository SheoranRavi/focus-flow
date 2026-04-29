# Continuation
- Homepage
- Analytics support
- On SSE reconnect or page reload, fetch sessions to prevent stale data
- Add system notification to session complete.
- Build tests to ensure timer accuracy

# Backlog
- Add all timezones to dropdown
- Handle the case of both frontend and backend triggering reset within seconds/minutes of each other.

# UI
- Maybe allow editing the time (focusSeconds) for tasks.
- Enter to save.
- The audio does not happen if the tab is suspended (I think). Explore the use of a service worker or something to get around this.
  - Probably can get it working with the notifications API.

## UI-API sessions merge
- backend/repo errors to not flow to ui
- Implement a frontend cache for offline use. Once connection established, update backend from the cache.
  

## Backend
- Performance and concurrency tests for backend

# Performance
- Analyze performance of the app.
  - Load time, how can it be improved.

## Bugs
- When only the Goal is changed, the session timer shouldn't reset to sessionDuration

## Backend requirements
- Compute analytics
  - Time spent per task per unit of time (day, week, month)
- Store data

## Questions
- At what interval should you call the API
  - Data is safely stored in the local storage, but multiple device sync would be an issue if not synced regularly
    - If doing multiple device sync thingy, then need to track state in the backend, which timer is running
    - Don't have to have something always running, just need to update in the DB, so something like serverless functions also works
- How to generate analytics?
  - Demarcate by Reset time or 12:00 midnight local usertime?
    - Demarcate by Reset time.

## Bugs and Learnings
- When another session is started for a user with one already in running state, the already running session needs to be canceled. Overlooking this caused a bug where both the sessions were in running state.