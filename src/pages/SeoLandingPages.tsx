import SeoLandingPage, { SeoLandingPageConfig } from "./SeoLandingPage";

const pages: Record<string, SeoLandingPageConfig> = {
  "/task-focus-timer": {
    path: "/task-focus-timer",
    title: "Task Focus Timer | Focus by task with Task Quota",
    description: "Use a task focus timer to organize deep work, study, reading, and planning sessions while keeping daily progress visible.",
    eyebrow: "Focus by task",
    heading: "A task focus timer for the work in front of you.",
    intro: "Task Quota gives every important task its own focused session, so you can choose what to work on, start the timer, and keep your attention where it belongs.",
    benefits: [
      { title: "Separate sessions by task", description: "Keep deep work, research, reading, and planning distinct instead of losing everything in one generic timer.", icon: "target" },
      { title: "Set a daily goal", description: "Give each session a target and see how much focused time you want to complete today.", icon: "clock" },
      { title: "Review your progress", description: "Use analytics to understand which tasks receive your time and where your routine is improving.", icon: "analytics" },
    ],
    workflowHeading: "Start focused work in three steps.",
    workflow: ["Create a session for the task you want to complete.", "Choose the duration and start one focused session.", "Review daily progress and analytics when you finish."],
    faqs: [
      { question: "What is a task focus timer?", answer: "A task focus timer lets you track focused time against a specific task instead of using one timer for your entire day." },
      { question: "Can I use Task Quota for different kinds of work?", answer: "Yes. Create separate sessions for deep work, study, reading, email, planning, or any other task you want to track." },
    ],
  },
  "/focus-session-tracker": {
    path: "/focus-session-tracker",
    title: "Focus Session Tracker | Track focused time with Task Quota",
    description: "Track focus sessions, daily goals, streaks, and time spent by task with Task Quota.",
    eyebrow: "Track consistency",
    heading: "See the focus sessions that move your day forward.",
    intro: "A focus session tracker helps you measure the work that actually received your attention. Task Quota keeps sessions, goals, and streaks together in one simple workspace.",
    benefits: [
      { title: "Make progress measurable", description: "Replace vague productivity goals with clear sessions and minutes spent on the task.", icon: "target" },
      { title: "Build a repeatable routine", description: "Use daily goals and streaks as a lightweight way to return to focused work consistently.", icon: "clock" },
      { title: "Learn from your history", description: "Look back at focused time by session and identify the work patterns worth repeating.", icon: "analytics" },
    ],
    workflowHeading: "A tracker that stays close to your work.",
    workflow: ["Plan the tasks that deserve focused time today.", "Run each session without switching between separate tools.", "Check your progress and use the pattern to plan tomorrow."],
    faqs: [
      { question: "What can I track with Task Quota?", answer: "You can track focused minutes, task sessions, daily goals, completion, and focus streaks." },
      { question: "Do I need an account to track sessions?", answer: "No. You can begin as a guest on your device. An account adds syncing across devices." },
    ],
  },
  "/productivity-analytics": {
    path: "/productivity-analytics",
    title: "Productivity Analytics by Task | Task Quota",
    description: "Understand where your focused time goes with productivity analytics by task, session, and date range in Task Quota.",
    eyebrow: "Understand your time",
    heading: "Productivity analytics that show the work behind the day.",
    intro: "Task Quota connects your focus sessions to useful analytics, helping you see how your time is distributed across tasks and whether your goals are becoming a habit.",
    benefits: [
      { title: "Compare tasks clearly", description: "See which sessions and tasks account for your focused time instead of relying on memory.", icon: "target" },
      { title: "Spot useful trends", description: "Review weekly, monthly, and quarterly windows to find patterns in your work.", icon: "clock" },
      { title: "Use data to adjust", description: "Turn the numbers into better daily goals and a more realistic plan for your attention.", icon: "analytics" },
    ],
    workflowHeading: "From timer to insight without extra spreadsheets.",
    workflow: ["Track focused sessions as you work through your tasks.", "Open analytics to see time by session and date range.", "Adjust your next goals based on the evidence from your routine."],
    faqs: [
      { question: "What does Task Quota analytics show?", answer: "Task Quota analytics shows focused time by session and date range, helping you review weekly, monthly, and quarterly patterns." },
      { question: "Is productivity analytics useful for a single person?", answer: "Yes. Individual analytics can reveal which tasks receive attention, how consistent your goals are, and where your plan needs adjustment." },
    ],
  },
};

export function getSeoLandingPage(pathname: string) {
  const config = pages[pathname];
  return config ? <SeoLandingPage config={config} /> : null;
}

export const seoLandingPagePaths = Object.keys(pages);
