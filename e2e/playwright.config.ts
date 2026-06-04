import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 40_000,
  retries: process.env['CI'] ? 2 : 0,
  workers: 1, // Electron windows must run serially
  globalSetup: './global-setup',
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: '../playwright-report' }],
  ],
  use: {
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
})
