import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Plus, 
  ScanFace, 
  Loader2,
  Wand2,
  RefreshCw,
  AlertCircle
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
  description: string | null;
  face_description: string | null;
  gender: string | null;
  created_at: string;
  updated_at: string;
}

const AITwin = () => {
  const { toast } = useToast();
  const [twins, setTwins] = useState<AITwin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedTwin, setSelectedTwin] = useState<AITwin | null>(null);

  useEffect(() => {
    loadTwins();
  }, []);

  const loadTwins = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const { data, error } = await supabase
        .from('ai_twins')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTwins((data as AITwin[]) || []);
    } catch (error: any) {
      console.error('Error loading twins:', error);
      setLoadError(error.message || 'Failed to load AI Twins');
      toast({
        title: 'Error',
        description: 'Failed to load AI Twins. Click retry to try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTwin = async (id: string) => {
    try {
      const { error } = await supabase
        .from('ai_twins')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTwins(prev => prev.filter(t => t.id !== id));
      toast({
        title: 'Deleted',
        description: 'AI Twin has been removed'
      });
    } catch (error: any) {
      console.error('Error deleting twin:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete AI Twin',
        variant: 'destructive'
      });
    }
  };

  const handleWizardComplete = () => {
    setShowWizard(false);
    loadTwins();
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

        {/* Main Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : loadError ? (
          <Card className="border-destructive">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <AlertCircle className="w-16 h-16 text-destructive mb-4" />
              <h3 className="text-xl font-semibold mb-2">Failed to Load</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                {loadError}
              </p>
              <Button onClick={loadTwins} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
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
