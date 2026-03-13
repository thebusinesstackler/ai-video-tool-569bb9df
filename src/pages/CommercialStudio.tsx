import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Film, Sparkles, Play, Users, Clapperboard, Volume2, Image, 
  Video, Loader2, Download, ChevronRight, RotateCcw, ScanFace,
  Bot
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ParsedSegment {
  id: string;
  type: 'dialogue' | 'direction' | 'onscreen-text';
  character?: string;
  parenthetical?: string;
  text: string;
  assignedTwinId?: string;
}

interface AITwin {
  id: string;
  name: string;
  gender: string | null;
  face_description: string | null;
  reference_images: string[] | null;
  voice_sample_url: string | null;
  voice_cloning_key: string | null;
}

interface GeneratedClip {
  segmentId: string;
  videoUrl?: string;
  imageUrl?: string;
  audioUrl?: string;
  status: 'pending' | 'generating-image' | 'generating-audio' | 'generating-video' | 'polling' | 'done' | 'error';
  error?: string;
}

// ─── Script Parser ───────────────────────────────────────────────────────────

function parseScript(script: string): ParsedSegment[] {
  const lines = script.split('\n');
  const segments: ParsedSegment[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    
    if (!line) { i++; continue; }

    // Check for on-screen text block
    if (line.toLowerCase().startsWith('on-screen text') || line.toLowerCase().startsWith('on screen text')) {
      let textBlock = '';
      i++;
      while (i < lines.length) {
        const next = lines[i].trim();
        if (!next) { i++; break; }
        textBlock += (textBlock ? '\n' : '') + next;
        i++;
      }
      if (textBlock) {
        segments.push({
          id: crypto.randomUUID(),
          type: 'onscreen-text',
          text: textBlock
        });
      }
      continue;
    }

    // Check for dialogue: "Character (parenthetical):" or "Character:"
    const dialogueMatch = line.match(/^([A-Z][A-Za-z\s]+?)(?:\s*\(([^)]+)\))?\s*:\s*$/);
    if (dialogueMatch) {
      const character = dialogueMatch[1].trim();
      const parenthetical = dialogueMatch[2] || undefined;
      
      // Collect dialogue lines (quoted or until next segment)
      let dialogueText = '';
      i++;
      while (i < lines.length) {
        const next = lines[i].trim();
        if (!next) { i++; break; }
        // Stop if next line is a new character or direction
        if (/^[A-Z][A-Za-z\s]+?(?:\s*\([^)]+\))?\s*:\s*$/.test(next)) break;
        if (/^\(.*\)\s*$/.test(next) && !dialogueText) {
          // Inline parenthetical before dialogue
          i++;
          continue;
        }
        // Remove surrounding quotes
        const cleaned = next.replace(/^[""]|[""]$/g, '').trim();
        if (cleaned) dialogueText += (dialogueText ? ' ' : '') + cleaned;
        i++;
      }
      
      if (dialogueText) {
        segments.push({
          id: crypto.randomUUID(),
          type: 'dialogue',
          character,
          parenthetical,
          text: dialogueText
        });
      }
      continue;
    }

    // Check for parenthetical direction like "(pauses, then softer)"
    const parentheticalMatch = line.match(/^\(([^)]+)\)\s*$/);
    if (parentheticalMatch) {
      // Check if next line is a character's dialogue continuation
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1]?.trim();
        if (nextLine && nextLine.startsWith('"')) {
          // This is a mid-dialogue parenthetical, skip it as a segment
          i++;
          continue;
        }
      }
      segments.push({
        id: crypto.randomUUID(),
        type: 'direction',
        text: parentheticalMatch[1]
      });
      i++;
      continue;
    }

    // Stage direction (everything else)
    segments.push({
      id: crypto.randomUUID(),
      type: 'direction',
      text: line
    });
    i++;
  }

  return segments;
}

// Extract unique character names from parsed segments
function getUniqueCharacters(segments: ParsedSegment[]): string[] {
  const chars = new Set<string>();
  segments.forEach(s => {
    if (s.type === 'dialogue' && s.character) {
      chars.add(s.character);
    }
  });
  return Array.from(chars);
}

// ─── Example Script ──────────────────────────────────────────────────────────

