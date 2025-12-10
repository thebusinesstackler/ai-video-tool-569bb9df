import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useImageGallery } from '@/hooks/useImageGallery';
import { 
  Plus, 
  Trash2, 
  Mic, 
  Upload, 
  Play, 
  Pause, 
  ScanFace, 
  ImageIcon, 
  Volume2,
  Loader2,
  Check,
  X,
  Wand2
} from 'lucide-react';
import { TwinCreationWizard } from '@/components/ai-twin/TwinCreationWizard';
import { TwinCard } from '@/components/ai-twin/TwinCard';

interface AITwin {
  id: string;
  user_id: string;
  name: string;
  reference_images: string[];
  voice_sample_url: string | null;
  voice_cloning_key: string | null;
  description: string | null;
  face_description: string | null;
  created_at: string;
  updated_at: string;
}

const AITwin = () => {
  const { toast } = useToast();
  const [twins, setTwins] = useState<AITwin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedTwin, setSelectedTwin] = useState<AITwin | null>(null);

  useEffect(() => {
    loadTwins();
  }, []);

  const loadTwins = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('ai_twins')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTwins((data as AITwin[]) || []);
    } catch (error: any) {
      console.error('Error loading twins:', error);
      toast({
        title: 'Error',
        description: 'Failed to load AI Twins',
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
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{selectedTwin?.name}</DialogTitle>
            </DialogHeader>
            {selectedTwin && (
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium mb-3">Reference Images ({selectedTwin.reference_images?.length || 0})</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {selectedTwin.reference_images?.map((img, idx) => (
                      <img 
                        key={idx}
                        src={img}
                        alt={`Reference ${idx + 1}`}
                        className="w-full aspect-square object-cover rounded-lg"
                      />
                    ))}
                  </div>
                </div>

                {selectedTwin.description && (
                  <div>
                    <h4 className="font-medium mb-2">Description</h4>
                    <p className="text-muted-foreground">{selectedTwin.description}</p>
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <Badge variant={selectedTwin.voice_cloning_key ? "default" : "secondary"}>
                    <Volume2 className="w-3 h-3 mr-1" />
                    {selectedTwin.voice_cloning_key ? "Voice Cloned" : "No Voice Clone"}
                  </Badge>
                  <Badge variant="outline">
                    <ImageIcon className="w-3 h-3 mr-1" />
                    {selectedTwin.reference_images?.length || 0} Images
                  </Badge>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default AITwin;
