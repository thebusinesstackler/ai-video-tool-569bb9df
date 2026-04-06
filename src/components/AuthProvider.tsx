import React, { createContext, useContext, useEffect, useState, ReactNode, FC } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  clearLocalSession: () => void;
  loading: boolean;
  authServiceDown: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  clearLocalSession: () => {},
  loading: true,
  authServiceDown: false,
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

// Helper to detect service outage from error
const isServiceDown = (error: unknown): boolean => {
  if (!error) return false;
  const msg = String(error).toLowerCase();
  return msg.includes('503') || 
         msg.includes('upstream connect') || 
         msg.includes('service unavailable') ||
         msg.includes('failed to fetch') ||
         msg.includes('network');
};

export const AuthProvider: FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authServiceDown, setAuthServiceDown] = useState(false);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Detect token refresh failures as service issues
        if (event === 'TOKEN_REFRESHED' && !session) {
          setAuthServiceDown(true);
        } else if (event === 'SIGNED_OUT') {
          setAuthServiceDown(false);
        } else if (session) {
          setAuthServiceDown(false);
        }
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        // Handle returned errors (not thrown) — e.g. refresh failures
        if (error) {
          console.error('Session fetch returned error:', error);
          if (isServiceDown(error)) {
            setAuthServiceDown(true);
          }
        }
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        if (session) setAuthServiceDown(false);
      })
      .catch((error) => {
        console.error('Failed to get session:', error);
        if (isServiceDown(error)) {
          setAuthServiceDown(true);
        }
        setLoading(false);
      });

    // Fallback timeout - if auth takes too long, stop loading
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    
    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Clear local session without requiring server - useful when backend is down
  const clearLocalSession = () => {
    // Clear Supabase auth tokens from localStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Reset state
    setUser(null);
    setSession(null);
    setLoading(false);
  };

  const value = {
    user,
    session,
    signUp,
    signIn,
    signOut,
    clearLocalSession,
    loading,
    authServiceDown,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
