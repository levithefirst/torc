import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  testMatch: /judge\.spec\.ts/,
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: process.env.BASE_URL || 'https://torc-cash.vercel.app', trace: 'off' },
  projects: [
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], viewport: { width: 360, height: 780 }, deviceScaleFactor: 1 },
    },
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
  ],
});
