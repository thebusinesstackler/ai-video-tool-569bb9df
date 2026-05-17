import { useState, useMemo, useEffect, useRef } from 'react';
import { Users, Sparkles, Loader2, Plus, Trash2, Wand2, Video, MessageSquare, Upload, Mic2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAITwins } from '@/hooks/useAITwins';
import { useConversationGenerator, DialogueLine, ConversationSpeaker } from '@/hooks/useConversationGenerator';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { AITwin } from '@/types/aiTwin';

interface ConversationBuilderProps {
  aspectRatio?: '9:16' | '16:9' | '1:1';
  source?: string;
  onVideoReady?: (videoUrl: string) => void;
}

const TONES = ['natural', 'playful', 'serious', 'inspiring', 'witty', 'dramatic', 'educational'];

// Built-in OpenAI TTS voices (same pool the rest of the platform uses)
const BUILT_IN_VOICES: { id: string; label: string; gender: 'male' | 'female' }[] = [
  { id: 'onyx', label: 'Onyx (deep male)', gender: 'male' },
  { id: 'echo', label: 'Echo (warm male)', gender: 'male' },
  { id: 'ash', label: 'Ash (calm male)', gender: 'male' },
  { id: 'nova', label: 'Nova (bright female)', gender: 'female' },
  { id: 'shimmer', label: 'Shimmer (soft female)', gender: 'female' },
  { id: 'coral', label: 'Coral (energetic female)', gender: 'female' },
  { id: 'alloy', label: 'Alloy (neutral)', gender: 'female' },
  { id: 'fable', label: 'Fable (storyteller)', gender: 'male' },
];

interface BuiltInSpeaker {
  characterName: string;
  voice: string;
  gender: 'male' | 'female';
  portraitUrl: string;
  portraitUploading?: boolean;
}

type Mode = 'twins' | 'builtin';

