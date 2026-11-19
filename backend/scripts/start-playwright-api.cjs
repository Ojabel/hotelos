require('dotenv/config');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for the PostgreSQL browser suite.');
const testDatabaseUrl = new URL(databaseUrl);
testDatabaseUrl.pathname = '/hotelos_m4_test';
process.env.DATABASE_URL = testDatabaseUrl.toString();
if (new URL(process.env.DATABASE_URL).pathname !== '/hotelos_m4_test') throw new Error('Browser API refuses to use any database other than hotelos_m4_test.');
if (process.env.AUTH_MODE !== 'development' || process.env.NODE_ENV !== 'development') {
  if (process.env.HOTEL_OS_BROWSER_AUTH_MODE !== 'firebase' || process.env.NODE_ENV !== 'development') {
    throw new Error('Browser API requires local development or Firebase Emulator authentication.');
  }
}
if (process.env.HOTEL_OS_BROWSER_AUTH_MODE === 'firebase') {
  process.env.AUTH_MODE = 'firebase';
  process.env.FIREBASE_PROJECT_ID = 'hotelos-local';
  process.env.FIREBASE_AUTH_MODE = 'emulator';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
}

require('../dist/src/main.js');
