import { describe, expect, it } from "vitest";
import { buildAnalyticsViewModel, getAnalyticsRangeWindow } from "./analytics";

describe("analytics helpers", () => {
  it("builds daily buckets and aggregates totals for a 7 day range", () => {
    const now = new Date("2026-05-07T12:00:00Z");
    const rows = [
      { id: 1, name: "Deep Work", date: "2026-05-01T00:00:00Z", timeSpentMinutes: 30, goalMinutes: 60 },
      { id: 2, name: "Reading", date: "2026-05-01T00:00:00Z", timeSpentMinutes: 15, goalMinutes: 30 },
      { id: 1, name: "Deep Work", date: "2026-05-02T00:00:00Z", timeSpentMinutes: 20, goalMinutes: 60 },
      { id: 1, name: "Deep Work", date: "2026-05-07T18:30:00Z", timeSpentMinutes: 5, goalMinutes: 60 },
    ];

    const viewModel = buildAnalyticsViewModel(rows, "7d", "UTC", now);

    expect(getAnalyticsRangeWindow("7d", "UTC", now)).toEqual({
      startDate: "2026-05-01",
      endDate: "2026-05-07",
      label: "Last 7 days",
    });
    expect(viewModel.bucketMode).toBe("day");
    expect(viewModel.buckets).toHaveLength(7);
    expect(viewModel.sessionTotals).toHaveLength(2);
    expect(viewModel.sessionTotals[0]).toMatchObject({
      sessionId: 1,
      sessionName: "Deep Work",
      timeSpentMinutes: 55,
      goalMinutes: 180,
    });
    expect(viewModel.totalMinutesSpent).toBe(70);
    expect(viewModel.totalGoalMinutes).toBe(210);
  });

  it("groups longer ranges into weekly buckets", () => {
    const now = new Date("2026-05-07T12:00:00Z");
    const rows = [
      { id: 1, name: "Deep Work", date: "2026-03-01", timeSpentMinutes: 30, goalMinutes: 60 },
      { id: 1, name: "Deep Work", date: "2026-03-08", timeSpentMinutes: 40, goalMinutes: 60 },
      { id: 2, name: "Writing", date: "2026-03-15", timeSpentMinutes: 20, goalMinutes: 30 },
    ];

    const viewModel = buildAnalyticsViewModel(rows, "90d", "UTC", now);

    expect(viewModel.bucketMode).toBe("week");
    expect(viewModel.buckets).toHaveLength(13);
    expect(viewModel.totalMinutesSpent).toBe(90);
    expect(viewModel.sessionTotals.map((session) => session.sessionName)).toEqual(["Deep Work", "Writing"]);
  });
});
