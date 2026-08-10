import React from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../firebase";

const AuthContext = createContext<User | null>(null);
const isE2ETest = import.meta.env.VITE_E2E_TEST === 'true';
const e2eUser = {
  uid: 'e2e-user',
  getIdToken: async () => 'e2e-token',
} as User;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isE2ETest) {
      setUser(e2eUser);
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsub;
  }, []);

  if (loading) return null; // or spinner

  return (
    <AuthContext.Provider value={user}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
