import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AnalyticsPage from "./Analytics";

const mockApi = vi.hoisted(() => ({
  getUser: vi.fn(),
  getSessions: vi.fn(),
  getAnalytics: vi.fn(),
  sendUserEvent: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  user: { uid: "user-1" },
}));

vi.mock("@/lib/api", () => ({
  api: mockApi,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => authState.user,
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <AnalyticsPage />
    </MemoryRouter>,
  );

describe("Analytics page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockApi.getUser.mockResolvedValue({
      id: "user-1",
      name: "Test User",
      email: "user@example.com",
      sessionsResetTime: "00:00",
      lastResetDate: "2026-05-07",
      lastAutoResetDate: "2026-05-07",
      activeSessionId: 1,
      yesterdayMins: 120,
      streak: 4,
      timezone: "UTC",
    });
    mockApi.getSessions.mockResolvedValue([
      {
        id: 1,
        title: "Deep Work",
        sessionDuration: 1500,
        timeLeft: 1500,
        isCompleted: false,
        dailyGoalMinutes: 60,
        focusSeconds: 0,
        state: 0,
      },
    ]);
    mockApi.getAnalytics.mockResolvedValue([
      { id: 1, name: "Deep Work", date: "2026-05-07", timeSpentMinutes: 45, goalMinutes: 60 },
    ]);
    mockApi.sendUserEvent.mockResolvedValue(undefined);
  });

  it("renders analytics data and refetches when the range changes", async () => {
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText(/Deep Work/)).toBeInTheDocument();
    expect(screen.getByText(/focus time/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /last 30 days/i }));

    await waitFor(() => {
      expect(mockApi.getAnalytics).toHaveBeenCalledTimes(2);
    });
  });

  it("sends includeDeleted to the backend when toggled", async () => {
    const user = userEvent.setup();

    renderPage();

    await screen.findByText(/Deep Work/);
    expect(mockApi.getAnalytics).toHaveBeenCalledWith(expect.any(String), expect.any(String), false);

    await user.click(screen.getByRole("checkbox", { name: /include deleted sessions/i }));

    await waitFor(() => {
      expect(mockApi.getAnalytics).toHaveBeenLastCalledWith(expect.any(String), expect.any(String), true);
    });
  });
});
