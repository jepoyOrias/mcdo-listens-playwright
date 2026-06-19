import { defineConfig, devices } from '@playwright/test';

/**
 * McDo Listens – Playwright configuration
 * Runs on Chromium, Firefox, WebKit (desktop) and mobile emulation.
 *
 * Run all:          npx playwright test
 * Desktop only:     npx playwright test --project=chromium --project=firefox --project=webkit
 * Mobile only:      npx playwright test --project=mobile-chrome --project=mobile-safari
 * Single/known code: MCDO_SURVEY_CODE=0123 MCDO_ORDER_NO=00456 npx playwright test --grep "known valid code"
 */
export default defineConfig({
  testDir: './tests',
  timeout: 30 * 60 * 1000,      // 30 min ceiling (500 combos)
  expect: { timeout: 10_000 },
  fullyParallel: false,          // survey runs sequentially by design
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],

  use: {
    baseURL: 'https://www.mcdolistens.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    // ── Desktop browsers ─────────────────────────────────────────
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // ── Mobile emulation ─────────────────────────────────────────
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
  ],
});
