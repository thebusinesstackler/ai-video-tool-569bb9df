import React, { createContext, useContext, useEffect, useState, ReactNode, FC, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  loading: boolean;
  serviceUnavailable: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  loading: true,
  serviceUnavailable: false,
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

// Helper to detect service unavailability errors
const isServiceUnavailableError = (error: any): boolean => {
  if (!error) return false;
  const message = error.message || String(error);
  const status = error.status || error.code;
  
  return (
    status === 503 ||
    status === '503' ||
    error.name === 'AuthRetryableFetchError' ||
    message.includes('upstream connect error') ||
    message.includes('503') ||
    message.includes('fetch failed') ||
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('connection failure')
  );
};

export const AuthProvider: FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);
  
  // Track consecutive failures to prevent infinite retry loops
  const failureCountRef = useRef(0);
  const MAX_FAILURES = 3;

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Reset failure count on successful auth state change
        failureCountRef.current = 0;
        setServiceUnavailable(false);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        failureCountRef.current = 0;
        setServiceUnavailable(false);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch(async (error) => {
        failureCountRef.current += 1;
        
        if (isServiceUnavailableError(error)) {
          setServiceUnavailable(true);
          
          // After MAX_FAILURES, stop retrying and clear local state
          if (failureCountRef.current >= MAX_FAILURES) {
            try {
              await supabase.auth.signOut({ scope: 'local' });
            } catch {
              // Ignore cleanup errors
            }
          }
        }
        
        setSession(null);
        setUser(null);
        setLoading(false);
      });

    // Fallback timeout - if auth takes too long, stop loading anyway
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
    
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl
        }
      });
      
      if (error && isServiceUnavailableError(error)) {
        setServiceUnavailable(true);
      } else if (!error) {
        setServiceUnavailable(false);
      }
      
      return { error };
    } catch (error: any) {
      if (isServiceUnavailableError(error)) {
        setServiceUnavailable(true);
      }
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error && isServiceUnavailableError(error)) {
        setServiceUnavailable(true);
      } else if (!error) {
        setServiceUnavailable(false);
      }
      
      return { error };
    } catch (error: any) {
      if (isServiceUnavailableError(error)) {
        setServiceUnavailable(true);
      }
      return { error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    signUp,
    signIn,
    signOut,
    loading,
    serviceUnavailable,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};