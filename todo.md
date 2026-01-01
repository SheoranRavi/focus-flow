- Track the goals by `name` instead of id
  - generate the analytics using this name
  - If the name changes (during edit), classify it as a new Goal
    - Do we change the id in that case?
- Add a drag and drop functionality to re-arrange the goals
  - OR, just have the active one sit at the top
- Add the spotify integration
- Add a cache layer
  - localStorage to start with
- The daily reset should show a notification that the Reset has been triggered
- Maybe allow editing the time (focusSeconds) for tasks.

## Bugs
- The reset does not happen if the timer effect doesnt run at the exact time.
  - So, whether a reset has happened or not needs to be tracked.
  - Track the lastResetDate like the original logic

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
