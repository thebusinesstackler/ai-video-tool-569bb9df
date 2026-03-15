import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SegmentTimeline } from '@/components/testimonial/SegmentTimeline';
import { CommercialStrategist } from '@/components/testimonial/CommercialStrategist';
import { TimelinePreview } from '@/components/testimonial/TimelinePreview';
import { useTestimonialCommercial } from '@/hooks/useTestimonialCommercial';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Play, Download, ArrowLeft, Loader2, Video, Trash2, Sparkles, Film, CheckCircle2, Image } from 'lucide-react';
import { TestimonialCommercial as TestimonialCommercialType, CommercialSegment } from '@/types/testimonialCommercial';

export default function TestimonialCommercial() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  const [name, setName] = useState('Untitled Commercial');
  const [savedCommercials, setSavedCommercials] = useState<TestimonialCommercialType[]>([]);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('scenes');

  const {
    segments,
    setSegments,
    addSegment,
    updateSegment,
    deleteSegment,
    reorderSegments,
    saveCommercial,
    loadCommercial,
    generateCommercial,
    generateCharacterForSegment,
    approveAllSegments,
    isGenerating,
    generationProgress,
    currentCommercial,
    setCurrentCommercial
  } = useTestimonialCommercial();

  const handleApplyStrategy = (newSegments: CommercialSegment[], commercialName: string) => {
    setSegments(newSegments);
    setName(commercialName);
    setCurrentCommercial(null);
    setFinalVideoUrl(null);
    setActiveTab('scenes');
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
      if (data) setSavedCommercials(data as unknown as TestimonialCommercialType[]);
    }
    fetchSaved();
  }, [currentCommercial]);

  useEffect(() => {
    if (editId) loadCommercial(editId);
  }, [editId, loadCommercial]);

  useEffect(() => {
    if (currentCommercial) {
      setName(currentCommercial.name);
      if (currentCommercial.video_url) setFinalVideoUrl(currentCommercial.video_url);
    }
  }, [currentCommercial]);

  const handleSave = async () => { await saveCommercial(name); };

  const handleGenerate = async () => {
    const videoUrl = await generateCommercial();
    if (videoUrl) setFinalVideoUrl(videoUrl);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('testimonial_commercials').delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); }
    else { setSavedCommercials(prev => prev.filter(c => c.id !== id)); toast.success('Deleted'); }
  };

  const speakingSegments = segments.filter(s => s.type === 'speaking');
  const brollSegments = segments.filter(s => s.type === 'broll');
  const allApproved = speakingSegments.length > 0 && speakingSegments.every(s => s.status === 'approved' || s.status === 'complete');
  const hasCharacters = speakingSegments.some(s => s.character && s.character.referenceImages.length > 0);

  return (
    <Layout>
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              AI Commercial Creator
            </h1>
            <p className="text-sm text-muted-foreground">
              Create VEO3-powered commercials with AI-generated actors
            </p>
          </div>
          <Button onClick={handleSave} variant="outline" size="sm">
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>

        {/* AI Strategist */}
        <CommercialStrategist onApplyStrategy={handleApplyStrategy} />

        <div className="grid lg:grid-cols-4 gap-6 mt-6">
          {/* Main Editor - 3 cols */}
          <div className="lg:col-span-3 space-y-4">
            {/* Name + Timeline Preview */}
            <Card className="border-border/50">
              <CardContent className="pt-5 space-y-4">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-lg font-semibold border-none bg-transparent px-0 focus-visible:ring-0 placeholder:text-muted-foreground/40"
                  placeholder="Name your commercial..."
                />
                <TimelinePreview segments={segments} onReorder={reorderSegments} />
              </CardContent>
            </Card>

            {/* Tabs: Scenes / B-Roll */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="scenes" className="gap-2">
                  <Film className="h-4 w-4" />
                  Scenes ({speakingSegments.length})
                </TabsTrigger>
                <TabsTrigger value="broll" className="gap-2">
                  <Image className="h-4 w-4" />
                  B-Roll ({brollSegments.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="scenes" className="mt-4">
                <SegmentTimeline
                  segments={speakingSegments}
                  onUpdate={updateSegment}
                  onDelete={deleteSegment}
                  onAdd={() => addSegment('speaking')}
                  onReorder={reorderSegments}
                  onGenerateCharacter={generateCharacterForSegment}
                  segmentFilter="speaking"
                />
              </TabsContent>

              <TabsContent value="broll" className="mt-4">
                <SegmentTimeline
                  segments={brollSegments}
                  onUpdate={updateSegment}
                  onDelete={deleteSegment}
                  onAdd={() => addSegment('broll')}
                  onReorder={reorderSegments}
                  segmentFilter="broll"
                />
              </TabsContent>
            </Tabs>

            {/* Generation Controls */}
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardContent className="pt-5 space-y-4">
                {hasCharacters && !allApproved && (
                  <Button onClick={approveAllSegments} variant="outline" className="w-full gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Approve All Characters & Scenes
                  </Button>
                )}

                {isGenerating ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm font-medium">Generating commercial with VEO3...</span>
                    </div>
                    <Progress value={generationProgress} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      This may take several minutes depending on the number of scenes
                    </p>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Button
                      onClick={handleGenerate}
                      disabled={segments.length === 0 || (!allApproved && speakingSegments.length > 0)}
                      className="flex-1 gap-2"
                      size="lg"
                    >
                      <Play className="h-4 w-4" />
                      Generate Commercial
                    </Button>
                    {finalVideoUrl && (
                      <Button variant="outline" size="lg" asChild>
                        <a href={finalVideoUrl} download target="_blank" rel="noopener">
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </a>
                      </Button>
                    )}
                  </div>
                )}

                {!allApproved && speakingSegments.length > 0 && !isGenerating && (
                  <p className="text-xs text-muted-foreground text-center">
                    Generate and approve character previews before creating the commercial
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Video Preview */}
            {finalVideoUrl && (
              <Card>
                <CardHeader><CardTitle>Generated Commercial</CardTitle></CardHeader>
                <CardContent>
                  <video src={finalVideoUrl} controls className="w-full rounded-lg" />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - 1 col */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Saved Commercials
                </CardTitle>
              </CardHeader>
              <CardContent>
                {savedCommercials.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">No saved commercials</p>
                ) : (
                  <div className="space-y-2">
                    {savedCommercials.map((commercial) => (
                      <div key={commercial.id} className="flex items-center justify-between p-2 rounded-md border hover:bg-muted/50 transition-colors text-sm">
                        <button className="flex-1 text-left" onClick={() => navigate(`?edit=${commercial.id}`)}>
                          <p className="font-medium truncate">{commercial.name}</p>
                          <p className="text-xs text-muted-foreground">{commercial.segments?.length || 0} segments</p>
                        </button>
                        <div className="flex gap-1">
                          {commercial.video_url && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                              <a href={commercial.video_url} target="_blank" rel="noopener"><Download className="h-3 w-3" /></a>
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(commercial.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  How it works
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2">
                <p>1. Describe your commercial idea to the AI Strategist</p>
                <p>2. AI generates characters with 6 cinematic angles</p>
                <p>3. Preview & approve each character look</p>
                <p>4. Generate the full commercial with VEO3</p>
                <p className="text-primary/70 font-medium pt-1">No AI Twins needed — characters are created automatically!</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
