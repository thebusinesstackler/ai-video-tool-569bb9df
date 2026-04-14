import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Upload, Play, Pause, ArrowLeft, Scissors, Clock, Star,
  Pencil, Check, X, Trash2, Plus, RefreshCw, Copy, Link2, Send,
  Download, ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface VizardVideo {
  videoId: number;
  videoUrl: string;
  videoMsDuration: number;
  title: string;
  transcript: string;
  viralScore: string;
  viralReason: string;
  relatedTopic: string;
  clipEditorUrl: string;
}

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
  vizard_api_project_id: number | null;
  vizard_share_link: string | null;
  vizard_videos: VizardVideo[];
  error: string | null;
  created_at: string;
  updated_at: string;
}

type View = 'list' | 'detail';

const STATUS_STEPS = ['uploading', 'processing', 'ready'];
const STATUS_LABELS: Record<string, string> = {
  uploading: 'Submitting',
  processing: 'Vizard AI Processing',
  finding_clips: 'Finding Best Clips',
  transcribing: 'Transcribing',
  ready: 'Ready',
  failed: 'Failed',
};

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function isYoutubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/.test(url);
}

function getYoutubeEmbedUrl(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]+)/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

function detectVideoType(url: string): number {
  if (/youtube\.com|youtu\.be/.test(url)) return 2;
  if (/tiktok\.com/.test(url)) return 6;
  if (/twitter\.com|x\.com/.test(url)) return 7;
  if (/vimeo\.com/.test(url)) return 4;
  if (/twitch\.tv/.test(url)) return 9;
  if (/loom\.com/.test(url)) return 10;
  if (/facebook\.com|fb\.watch/.test(url)) return 11;
  if (/linkedin\.com/.test(url)) return 12;
  if (/drive\.google\.com/.test(url)) return 3;
  return 1; // remote file
}

