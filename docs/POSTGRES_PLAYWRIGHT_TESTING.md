# PostgreSQL Playwright testing

## Safety boundary

Browser regression tests use a dedicated PostgreSQL database named `hotelos_m4_test`. The Playwright API launcher rewrites the local backend connection string to this database and refuses to run in a mode other than local `development`. It never connects to or cleans `hotelos_dev`. The browser tests create uniquely named operational records; no database reset or destructive cleanup is used.

## Setup

1. Start local PostgreSQL and ensure the existing `backend/.env` connection can create the dedicated database once. The setup used for this milestone created `hotelos_m4_test` without modifying `hotelos_dev`.
2. Apply migrations and seed the isolated tenant/hotel/access catalogue. Commands use the dedicated URL:

```powershell
cd backend
$env:DATABASE_URL = '<same local connection with database hotelos_m4_test>'
npm run prisma:migrate:deploy
npm run seed:dev-tenant
npm run seed:access
npm run seed:dev-hotel
```

The Playwright API launcher automatically points to `hotelos_m4_test`; the browser suite automatically mints a short-lived local development token from the untracked backend `.env`. Never print or commit the token.

3. Install the Chromium browser once with `npx playwright install chromium`.
4. Run all PostgreSQL browser workflows:

```powershell
cd hotelos
npm run test:browser
```

Playwright starts the API and Vite server itself. The test API enables local email capture so staff-invitation workflows can retrieve one-time links without an external mail service. This is limited to the managed test process; normal SMTP configuration is unchanged. It requires ports 3000 and 5173 to be free. The managed API checks PostgreSQL readiness before the tests run.

## Guest Firebase tests

The Auth Emulator configuration is in root `firebase.json`. Start it in another terminal:

```powershell
npx -y firebase-tools@latest emulators:start --only auth --project hotelos-local
```

Set frontend `VITE_FIREBASE_PROJECT_ID=hotelos-local`, public placeholder Web app values, and `VITE_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`. Start the backend with `AUTH_MODE=firebase`, `FIREBASE_AUTH_MODE=emulator`, `FIREBASE_PROJECT_ID=hotelos-local`, and `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`. Emulator accounts are local-only; do not use real provider credentials. The guest Playwright config passes a synthetic Google ID-token claims payload through Firebase's documented emulator credential flow; it exercises the guest UI button, backend token verification and PostgreSQL resolution without a real Google account.

## Skip and failure diagnosis

The earlier three suites used explicit `test.skip()` when `HOTEL_OS_DEV_TOKEN` was absent, so Playwright reported a green run with zero browser verification. The current config mints a short-lived token from the local backend development secret and has no conditional skip. Missing configuration now fails startup instead of silently skipping. Check that the test output reports **3 tests**, that both managed web servers started, and that each test has a passed/failed result rather than `skipped`.

If startup fails, check PostgreSQL connectivity, that `hotelos_m4_test` has all migrations and seed data, local `AUTH_MODE=development`, a development secret, and ports 3000/5173. Do not resolve failures by switching the launcher to `hotelos_dev` or deleting data.
