import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

const backendPath = resolve(process.cwd(), '..', 'backend');
const googleTestId = `hotelos-google-${Date.now()}`;
const googleTestEmail = `${googleTestId}@example.test`;
const googleTestCredential = JSON.stringify({ sub: googleTestId, email: googleTestEmail, email_verified: true, name: 'Google Browser Guest' });
process.env.HOTEL_OS_BROWSER_GOOGLE_EMAIL = googleTestEmail;

export default defineConfig({
  testDir: './browser-tests',
  testMatch: 'guest-auth.spec.ts',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  reporter: 'list',
  use: { baseURL: 'http://localhost:5173', browserName: 'chromium', headless: true, viewport: { width: 1365, height: 950 } },
  webServer: [
    {
      command: 'node scripts/start-playwright-api.cjs', cwd: backendPath,
      url: 'http://localhost:3000/api/v1/health/database', reuseExistingServer: false, timeout: 60_000,
      env: { HOTEL_OS_BROWSER_AUTH_MODE: 'firebase' },
    },
    {
      command: 'npm run dev -- --host localhost --port 5173 --strictPort', cwd: process.cwd(),
      url: 'http://localhost:5173', reuseExistingServer: false, timeout: 60_000,
      env: {
        VITE_API_BASE_URL: 'http://localhost:3000', VITE_DATA_MODE: 'backend',
        VITE_FIREBASE_API_KEY: 'fake-api-key', VITE_FIREBASE_AUTH_DOMAIN: 'hotelos-local.firebaseapp.com',
        VITE_FIREBASE_PROJECT_ID: 'hotelos-local', VITE_FIREBASE_APP_ID: '1:123456789:web:hotelos-local',
        VITE_FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
        VITE_FIREBASE_AUTH_EMULATOR_GOOGLE_ID_TOKEN: googleTestCredential,
      },
    },
  ],
});