const EXAMPLE_SCRIPT = `A young couple sits at a warmly lit bar, gazing into each other's eyes with soft smiles.

The woman gently tucks her hair behind her ear, resting her chin on her hand.

Woman (playful but sincere):

"So… are you always this calm? Or is this just first-date magic?"

The man chuckles, swirling his drink slowly.

Man (smiling):

"Honestly? This is the first night in a while I haven't been worried about getting a migraine."

She tilts her head, curious.

Woman:

"You get migraines?"

He nods.

Man:

"Yeah. They used to mess up everything. Work, plans… even nights like this."

(pauses, then softer)

"But I just enrolled in a migraine clinical trial at Monroe Biomedical Research. They're studying new treatments. It feels good to finally do something about it."

She smiles warmly.

Woman:

"That's amazing. So you're not just charming… you're proactive too."

He laughs.

Man:

"Hey, if there's a chance to have more nights like this? I'm in."

They clink glasses softly.

The camera slowly dollies in. Warm golden tones. Soft jazz in the background. Bokeh lights shimmer.

On-Screen Text (clean, elegant lower-third):

Struggling with migraines?
See if you qualify for a migraine clinical trial.
Monroe Biomedical Research
Apply today.`;

// ─── Main Component ──────────────────────────────────────────────────────────

