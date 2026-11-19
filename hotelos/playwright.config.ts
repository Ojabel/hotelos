import { defineConfig } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const backendPath = resolve(process.cwd(), '..', 'backend');
if (!process.env.HOTEL_OS_DEV_TOKEN) {
  process.env.HOTEL_OS_DEV_TOKEN = execFileSync(process.execPath, [resolve(backendPath, 'scripts/create-dev-token.cjs'), 'local-owner'], { cwd: backendPath, encoding: 'utf8' }).trim();
}

export default defineConfig({
  testDir: './browser-tests',
  testMatch: 'backend-*.spec.ts',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    browserName: 'chromium',
    headless: true,
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node scripts/start-playwright-api.cjs',
      cwd: backendPath,
      url: 'http://localhost:3000/api/v1/health/database',
      reuseExistingServer: false,
      timeout: 60_000,
      env: { EMAIL_DELIVERY_MODE: 'local' },
    },
    {
      command: 'npm run dev -- --host localhost --port 5173 --strictPort',
      cwd: process.cwd(),
      url: 'http://localhost:5173',
      env: {
        VITE_API_BASE_URL: 'http://localhost:3000',
        VITE_ENABLE_LOCAL_DEV_AUTH: 'true',
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
