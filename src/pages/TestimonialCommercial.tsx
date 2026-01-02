import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { SegmentTimeline } from '@/components/testimonial/SegmentTimeline';
import { CommercialStrategist } from '@/components/testimonial/CommercialStrategist';
import { TimelinePreview } from '@/components/testimonial/TimelinePreview';
import { useTestimonialCommercial } from '@/hooks/useTestimonialCommercial';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Play, Download, ArrowLeft, Loader2, Video, Trash2, Sparkles, User, Film, Users, Clapperboard } from 'lucide-react';
import { TestimonialCommercial as TestimonialCommercialType, CommercialSegment } from '@/types/testimonialCommercial';
import { testimonialExamples } from '@/data/testimonialExamples';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const templateIcons: Record<string, React.ReactNode> = {
  'simple-testimonial': <User className="h-4 w-4" />,
  'testimonial-broll': <Film className="h-4 w-4" />,
  'multi-twin': <Users className="h-4 w-4" />,
  'full-production': <Clapperboard className="h-4 w-4" />,
};

export default function TestimonialCommercial() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  const [name, setName] = useState('Untitled Commercial');
  const [savedCommercials, setSavedCommercials] = useState<TestimonialCommercialType[]>([]);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);

  const {
    segments,
    setSegments,
    addSegment,
    updateSegment,
    deleteSegment,
    reorderSegments,
    saveCommercial,
    loadCommercial,
    loadExampleTemplate,
    generateCommercial,
    isGenerating,
    generationProgress,
    currentCommercial,
    setCurrentCommercial
  } = useTestimonialCommercial();

  const handleLoadExample = async (templateId: string) => {
    const result = await loadExampleTemplate(templateId);
    if (result.success && result.name) {
      setName(result.name);
    }
  };

  const handleApplyStrategy = (newSegments: CommercialSegment[], commercialName: string) => {
    setSegments(newSegments);
    setName(commercialName);
    setCurrentCommercial(null); // Reset since this is a new commercial
    setFinalVideoUrl(null);
  };

  const handleGenerateBrollImages = async (segments: CommercialSegment[]) => {
    // Generate images for B-roll segments
    for (const segment of segments) {
      if ((segment.type === 'broll-voice-continue' || segment.type === 'broll-montage') && segment.brollPrompts && segment.brollPrompts.length > 0) {
        const generatedImages: string[] = [];
        
        for (const prompt of segment.brollPrompts) {
          try {
            const { data, error } = await supabase.functions.invoke('generate-scene-image', {
              body: { prompt, aspectRatio: '16:9' }
            });

            if (error) throw error;
            if (data?.imageUrl) {
              generatedImages.push(data.imageUrl);
            }
          } catch (err) {
            console.error('Failed to generate B-roll image:', err);
          }
        }

        if (generatedImages.length > 0) {
          updateSegment(segment.id, { brollImages: generatedImages });
        }
      }
    }
  };

  // Load saved commercials
  useEffect(() => {
    async function fetchSaved() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('testimonial_commercials')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (data) {
        setSavedCommercials(data as unknown as TestimonialCommercialType[]);
      }
    }
    fetchSaved();
  }, [currentCommercial]);

  // Load commercial for editing
  useEffect(() => {
    if (editId) {
      loadCommercial(editId);
    }
  }, [editId, loadCommercial]);

  // Update name when commercial is loaded
  useEffect(() => {
    if (currentCommercial) {
      setName(currentCommercial.name);
      if (currentCommercial.video_url) {
        setFinalVideoUrl(currentCommercial.video_url);
      }
    }
  }, [currentCommercial]);

  const handleSave = async () => {
    await saveCommercial(name);
  };

  const handleGenerate = async () => {
    const videoUrl = await generateCommercial();
    if (videoUrl) {
      setFinalVideoUrl(videoUrl);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('testimonial_commercials')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete');
    } else {
      setSavedCommercials(prev => prev.filter(c => c.id !== id));
      toast.success('Deleted');
    }
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Testimonial Commercial Creator</h1>
            <p className="text-muted-foreground">
              Create commercials with AI Twin testimonials, B-roll, and montages
            </p>
          </div>
        </div>

        {/* AI Commercial Strategist */}
        <CommercialStrategist 
          onApplyStrategy={handleApplyStrategy} 
          onGenerateBrollImages={handleGenerateBrollImages}
        />

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Editor */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="text-lg font-semibold max-w-md"
                    placeholder="Commercial name..."
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">
                        <Sparkles className="h-4 w-4 mr-2" />
                        Examples
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-72 bg-popover">
                      {testimonialExamples.map((template) => (
                        <DropdownMenuItem
                          key={template.id}
                          onClick={() => handleLoadExample(template.id)}
                          className="flex flex-col items-start py-3 cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            {templateIcons[template.id]}
                            <span className="font-medium">{template.name}</span>
                          </div>
                          <span className="text-xs text-muted-foreground pl-6">
                            {template.description}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button onClick={handleSave} variant="outline">
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <SegmentTimeline
                  segments={segments}
                  onUpdate={updateSegment}
                  onDelete={deleteSegment}
                  onAdd={addSegment}
                  onReorder={reorderSegments}
                />
              </CardContent>
            </Card>

            {/* Timeline Preview & Generation Controls */}
            <Card>
              <CardContent className="pt-6 space-y-6">
                {/* Visual Timeline Preview with drag-and-drop */}
                <TimelinePreview segments={segments} onReorder={reorderSegments} />

                {isGenerating ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Generating commercial...</span>
                    </div>
                    <Progress value={generationProgress} />
                    <p className="text-sm text-muted-foreground">
                      This may take several minutes depending on the number of segments
                    </p>
                  </div>
                ) : (
                  <div className="flex gap-4">
                    <Button 
                      onClick={handleGenerate} 
                      disabled={segments.length === 0}
                      className="flex-1"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Generate Commercial
                    </Button>
                    {finalVideoUrl && (
                      <Button variant="outline" asChild>
                        <a href={finalVideoUrl} download target="_blank" rel="noopener">
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </a>
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Video Preview */}
            {finalVideoUrl && (
              <Card>
                <CardHeader>
                  <CardTitle>Generated Commercial</CardTitle>
                </CardHeader>
                <CardContent>
                  <video
                    src={finalVideoUrl}
                    controls
                    className="w-full rounded-lg"
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Saved Commercials Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  Saved Commercials
                </CardTitle>
                <CardDescription>
                  Your previous testimonial commercials
                </CardDescription>
              </CardHeader>
              <CardContent>
                {savedCommercials.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No saved commercials yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {savedCommercials.map((commercial) => (
                      <div
                        key={commercial.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <button
                          className="flex-1 text-left"
                          onClick={() => navigate(`?edit=${commercial.id}`)}
                        >
                          <p className="font-medium truncate">{commercial.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {commercial.segments?.length || 0} segments
                          </p>
                        </button>
                        <div className="flex gap-1">
                          {commercial.video_url && (
                            <Button variant="ghost" size="icon" asChild>
                              <a href={commercial.video_url} target="_blank" rel="noopener">
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(commercial.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tips Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Tips</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>• Start with an AI Twin speaking segment for impact</p>
                <p>• Use B-roll overlays while voice continues</p>
                <p>• End with a montage of quick product shots</p>
                <p>• Fade-in transitions work best for talking heads</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