const CommercialStudio = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Script state
  const [rawScript, setRawScript] = useState('');
  const [segments, setSegments] = useState<ParsedSegment[]>([]);
  const [isParsed, setIsParsed] = useState(false);
  
  // AI Twins
  const [aiTwins, setAiTwins] = useState<AITwin[]>([]);
  const [characterAssignments, setCharacterAssignments] = useState<Record<string, string>>({});
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [clips, setClips] = useState<GeneratedClip[]>([]);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);

  // Load AI Twins
  useEffect(() => {
    if (!user) return;
    supabase.from('ai_twins').select('*').eq('user_id', user.id)
      .then(({ data }) => { if (data) setAiTwins(data as AITwin[]); });
  }, [user]);

  const handleParse = () => {
    const parsed = parseScript(rawScript);
    setSegments(parsed);
    setIsParsed(true);
    
    // Auto-assign twins to characters by name match
    const chars = getUniqueCharacters(parsed);
    const assignments: Record<string, string> = {};
    chars.forEach(char => {
      const match = aiTwins.find(t => t.name.toLowerCase().includes(char.toLowerCase()));
      if (match) assignments[char] = match.id;
    });
    setCharacterAssignments(assignments);
  };

  const loadExample = () => {
    setRawScript(EXAMPLE_SCRIPT);
    setIsParsed(false);
    setSegments([]);
    setClips([]);
    setFinalVideoUrl(null);
  };

  const assignTwin = (character: string, twinId: string) => {
    setCharacterAssignments(prev => ({ ...prev, [character]: twinId }));
  };

  // ─── Generation Pipeline ────────────────────────────────────────────────────

  const generateCommercial = async () => {
    if (!user) return;
    
    const dialogueSegments = segments.filter(s => s.type === 'dialogue');
    if (dialogueSegments.length === 0) {
      toast({ title: 'No dialogue segments', description: 'Parse a script with character dialogue first.', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setFinalVideoUrl(null);
    
    const newClips: GeneratedClip[] = dialogueSegments.map(s => ({
      segmentId: s.id,
      status: 'pending'
    }));
    setClips(newClips);

    try {
      const totalSteps = dialogueSegments.length * 3; // image + audio + video per segment
      let completedSteps = 0;

      const updateClip = (segmentId: string, updates: Partial<GeneratedClip>) => {
        setClips(prev => prev.map(c => c.segmentId === segmentId ? { ...c, ...updates } : c));
      };

      // Process each dialogue segment
      for (const segment of dialogueSegments) {
        const twin = segment.character ? aiTwins.find(t => t.id === characterAssignments[segment.character!]) : null;
        const referenceImage = twin?.reference_images?.[0];
        
        // Collect surrounding stage directions for visual context
        const segIdx = segments.indexOf(segment);
        const nearbyDirections = segments
          .filter((s, i) => s.type === 'direction' && Math.abs(i - segIdx) <= 2)
          .map(s => s.text)
          .join('. ');

        // Step 1: Generate character image
        setGenerationStep(`Generating image for ${segment.character}...`);
        updateClip(segment.id, { status: 'generating-image' });

        let imageUrl = referenceImage || '';
        
        if (!referenceImage) {
          try {
            const imagePrompt = `Generate a premium cinematic portrait photograph.
CHARACTER: ${twin?.face_description || segment.character || 'Person'}
SCENE CONTEXT: ${nearbyDirections}
${segment.parenthetical ? `EXPRESSION/MOOD: ${segment.parenthetical}` : ''}
CINEMATOGRAPHY: Shot on RED V-RAPTOR, 85mm lens f/1.4, shallow depth of field.
LIGHTING: Warm cinematic lighting, soft key light, subtle rim light.
COMPOSITION: Centered portrait, 9:16 vertical format, magazine quality.
CRITICAL: CLOSED MOUTH or slight smile. NO text, NO watermarks. Ultra photorealistic, 8K.`;

            const messages: any[] = [];
            if (twin?.reference_images?.[0]) {
              messages.push({
                role: 'user',
                content: [
                  { type: 'image_url', image_url: { url: twin.reference_images[0] } },
                  { type: 'text', text: `Match this person's exact appearance.\n\n${imagePrompt}` }
                ]
              });
            } else {
              messages.push({ role: 'user', content: imagePrompt });
            }

            const { data: imgData } = await supabase.functions.invoke('ai', {
              body: {
                model: 'google/gemini-3.1-flash-image-preview',
                messages,
                modalities: ['image', 'text']
              }
            });
            
            const genUrl = imgData?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
            if (genUrl) {
              // Upload base64 to storage
              if (genUrl.startsWith('data:')) {
                const base64Data = genUrl.split(',')[1];
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let j = 0; j < binaryString.length; j++) bytes[j] = binaryString.charCodeAt(j);
                
                const fileName = `commercial-studio/${user.id}/${Date.now()}-${segment.character?.toLowerCase().replace(/\s+/g, '-')}.png`;
                const { data: uploadData, error: uploadError } = await supabase.storage
                  .from('reels').upload(fileName, bytes, { contentType: 'image/png', upsert: true });
                
                if (!uploadError && uploadData) {
                  const { data: pub } = supabase.storage.from('reels').getPublicUrl(fileName);
                  imageUrl = pub.publicUrl;
                } else {
                  imageUrl = genUrl;
                }
              } else {
                imageUrl = genUrl;
              }
            }
          } catch (err) {
            console.error('Image gen error:', err);
          }
        }

        updateClip(segment.id, { imageUrl, status: 'generating-audio' });
        completedSteps++;
        setProgress(Math.round((completedSteps / totalSteps) * 100));

        // Step 2: Generate voiceover
        setGenerationStep(`Generating voiceover for ${segment.character}...`);
        let audioUrl = '';
        
        try {
          const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
            body: {
              text: segment.text,
              voice: 'nova', // Default; could map per character
              model: 'tts-1-hd'
            }
          });

          if (!ttsError && ttsData?.audioUrl) {
            audioUrl = ttsData.audioUrl;
          }
        } catch (err) {
          console.error('TTS error:', err);
        }

        updateClip(segment.id, { audioUrl, status: 'generating-video' });
        completedSteps++;
        setProgress(Math.round((completedSteps / totalSteps) * 100));

        // Step 3: Generate lip-synced video via WaveSpeed InfiniteTalk
        setGenerationStep(`Generating video for ${segment.character}...`);
        
        if (imageUrl && audioUrl) {
          try {
            const { data: vidData, error: vidError } = await supabase.functions.invoke('wavespeed-video', {
              body: {
                action: 'create',
                model: 'infinitetalk',
                imageUrls: [imageUrl],
                audioUrl: audioUrl
              }
            });

            if (!vidError && vidData?.taskId) {
              updateClip(segment.id, { status: 'polling' });
              
              // Poll for completion
              let videoUrl = '';
              const maxAttempts = 60;
              for (let attempt = 0; attempt < maxAttempts; attempt++) {
                await new Promise(r => setTimeout(r, 5000));
                
                const { data: statusData } = await supabase.functions.invoke('wavespeed-video', {
                  body: { action: 'status', taskId: vidData.taskId }
                });
                
                if (statusData?.status === 'completed' && statusData?.videoUrl) {
                  videoUrl = statusData.videoUrl;
                  break;
                } else if (statusData?.status === 'failed') {
                  throw new Error(statusData?.error || 'Video generation failed');
                }
              }
              
              if (videoUrl) {
                updateClip(segment.id, { videoUrl, status: 'done' });
              } else {
                updateClip(segment.id, { status: 'error', error: 'Timeout waiting for video' });
              }
            } else {
              updateClip(segment.id, { status: 'error', error: vidError?.message || 'Failed to start video' });
            }
          } catch (err: any) {
            console.error('Video gen error:', err);
            updateClip(segment.id, { status: 'error', error: err.message });
          }
        } else {
          updateClip(segment.id, { status: 'error', error: 'Missing image or audio' });
        }

        completedSteps++;
        setProgress(Math.round((completedSteps / totalSteps) * 100));
      }

      // Step 4: Stitch all completed clips together
      const completedClips = clips.filter(c => c.videoUrl);
      // Re-read latest clips state
      setClips(prev => {
        const done = prev.filter(c => c.status === 'done' && c.videoUrl);
        if (done.length > 1) {
          setGenerationStep('Stitching final commercial...');
          // Trigger stitch via Creatomate
          stitchClips(done);
        } else if (done.length === 1) {
          setFinalVideoUrl(done[0].videoUrl!);
          setGenerationStep('Complete!');
          setProgress(100);
          setIsGenerating(false);
        } else {
          setGenerationStep('No clips completed successfully');
          setIsGenerating(false);
        }
        return prev;
      });

    } catch (err: any) {
      console.error('Generation error:', err);
      toast({ title: 'Generation Failed', description: err.message, variant: 'destructive' });
      setIsGenerating(false);
    }
  };

  const stitchClips = async (completedClips: GeneratedClip[]) => {
    try {
      const stitchBody = {
        clips: completedClips.map(c => ({
          url: c.videoUrl!,
          duration: 10, // Estimated
          caption: ''
        })),
        transition: 'crossfade',
        transitionDuration: 0.5
      };

      const { data, error } = await supabase.functions.invoke('creatomate-stitch', {
        body: stitchBody
      });

      if (error || !data?.success) {
        // Creatomate failed - just show individual clips
        toast({ title: 'Stitching unavailable', description: 'Individual clips are ready for download.', variant: 'default' });
        setIsGenerating(false);
        setProgress(100);
        setGenerationStep('Clips ready (stitching unavailable)');
        return;
      }

      // Poll for stitch completion
      const renderId = data.renderId;
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const { data: statusData } = await supabase.functions.invoke('creatomate-status', {
          body: { renderId }
        });
        if (statusData?.status === 'succeeded' && statusData?.url) {
          setFinalVideoUrl(statusData.url);
          setGenerationStep('Complete!');
          setProgress(100);
          setIsGenerating(false);
          return;
        } else if (statusData?.status === 'failed') {
          break;
        }
      }

      toast({ title: 'Stitching timed out', description: 'Individual clips are available.', variant: 'default' });
      setIsGenerating(false);
    } catch (err) {
      console.error('Stitch error:', err);
      setIsGenerating(false);
    }
  };

  const reset = () => {
    setRawScript('');
    setSegments([]);
    setIsParsed(false);
    setClips([]);
    setFinalVideoUrl(null);
    setIsGenerating(false);
    setProgress(0);
    setGenerationStep('');
    setCharacterAssignments({});
  };

  const characters = getUniqueCharacters(segments);
  const dialogueCount = segments.filter(s => s.type === 'dialogue').length;
  const directionCount = segments.filter(s => s.type === 'direction').length;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
              <Clapperboard className="w-8 h-8" />
              Commercial Studio
            </h1>
            <p className="text-muted-foreground mt-1">
              Paste a dialogue script → assign AI Twins → generate cinematic commercial videos
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadExample} disabled={isGenerating}>
              <Film className="w-4 h-4 mr-2" />
              Load Example
            </Button>
            <Button variant="outline" onClick={reset} disabled={isGenerating}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        {isGenerating && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center gap-3">
                <Bot className="w-5 h-5 text-primary animate-pulse" />
                <span className="font-semibold text-primary">Loop AI</span>
                <span className="text-sm text-muted-foreground">{generationStep}</span>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progress}%</span>
                <span>{clips.filter(c => c.status === 'done').length}/{clips.length} clips</span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Script Input */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Film className="w-5 h-5 text-primary" />
                  Script
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={rawScript}
                  onChange={(e) => { setRawScript(e.target.value); setIsParsed(false); }}
                  placeholder="Paste your dialogue script here...&#10;&#10;Character Name (emotion):&#10;&quot;Dialogue text here&quot;&#10;&#10;Stage direction describing the scene..."
                  className="min-h-[400px] font-mono text-sm"
                  disabled={isGenerating}
                />
                <Button 
                  onClick={handleParse} 
                  disabled={!rawScript.trim() || isGenerating}
                  className="w-full"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Parse Script
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right: Parsed Segments & Controls */}
          <div className="space-y-4">
            {/* Character Assignment */}
            {isParsed && characters.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ScanFace className="w-5 h-5 text-primary" />
                    Assign AI Twins to Characters
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {characters.map(char => (
                    <div key={char} className="flex items-center gap-3">
                      <Badge variant="secondary" className="min-w-[80px] justify-center">
                        {char}
                      </Badge>
                      <Select
                        value={characterAssignments[char] || ''}
                        onValueChange={(v) => assignTwin(char, v)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select AI Twin..." />
                        </SelectTrigger>
                        <SelectContent>
                          {aiTwins.map(twin => (
                            <SelectItem key={twin.id} value={twin.id}>
                              <div className="flex items-center gap-2">
                                {twin.reference_images?.[0] && (
                                  <img src={twin.reference_images[0]} className="w-6 h-6 rounded-full object-cover" />
                                )}
                                {twin.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                  {aiTwins.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No AI Twins found. Create one in the AI Twin page first, or the system will generate characters from the script.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Parsed Segments Preview */}
            {isParsed && segments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Script Breakdown
                    <div className="flex gap-2 ml-auto">
                      <Badge variant="outline">{dialogueCount} dialogue</Badge>
                      <Badge variant="outline">{directionCount} directions</Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
                  {segments.map((seg, idx) => {
                    const clip = clips.find(c => c.segmentId === seg.id);
                    
                    return (
                      <div 
                        key={seg.id}
                        className={`p-3 rounded-lg border text-sm ${
                          seg.type === 'dialogue' 
                            ? 'bg-primary/5 border-primary/20' 
                            : seg.type === 'onscreen-text'
                            ? 'bg-accent/10 border-accent/20'
                            : 'bg-muted/30 border-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {seg.type === 'dialogue' && (
                            <>
                              <Volume2 className="w-3.5 h-3.5 text-primary" />
                              <span className="font-semibold text-primary">{seg.character}</span>
                              {seg.parenthetical && (
                                <span className="text-xs text-muted-foreground italic">({seg.parenthetical})</span>
                              )}
                            </>
                          )}
                          {seg.type === 'direction' && (
                            <span className="text-xs text-muted-foreground italic">Stage Direction</span>
                          )}
                          {seg.type === 'onscreen-text' && (
                            <span className="text-xs font-semibold text-accent-foreground">On-Screen Text</span>
                          )}
                          
                          {/* Clip status */}
                          {clip && (
                            <span className="ml-auto">
                              {clip.status === 'done' && <Badge className="bg-green-600 text-xs">✓ Done</Badge>}
                              {clip.status === 'error' && <Badge variant="destructive" className="text-xs">Error</Badge>}
                              {!['done', 'error', 'pending'].includes(clip.status) && (
                                <Badge variant="secondary" className="text-xs">
                                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                  {clip.status}
                                </Badge>
                              )}
                            </span>
                          )}
                        </div>
                        <p className={seg.type === 'dialogue' ? '' : 'italic text-muted-foreground'}>
                          {seg.type === 'dialogue' ? `"${seg.text}"` : seg.text}
                        </p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Generate Button */}
            {isParsed && dialogueCount > 0 && (
              <Button 
                onClick={generateCommercial}
                disabled={isGenerating}
                size="lg"
                className="w-full bg-gradient-primary hover:opacity-90"
              >
                {isGenerating ? (
                  <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Generating...</>
                ) : (
                  <><Play className="w-5 h-5 mr-2" /> Generate Commercial ({dialogueCount} clips)</>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Generated Clips Gallery */}
        {clips.some(c => c.status === 'done') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5 text-primary" />
                Generated Clips
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {clips.filter(c => c.videoUrl).map((clip, i) => {
                  const seg = segments.find(s => s.id === clip.segmentId);
                  return (
                    <div key={clip.segmentId} className="space-y-2">
                      <video 
                        src={clip.videoUrl} 
                        controls 
                        className="w-full rounded-lg aspect-[9/16] object-cover bg-black"
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{seg?.character || `Clip ${i + 1}`}</span>
                        <a href={clip.videoUrl} download target="_blank" rel="noreferrer">
                          <Button variant="ghost" size="sm">
                            <Download className="w-4 h-4" />
                          </Button>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Final Stitched Video */}
        {finalVideoUrl && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Final Commercial
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <video 
                src={finalVideoUrl} 
                controls 
                className="w-full max-w-lg rounded-lg aspect-[9/16] bg-black"
              />
              <a href={finalVideoUrl} download target="_blank" rel="noreferrer">
                <Button>
                  <Download className="w-4 h-4 mr-2" />
                  Download Commercial
                </Button>
              </a>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default CommercialStudio;
