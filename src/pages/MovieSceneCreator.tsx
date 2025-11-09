import React, { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, Film, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const MovieSceneCreator = () => {
  const [movieIdea, setMovieIdea] = useState('');
  const [outline, setOutline] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const generateOutline = async () => {
    if (!movieIdea.trim()) {
      toast({
        title: "Movie Idea Required",
        description: "Please describe your movie idea first.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-movie-outline', {
        body: { movieIdea }
      });

      if (error) throw error;

      setOutline(data.outline);
      toast({
        title: "Outline Generated!",
        description: "Your movie outline is ready. Review it and generate scenes.",
      });
    } catch (error: any) {
      console.error('Error generating outline:', error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate outline. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generateScenes = () => {
    if (!outline.trim()) {
      toast({
        title: "No Outline",
        description: "Generate an outline first before creating scenes.",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Coming Soon",
      description: "Scene generation will be available soon!",
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Movie Scene Creator</h1>
          <p className="text-muted-foreground">
            Describe your movie idea, get an AI-generated outline, and create scenes for your film.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Movie Idea Input */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Film className="w-5 h-5 text-primary" />
                Your Movie Idea
              </CardTitle>
              <CardDescription>
                Describe what your movie is about - genre, plot, characters, setting, etc.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="movie-idea">Movie Description</Label>
                <Textarea
                  id="movie-idea"
                  placeholder="Example: A sci-fi thriller about a detective who discovers she's living in a simulated reality. She must navigate between the real world and the simulation to uncover who trapped humanity in this digital prison..."
                  value={movieIdea}
                  onChange={(e) => setMovieIdea(e.target.value)}
                  rows={12}
                  className="resize-none"
                />
              </div>
              <Button
                onClick={generateOutline}
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                    Generating Outline...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Movie Outline
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Generated Outline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Generated Outline
              </CardTitle>
              <CardDescription>
                AI-generated movie structure with act breakdowns and key scenes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="outline">Outline</Label>
                <Textarea
                  id="outline"
                  placeholder="Your movie outline will appear here after generation..."
                  value={outline}
                  onChange={(e) => setOutline(e.target.value)}
                  rows={12}
                  className="resize-none"
                />
              </div>
              <Button
                onClick={generateScenes}
                disabled={!outline.trim()}
                className="w-full"
                variant="secondary"
              >
                <ChevronRight className="w-4 h-4 mr-2" />
                Generate Scenes from Outline
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Info Card */}
        <Card className="bg-gradient-accent border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">How It Works</h3>
                <ol className="text-sm text-muted-foreground space-y-2">
                  <li><strong>1. Describe Your Movie:</strong> Write about your plot, characters, genre, and setting.</li>
                  <li><strong>2. Generate Outline:</strong> AI creates a structured outline with acts, sequences, and key scenes.</li>
                  <li><strong>3. Create Scenes:</strong> Transform outline beats into detailed scenes ready for video generation.</li>
                  <li><strong>4. Generate Videos:</strong> Use each scene with keyframe technology to bring your movie to life.</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default MovieSceneCreator;
