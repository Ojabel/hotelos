# Firebase Authentication setup

## Firebase Console

1. Create a Firebase project and Web app. Use the same project ID in the browser and Admin SDK.
2. Enable **Email/Password** and **Google** under Authentication → Sign-in method. Staff login remains email/password with invitation based onboarding; guest login offers both providers.
3. Add local and deployed hostnames under Authentication → Settings → Authorized domains.
4. Configure the verification and password-reset email templates and authorized continue URL. Enable email-enumeration protection in Firebase; the guest UI also shows a neutral password-reset response.

Firebase Web API key, auth domain, project ID and app ID are public client values. Never put service account JSON or Admin credentials in a `VITE_*` variable.

## Frontend

Copy `hotelos/.env.example` to `hotelos/.env`:

```env
VITE_DATA_MODE=backend
VITE_API_BASE_URL=http://localhost:3000
VITE_FIREBASE_API_KEY=replace-with-web-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_APP_ID=replace-with-web-app-id
VITE_FIREBASE_MESSAGING_SENDER_ID=replace-if-used
VITE_FIREBASE_AUTH_EMULATOR_HOST=
```

The backend is the default data mode. `VITE_DATA_MODE=demo` opts the local UI into its isolated mock/demo experience; it does not authenticate a user to the backend. The guest portal backend mode provides Google, email/password registration/login, verification gating, reset email, refreshed ID tokens and logout.

## Backend

Set `AUTH_MODE=firebase`, matching `FIREBASE_PROJECT_ID`, and `TENANT_ORGANIZATION_ID`. Provide Firebase Admin Application Default Credentials on the server (local `gcloud auth application-default login`, or a local untracked service account file); deployed workloads should use workload identity. `verifyIdToken(token, true)` validates the Firebase token and revocation state. Guest access additionally requires a verified email, Google or password provider and a server-side guest identity link. Firebase provider claims never grant staff membership or permissions.

## Local Auth Emulator

The repository `firebase.json` configures Auth Emulator on port 9099 and its UI on 4000. Start it from the project root:

```powershell
npx -y firebase-tools@latest emulators:start --only auth --project hotelos-local
```

Set backend `AUTH_MODE=firebase`, `FIREBASE_PROJECT_ID=hotelos-local`, `FIREBASE_AUTH_MODE=emulator`, and `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`. Set the frontend Firebase values to the local project and `VITE_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`. Emulator mode is rejected in production. Firebase Emulator accounts and test identities are local test data only.

The Playwright guest config uses Firebase's documented mock Google ID-token support by setting `VITE_FIREBASE_AUTH_EMULATOR_GOOGLE_ID_TOKEN` to synthetic claims. The frontend consumes that credential only in development when the Auth Emulator host is configured; otherwise Google sign-in uses `signInWithPopup` and a real Firebase Google provider. See the [Auth Emulator provider testing guidance](https://firebase.google.com/docs/emulator-suite/connect_auth#emulated_third-party_identity_provider_authentication).

## Existing guest profiles

Firebase UID is stored as the verified external identity in `UserIdentity`; `GuestIdentityLink` maps that identity to a hotel-scoped `HotelGuest`. New profiles are created only when no same-email guest record exists. A matching email is not proof of ownership. Staff must verify the person through the hotel’s approved process and use the permission-protected identity-link operation documented in [Guest identity linking](GUEST_IDENTITY_LINKING.md). Reservation records remain attached to the existing guest profile.
