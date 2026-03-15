import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SegmentTimeline } from '@/components/testimonial/SegmentTimeline';
import { LoopAIDirector } from '@/components/testimonial/LoopAIDirector';
import { TimelinePreview } from '@/components/testimonial/TimelinePreview';
import { useTestimonialCommercial } from '@/hooks/useTestimonialCommercial';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Play, Download, ArrowLeft, Loader2, Video, Trash2, Film, CheckCircle2, Image, Clapperboard, PanelLeftClose, PanelLeftOpen, MessageSquare, Clock, Eye } from 'lucide-react';
import { TestimonialCommercial as TestimonialCommercialType, CommercialSegment } from '@/types/testimonialCommercial';
import { cn } from '@/lib/utils';
import { SavedCommercialsDrawer } from '@/components/testimonial/SavedCommercialsDrawer';
import { StoryboardPreview } from '@/components/testimonial/StoryboardPreview';

export default function TestimonialCommercial() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  const [name, setName] = useState('Untitled Commercial');
  const [savedCommercials, setSavedCommercials] = useState<TestimonialCommercialType[]>([]);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('scenes');
  const [targetDuration, setTargetDuration] = useState('30');
  const [chatOpen, setChatOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);

  const {
    segments,
    setSegments,
    addSegment,
    updateSegment,
    deleteSegment,
    duplicateSegment,
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
    if (commercialName) setName(commercialName);
    setCurrentCommercial(null);
    setFinalVideoUrl(null);
    setActiveTab('scenes');
  };

  const handleSaveToDb = async () => {
    await saveCommercial(name);
  };

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
    if (error) toast.error('Failed to delete');
    else { setSavedCommercials(prev => prev.filter(c => c.id !== id)); toast.success('Deleted'); }
  };

  const generateBrollPreview = useCallback(async (segmentId: string, prompt: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-scene-image', {
        body: { prompt, aspectRatio: '16:9' }
      });
      if (error) throw error;
      if (data?.imageUrl) {
        updateSegment(segmentId, { brollImages: [data.imageUrl], status: 'character-ready' });
      } else {
        updateSegment(segmentId, { status: 'pending' });
      }
    } catch (err) {
      console.error('B-roll preview generation failed:', err);
      updateSegment(segmentId, { status: 'pending' });
    }
  }, [updateSegment]);

  const [isSuggestingScene, setIsSuggestingScene] = useState(false);

  const handleSmartAddScene = useCallback(async (type: 'speaking' | 'broll') => {
    if (segments.length === 0) {
      addSegment(type);
      return;
    }

    setIsSuggestingScene(true);
    try {
      const segmentSummary = segments.map((s, i) => {
        if (s.type === 'speaking') return `Scene ${i+1}: SPEAKING — "${(s.script || '').slice(0, 100)}"`;
        return `Scene ${i+1}: B-ROLL — "${(s.brollPrompts?.[0] || '').slice(0, 100)}"`;
      }).join('\n');

      const { data, error } = await supabase.functions.invoke('ai', {
        body: {
          messages: [{
            role: 'user',
            content: `You are a commercial director. Given this storyboard:\n${segmentSummary}\n\nSuggest ONE new ${type} segment that fits cohesively. Return ONLY valid JSON:\n${type === 'speaking'
              ? '{"script":"TTS-ready script using em dashes and ellipses, never periods","characterDescription":"Vivid actor description","duration":8}'
              : '{"brollPrompts":["Cinematic B-roll description"],"voiceoverText":"Optional narration","duration":5}'}`
          }],
          model: 'google/gemini-2.5-flash',
        }
      });

      if (error) throw error;

      const text = data?.choices?.[0]?.message?.content || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const suggestion = JSON.parse(jsonMatch[0]);
        if (type === 'speaking') {
          addSegment('speaking', {
            script: suggestion.script || '',
            duration: suggestion.duration || 8,
            character: suggestion.characterDescription ? {
              name: suggestion.characterDescription.slice(0, 60),
              description: suggestion.characterDescription,
              referenceImages: [],
            } : undefined,
          });
        } else {
          const brollPrompt = suggestion.brollPrompts?.[0] || '';
          const newSeg = addSegment('broll', {
            brollPrompts: suggestion.brollPrompts || [''],
            voiceoverText: suggestion.voiceoverText || '',
            duration: suggestion.duration || 5,
            status: brollPrompt ? 'generating-character' : 'pending',
          });
          // Auto-generate B-roll preview image
          if (brollPrompt && newSeg) {
            generateBrollPreview(newSeg.id, brollPrompt);
          }
        }
        toast.success(`AI suggested a new ${type === 'speaking' ? 'scene' : 'B-roll'} — edit it to your liking`);
      } else {
        addSegment(type);
      }
    } catch (err) {
      console.error('Smart add failed:', err);
      addSegment(type);
    } finally {
      setIsSuggestingScene(false);
    }
  }, [segments, addSegment]);

  const speakingSegments = segments.filter(s => s.type === 'speaking');
  const brollSegments = segments.filter(s => s.type === 'broll');
  const allApproved = speakingSegments.length > 0 && speakingSegments.every(s => s.status === 'approved' || s.status === 'complete');
  const hasCharacters = speakingSegments.some(s => s.character && s.character.referenceImages.length > 0);

  return (
    <Layout>
      <div className="h-[calc(100vh-64px)] flex flex-col">
        {/* Compact Header */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border/50 bg-background/95 backdrop-blur shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Clapperboard className="h-4 w-4 text-primary shrink-0" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-sm font-semibold bg-transparent border-none outline-none flex-1 min-w-0 placeholder:text-muted-foreground/40"
              placeholder="Commercial name..."
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={() => setChatOpen(!chatOpen)}
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              title={chatOpen ? 'Hide Loop AI' : 'Show Loop AI'}
            >
              {chatOpen ? <PanelLeftClose className="h-3 w-3" /> : <PanelLeftOpen className="h-3 w-3" />}
              <MessageSquare className="h-3 w-3" />
            </Button>
            <Button
              onClick={() => {
                setSegments([]);
                setCurrentCommercial(null);
                setName('Untitled Commercial');
                setFinalVideoUrl(null);
                setActiveTab('scenes');
              }}
              variant="outline"
              size="sm"
              className="h-7 text-xs"
            >
              <Film className="h-3 w-3 mr-1" /> New
            </Button>
            <SavedCommercialsDrawer
              onLoad={(id) => navigate(`?edit=${id}`)}
              refreshTrigger={currentCommercial}
            />
            <Button onClick={handleSave} variant="outline" size="sm" className="h-7 text-xs">
              <Save className="h-3 w-3 mr-1" /> Save
            </Button>
            {finalVideoUrl && (
              <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                <a href={finalVideoUrl} download target="_blank" rel="noopener">
                  <Download className="h-3 w-3 mr-1" /> Download
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Main Split Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Loop AI Director Chat — collapsible */}
          <div
            className={cn(
              'shrink-0 border-r border-border/50 flex flex-col bg-muted/20 transition-all duration-300 overflow-hidden',
              chatOpen ? 'w-[420px]' : 'w-0 border-r-0'
            )}
          >
            {chatOpen && (
              <LoopAIDirector
                onApplyStrategy={handleApplyStrategy}
                onUpdateSegment={updateSegment}
                onAddSegment={addSegment}
                onDeleteSegment={deleteSegment}
                onGenerateCharacter={generateCharacterForSegment}
                onGenerateBrollPreview={generateBrollPreview}
                onSaveToDb={handleSaveToDb}
                segments={segments}
                targetDuration={targetDuration}
                onTargetDurationChange={setTargetDuration}
              />
            )}
          </div>

          {/* Right: Preview & Production Panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Timeline Preview */}
            {segments.length > 0 && (
              <div className="px-4 py-3 border-b border-border/50 bg-background/50 shrink-0">
                <TimelinePreview segments={segments} onReorder={reorderSegments} />
              </div>
            )}

            {/* Duration Summary */}
            {segments.length > 0 && (
              <div className="px-4 pt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Film className="h-3 w-3" /> {segments.length} segments</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {segments.reduce((s, seg) => s + seg.duration, 0)}s total</span>
                <span>~{Math.ceil(segments.length * 1.5)} min to generate</span>
              </div>
            )}

            {/* Tabs */}
            <div className="flex-1 overflow-auto p-4">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full grid grid-cols-3 mb-4">
                  <TabsTrigger value="scenes" className="gap-1 text-xs">
                    <Film className="h-3 w-3" /> Scenes ({speakingSegments.length})
                  </TabsTrigger>
                  <TabsTrigger value="broll" className="gap-1 text-xs">
                    <Image className="h-3 w-3" /> B-Roll ({brollSegments.length})
                  </TabsTrigger>
                  <TabsTrigger value="saved" className="gap-1 text-xs">
                    <Video className="h-3 w-3" /> Saved ({savedCommercials.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="scenes">
                  <SegmentTimeline
                    segments={speakingSegments}
                    onUpdate={updateSegment}
                    onDelete={deleteSegment}
                    onDuplicate={duplicateSegment}
                    onAdd={() => handleSmartAddScene('speaking')}
                    onReorder={reorderSegments}
                    onGenerateCharacter={generateCharacterForSegment}
                    segmentFilter="speaking"
                    isAddingScene={isSuggestingScene}
                  />
                </TabsContent>

                <TabsContent value="broll">
                  <SegmentTimeline
                    segments={brollSegments}
                    onUpdate={updateSegment}
                    onDelete={deleteSegment}
                    onDuplicate={duplicateSegment}
                    onAdd={() => handleSmartAddScene('broll')}
                    onReorder={reorderSegments}
                    segmentFilter="broll"
                    isAddingScene={isSuggestingScene}
                  />
                </TabsContent>

                <TabsContent value="saved">
                  {savedCommercials.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">No saved commercials</div>
                  ) : (
                    <div className="space-y-2">
                      {savedCommercials.map((c) => (
                        <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                          <button className="flex-1 text-left" onClick={() => navigate(`?edit=${c.id}`)}>
                            <p className="text-sm font-medium truncate">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.segments?.length || 0} segments</p>
                          </button>
                          <div className="flex gap-1">
                            {c.video_url && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                <a href={c.video_url} target="_blank" rel="noopener"><Download className="h-3 w-3" /></a>
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(c.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* Bottom Generation Bar */}
            <div className="px-4 py-3 border-t border-border/50 bg-background/95 shrink-0">
              {isGenerating ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-xs font-medium">Generating with VEO3...</span>
                    <span className="text-xs text-muted-foreground ml-auto">{Math.round(generationProgress)}%</span>
                  </div>
                  <Progress value={generationProgress} className="h-1.5" />
                </div>
              ) : (
                <div className="flex gap-2">
                  {hasCharacters && !allApproved && (
                    <Button onClick={approveAllSegments} variant="outline" size="sm" className="gap-1 text-xs">
                      <CheckCircle2 className="h-3 w-3" /> Approve All
                    </Button>
                  )}
                  <Button
                    onClick={handleGenerate}
                    disabled={segments.length === 0 || (!allApproved && speakingSegments.length > 0)}
                    className="flex-1 gap-2"
                    size="sm"
                  >
                    <Play className="h-3 w-3" /> Generate Commercial
                  </Button>
                </div>
              )}

              {finalVideoUrl && (
                <div className="mt-3">
                  <video src={finalVideoUrl} controls className="w-full rounded-lg max-h-[200px]" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
