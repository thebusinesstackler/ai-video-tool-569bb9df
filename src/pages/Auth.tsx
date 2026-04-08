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
import { Mail, Lock, UserPlus, LogIn, KeyRound, ArrowLeft, Phone, Building2, User as UserIcon } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import logoLight from '@/assets/logo-light.png';
import logoDark from '@/assets/logo-dark.png';

const emailSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
});

const authSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

type AuthMode = 'signIn' | 'signUp' | 'forgotPassword';

const CONTENT_GOALS = [
  'AI Twins',
  'AI Spokesperson',
  'Facebook Ads',
  'Video Reels',
  'AI Movies',
] as const;

// Helper to normalize any error into a readable message
const normalizeAuthError = (err: unknown): string => {
  const fallback = 'Unknown error. Please try again.';
  if (typeof err === 'string') return err.trim() || fallback;
  if (err instanceof Error) {
    const msg = (err.message ?? '').trim();
    if (msg) return msg;
    const anyErr = err as any;
    if (typeof anyErr?.status === 'number') return `Request failed (${anyErr.status})`;
    if (typeof anyErr?.code === 'string' && anyErr.code.trim()) return anyErr.code.trim();
    return fallback;
  }
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    for (const c of [obj.message, obj.error_description, obj.msg, obj.error]) {
      if (typeof c === 'string' && c.trim()) return c.trim();
    }
    if (typeof obj.status === 'number') return `Request failed (${obj.status})`;
    try { const s = JSON.stringify(obj); if (s && s !== '{}') return s; } catch {}
  }
  return fallback;
};

const isConnectivityError = (message: string): boolean => {
  const patterns = ['failed to fetch', 'network', '503', 'upstream connect', 'econnreset', 'connection', 'timeout', 'service unavailable'];
  const lower = message.toLowerCase();
  return patterns.some((p) => lower.includes(p));
};

