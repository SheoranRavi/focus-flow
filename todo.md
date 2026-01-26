# UI
- Track the goals by `name` instead of id
  - generate the analytics using this name
  - If the name changes (during edit), classify it as a new Goal
    - Do we change the id in that case?
- Add the spotify integration
- Add a cache layer
  - localStorage to start with
- The daily reset should show a notification that the Reset has been triggered
- Maybe allow editing the time (focusSeconds) for tasks.
- Add option to have a goalless session, one that is used just for tracking time.
- Enter to save.
- Dropdown for selecting time.
- The audio does not happen if the tab is suspended (I think). Explore the use of a service worker or something to get around this.
  - Probably can get it working with the notifications API.

## Backend
- Keep a client list of some kind (on every login the client gets added), then send the start, pause, etc. events to all the connected clients.

# Performance
- Analyze performance of the app.
  - Load time, how can it be improved.

## Bugs
- When only the Goal is changed, the session timer shouldn't reset to initialDuration

## Backend requirements
- Compute analytics
  - Time spent per task per unit of time (day, week, month)
- Store data

## Questions
- At what interval should you call the API
  - Data is safely stored in the local storage, but multiple device sync would be an issue if not synced regularly
    - If doing multiple device sync thingy, then need to track state in the backend, which timer is running
    - Don't have to have something always running, just need to update in the DB, so something like serverless functions also works
- How to geneerate analytics?
  - Demarcate by Reset time or 12:00 midnight local usertime?
    - Demarcate by Reset time.
