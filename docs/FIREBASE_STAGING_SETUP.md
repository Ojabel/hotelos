# Firebase staging setup

Use the existing project **`com-example-geminitestap-8198d`**. Do not create a replacement. The local Firebase CLI identity received HTTP 403 when listing apps, so the existing Web App and Console settings have not been independently verified. Ask a Firebase project owner to perform the checks below before using real credentials.

## Environment

Frontend config is public Web SDK config and must be read from Vite environment variables, never embedded in source:

```dotenv
VITE_FIREBASE_API_KEY=<the project's Web API key>
VITE_FIREBASE_AUTH_DOMAIN=com-example-geminitestap-8198d.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=com-example-geminitestap-8198d
VITE_FIREBASE_STORAGE_BUCKET=com-example-geminitestap-8198d.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=752267161590
VITE_FIREBASE_APP_ID=1:752267161590:web:772f1409615e8ccabd21d7
VITE_API_BASE_URL=https://<staging-api-host>
VITE_DATA_MODE=backend
VITE_ENABLE_LOCAL_DEV_AUTH=false
```

Put values in an untracked `hotelos/.env.staging.local` (or the hosting provider's protected build variables). The API key is a public Firebase Web config value; restrict its API usage where suitable, and never use an Admin SDK private key here. `VITE_DATA_MODE` must stay `backend` in staging; auth/API errors must not fall back to mock data.

Backend runtime variables:

```dotenv
NODE_ENV=production
AUTH_MODE=firebase
FIREBASE_PROJECT_ID=com-example-geminitestap-8198d
FIREBASE_AUTH_MODE=standard
TENANT_ORGANIZATION_ID=<staging organization UUID>
DATABASE_URL=<Secret Manager version reference injected by Cloud Run>
DATABASE_POOL_MAX=5
APP_BASE_URL=https://<staging-frontend-domain>
CORS_ORIGINS=https://<staging-frontend-domain>
API_DOCS_ENABLED=false
EMAIL_DELIVERY_MODE=smtp
```

Cloud Run's attached service account uses ADC/workload identity for Firebase Admin. Do not set `GOOGLE_APPLICATION_CREDENTIALS` to a downloaded key in Cloud Run. Grant only the Firebase Auth permission needed to verify tokens with revocation checking; verify the effective permissions with the project owner.

## Firebase Console checklist

1. Open Firebase Console and select `com-example-geminitestap-8198d`.
2. In Project settings, confirm the existing Web App's app ID matches the value above. Do not create another app until existing apps are reviewed.
3. Authentication → Sign-in method: enable Email/Password and Google; keep staff enrollment invitation-only in HotelOS.
4. Authentication → Settings → Authorized domains: add the staging frontend hostname and any required Firebase Hosting domain. Keep localhost only for development.
5. Authentication → Templates: set and send a verification email test; set and send a password reset test. Ensure links return to the staging host and use a verified sender experience.
6. Check Google provider OAuth support/contact email and OAuth consent/authorized redirect configuration. Test popup behavior on the actual staging domain.
7. Restrict the Web API key by allowed APIs and staging web referrers where compatible with Firebase Auth, and rotate it if exposure is suspected.
8. Configure the Cloud Run service account using ADC. Test standard Firebase token verification, email verification, staff membership authorization, and revocation with test identities.
9. Verify staging Google OAuth and Firebase authorized domains before live tests. Never use production guest data in these tests.

## Local emulator

Root `firebase.json` currently configures only Auth Emulator on port 9099. Use the existing documented synthetic test setup:

```powershell
firebase emulators:start --only auth --project hotelos-local
```

Set both frontend and backend emulator host/project variables to `hotelos-local`. Emulator tests do not verify real Google OAuth, real verification email delivery, project IAM, or Cloud Run ADC. The current machine's emulator is local-only and must not be used as the staging project.

## Current verification

Guest browser workflows previously passed against the Auth Emulator and `hotelos_m4_test`; no real Firebase login was performed. Firebase app listing is blocked by project IAM (HTTP 403), and the real Web App/provider settings and staging domain remain unverified.
