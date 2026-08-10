import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const value = {
    session,
    user: session?.user || null,
    loading,
    passwordRecovery,
    clearPasswordRecovery: () => setPasswordRecovery(false),
    signUp: (email, password) => supabase.auth.signUp({ email, password }),
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
    resetPassword: (email) =>
      supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/auth' }),
    updatePassword: (password) => supabase.auth.updateUser({ password }),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
