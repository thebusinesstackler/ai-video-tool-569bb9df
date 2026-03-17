import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { 
  Plus, 
  ScanFace, 
  Loader2,
  Wand2,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Database,
  WifiOff,
  LogOut
} from 'lucide-react';
import { TwinCreationWizard } from '@/components/ai-twin/TwinCreationWizard';
import { TwinCard } from '@/components/ai-twin/TwinCard';
import { TwinDetailPanel } from '@/components/ai-twin/TwinDetailPanel';

interface AITwin {
  id: string;
  user_id: string;
  name: string;
  reference_images: string[];
  voice_sample_url: string | null;
  voice_cloning_key: string | null;
  consent_audio_url: string | null;
  description: string | null;
  face_description: string | null;
  gender: string | null;
  voice_engine?: string;
  google_voice_id?: string | null;
  created_at: string;
  updated_at: string;
}

const CACHE_KEY = 'ai_twins_cache';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

interface CachedTwinsData {
  twins: AITwin[];
  savedAt: number;
}

function getCachedTwins(): AITwin[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: CachedTwinsData = JSON.parse(raw);
    if (Date.now() - parsed.savedAt > CACHE_EXPIRY_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed.twins;
  } catch {
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

function setCachedTwins(twins: AITwin[]) {
  try {
    const data: CachedTwinsData = { twins, savedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch { /* ignore quota errors */ }
}

type ErrorKind = 'connectivity' | 'auth' | 'generic';

function classifyError(error: unknown): ErrorKind {
  const msg = String(error).toLowerCase();
  if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('503') || msg.includes('timeout') || msg.includes('upstream')) {
    return 'connectivity';
  }
  if (msg.includes('jwt') || msg.includes('401') || msg.includes('auth') || msg.includes('refresh')) {
    return 'auth';
  }
  return 'generic';
}

const AITwin = () => {
  const { toast } = useToast();
  const { user, clearLocalSession, authServiceDown } = useAuth();
  const [twins, setTwins] = useState<AITwin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind>('generic');
  const [isStale, setIsStale] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedTwin, setSelectedTwin] = useState<AITwin | null>(null);
  const toastShownRef = useRef(false);
  
  // Migration state
  const [twinsWithBase64, setTwinsWithBase64] = useState<AITwin[]>([]);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [currentMigratingTwin, setCurrentMigratingTwin] = useState<string | null>(null);

  const loadTwins = useCallback(async (isUserRetry = false) => {
    if (!user?.id) {
      setTwins([]);
      setLoadError(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setLoadError(null);
      setIsStale(false);

      // Race the fetch against a timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const { data, error } = await supabase
        .from('ai_twins')
        .select('id, user_id, name, reference_images, voice_sample_url, voice_cloning_key, consent_audio_url, description, face_description, gender, voice_engine, google_voice_id, created_at, updated_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .abortSignal(controller.signal);

      clearTimeout(timeout);

      if (error) throw error;

      const twinsData = (data || []).map((twin) => ({
        ...twin,
        reference_images: twin.reference_images || []
      })) as AITwin[];

      setTwins(twinsData);
      setCachedTwins(twinsData);
      toastShownRef.current = false;
    } catch (error: any) {
      console.error('Error loading twins:', error);
      const kind = classifyError(error);
      setErrorKind(kind);

      // Fall back to cache
      const cached = getCachedTwins();
      if (cached && cached.length > 0) {
        setTwins(cached);
        setIsStale(true);
        setLoadError(null);
      } else {
        setLoadError(error.message || 'Failed to load AI Twins');
      }

      // Only toast on user-initiated retry or first failure
      if (isUserRetry || !toastShownRef.current) {
        toastShownRef.current = true;
        toast({
          title: kind === 'connectivity' ? 'Connection Issue' : 'Error',
          description: kind === 'connectivity'
            ? 'Backend is unreachable. Showing cached data if available.'
            : 'Failed to load AI Twins.',
          variant: 'destructive'
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    if (!user?.id) {
      setTwins([]);
      setLoadError(null);
      setIsLoading(false);
      return;
    }
    loadTwins();
  }, [user?.id, loadTwins]);

  // Check for twins with base64 images
  useEffect(() => {
    if (twins.length > 0) {
      const needsMigration = twins.filter(twin => 
        twin.reference_images?.some(img => img.startsWith('data:'))
      );
      setTwinsWithBase64(needsMigration);
    } else {
      setTwinsWithBase64([]);
    }
  }, [twins]);

  const migrateAllTwins = async () => {
    if (twinsWithBase64.length === 0) return;
    
    setIsMigrating(true);
    setMigrationProgress(0);
    
    let migrated = 0;
    
    for (const twin of twinsWithBase64) {
      setCurrentMigratingTwin(twin.name);
      
      try {
        const { data, error } = await supabase.functions.invoke('migrate-twin-images', {
          body: { twinId: twin.id }
        });
        
        if (error) {
          console.error(`Failed to migrate ${twin.name}:`, error);
        } else {
          console.log(`Migrated ${twin.name}:`, data);
        }
      } catch (err) {
        console.error(`Error migrating ${twin.name}:`, err);
      }
      
      migrated++;
      setMigrationProgress(Math.round((migrated / twinsWithBase64.length) * 100));
    }
    
    setIsMigrating(false);
    setCurrentMigratingTwin(null);
    
    await loadTwins();
    
    toast({
      title: 'Migration Complete',
      description: `Migrated images for ${migrated} AI Twins.`
    });
  };

  const deleteTwin = async (id: string) => {
    try {
      const { error } = await supabase
        .from('ai_twins')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTwins(prev => {
        const updated = prev.filter(t => t.id !== id);
        setCachedTwins(updated);
        return updated;
      });
      toast({ title: 'Deleted', description: 'AI Twin has been removed' });
    } catch (error: any) {
      console.error('Error deleting twin:', error);
      toast({ title: 'Error', description: 'Failed to delete AI Twin', variant: 'destructive' });
    }
  };

  const handleWizardComplete = () => {
    setShowWizard(false);
    loadTwins();
  };

  const handleClearSessionRetry = () => {
    clearLocalSession();
    window.location.reload();
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
              <ScanFace className="w-8 h-8" />
              AI Twin
            </h1>
            <p className="text-muted-foreground mt-1">
              Create digital twins with grouped reference images and cloned voices
            </p>
          </div>
          <Button 
            onClick={() => setShowWizard(true)}
            className="bg-gradient-primary hover:opacity-90"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create AI Twin
          </Button>
        </div>

        {/* Backend down banner */}
        {authServiceDown && (
          <Alert variant="destructive">
            <WifiOff className="h-4 w-4" />
            <AlertTitle>Backend Unavailable</AlertTitle>
            <AlertDescription>
              <p className="text-sm mb-3">The backend is currently unreachable. Your data is safe — try again shortly.</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => loadTwins(true)}>
                  <RefreshCw className="w-3 h-3 mr-1" /> Retry
                </Button>
                <Button size="sm" variant="ghost" onClick={handleClearSessionRetry}>
                  <LogOut className="w-3 h-3 mr-1" /> Clear Session & Retry
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Stale data indicator */}
        {isStale && !isLoading && (
          <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
            <WifiOff className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-600 dark:text-amber-400">Showing Cached Data</AlertTitle>
            <AlertDescription>
              <p className="text-sm text-muted-foreground mb-2">
                Live data couldn't be loaded. You're seeing previously loaded twins.
              </p>
              <Button size="sm" variant="outline" onClick={() => loadTwins(true)}>
                <RefreshCw className="w-3 h-3 mr-1" /> Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Migration Alert Banner */}
        {twinsWithBase64.length > 0 && !isLoading && (
          <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-600 dark:text-amber-400">
              Performance Issue Detected
            </AlertTitle>
            <AlertDescription className="mt-2">
              <p className="text-sm text-muted-foreground mb-3">
                {twinsWithBase64.length} AI Twin(s) have images stored as base64 data, which causes slow loading. 
                Migrate them to cloud storage for faster performance.
              </p>
              {isMigrating ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Migrating {currentMigratingTwin}...</span>
                  </div>
                  <Progress value={migrationProgress} className="h-2" />
                </div>
              ) : (
                <Button size="sm" onClick={migrateAllTwins} className="gap-2">
                  <Database className="h-4 w-4" />
                  Migrate All ({twinsWithBase64.length} twins)
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Main Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : loadError ? (
          <Card className="border-destructive">
            <CardContent className="flex flex-col items-center justify-center py-16">
              {errorKind === 'connectivity' ? (
                <WifiOff className="w-16 h-16 text-destructive mb-4" />
              ) : (
                <AlertCircle className="w-16 h-16 text-destructive mb-4" />
              )}
              <h3 className="text-xl font-semibold mb-2">
                {errorKind === 'connectivity' ? 'Connection Failed' : 'Failed to Load'}
              </h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                {errorKind === 'connectivity' 
                  ? 'The backend is unreachable. Your data is safe — try again in a moment.'
                  : loadError}
              </p>
              <div className="flex gap-3">
                <Button onClick={() => loadTwins(true)} variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
                {errorKind !== 'generic' && (
                  <Button onClick={handleClearSessionRetry} variant="ghost">
                    <LogOut className="w-4 h-4 mr-2" />
                    Clear Session & Retry
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : twins.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <ScanFace className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No AI Twins Yet</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Create your first AI Twin by grouping similar images from your gallery 
                and optionally cloning a voice for video generation.
              </p>
              <Button 
                onClick={() => setShowWizard(true)}
                className="bg-gradient-primary"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First AI Twin
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {twins.map((twin) => (
              <TwinCard
                key={twin.id}
                twin={twin}
                onDelete={() => deleteTwin(twin.id)}
                onSelect={() => setSelectedTwin(twin)}
              />
            ))}
          </div>
        )}

        {/* Creation Wizard Dialog */}
        <Dialog open={showWizard} onOpenChange={setShowWizard}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wand2 className="w-5 h-5" />
                Create AI Twin
              </DialogTitle>
            </DialogHeader>
            <TwinCreationWizard onComplete={handleWizardComplete} onCancel={() => setShowWizard(false)} />
          </DialogContent>
        </Dialog>

        {/* Twin Detail Dialog */}
        <Dialog open={!!selectedTwin} onOpenChange={() => setSelectedTwin(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedTwin?.name}</DialogTitle>
            </DialogHeader>
            {selectedTwin && (
              <TwinDetailPanel 
                twin={selectedTwin} 
                onUpdate={loadTwins}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default AITwin;
