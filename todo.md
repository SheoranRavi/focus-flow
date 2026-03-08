# Continuation
- AI made changes that aint good
- check the streamEvents call in app.tsx, add the methods to it
- apply the useCallback hook on them
- make sure that extra events calls do not go through.

# UI
- The daily reset should show a notification that the Reset has been triggered
- Maybe allow editing the time (focusSeconds) for tasks.
- Goalless session, update the session card.
- Enter to save.
- Dropdown for selecting time.
- The audio does not happen if the tab is suspended (I think). Explore the use of a service worker or something to get around this.
  - Probably can get it working with the notifications API.

## UI-API sessions merge
- handle errors in repo
- backend errors to not flow to ui
- Implement a frontend cache for offline use. Once connection established, update backend from the cache.
  

## Backend
- Keep a client list of some kind (on every login the client gets added), then send the start, pause, etc. events to all the connected clients.

# Performance
- Analyze performance of the app.
  - Load time, how can it be improved.

## Bugs
- When only the Goal is changed, the session timer shouldn't reset to sessionDuration
- When adding a new session, multiple new session cards come.
- Remove session.id from session card

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
