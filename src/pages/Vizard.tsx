import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Upload, Play, Pause, ArrowLeft, Scissors, Clock, Star,
  Pencil, Check, X, Trash2, Plus, RefreshCw, Download, Copy
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface VizardClip {
  id: string;
  title: string;
  description: string;
  start: number;
  end: number;
  score: number;
  tags: string[];
  exported: boolean;
}

interface VizardProject {
  id: string;
  title: string;
  status: string;
  source_video_url: string | null;
  transcript: any;
  clips: VizardClip[];
  error: string | null;
  created_at: string;
  updated_at: string;
}

type View = 'list' | 'detail';

const STATUS_STEPS = ['uploading', 'transcribing', 'finding_clips', 'ready'];
const STATUS_LABELS: Record<string, string> = {
  uploading: 'Uploading',
  transcribing: 'Transcribing',
  finding_clips: 'Finding Best Clips',
  ready: 'Ready',
  failed: 'Failed',
};

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function Vizard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [view, setView] = useState<View>('list');
  const [projects, setProjects] = useState<VizardProject[]>([]);
  const [activeProject, setActiveProject] = useState<VizardProject | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clip preview
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('vizard_projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setProjects(data.map(mapProject));
  }, [user]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  function mapProject(row: any): VizardProject {
    return {
      ...row,
      clips: Array.isArray(row.clips) ? row.clips : [],
    };
  }

  // ---- Upload & Pipeline ----
  const handleUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('raw-footage')
        .upload(path, file, { contentType: file.type });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('raw-footage').getPublicUrl(path);
      const videoUrl = urlData.publicUrl;

      const { data: row, error: insertErr } = await supabase
        .from('vizard_projects')
        .insert({ user_id: user.id, title: file.name.replace(/\.[^.]+$/, ''), source_video_url: videoUrl, status: 'transcribing' })
        .select()
        .single();
      if (insertErr) throw insertErr;

      const project = mapProject(row);
      setActiveProject(project);
      setView('detail');
      toast({ title: 'Video uploaded', description: 'Starting transcription...' });

      // Start pipeline
      runPipeline(project);
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const runPipeline = async (project: VizardProject) => {
    try {
      // Step 1: Transcribe
      const { data: txData, error: txErr } = await supabase.functions.invoke('transcribe-video', {
        body: { videoUrl: project.source_video_url },
      });
      if (txErr) throw new Error(txErr.message || 'Transcription failed');

      const transcript = txData?.transcript || txData?.segments || txData;
      await supabase.from('vizard_projects').update({ transcript, status: 'finding_clips' }).eq('id', project.id);
      setActiveProject(prev => prev ? { ...prev, transcript, status: 'finding_clips' } : prev);

      // Step 2: Find clips
      const { data: clipData, error: clipErr } = await supabase.functions.invoke('vizard-find-clips', {
        body: { projectId: project.id, transcript, videoDuration: null },
      });
      if (clipErr) throw new Error(clipErr.message || 'Clip finding failed');

      const clips = clipData?.clips || [];
      setActiveProject(prev => prev ? { ...prev, clips, status: 'ready' } : prev);
      toast({ title: 'Clips ready!', description: `Found ${clips.length} potential clips.` });
    } catch (e: any) {
      console.error('Pipeline error:', e);
      await supabase.from('vizard_projects').update({ status: 'failed', error: e.message }).eq('id', project.id);
      setActiveProject(prev => prev ? { ...prev, status: 'failed', error: e.message } : prev);
      toast({ title: 'Processing failed', description: e.message, variant: 'destructive' });
    }
  };

  // ---- Clip Preview ----
  const playClip = (clip: VizardClip) => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.currentTime = clip.start;
    vid.play();
    setPlayingClipId(clip.id);
  };

  const stopClip = () => {
    videoRef.current?.pause();
    setPlayingClipId(null);
  };

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !playingClipId || !activeProject) return;
    const clip = activeProject.clips.find(c => c.id === playingClipId);
    if (!clip) return;
    const onTime = () => {
      if (vid.currentTime >= clip.end) { vid.pause(); setPlayingClipId(null); }
    };
    vid.addEventListener('timeupdate', onTime);
    return () => vid.removeEventListener('timeupdate', onTime);
  }, [playingClipId, activeProject]);

  // ---- Clip Editing ----
  const startEdit = (clip: VizardClip) => {
    setEditingClipId(clip.id);
    setEditTitle(clip.title);
    setEditDesc(clip.description);
  };

  const saveEdit = async () => {
    if (!activeProject || !editingClipId) return;
    const updated = activeProject.clips.map(c =>
      c.id === editingClipId ? { ...c, title: editTitle, description: editDesc } : c
    );
    await supabase.from('vizard_projects').update({ clips: updated as any }).eq('id', activeProject.id);
    setActiveProject({ ...activeProject, clips: updated });
    setEditingClipId(null);
  };

  const deleteClip = async (clipId: string) => {
    if (!activeProject) return;
    const updated = activeProject.clips.filter(c => c.id !== clipId);
    await supabase.from('vizard_projects').update({ clips: updated as any }).eq('id', activeProject.id);
    setActiveProject({ ...activeProject, clips: updated });
  };

  const deleteProject = async (id: string) => {
    await supabase.from('vizard_projects').delete().eq('id', id);
    setProjects(prev => prev.filter(p => p.id !== id));
    if (activeProject?.id === id) { setActiveProject(null); setView('list'); }
  };

  const openProject = async (project: VizardProject) => {
    setActiveProject(project);
    setView('detail');
    // If still processing, re-poll
    if (['uploading', 'transcribing', 'finding_clips'].includes(project.status)) {
      pollProject(project.id);
    }
  };

  const pollProject = async (id: string) => {
    const poll = setInterval(async () => {
      const { data } = await supabase.from('vizard_projects').select('*').eq('id', id).single();
      if (!data) { clearInterval(poll); return; }
      const p = mapProject(data);
      setActiveProject(p);
      if (p.status === 'ready' || p.status === 'failed') clearInterval(poll);
    }, 3000);
  };

  const copyTimestamps = (clip: VizardClip) => {
    navigator.clipboard.writeText(`${formatTime(clip.start)} - ${formatTime(clip.end)}`);
    toast({ title: 'Copied', description: `${formatTime(clip.start)} - ${formatTime(clip.end)}` });
  };

  // ---- Progress Stepper ----
  const ProgressStepper = ({ status }: { status: string }) => {
    const currentIdx = STATUS_STEPS.indexOf(status);
    const progressVal = status === 'failed' ? 0 : ((currentIdx + 1) / STATUS_STEPS.length) * 100;
    return (
      <div className="space-y-3">
        <Progress value={progressVal} className="h-2" />
        <div className="flex justify-between">
          {STATUS_STEPS.map((step, i) => (
            <div key={step} className={cn(
              "flex flex-col items-center gap-1 text-xs",
              i <= currentIdx ? "text-primary font-medium" : "text-muted-foreground"
            )}>
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-[10px] border-2",
                i < currentIdx ? "bg-primary text-primary-foreground border-primary" :
                i === currentIdx ? "border-primary text-primary" : "border-muted-foreground/30"
              )}>
                {i < currentIdx ? '✓' : i + 1}
              </div>
              <span>{STATUS_LABELS[step]}</span>
            </div>
          ))}
        </div>
        {status === 'failed' && (
          <p className="text-sm text-destructive text-center mt-2">Processing failed. You can retry or delete this project.</p>
        )}
      </div>
    );
  };

  // ---- Transcript Viewer ----
  const TranscriptViewer = ({ transcript }: { transcript: any }) => {
    const segments = Array.isArray(transcript)
      ? transcript
      : transcript?.segments || [];
    if (!segments.length) return <p className="text-muted-foreground text-sm">No transcript data.</p>;
    return (
      <div className="max-h-60 overflow-y-auto space-y-1 text-sm border rounded-lg p-3 bg-muted/30">
        {segments.map((seg: any, i: number) => (
          <p key={i}>
            <span className="text-muted-foreground font-mono text-xs mr-2">[{formatTime(seg.start || 0)}]</span>
            {seg.text}
          </p>
        ))}
      </div>
    );
  };

  // ---- Views ----
  if (view === 'detail' && activeProject) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => { setView('list'); fetchProjects(); }}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold">{activeProject.title}</h1>
            <Badge variant={activeProject.status === 'ready' ? 'default' : activeProject.status === 'failed' ? 'destructive' : 'secondary'}>
              {STATUS_LABELS[activeProject.status] || activeProject.status}
            </Badge>
          </div>

          <ProgressStepper status={activeProject.status} />

          {activeProject.source_video_url && (
            <Card>
              <CardContent className="p-4">
                <video
                  ref={videoRef}
                  src={activeProject.source_video_url}
                  controls
                  className="w-full max-h-[400px] rounded-lg bg-black"
                />
              </CardContent>
            </Card>
          )}

          {activeProject.transcript && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Transcript</CardTitle>
              </CardHeader>
              <CardContent>
                <TranscriptViewer transcript={activeProject.transcript} />
              </CardContent>
            </Card>
          )}

          {activeProject.status === 'ready' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Scissors className="w-5 h-5" />
                Clips ({activeProject.clips.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {activeProject.clips.map(clip => (
                  <Card key={clip.id} className="relative">
                    <CardContent className="p-4 space-y-3">
                      {editingClipId === clip.id ? (
                        <div className="space-y-2">
                          <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Title" />
                          <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description" rows={2} />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={saveEdit}><Check className="w-4 h-4 mr-1" />Save</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingClipId(null)}><X className="w-4 h-4" /></Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold">{clip.title}</h3>
                              <p className="text-sm text-muted-foreground">{clip.description}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 text-yellow-500" />
                              <span className="text-sm font-medium">{clip.score}/10</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {formatTime(clip.start)} – {formatTime(clip.end)}
                            <span className="ml-1">({Math.round(clip.end - clip.start)}s)</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {clip.tags.map(tag => (
                              <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                            ))}
                          </div>
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" variant="outline" onClick={() => playingClipId === clip.id ? stopClip() : playClip(clip)}>
                              {playingClipId === clip.id ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                              {playingClipId === clip.id ? 'Stop' : 'Preview'}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => startEdit(clip)}><Pencil className="w-4 h-4" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => copyTimestamps(clip)}><Copy className="w-4 h-4" /></Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteClip(clip.id)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {activeProject.status === 'failed' && (
            <div className="flex gap-3 justify-center">
              <Button onClick={() => { setActiveProject({ ...activeProject, status: 'transcribing' }); runPipeline(activeProject); }}>
                <RefreshCw className="w-4 h-4 mr-2" />Retry
              </Button>
              <Button variant="destructive" onClick={() => deleteProject(activeProject.id)}>
                <Trash2 className="w-4 h-4 mr-2" />Delete
              </Button>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // ---- Project List View ----
  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Vizard</h1>
            <p className="text-muted-foreground">Turn long videos into viral short clips</p>
          </div>
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            {uploading ? 'Uploading...' : 'New Project'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }}
          />
        </div>

        {/* Upload Drop Zone */}
        <Card
          className="border-dashed border-2 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Upload className="w-12 h-12 mb-3" />
            <p className="font-medium">Drop a video or click to upload</p>
            <p className="text-sm">MP4, MOV, WEBM — up to 500MB</p>
          </CardContent>
        </Card>

        {/* Project Cards */}
        {projects.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Your Projects</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {projects.map(p => (
                <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openProject(p)}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium truncate">{p.title}</h3>
                      <Badge variant={p.status === 'ready' ? 'default' : p.status === 'failed' ? 'destructive' : 'secondary'} className="text-[10px]">
                        {STATUS_LABELS[p.status] || p.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{p.clips.length} clips</span>
                      <span>{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                    <Button
                      size="sm" variant="ghost" className="text-destructive p-0 h-auto"
                      onClick={e => { e.stopPropagation(); deleteProject(p.id); }}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />Delete
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
