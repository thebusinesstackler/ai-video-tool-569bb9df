import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { SettingsIcon, ShieldCheckIcon, ServerIcon, Volume2, Clapperboard, UserIcon, Loader2 } from 'lucide-react';
import { TransferAssetsDialog } from '@/components/TransferAssetsDialog';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';

const VOICE_PRESETS = [
  { value: 'default', label: '🎬 Director (Default)', description: 'Warm, confident, conversational' },
  { value: 'british', label: '🇬🇧 British', description: 'Refined, authoritative tone' },
  { value: 'deep', label: '🎙️ Deep Voice', description: 'Low, rich, cinematic feel' },
  { value: 'female', label: '👩 Female Director', description: 'Sharp, confident, creative lead' },
];

const Settings = () => {
  const { user } = useAuth();
  const [voicePreset, setVoicePreset] = useState(() => {
    try { return localStorage.getItem('loop-ai-voice-preset') || 'default'; } catch { return 'default'; }
  });

  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    company_name: '',
    brand_description: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, phone, company_name, brand_description')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setProfile({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          phone: data.phone || '',
          company_name: data.company_name || '',
          brand_description: data.brand_description || '',
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          ...profile,
        }, { onConflict: 'user_id' });

      if (error) throw error;
      toast.success('Profile saved successfully!');
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast.error(error.message || 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleVoiceChange = (value: string) => {
    setVoicePreset(value);
    localStorage.setItem('loop-ai-voice-preset', value);
    toast.success(`Loop AI voice set to ${VOICE_PRESETS.find(p => p.value === value)?.label}`);

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const previewLines: Record<string, string> = {
        default: "Alright, looking good — let me handle the rest—",
        british: "Right then — let's craft something brilliant, shall we—",
        deep: "Let's build something legendary — trust the process—",
        female: "Listen up — this is going to be our best work yet—",
      };
      const utterance = new SpeechSynthesisUtterance(previewLines[value] || previewLines.default);
      const voices = window.speechSynthesis.getVoices();
      const presets: Record<string, { nameHints: string[]; rate: number; pitch: number }> = {
        default: { nameHints: ['Google US English', 'Alex', 'Aaron', 'Male'], rate: 1.0, pitch: 1.0 },
        british: { nameHints: ['Google UK English Male', 'Daniel', 'James'], rate: 1.05, pitch: 0.95 },
        deep: { nameHints: ['Google UK English Male', 'Daniel', 'Rishi', 'Male'], rate: 0.92, pitch: 0.8 },
        female: { nameHints: ['Google UK English Female', 'Karen', 'Samantha', 'Victoria', 'Female'], rate: 1.0, pitch: 1.1 },
      };
      const p = presets[value] || presets.default;
      const voice = voices.find(v => p.nameHints.some(h => v.name.includes(h))) || voices.find(v => v.lang.startsWith('en'));
      if (voice) utterance.voice = voice;
      utterance.rate = p.rate;
      utterance.pitch = p.pitch;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Platform configuration and preferences.
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profile Settings */}
          <Card className="glass border-primary/20 lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <UserIcon className="w-5 h-5 text-primary" />
                Your Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Sign-in Email</Label>
                      <Input
                        id="email"
                        value={user?.email || ''}
                        readOnly
                        disabled
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="first_name">First Name</Label>
                      <Input
                        id="first_name"
                        placeholder="Your first name"
                        value={profile.first_name}
                        onChange={(e) => setProfile(p => ({ ...p, first_name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Last Name</Label>
                      <Input
                        id="last_name"
                        placeholder="Your last name"
                        value={profile.last_name}
                        onChange={(e) => setProfile(p => ({ ...p, last_name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        placeholder="+1 (555) 000-0000"
                        value={profile.phone}
                        onChange={(e) => setProfile(p => ({ ...p, phone: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company_name">Company Name</Label>
                      <Input
                        id="company_name"
                        placeholder="Your company or brand name"
                        value={profile.company_name}
                        onChange={(e) => setProfile(p => ({ ...p, company_name: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brand_description">Brand Description</Label>
                    <Textarea
                      id="brand_description"
                      placeholder="Describe your brand, products, and target audience..."
                      rows={3}
                      value={profile.brand_description}
                      onChange={(e) => setProfile(p => ({ ...p, brand_description: e.target.value }))}
                    />
                  </div>
                  <Button onClick={saveProfile} disabled={isSaving}>
                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Save Profile
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Loop AI Voice Settings */}
          <Card className="glass border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Clapperboard className="w-5 h-5 text-primary" />
                Loop AI Director Voice
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Choose how your AI Director sounds when speaking. Click a voice to hear a preview.
                </p>
                <div className="space-y-2">
                  {VOICE_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => handleVoiceChange(preset.value)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        voicePreset === preset.value
                          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                          : 'border-border hover:border-primary/30 hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{preset.label}</p>
                          <p className="text-xs text-muted-foreground">{preset.description}</p>
                        </div>
                        {voicePreset === preset.value && (
                          <Volume2 className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Tip: Click the speaker icon while Loop AI is talking to interrupt him.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <ShieldCheckIcon className="w-5 h-5 text-green-500" />
                Security Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm">
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-200">API Keys Secured</p>
                    <p className="text-green-600 dark:text-green-300">All API keys are stored server-side</p>
                  </div>
                  <ShieldCheckIcon className="w-5 h-5 text-green-500" />
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium text-foreground">Configured Services:</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• WaveSpeed AI (Video & Voice)</li>
                    <li>• Lovable AI (Script & Strategy)</li>
                    <li>• Creatomate (Video Stitching)</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <ServerIcon className="w-5 h-5 text-primary" />
                Backend Integration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>Backend services powered by Lovable Cloud:</p>
                <ul className="space-y-1">
                  <li>• AI Script & Strategy Generation</li>
                  <li>• Character Image Generation</li>
                  <li>• Text-to-Speech (WaveSpeed HD)</li>
                  <li>• Video Generation & Stitching</li>
                  <li>• File Storage & Persistence</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <SettingsIcon className="w-5 h-5 text-primary" />
                Platform Info
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-muted-foreground">
                <p>Current capabilities:</p>
                <ul className="space-y-2">
                  <li>• Background Music Generation (via Reels)</li>
                  <li>• AI Twin Voice Cloning</li>
                  <li>• Testimonial Ad Builder</li>
                  <li>• Movie Scene Creator</li>
                  <li>• Video Hook Engine</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;