export function ConversationBuilder({ aspectRatio = '9:16', source = 'reels', onVideoReady }: ConversationBuilderProps) {
  const { twins, loading: twinsLoading } = useAITwins();
  const { generateDialogue, renderVideo, generatingDialogue, renderingVideo } = useConversationGenerator();

  const [mode, setMode] = useState<Mode>('builtin');
  const [speakerCount, setSpeakerCount] = useState(2);
  const [selectedTwinIds, setSelectedTwinIds] = useState<(string | undefined)[]>([undefined, undefined]);
  const [builtInSpeakers, setBuiltInSpeakers] = useState<BuiltInSpeaker[]>([
    { characterName: 'Alex', voice: 'onyx', gender: 'male', portraitUrl: '' },
    { characterName: 'Sam', voice: 'nova', gender: 'female', portraitUrl: '' },
  ]);
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('natural');
  const [exchanges, setExchanges] = useState(8);
  const [dialogue, setDialogue] = useState<DialogueLine[]>([]);
  const [progressLabel, setProgressLabel] = useState<string>('');
  const [progressPct, setProgressPct] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const eligibleTwins = useMemo(
    () => twins.filter(t => !!t.voice_cloning_key && (t.reference_images?.length ?? 0) > 0),
    [twins]
  );

  useEffect(() => {
    setSelectedTwinIds(prev => {
      const next = [...prev];
      while (next.length < speakerCount) next.push(undefined);
      return next.slice(0, speakerCount);
    });
    setBuiltInSpeakers(prev => {
      const next = [...prev];
      while (next.length < speakerCount) {
        const idx = next.length;
        const isFemale = idx % 2 === 1;
        next.push({
          characterName: `Speaker ${idx + 1}`,
          voice: isFemale ? 'nova' : 'onyx',
          gender: isFemale ? 'female' : 'male',
          portraitUrl: '',
        });
      }
      return next.slice(0, speakerCount);
    });
  }, [speakerCount]);

  const selectedTwins: AITwin[] = useMemo(
    () => selectedTwinIds.map(id => eligibleTwins.find(t => t.id === id)).filter(Boolean) as AITwin[],
    [selectedTwinIds, eligibleTwins]
  );

  const twinSpeakers: ConversationSpeaker[] = useMemo(
    () =>
      selectedTwins.map(t => ({
        characterName: t.name,
        twinId: t.id,
        voice_cloning_key: t.voice_cloning_key,
        gender: t.gender,
        portraitUrl: t.reference_images[0],
      })),
    [selectedTwins]
  );

  const builtInAsSpeakers: ConversationSpeaker[] = useMemo(
    () =>
      builtInSpeakers.slice(0, speakerCount).map(b => ({
        characterName: b.characterName.trim() || 'Speaker',
        voice: b.voice,
        gender: b.gender,
        portraitUrl: b.portraitUrl,
      })),
    [builtInSpeakers, speakerCount]
  );

  const speakers = mode === 'twins' ? twinSpeakers : builtInAsSpeakers;

  const namesUnique =
    new Set(speakers.map(s => s.characterName.toLowerCase())).size === speakers.length;
  const twinsAllSelected =
    selectedTwinIds.every(Boolean) && selectedTwinIds.length === speakerCount;
  const builtInAllReady = builtInAsSpeakers.every(
    s => s.characterName.trim() && s.portraitUrl
  );
  const allReady = mode === 'twins' ? twinsAllSelected : builtInAllReady;

  const updateBuiltIn = (idx: number, patch: Partial<BuiltInSpeaker>) =>
    setBuiltInSpeakers(prev => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  const handlePortraitUpload = async (idx: number, file: File) => {
    if (!file) return;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      updateBuiltIn(idx, { portraitUploading: true });
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${user.id}/conversation-portraits/${Date.now()}-speaker-${idx}.${ext}`;
      const { error } = await supabase.storage
        .from('reels')
        .upload(fileName, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('reels').getPublicUrl(fileName);
      updateBuiltIn(idx, { portraitUrl: data.publicUrl, portraitUploading: false });
    } catch (e: any) {
      updateBuiltIn(idx, { portraitUploading: false });
      toast({
        title: 'Portrait upload failed',
        description: e?.message || 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleGenerateDialogue = async () => {
    if (!topic.trim()) {
      toast({ title: 'Add a topic', description: 'Describe what they should talk about.', variant: 'destructive' });
      return;
    }
    if (!allReady) {
      toast({
        title: mode === 'twins' ? 'Pick all twins' : 'Finish each speaker',
        description:
          mode === 'twins'
            ? `Select ${speakerCount} different twins with cloned voices.`
            : 'Give each speaker a name and upload a portrait image.',
        variant: 'destructive',
      });
      return;
    }
    if (!namesUnique) {
      toast({ title: 'Use unique names', description: 'Each speaker must have a different name.', variant: 'destructive' });
      return;
    }
    try {
      const lines = await generateDialogue({ speakers, topic, tone, exchanges });
      setDialogue(lines);
      toast({ title: 'Dialogue ready', description: `${lines.length} lines generated. Edit, then render.` });
    } catch (e: any) {
      toast({ title: 'Dialogue failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    }
  };

  const updateLine = (idx: number, patch: Partial<DialogueLine>) =>
    setDialogue(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLine = () =>
    setDialogue(prev => [...prev, { character: speakers[0]?.characterName || '', line: '' }]);
  const removeLine = (idx: number) => setDialogue(prev => prev.filter((_, i) => i !== idx));

  const handleRender = async () => {
    const cleaned = dialogue.filter(l => l.line.trim().length > 0 && l.character);
    if (cleaned.length === 0) {
      toast({ title: 'Empty dialogue', description: 'Generate or write some lines first.', variant: 'destructive' });
      return;
    }
    setVideoUrl(null);
    setProgressPct(0);
    setProgressLabel('Starting...');
    try {
      const url = await renderVideo({
        dialogue: cleaned,
        speakers,
        aspectRatio,
        source,
        onProgress: (stage, pct) => {
          setProgressLabel(stage);
          setProgressPct(pct);
        },
      });
      setVideoUrl(url);
      onVideoReady?.(url);
      toast({ title: 'Conversation video ready', description: 'Saved to your library.' });
    } catch (e: any) {
      toast({ title: 'Render failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    }
  };

  if (twinsLoading && mode === 'twins') {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading twins...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-5">
        <div className="flex items-center gap-2 flex-wrap">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Multi-Speaker Conversation</h3>
          <Badge variant="secondary">Movie-style cuts</Badge>
        </div>

        {/* Mode toggle */}
        <div className="space-y-2">
          <Label className="text-xs">Voice source</Label>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === 'builtin' ? 'default' : 'outline'}
              onClick={() => setMode('builtin')}
              className="flex-1"
            >
              <Mic2 className="w-3 h-3 mr-1" /> Built-in voices
            </Button>
            <Button
              size="sm"
              variant={mode === 'twins' ? 'default' : 'outline'}
              onClick={() => setMode('twins')}
              className="flex-1"
              disabled={eligibleTwins.length < 2}
            >
              <Users className="w-3 h-3 mr-1" /> AI Twin cloned voices
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {mode === 'builtin'
              ? 'Pick a voice for each character — no cloned twin required. Upload a portrait per speaker for lip-sync.'
              : 'Use your saved AI Twins with cloned voices.'}
            {mode === 'twins' && eligibleTwins.length < 2 && (
              <span className="block mt-1 text-destructive">
                Need at least 2 twins with cloned voices — switch to Built-in voices or add more in AI Twins.
              </span>
            )}
          </p>
        </div>

        {/* Speaker count */}
        <div className="space-y-2">
          <Label className="text-xs">Number of speakers</Label>
          <div className="flex gap-2">
            {[2, 3, 4].map(n => (
              <Button
                key={n}
                size="sm"
                variant={speakerCount === n ? 'default' : 'outline'}
                onClick={() => setSpeakerCount(n)}
              >
                {n} speakers
              </Button>
            ))}
          </div>
        </div>

        {/* Speaker configuration */}
        {mode === 'twins' ? (
          <div className="space-y-2">
            <Label className="text-xs">Speakers (each must be a different twin)</Label>
            <div className="grid gap-2">
              {Array.from({ length: speakerCount }).map((_, i) => (
                <Select
                  key={i}
                  value={selectedTwinIds[i] || ''}
                  onValueChange={v =>
                    setSelectedTwinIds(prev => {
                      const n = [...prev];
                      n[i] = v;
                      return n;
                    })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={`Speaker ${i + 1}...`} />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleTwins.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} {t.gender ? `· ${t.gender}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Label className="text-xs">Speakers</Label>
            {builtInSpeakers.slice(0, speakerCount).map((sp, i) => (
              <div key={i} className="border rounded-md p-3 space-y-2 bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="w-12 h-12 rounded-md overflow-hidden bg-muted shrink-0 border">
                    {sp.portraitUrl ? (
                      <img src={sp.portraitUrl} alt={sp.characterName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Users className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                  <Input
                    value={sp.characterName}
                    onChange={e => updateBuiltIn(i, { characterName: e.target.value })}
                    placeholder={`Speaker ${i + 1} name`}
                    className="h-9 flex-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={sp.voice}
                    onValueChange={v => {
                      const found = BUILT_IN_VOICES.find(x => x.id === v);
                      updateBuiltIn(i, { voice: v, gender: found?.gender || sp.gender });
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BUILT_IN_VOICES.map(v => (
                        <SelectItem key={v.id} value={v.id} className="text-xs">
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div>
                    <input
                      ref={el => (fileInputRefs.current[i] = el)}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) handlePortraitUpload(i, f);
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full h-9 text-xs"
                      onClick={() => fileInputRefs.current[i]?.click()}
                      disabled={sp.portraitUploading}
                    >
                      {sp.portraitUploading ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Upload className="w-3 h-3 mr-1" />
                      )}
                      {sp.portraitUrl ? 'Replace portrait' : 'Upload portrait'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Topic + tone */}
        <div className="space-y-2">
          <Label className="text-xs">What are they talking about?</Label>
          <Textarea
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="e.g. Two friends debating which mushroom extract is best for focus before a workout."
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.map(t => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Exchanges</Label>
            <Input
              type="number"
              min={4}
              max={14}
              value={exchanges}
              onChange={e => setExchanges(Math.max(4, Math.min(14, Number(e.target.value) || 8)))}
              className="h-9"
            />
          </div>
        </div>

        <Button
          onClick={handleGenerateDialogue}
          disabled={generatingDialogue || !allReady || !topic.trim()}
          className="w-full"
        >
          {generatingDialogue ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Writing dialogue...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4 mr-2" />
              Generate dialogue
            </>
          )}
        </Button>

        {/* Dialogue editor */}
        {dialogue.length > 0 && (
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Dialogue ({dialogue.length} lines)</Label>
              <Button size="sm" variant="ghost" onClick={addLine}>
                <Plus className="w-3 h-3 mr-1" />
                Add line
              </Button>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {dialogue.map((l, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <Select value={l.character} onValueChange={v => updateLine(i, { character: v })}>
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {speakers.map(s => (
                        <SelectItem key={s.characterName} value={s.characterName}>
                          {s.characterName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={l.line}
                    onChange={e => updateLine(i, { line: e.target.value })}
                    rows={1}
                    className="text-sm min-h-[2rem] flex-1"
                  />
                  <Button size="sm" variant="ghost" onClick={() => removeLine(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>

            <Button onClick={handleRender} disabled={renderingVideo} className="w-full" size="lg">
              {renderingVideo ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Rendering...
                </>
              ) : (
                <>
                  <Video className="w-4 h-4 mr-2" />
                  Render conversation video
                </>
              )}
            </Button>

            {renderingVideo && (
              <div className="space-y-1">
                <Progress value={progressPct} />
                <p className="text-xs text-muted-foreground">{progressLabel}</p>
              </div>
            )}
          </div>
        )}

        {videoUrl && (
          <div className="border-t pt-4 space-y-2">
            <Label className="text-xs flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-primary" />
              Final video
            </Label>
            <video src={videoUrl} controls className="w-full rounded-md bg-muted" />
            <a href={videoUrl} download className="text-xs text-primary underline">
              Download
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
