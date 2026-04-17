import { useEffect, useRef, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload, Mic2, Wand2, Video, Download, RefreshCcw, FileAudio, ScanFace } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';

interface TwinSummary {
  id: string;
  name: string;
  first_image: string | null;
  voice_cloning_key: string | null;
  voice_engine: string | null;
  google_voice_id: string | null;
  gender: string | null;
}

interface PodcastVideo {
  id: string;
  task_id: string;
  video_url: string;
  created_at: string;
  prompt: string | null;
}

const OPENAI_VOICES = [
  { id: 'alloy', label: 'Alloy (neutral)' },
  { id: 'echo', label: 'Echo (warm male)' },
  { id: 'fable', label: 'Fable (British)' },
  { id: 'onyx', label: 'Onyx (deep male)' },
  { id: 'nova', label: 'Nova (bright female)' },
  { id: 'shimmer', label: 'Shimmer (soft female)' },
];

export default function VoiceoverStudio() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Step 1
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [originalAudioUrl, setOriginalAudioUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [editedScript, setEditedScript] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Step 2
  const [twins, setTwins] = useState<TwinSummary[]>([]);
  const [voiceMode, setVoiceMode] = useState<'twin' | 'openai'>('openai');
  const [selectedTwinId, setSelectedTwinId] = useState<string>('');
  const [selectedOpenAIVoice, setSelectedOpenAIVoice] = useState<string>('nova');
  const [newVoiceoverUrl, setNewVoiceoverUrl] = useState<string | null>(null);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);

  // Step 3
  const [podcastVideos, setPodcastVideos] = useState<PodcastVideo[]>([]);
  const [selectedSourceVideo, setSelectedSourceVideo] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStatus, setRenderStatus] = useState('');
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);

  const projectIdRef = useRef<string | null>(null);

  // Load twins and history
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: twinData } = await supabase.rpc('get_twins_summary', { _user_id: user.id });
      if (twinData) setTwins(twinData as any);

      // Pull past podcast/spokesperson lip-sync videos from video_tasks
      const { data: tasks } = await supabase
        .from('video_tasks')
        .select('id, task_id, video_url, created_at, prompt')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .eq('model', 'infinitetalk-hd')
        .not('video_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(24);
      if (tasks) setPodcastVideos(tasks as any);
    })();
  }, [user]);

  const handleAudioUpload = (file: File) => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 50MB', variant: 'destructive' });
      return;
    }
    setAudioFile(file);
    setOriginalAudioUrl(URL.createObjectURL(file));
    setTranscript('');
    setEditedScript('');
    setNewVoiceoverUrl(null);
    setFinalVideoUrl(null);
  };

  const transcribeAudio = async () => {
    if (!audioFile || !user) return;
    setIsTranscribing(true);
    try {
      // Upload to storage
      const ext = audioFile.name.split('.').pop() || 'mp3';
      const fileName = `voiceover-studio/${user.id}/${Date.now()}-source.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('reels')
        .upload(fileName, audioFile, { contentType: audioFile.type || 'audio/mpeg', upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('reels').getPublicUrl(fileName);
      const audioUrl = pub.publicUrl;

      // Call transcribe-video (works on audio files via Whisper)
      const { data, error } = await supabase.functions.invoke('transcribe-video', {
        body: { videoUrl: audioUrl },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Transcription failed');

      const text = data.text || '';
      setTranscript(text);
      setEditedScript(text);

      // Create draft project row
      const { data: proj } = await supabase
        .from('voiceover_studio_projects')
        .insert({
          user_id: user.id,
          original_audio_url: audioUrl,
          transcript: text,
          edited_script: text,
          status: 'transcribed',
        })
        .select('id')
        .single();
      if (proj) projectIdRef.current = proj.id;

      toast({ title: 'Transcription complete', description: `${text.split(/\s+/).length} words` });
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Transcription failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsTranscribing(false);
    }
  };

  const generateVoiceover = async () => {
    if (!editedScript.trim() || !user) return;
    setIsGeneratingVoice(true);
    setNewVoiceoverUrl(null);
    try {
      const body: Record<string, any> = { text: editedScript, speakingRate: 1.0 };
      if (voiceMode === 'twin' && selectedTwinId) {
        const twin = twins.find(t => t.id === selectedTwinId);
        if (!twin) throw new Error('Twin not found');
        if (twin.voice_cloning_key) {
          body.voiceCloningKey = twin.voice_cloning_key;
        } else {
          body.voice = selectedOpenAIVoice;
          body.gender = twin.gender || 'male';
        }
      } else {
        body.voice = selectedOpenAIVoice;
      }

      const { data, error } = await supabase.functions.invoke('text-to-speech', { body });
      if (error) throw error;
      if (!data?.audioContent) throw new Error('No audio generated');

      // Upload generated audio so wavespeed can fetch it
      const bytes = Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0));
      const fileName = `voiceover-studio/${user.id}/${Date.now()}-new.mp3`;
      const { error: upErr } = await supabase.storage
        .from('reels')
        .upload(fileName, bytes, { contentType: 'audio/mp3' });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('reels').getPublicUrl(fileName);
      setNewVoiceoverUrl(pub.publicUrl);

      if (projectIdRef.current) {
        await supabase
          .from('voiceover_studio_projects')
          .update({
            edited_script: editedScript,
            new_voiceover_url: pub.publicUrl,
            voice_source: voiceMode === 'twin'
              ? { type: 'twin', twinId: selectedTwinId }
              : { type: 'openai', voiceId: selectedOpenAIVoice },
            status: 'voiced',
          })
          .eq('id', projectIdRef.current);
      }

      toast({ title: 'Voiceover ready', description: 'Listen below, then pick a video to lip-sync.' });
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Voice generation failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  const lipSync = async () => {
    if (!newVoiceoverUrl || !selectedSourceVideo || !user) return;
    setIsRendering(true);
    setRenderProgress(5);
    setRenderStatus('Submitting lip-sync job...');
    setFinalVideoUrl(null);
    try {
      const { data: videoData, error: videoErr } = await supabase.functions.invoke('wavespeed-video', {
        body: {
          action: 'create',
          model: 'infinitetalk-hd',
          videoUrl: selectedSourceVideo,
          audioUrl: newVoiceoverUrl,
          prompt: 'Replace the spoken audio with the new voiceover. Keep natural facial movement, head turns, and subtle expression. Match lip movement precisely to the new audio.',
          aspectRatio: '9:16',
        },
      });
      if (videoErr) throw videoErr;
      if (!videoData?.taskId) throw new Error(videoData?.error || 'No task created');

      setRenderProgress(15);
      setRenderStatus('Rendering... (1-4 minutes)');

      let attempts = 0;
      const maxAttempts = 200;
      let finalUrl: string | undefined;
      while (attempts < maxAttempts) {
        attempts++;
        await new Promise(r => setTimeout(r, 3000));
        const { data: status } = await supabase.functions.invoke('wavespeed-video', {
          body: { action: 'status', taskId: videoData.taskId },
        });
        if (status?.status === 'completed' && status?.videoUrl) {
          finalUrl = status.videoUrl;
          break;
        }
        if (status?.status === 'failed') throw new Error(status?.error || 'Render failed');
        setRenderProgress(15 + (attempts / maxAttempts) * 80);
      }
      if (!finalUrl) throw new Error('Render timed out');

      setFinalVideoUrl(finalUrl);
      setRenderProgress(100);
      setRenderStatus('Done!');

      if (projectIdRef.current) {
        await supabase
          .from('voiceover_studio_projects')
          .update({
            source_video_url: selectedSourceVideo,
            final_video_url: finalUrl,
            status: 'done',
          })
          .eq('id', projectIdRef.current);
      }

      toast({ title: '🎬 Lip-sync complete!', description: 'Your new video is ready.' });
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Render failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Mic2 className="w-7 h-7 text-primary" />
            <h1 className="text-3xl font-bold">Voiceover Studio</h1>
          </div>
          <p className="text-muted-foreground">
            Upload audio → transcribe → rewrite & re-voice → lip-sync onto a saved talking-head video.
          </p>
        </div>

        {/* Step 1 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="bg-primary text-primary-foreground rounded-full w-7 h-7 inline-flex items-center justify-center text-sm">1</span>
              Upload & Transcribe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:bg-accent/30 transition-colors">
              <input
                type="file"
                accept="audio/mpeg,audio/mp3,audio/wav,audio/m4a,audio/x-m4a,.mp3,.wav,.m4a"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleAudioUpload(e.target.files[0])}
              />
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">{audioFile ? audioFile.name : 'Click to upload MP3, WAV, or M4A'}</p>
              <p className="text-xs text-muted-foreground mt-1">Max 50MB</p>
            </label>

            {originalAudioUrl && (
              <div className="space-y-3">
                <audio controls src={originalAudioUrl} className="w-full" />
                <Button onClick={transcribeAudio} disabled={isTranscribing} className="w-full">
                  {isTranscribing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Transcribing...</> : <><FileAudio className="w-4 h-4 mr-2" />Transcribe Audio</>}
                </Button>
              </div>
            )}

            {transcript && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Edit script (this will be re-voiced)</label>
                  <Badge variant="secondary">{editedScript.split(/\s+/).filter(Boolean).length} words</Badge>
                </div>
                <Textarea
                  value={editedScript}
                  onChange={(e) => setEditedScript(e.target.value)}
                  className="min-h-[180px] font-mono text-sm"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2 */}
        <Card className={editedScript ? '' : 'opacity-60 pointer-events-none'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="bg-primary text-primary-foreground rounded-full w-7 h-7 inline-flex items-center justify-center text-sm">2</span>
              Generate New Voiceover
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={voiceMode === 'openai' ? 'default' : 'outline'}
                onClick={() => setVoiceMode('openai')}
                className="justify-start"
              >
                <Wand2 className="w-4 h-4 mr-2" />OpenAI Voice
              </Button>
              <Button
                variant={voiceMode === 'twin' ? 'default' : 'outline'}
                onClick={() => setVoiceMode('twin')}
                className="justify-start"
                disabled={twins.length === 0}
              >
                <ScanFace className="w-4 h-4 mr-2" />My AI Twin {twins.length === 0 && '(none)'}
              </Button>
            </div>

            {voiceMode === 'openai' && (
              <Select value={selectedOpenAIVoice} onValueChange={setSelectedOpenAIVoice}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OPENAI_VOICES.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {voiceMode === 'twin' && (
              <Select value={selectedTwinId} onValueChange={setSelectedTwinId}>
                <SelectTrigger><SelectValue placeholder="Pick a twin" /></SelectTrigger>
                <SelectContent>
                  {twins.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} {t.voice_cloning_key ? '(cloned voice)' : '(preset voice)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              onClick={generateVoiceover}
              disabled={isGeneratingVoice || !editedScript.trim() || (voiceMode === 'twin' && !selectedTwinId)}
              className="w-full"
            >
              {isGeneratingVoice ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</> : <><Mic2 className="w-4 h-4 mr-2" />Generate Voiceover</>}
            </Button>

            {newVoiceoverUrl && (
              <div className="space-y-2">
                <audio controls src={newVoiceoverUrl} className="w-full" />
                <Button variant="outline" size="sm" onClick={generateVoiceover} disabled={isGeneratingVoice}>
                  <RefreshCcw className="w-3 h-3 mr-1" />Regenerate
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 3 */}
        <Card className={newVoiceoverUrl ? '' : 'opacity-60 pointer-events-none'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="bg-primary text-primary-foreground rounded-full w-7 h-7 inline-flex items-center justify-center text-sm">3</span>
              Lip-sync onto a Talking-Head Video
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {podcastVideos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No saved talking-head videos found. Generate one in <a href="/podcast" className="text-primary underline">Podcast Talking Head</a> first.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto">
                {podcastVideos.map(v => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedSourceVideo(v.video_url)}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                      selectedSourceVideo === v.video_url ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <video
                      src={`${v.video_url}#t=0.5`}
                      preload="metadata"
                      className="w-full aspect-[9/16] object-cover bg-muted"
                      muted
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                      <p className="text-[10px] text-white/90 truncate">
                        {new Date(v.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <Button
              onClick={lipSync}
              disabled={isRendering || !selectedSourceVideo || !newVoiceoverUrl}
              className="w-full"
              size="lg"
            >
              {isRendering ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Rendering...</> : <><Video className="w-4 h-4 mr-2" />Lip-sync with new voiceover</>}
            </Button>

            {isRendering && (
              <div className="space-y-1">
                <Progress value={renderProgress} />
                <p className="text-xs text-muted-foreground text-center">{renderStatus}</p>
              </div>
            )}

            {finalVideoUrl && (
              <div className="space-y-3 pt-2">
                <video src={finalVideoUrl} controls className="w-full rounded-lg max-h-[600px] bg-black" />
                <div className="flex gap-2">
                  <Button asChild variant="outline" className="flex-1">
                    <a href={finalVideoUrl} download target="_blank" rel="noopener noreferrer">
                      <Download className="w-4 h-4 mr-2" />Download
                    </a>
                  </Button>
                  <Button asChild className="flex-1">
                    <a href={`/chatcut-ai?video=${encodeURIComponent(finalVideoUrl)}`}>
                      Open in Chatcut →
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
