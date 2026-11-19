import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  getIdToken,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';

const env = import.meta.env;
const values = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(values.apiKey && values.authDomain && values.projectId && values.appId);
const app = firebaseConfigured
  ? getApps().length ? getApp() : initializeApp({ ...values })
  : undefined;
export const firebaseAuth = app ? getAuth(app) : undefined;

if (firebaseAuth) {
  void setPersistence(firebaseAuth, browserLocalPersistence);
  const emulatorHost = env.VITE_FIREBASE_AUTH_EMULATOR_HOST;
  if (import.meta.env.DEV && emulatorHost && !firebaseAuth.emulatorConfig) {
    connectAuthEmulator(firebaseAuth, `http://${emulatorHost}`, { disableWarnings: true });
  }
}

function requireAuth() {
  if (!firebaseAuth) throw new Error('Firebase Authentication is not configured. Set the VITE_FIREBASE_* values.');
  return firebaseAuth;
}

export const firebaseIdentity = {
  signInEmail: (email: string, password: string) => signInWithEmailAndPassword(requireAuth(), email.trim().toLowerCase(), password),
  registerEmail: (email: string, password: string) => createUserWithEmailAndPassword(requireAuth(), email.trim().toLowerCase(), password),
  signInGoogle: () => {
    const emulatorGoogleIdToken = env.VITE_FIREBASE_AUTH_EMULATOR_GOOGLE_ID_TOKEN;
    if (import.meta.env.DEV && env.VITE_FIREBASE_AUTH_EMULATOR_HOST && emulatorGoogleIdToken) {
      return signInWithCredential(requireAuth(), GoogleAuthProvider.credential(emulatorGoogleIdToken));
    }
    return signInWithPopup(requireAuth(), new GoogleAuthProvider());
  },
  sendVerification: (user: User) => sendEmailVerification(user),
  sendPasswordReset: (email: string) => sendPasswordResetEmail(requireAuth(), email.trim().toLowerCase()),
  signOut: () => firebaseAuth ? signOut(firebaseAuth) : Promise.resolve(),
  getToken: async () => firebaseAuth?.currentUser ? getIdToken(firebaseAuth.currentUser) : undefined,
  reloadCurrentUser: async () => {
    if (firebaseAuth?.currentUser) {
      await reload(firebaseAuth.currentUser);
      await getIdToken(firebaseAuth.currentUser, true);
    }
    return firebaseAuth?.currentUser ?? null;
  },
  subscribe: (listener: (user: User | null) => void) => firebaseAuth ? onAuthStateChanged(firebaseAuth, listener) : () => undefined,
};

export type { User as FirebaseUser };
