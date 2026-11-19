import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { firebaseIdentity, firebaseConfigured } from './firebase';

interface AuthContextValue {
  firebaseUser: User | null;
  loading: boolean;
  configured: boolean;
}

const AuthContext = createContext<AuthContextValue>({ firebaseUser: null, loading: true, configured: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);

  useEffect(() => firebaseIdentity.subscribe((user) => {
    setFirebaseUser(user);
    setLoading(false);
  }), []);

  const value = useMemo(() => ({ firebaseUser, loading, configured: firebaseConfigured }), [firebaseUser, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
