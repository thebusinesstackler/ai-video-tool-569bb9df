import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { VideoIcon, Mail, Lock, UserPlus, LogIn, KeyRound, ArrowLeft } from 'lucide-react';

const emailSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
});

const authSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

type AuthMode = 'signIn' | 'signUp' | 'forgotPassword';

// Helper to normalize any error into a readable message
const normalizeAuthError = (err: unknown): string => {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error_description === 'string') return obj.error_description;
    if (typeof obj.msg === 'string') return obj.msg;
    try {
      const str = JSON.stringify(obj);
      if (str && str !== '{}' && str !== '""') return str;
    } catch { /* ignore */ }
  }
  return 'Unknown error. Please try again.';
};

// Check if error is a connectivity/backend issue
const isConnectivityError = (message: string): boolean => {
  const patterns = [
    'failed to fetch',
    'fetch',
    'network',
    '503',
    'upstream connect',
    'econnreset',
    'connection',
    'timeout',
    'unavailable',
  ];
  const lower = message.toLowerCase();
  return patterns.some(p => lower.includes(p));
};

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signUp, signIn, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Redirect authenticated users
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      emailSchema.parse({ email });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0]?.message || "Please enter a valid email",
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?mode=reset`,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Check your email",
          description: "We've sent you a password reset link. Please check your inbox.",
        });
        setMode('signIn');
      }
    } catch (error) {
      console.error('Reset password error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate input
    try {
      authSchema.parse({ email, password });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0]?.message || "Please check your input",
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);

    try {
      let result;
      if (mode === 'signUp') {
        result = await signUp(email, password);
        if (!result.error) {
          toast({
            title: "Account Created!",
            description: "Welcome to AI Video Creator! You can now create amazing videos.",
          });
        }
      } else {
        result = await signIn(email, password);
        if (!result.error) {
          toast({
            title: "Welcome Back!",
            description: "Successfully signed in to your account.",
          });
        }
      }

      if (result.error) {
        const rawMessage = normalizeAuthError(result.error);
        let errorMessage: string;

        // Check for connectivity/backend issues first
        if (isConnectivityError(rawMessage)) {
          errorMessage = "Authentication service is temporarily unavailable. Please wait a moment and try again.";
        } else if (rawMessage.toLowerCase().includes('invalid login credentials')) {
          errorMessage = "Invalid email or password. Please check your credentials.";
        } else if (rawMessage.toLowerCase().includes('user already registered')) {
          errorMessage = "An account with this email already exists. Try signing in instead.";
          setMode('signIn');
        } else if (rawMessage.toLowerCase().includes('email not confirmed')) {
          errorMessage = "Please check your email and click the confirmation link.";
        } else {
          errorMessage = rawMessage;
        }

        toast({
          title: mode === 'signUp' ? "Sign Up Failed" : "Sign In Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      const rawMessage = normalizeAuthError(error);
      let errorMessage: string;

      if (isConnectivityError(rawMessage)) {
        errorMessage = "Authentication service is temporarily unavailable. Please wait a moment and try again.";
      } else {
        errorMessage = rawMessage;
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderForgotPassword = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-center flex items-center justify-center gap-2">
          <KeyRound className="w-5 h-5" />
          Reset Password
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleForgotPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Enter your email address and we'll send you a reset link
            </p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !email}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                Sending...
              </>
            ) : (
              'Send Reset Link'
            )}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setMode('signIn')}
            className="text-sm text-primary hover:underline disabled:opacity-50 flex items-center justify-center gap-1 mx-auto"
            disabled={isLoading}
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Sign In
          </button>
        </div>
      </CardContent>
    </Card>
  );

  const renderAuthForm = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-center flex items-center justify-center gap-2">
          {mode === 'signUp' ? (
            <>
              <UserPlus className="w-5 h-5" />
              Create Account
            </>
          ) : (
            <>
              <LogIn className="w-5 h-5" />
              Sign In
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={isLoading}
              minLength={6}
            />
            {mode === 'signUp' && (
              <p className="text-xs text-muted-foreground">
                Password must be at least 6 characters long
              </p>
            )}
          </div>

          {mode === 'signIn' && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => setMode('forgotPassword')}
                className="text-sm text-primary hover:underline"
                disabled={isLoading}
              >
                Forgot password?
              </button>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !email || !password}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                {mode === 'signUp' ? 'Creating Account...' : 'Signing In...'}
              </>
            ) : (
              mode === 'signUp' ? 'Create Account' : 'Sign In'
            )}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setMode(mode === 'signUp' ? 'signIn' : 'signUp')}
            className="text-sm text-primary hover:underline disabled:opacity-50"
            disabled={isLoading}
          >
            {mode === 'signUp'
              ? 'Already have an account? Sign in'
              : "Don't have an account? Sign up"}
          </button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo/Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="p-3 bg-primary rounded-full">
              <VideoIcon className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">AI Video Creator</h1>
          <p className="text-muted-foreground">
            {mode === 'signUp' 
              ? 'Create your account to get started' 
              : mode === 'forgotPassword'
              ? 'Reset your password'
              : 'Sign in to your account'}
          </p>
        </div>

        {/* Auth Form */}
        {mode === 'forgotPassword' ? renderForgotPassword() : renderAuthForm()}

        <div className="text-center text-sm text-muted-foreground">
          <p>Transform your scripts into professional videos with AI</p>
        </div>
      </div>
    </div>
  );
};

export default Auth;