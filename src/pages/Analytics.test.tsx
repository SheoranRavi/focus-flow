import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AnalyticsPage from "./Analytics";

const mockApi = vi.hoisted(() => ({
  getUser: vi.fn(),
  getSessions: vi.fn(),
  getAnalytics: vi.fn(),
  sendUserEvent: vi.fn(),
  createRazorpayOrder: vi.fn(),
  verifyRazorpayPayment: vi.fn(),
}));

const razorpayState = vi.hoisted(() => ({
  constructor: null as null | typeof window.Razorpay,
  instance: {
    open: vi.fn(),
    on: vi.fn(),
  },
  options: null as null | {
    handler?: (payload: {
      razorpay_payment_id: string;
      razorpay_order_id: string;
      razorpay_signature: string;
    }) => void | Promise<void>;
  },
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
    razorpayState.options = null;
    const RazorpayMock = vi.fn(function RazorpayMock(this: unknown, options) {
      razorpayState.options = options;
      return razorpayState.instance;
    });
    Object.defineProperty(window, "Razorpay", {
      value: RazorpayMock,
      configurable: true,
      writable: true,
    });
    razorpayState.constructor = RazorpayMock as unknown as typeof window.Razorpay;

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
      subscriptionTier: "pro",
      subscriptionStatus: "active",
      subscriptionCancelAtPeriodEnd: false,
      subscriptionUpdatedAt: "2026-05-07T00:00:00.000Z",
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
    mockApi.createRazorpayOrder.mockResolvedValue({
      order_id: "order_123",
      amount: 19900,
      currency: "INR",
    });
    mockApi.verifyRazorpayPayment.mockResolvedValue({ success: true });
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

  it("shows the paywall for free users and does not fetch analytics", async () => {
    mockApi.getUser.mockResolvedValueOnce({
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
      subscriptionTier: "free",
      subscriptionStatus: "inactive",
      subscriptionCancelAtPeriodEnd: false,
      subscriptionUpdatedAt: "2026-05-07T00:00:00.000Z",
    });

    renderPage();

    expect(await screen.findByText(/unlock the analytics dashboard/i)).toBeInTheDocument();
    expect(mockApi.getAnalytics).not.toHaveBeenCalled();
  });

  it("opens Razorpay checkout and unlocks analytics after successful payment verification", async () => {
    const user = userEvent.setup();

    mockApi.getUser
      .mockResolvedValueOnce({
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
        subscriptionTier: "free",
        subscriptionStatus: "inactive",
        subscriptionCancelAtPeriodEnd: false,
        subscriptionUpdatedAt: "2026-05-07T00:00:00.000Z",
      })
      .mockResolvedValueOnce({
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
        subscriptionTier: "pro",
        subscriptionStatus: "active",
        subscriptionCancelAtPeriodEnd: false,
        subscriptionUpdatedAt: "2026-05-07T00:00:00.000Z",
      });

    renderPage();

    const upgradeButton = await screen.findByRole("button", { name: /upgrade with razorpay/i });
    await user.click(upgradeButton);

    expect(mockApi.createRazorpayOrder).toHaveBeenCalledTimes(1);
    expect(razorpayState.constructor).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(razorpayState.instance.open).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await razorpayState.options?.handler?.({
        razorpay_payment_id: "pay_123",
        razorpay_order_id: "order_123",
        razorpay_signature: "signature_123",
      });
    });

    expect(mockApi.verifyRazorpayPayment).toHaveBeenCalledWith({
      razorpay_payment_id: "pay_123",
      razorpay_order_id: "order_123",
      razorpay_signature: "signature_123",
    });
    await waitFor(() => {
      expect(mockApi.getAnalytics).toHaveBeenCalled();
    });
    expect(await screen.findByText(/focus time/i)).toBeInTheDocument();
  });
});