import { isDevPreview } from '@/lib/devBypass';

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { signUp, signIn, user, authServiceDown } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (isDevPreview || user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const toggleGoal = (goal: string) => {
    setSelectedGoals(prev =>
      prev.includes(goal) ? prev.filter(g => g !== goal) : [...prev, goal]
    );
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try { emailSchema.parse({ email }); } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ title: "Validation Error", description: error.errors[0]?.message || "Please enter a valid email", variant: "destructive" });
        return;
      }
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?mode=reset`,
      });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Check your email", description: "We've sent you a password reset link. Please check your inbox." });
        setMode('signIn');
      }
    } catch (error) {
      toast({ title: "Error", description: "An unexpected error occurred. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { authSchema.parse({ email, password }); } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ title: "Validation Error", description: error.errors[0]?.message || "Please check your input", variant: "destructive" });
        return;
      }
    }

    if (mode === 'signUp') {
      if (!firstName.trim()) {
        toast({ title: "Validation Error", description: "Please enter your first name", variant: "destructive" });
        return;
      }
      if (!companyName.trim()) {
        toast({ title: "Validation Error", description: "Please enter your company name", variant: "destructive" });
        return;
      }
      if (selectedGoals.length === 0) {
        toast({ title: "Validation Error", description: "Please select at least one content goal", variant: "destructive" });
        return;
      }
    }

    setIsLoading(true);
    try {
      let result;
      if (mode === 'signUp') {
        result = await signUp(email, password);
        if (!result.error) {
          // Save profile data — the trigger creates the profile row, so we update it
          const userId = result.data?.user?.id;
          if (userId) {
            await supabase.from('profiles').update({
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              company_name: companyName.trim(),
              phone: phone.trim() || null,
              content_goal: selectedGoals.join(', '),
            }).eq('user_id', userId);
          }
          toast({ title: "Account Created!", description: "Please check your email to confirm your account before signing in." });
        }
      } else {
        result = await signIn(email, password);
        if (!result.error) {
          toast({ title: "Welcome Back!", description: "Successfully signed in to your account." });
        }
      }

      if (result.error) {
        const rawMessage = normalizeAuthError(result.error);
        let errorMessage: string;
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
        toast({ title: mode === 'signUp' ? "Sign Up Failed" : "Sign In Failed", description: errorMessage, variant: "destructive" });
      }
    } catch (error) {
      const rawMessage = normalizeAuthError(error);
      const errorMessage = isConnectivityError(rawMessage)
        ? "Authentication service is temporarily unavailable. Please wait a moment and try again."
        : rawMessage;
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // We need access to signUp return data — update AuthProvider's signUp to return data
  // For now, we'll listen for auth state change to update profile

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
              <Mail className="w-4 h-4" /> Email
            </Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required disabled={isLoading} />
            <p className="text-xs text-muted-foreground">Enter your email address and we'll send you a reset link</p>
          </div>
          <Button type="submit" className="w-full" disabled={isLoading || !email}>
            {isLoading ? (<><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />Sending...</>) : 'Send Reset Link'}
          </Button>
        </form>
        <div className="mt-4 text-center">
          <button type="button" onClick={() => setMode('signIn')} className="text-sm text-primary hover:underline flex items-center justify-center gap-1 mx-auto" disabled={isLoading}>
            <ArrowLeft className="w-3 h-3" /> Back to Sign In
          </button>
        </div>
      </CardContent>
    </Card>
  );

  const renderAuthForm = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-center flex items-center justify-center gap-2">
          {mode === 'signUp' ? (<><UserPlus className="w-5 h-5" /> Create Account</>) : (<><LogIn className="w-5 h-5" /> Sign In</>)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signUp' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4" /> First Name *
                  </Label>
                  <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" required disabled={isLoading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" disabled={isLoading} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyName" className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" /> Company Name *
                </Label>
                <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Your company" required disabled={isLoading} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="w-4 h-4" /> Phone Number
                </Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" disabled={isLoading} />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="w-4 h-4" /> Email *
            </Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required disabled={isLoading} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="flex items-center gap-2">
              <Lock className="w-4 h-4" /> Password *
            </Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required disabled={isLoading} minLength={6} />
            {mode === 'signUp' && <p className="text-xs text-muted-foreground">Password must be at least 6 characters long</p>}
          </div>

          {mode === 'signUp' && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">What are you looking to create? *</Label>
              <div className="grid grid-cols-2 gap-2">
                {CONTENT_GOALS.map((goal) => (
                  <label
                    key={goal}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all text-sm ${
                      selectedGoals.includes(goal)
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border hover:border-primary/40 text-muted-foreground'
                    }`}
                  >
                    <Checkbox
                      checked={selectedGoals.includes(goal)}
                      onCheckedChange={() => toggleGoal(goal)}
                      disabled={isLoading}
                    />
                    {goal}
                  </label>
                ))}
              </div>
            </div>
          )}

          {mode === 'signIn' && (
            <div className="text-right">
              <button type="button" onClick={() => setMode('forgotPassword')} className="text-sm text-primary hover:underline" disabled={isLoading}>
                Forgot password?
              </button>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading || !email || !password}>
            {isLoading ? (<><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />{mode === 'signUp' ? 'Creating Account...' : 'Signing In...'}</>) : (mode === 'signUp' ? 'Create Account' : 'Sign In')}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <button type="button" onClick={() => setMode(mode === 'signUp' ? 'signIn' : 'signUp')} className="text-sm text-primary hover:underline disabled:opacity-50" disabled={isLoading}>
            {mode === 'signUp' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-[240px]">
              <img src={logoDark} alt="Video AI Pro" className="w-full object-contain hidden dark:block" />
              <img src={logoLight} alt="Video AI Pro" className="w-full object-contain dark:hidden" />
            </div>
          </div>
          <p className="text-muted-foreground">
            {mode === 'signUp'
              ? 'Create your account to get started'
              : mode === 'forgotPassword'
              ? 'Reset your password'
              : 'Sign in to your account'}
          </p>
        </div>

        {authServiceDown && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-center gap-3">
            <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
            <p className="text-sm text-destructive">Authentication service is temporarily unavailable. Please try again later.</p>
          </div>
        )}

        {mode === 'forgotPassword' ? renderForgotPassword() : renderAuthForm()}

        <div className="text-center text-sm text-muted-foreground">
          <p>Transform your scripts into professional videos with AI</p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
