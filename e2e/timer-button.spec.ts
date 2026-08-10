import { expect, test } from '@playwright/test';

test('a start action keeps the timer on Pause when a revisionless refresh arrives', async ({ page }) => {
  page.on('console', message => console.log(`[browser] ${message.text()}`));
  let sessionGetCount = 0;

  await page.route('**/users/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        streak: 0,
        yesterdayMins: 0,
        sessionsResetTime: '00:00',
        lastResetDate: '2026-08-10',
        lastAutoResetDate: '2026-08-10',
        timezone: 'Asia/Kolkata',
        activeSessionId: null,
        selectedSessionId: null,
      }),
    });
  });

  await page.route('**/sessions/**', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'GET' && url.pathname.endsWith('/sessions/')) {
      sessionGetCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify([
          {
            id: 0,
            userId: 'e2e-user',
            title: 'General',
            dailyGoalMinutes: 0,
            state: 0,
            focusSeconds: 0,
            groupId: null,
            sessionDuration: 1500,
            timeLeft: 0,
            isCompleted: false,
            targetTimeMs: 0,
            noGoal: true,
            createdAt: '2026-08-10T00:00:00.000Z',
            updatedAt: '2026-08-10T00:00:00.000Z',
            isDeleted: false,
          },
          {
            id: 11,
            userId: 'e2e-user',
            title: 'Browser task',
            dailyGoalMinutes: 20,
            state: 0,
            focusSeconds: 0,
            groupId: null,
            sessionDuration: 120,
            timeLeft: 120,
            isCompleted: false,
            targetTimeMs: 0,
            noGoal: false,
            createdAt: '2026-08-10T00:00:00.000Z',
            updatedAt: '2026-08-10T00:00:00.000Z',
            isDeleted: false,
          },
        ]),
      });
      return;
    }

    if (route.request().method() === 'POST' && url.pathname.endsWith('/sessions/event')) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ revision: 11 }),
      });
      return;
    }

    await route.continue();
  });

  await page.route('**/events/**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
        'Content-Type': 'text/event-stream',
      },
      body: 'event: heartbeat\ndata: {}\n\n',
    });
  });

  await page.goto('/');

  const sharedTimerStart = page.getByRole('button', { name: /^(Start|Resume)$/ }).first();
  await expect(sharedTimerStart).toBeVisible();

  await sharedTimerStart.click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
  });
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  expect(sessionGetCount).toBeGreaterThanOrEqual(1);
});