export default function Vizard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [view, setView] = useState<View>('list');
  const [projects, setProjects] = useState<VizardProject[]>([]);
  const [activeProject, setActiveProject] = useState<VizardProject | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [importingUrl, setImportingUrl] = useState(false);

  // Clip preview
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // Project rename
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

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
      vizard_videos: Array.isArray(row.vizard_videos) ? row.vizard_videos : [],
      vizard_api_project_id: row.vizard_api_project_id ?? null,
      vizard_share_link: row.vizard_share_link ?? null,
    };
  }

  // ---- Upload File → upload to storage then send URL to Vizard API ----
  const handleUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'mp4';
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('raw-footage')
        .upload(path, file, { contentType: file.type });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('raw-footage').getPublicUrl(path);
      const videoUrl = urlData.publicUrl;
      const title = file.name.replace(/\.[^.]+$/, '');

      // Create local project row
      const { data: row, error: insertErr } = await supabase
        .from('vizard_projects')
        .insert({ user_id: user.id, title, source_video_url: videoUrl, status: 'uploading' })
        .select()
        .single();
      if (insertErr) throw insertErr;

      const project = mapProject(row);
      setActiveProject(project);
      setView('detail');

      // Submit to Vizard API
      await submitToVizardApi(project, videoUrl, 1, ext);
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  // ---- URL Import → send directly to Vizard API ----
  const handleUrlImport = async () => {
    if (!user || !youtubeUrl.trim()) return;
    setImportingUrl(true);
    try {
      const url = youtubeUrl.trim();
      const videoType = detectVideoType(url);
      const urlMatch = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]+)/);
      let title = urlMatch ? `YouTube ${urlMatch[1]}` : 'Video Import';

      // Try to fetch actual YouTube title via oEmbed
      if (urlMatch) {
        try {
          const oembedResp = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${urlMatch[1]}&format=json`);
          if (oembedResp.ok) {
            const oembedData = await oembedResp.json();
            if (oembedData.title) title = oembedData.title;
          }
        } catch (_) { /* fallback to ID-based title */ }
      }

      // Create local project row
      const { data: row, error: insertErr } = await supabase
        .from('vizard_projects')
        .insert({ user_id: user.id, title, source_video_url: url, status: 'uploading' })
        .select()
        .single();
      if (insertErr) throw insertErr;

      const project = mapProject(row);
      setActiveProject(project);
      setView('detail');
      setYoutubeUrl('');

      // Submit to Vizard API
      await submitToVizardApi(project, url, videoType);
    } catch (e: any) {
      toast({ title: 'Import failed', description: e.message, variant: 'destructive' });
    } finally {
      setImportingUrl(false);
    }
  };

  // ---- Submit to Vizard.ai API ----
  const submitToVizardApi = async (project: VizardProject, videoUrl: string, videoType: number, ext?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('vizard-api', {
        body: {
          action: 'create',
          videoUrl,
          videoType,
          projectName: project.title,
          lang: 'en',
          preferLength: [0],
          ext: ext || 'mp4',
        },
      });

      if (error) throw new Error(error.message || 'Failed to submit to Vizard');
      if (data?.error) throw new Error(data.error);

      const vizardProjectId = data.vizardProjectId;
      const shareLink = data.shareLink;

      // Update local project with Vizard project ID
      await supabase.from('vizard_projects').update({
        vizard_api_project_id: vizardProjectId,
        vizard_share_link: shareLink,
        status: 'processing',
      }).eq('id', project.id);

      setActiveProject(prev => prev ? {
        ...prev,
        vizard_api_project_id: vizardProjectId,
        vizard_share_link: shareLink,
        status: 'processing',
      } : prev);

      toast({ title: 'Submitted to Vizard AI', description: 'Processing your video — this may take a few minutes...' });

      // Start polling
      pollVizardApi(project.id, vizardProjectId);
    } catch (e: any) {
      console.error('Vizard API submit error:', e);
      await supabase.from('vizard_projects').update({ status: 'failed', error: e.message }).eq('id', project.id);
      setActiveProject(prev => prev ? { ...prev, status: 'failed', error: e.message } : prev);
      toast({ title: 'Vizard API error', description: e.message, variant: 'destructive' });
    }
  };

  // ---- Poll Vizard.ai API for results ----
  const pollVizardApi = useCallback((localProjectId: string, vizardProjectId: number) => {
    let attempts = 0;
    const maxAttempts = 120; // ~60 minutes at 30s intervals

    const poll = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(poll);
        await supabase.from('vizard_projects').update({ status: 'failed', error: 'Timed out waiting for Vizard processing' }).eq('id', localProjectId);
        setActiveProject(prev => prev?.id === localProjectId ? { ...prev, status: 'failed', error: 'Timed out' } : prev);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('vizard-api', {
          body: { action: 'query', vizardProjectId },
        });

        if (error) {
          console.error('Poll error:', error);
          return; // keep polling
        }

        const code = data?.code;

        if (code === 1000) {
          // Still processing
          return;
        }

        if (code === 2000 && data?.videos?.length > 0) {
          // Done! Convert to clips
          clearInterval(poll);
          const vizardVideos: VizardVideo[] = data.videos;
          const clips: VizardClip[] = vizardVideos.map((v: VizardVideo, i: number) => ({
            id: `clip_${i + 1}`,
            title: v.title || `Clip ${i + 1}`,
            description: v.viralReason || '',
            start: 0,
            end: (v.videoMsDuration || 0) / 1000,
            score: parseInt(v.viralScore) || 0,
            tags: parseRelatedTopics(v.relatedTopic),
            exported: false,
          }));

          await supabase.from('vizard_projects').update({
            clips: clips as any,
            vizard_videos: vizardVideos as any,
            status: 'ready',
          }).eq('id', localProjectId);

          setActiveProject(prev => prev?.id === localProjectId ? {
            ...prev,
            clips,
            vizard_videos: vizardVideos,
            status: 'ready',
          } : prev);

          toast({ title: 'Clips ready!', description: `Vizard found ${clips.length} clips.` });
          return;
        }

        if (code === 4002 || code === 4004 || code === 4005 || code === 4008) {
          clearInterval(poll);
          const errMsg = data?.errMsg || `Vizard error code ${code}`;
          await supabase.from('vizard_projects').update({ status: 'failed', error: errMsg }).eq('id', localProjectId);
          setActiveProject(prev => prev?.id === localProjectId ? { ...prev, status: 'failed', error: errMsg } : prev);
          toast({ title: 'Processing failed', description: errMsg, variant: 'destructive' });
          return;
        }

        // Keep polling for other codes
      } catch (e) {
        console.error('Poll exception:', e);
      }
    }, 30000); // poll every 30s

    return () => clearInterval(poll);
  }, [toast]);

  function parseRelatedTopics(raw: string): string[] {
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.slice(0, 3) : [];
    } catch {
      return [];
    }
  }

  // ---- Resume polling on page load for processing projects ----
  const openProject = async (project: VizardProject) => {
    setActiveProject(project);
    setView('detail');
    if (project.status === 'processing' && project.vizard_api_project_id) {
      pollVizardApi(project.id, project.vizard_api_project_id);
    }
  };

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

  const renameProject = async (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    await supabase.from('vizard_projects').update({ title: newTitle.trim() }).eq('id', id);
    setProjects(prev => prev.map(p => p.id === id ? { ...p, title: newTitle.trim() } : p));
    if (activeProject?.id === id) setActiveProject(prev => prev ? { ...prev, title: newTitle.trim() } : prev);
    setRenamingProjectId(null);
  };

  const copyTimestamps = (clip: VizardClip) => {
    navigator.clipboard.writeText(`${formatTime(clip.start)} - ${formatTime(clip.end)}`);
    toast({ title: 'Copied', description: `${formatTime(clip.start)} - ${formatTime(clip.end)}` });
  };

  // ---- Send to Chatcut AI ----
  const sendToChatcut = (clip?: VizardClip, vizardVideo?: VizardVideo) => {
    if (!activeProject) return;
    const payload: any = {
      videoUrl: vizardVideo?.videoUrl || activeProject.source_video_url,
      title: activeProject.title,
      allClips: activeProject.clips,
      vizardVideos: activeProject.vizard_videos,
    };
    if (clip) {
      payload.selectedClipId = clip.id;
      payload.clipStart = clip.start;
      payload.clipEnd = clip.end;
      payload.clipTitle = clip.title;
    }
    sessionStorage.setItem('vizard-to-chatcut', JSON.stringify(payload));
    navigate('/chatcut-ai');
  };

  // ---- Download clip ----
  const downloadClip = (video: VizardVideo) => {
    const a = document.createElement('a');
    a.href = video.videoUrl;
    a.download = `${video.title || 'clip'}.mp4`;
    a.target = '_blank';
    a.click();
  };

  // ---- Progress Stepper ----
  const ProgressStepper = ({ status }: { status: string }) => {
    const currentIdx = STATUS_STEPS.indexOf(status);
    const progressVal = status === 'failed' ? 0 : status === 'ready' ? 100 : ((Math.max(0, currentIdx) + 1) / STATUS_STEPS.length) * 100;
    return (
      <div className="space-y-3">
        <Progress value={progressVal} className="h-2" />
        <div className="flex justify-between">
          {STATUS_STEPS.map((step, i) => (
            <div key={step} className={cn(
              "flex flex-col items-center gap-1 text-xs",
              i <= currentIdx || status === 'ready' ? "text-primary font-medium" : "text-muted-foreground"
            )}>
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-[10px] border-2",
                (i <= currentIdx || status === 'ready') && status !== 'failed' ? "bg-primary text-primary-foreground border-primary" :
                "border-muted-foreground/30"
              )}>
                {(i <= currentIdx || status === 'ready') && status !== 'failed' ? '✓' : i + 1}
              </div>
              <span>{STATUS_LABELS[step] || step}</span>
            </div>
          ))}
        </div>
        {status === 'failed' && (
          <p className="text-sm text-destructive text-center mt-2">Processing failed. You can retry or delete this project.</p>
        )}
      </div>
    );
  };

  // ---- Detail View ----
  if (view === 'detail' && activeProject) {
    const vizardVideos = activeProject.vizard_videos || [];

    return (
      <Layout>
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="ghost" size="icon" onClick={() => { setView('list'); fetchProjects(); }}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold">{activeProject.title}</h1>
            <Badge variant={activeProject.status === 'ready' ? 'default' : activeProject.status === 'failed' ? 'destructive' : 'secondary'}>
              {STATUS_LABELS[activeProject.status] || activeProject.status}
            </Badge>
            {activeProject.vizard_share_link && (
              <a href={activeProject.vizard_share_link} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline">
                  <ExternalLink className="w-4 h-4 mr-2" />Open in Vizard
                </Button>
              </a>
            )}
            {activeProject.status === 'ready' && (
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => sendToChatcut()}>
                <Send className="w-4 h-4 mr-2" />
                Open in Chatcut AI
              </Button>
            )}
          </div>

          <ProgressStepper status={activeProject.status} />

          {activeProject.status === 'processing' && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-primary animate-spin" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Vizard AI is processing your video — this may take a few minutes...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Polling every 30 seconds. You can leave and come back.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {activeProject.status === 'uploading' && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-primary animate-spin" />
                <div>
                  <p className="text-sm font-medium text-foreground">Submitting video to Vizard AI...</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Vizard AI Clips */}
          {activeProject.status === 'ready' && vizardVideos.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Scissors className="w-5 h-5" />
                Vizard AI Clips ({vizardVideos.length})
              </h2>
              <div className="grid gap-6 grid-cols-1">
                {vizardVideos.map((video, idx) => {
                  const clip = activeProject.clips[idx];
                  return (
                    <Card key={video.videoId} className="overflow-hidden">
                      <CardContent className="p-0">
                        {/* Video preview — full width, native aspect ratio */}
                        <video
                          src={video.videoUrl}
                          controls
                          playsInline
                          preload="metadata"
                          className="w-full"
                          style={{ backgroundColor: 'hsl(var(--muted))' }}
                        />
                        <div className="p-4 space-y-3">
                          {editingClipId === clip?.id ? (
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
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-sm">{video.title}</h3>
                                  {video.viralReason && (
                                    <p className="text-xs text-muted-foreground mt-1">{video.viralReason}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 ml-2">
                                  <Star className="w-4 h-4 text-primary" />
                                  <span className="text-sm font-medium">{video.viralScore}/10</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {formatDuration(video.videoMsDuration)}
                              </div>
                              {clip?.tags && clip.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {clip.tags.map(tag => (
                                    <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                                  ))}
                                </div>
                              )}
                              <div className="flex flex-wrap gap-2 pt-1">
                                <Button size="sm" variant="outline" onClick={() => downloadClip(video)}>
                                  <Download className="w-4 h-4 mr-1" />Download
                                </Button>
                                {clip && (
                                  <Button size="sm" variant="ghost" onClick={() => startEdit(clip)}>
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                )}
                                <Button size="sm" onClick={() => sendToChatcut(clip, video)}>
                                  <Send className="w-4 h-4 mr-1" />Edit in Chatcut AI
                                </Button>
                                {video.clipEditorUrl && (
                                  <a href={video.clipEditorUrl} target="_blank" rel="noopener noreferrer">
                                    <Button size="sm" variant="ghost">
                                      <ExternalLink className="w-4 h-4" />
                                    </Button>
                                  </a>
                                )}
                                {clip && (
                                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteClip(clip.id)}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Fallback: show old-style clips if no vizard videos */}
          {activeProject.status === 'ready' && vizardVideos.length === 0 && activeProject.clips.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Scissors className="w-5 h-5" />
                Clips ({activeProject.clips.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {activeProject.clips.map(clip => (
                  <Card key={clip.id} className="relative">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{clip.title}</h3>
                          <p className="text-sm text-muted-foreground">{clip.description}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-primary" />
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
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button size="sm" variant="ghost" onClick={() => startEdit(clip)}><Pencil className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => copyTimestamps(clip)}><Copy className="w-4 h-4" /></Button>
                        <Button size="sm" onClick={() => sendToChatcut(clip)}>
                          <Send className="w-4 h-4 mr-1" />Edit in Chatcut AI
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteClip(clip.id)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {activeProject.status === 'failed' && (
            <div className="flex gap-3 justify-center">
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
            <p className="text-muted-foreground">Turn long videos into viral short clips with Vizard AI</p>
          </div>
        </div>

        {/* Import Options */}
        <Tabs defaultValue="url" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="url"><Link2 className="w-4 h-4 mr-2" />Paste URL</TabsTrigger>
            <TabsTrigger value="upload"><Upload className="w-4 h-4 mr-2" />Upload File</TabsTrigger>
          </TabsList>

          <TabsContent value="url">
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-sm text-muted-foreground">Paste a YouTube, TikTok, Vimeo, Twitter, or any video URL</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://youtu.be/... or any video URL"
                    value={youtubeUrl}
                    onChange={e => setYoutubeUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleUrlImport()}
                  />
                  <Button onClick={handleUrlImport} disabled={importingUrl || !youtubeUrl.trim()}>
                    {importingUrl ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Scissors className="w-4 h-4 mr-2" />}
                    {importingUrl ? 'Submitting...' : 'Clip It'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="upload">
            <Card
              className="border-dashed border-2 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Upload className="w-12 h-12 mb-3" />
                <p className="font-medium">{uploading ? 'Uploading...' : 'Drop a video or click to upload'}</p>
                <p className="text-sm">MP4, MOV, AVI, 3GP</p>
              </CardContent>
            </Card>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }}
            />
          </TabsContent>
        </Tabs>

        {/* Project Cards */}
        {projects.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Your Projects</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {projects.map(p => (
                <Card key={p.id} className="group hover:shadow-lg transition-all duration-200 border-border/60 hover:border-primary/30">
                  <CardContent className="p-5 space-y-3">
                    {/* Header: title + status */}
                    <div className="flex items-start justify-between gap-2">
                      {renamingProjectId === p.id ? (
                        <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
                          <Input
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') renameProject(p.id, renameValue); if (e.key === 'Escape') setRenamingProjectId(null); }}
                            className="h-8 text-sm"
                            autoFocus
                          />
                          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => renameProject(p.id, renameValue)}><Check className="w-3.5 h-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setRenamingProjectId(null)}><X className="w-3.5 h-3.5" /></Button>
                        </div>
                      ) : (
                        <h3
                          className="font-semibold truncate cursor-pointer hover:text-primary transition-colors"
                          onClick={() => openProject(p)}
                          title={p.title}
                        >{p.title}</h3>
                      )}
                      <Badge variant={p.status === 'ready' ? 'default' : p.status === 'failed' ? 'destructive' : 'secondary'} className="text-[10px] shrink-0">
                        {STATUS_LABELS[p.status] || p.status}
                      </Badge>
                    </div>

                    {/* Source URL */}
                    {p.source_video_url && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-2.5 py-1.5 overflow-hidden">
                        <Link2 className="w-3.5 h-3.5 shrink-0" />
                        <a
                          href={isYoutubeUrl(p.source_video_url)
                            ? p.source_video_url.replace(/^(?!https?:\/\/)/, 'https://')
                            : p.source_video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate hover:text-primary transition-colors hover:underline"
                          onClick={e => e.stopPropagation()}
                          title={p.source_video_url}
                        >{p.source_video_url}</a>
                      </div>
                    )}

                    {/* Meta row */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {(p.vizard_videos?.length || p.clips.length) > 0 && (
                        <span className="flex items-center gap-1"><Scissors className="w-3 h-3" />{p.vizard_videos?.length || p.clips.length} clips</span>
                      )}
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 pt-1 border-t border-border/40">
                      <Button size="sm" variant="ghost" className="text-xs h-8" onClick={() => openProject(p)}>
                        <Play className="w-3.5 h-3.5 mr-1" />Open
                      </Button>
                      <Button size="sm" variant="ghost" className="text-xs h-8" onClick={e => { e.stopPropagation(); setRenamingProjectId(p.id); setRenameValue(p.title); }}>
                        <Pencil className="w-3.5 h-3.5 mr-1" />Rename
                      </Button>
                      <Button
                        size="sm" variant="ghost" className="text-xs h-8 text-destructive hover:text-destructive ml-auto"
                        onClick={e => { e.stopPropagation(); deleteProject(p.id); }}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />Delete
                      </Button>
                    </div>
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
