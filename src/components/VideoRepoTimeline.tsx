import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Play, Pause, SkipBack, SkipForward, Scissors, ZoomIn, ZoomOut,
  Download, Save, SplitSquareHorizontal, Film, Trash2, Plus, BookmarkPlus, Library
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';

interface VideoRepoTimelineProps {
  videoUrl: string;
  onClose: () => void;
}

interface TimelineSegment {
  id: string;
  type: 'original' | 'broll' | 'template';
  startTime: number;
  endTime: number;
  label: string;
  color: string;
  videoUrl?: string;
}

interface SavedClip {
  id: string;
  label: string;
  category: string;
  start_time: number;
  end_time: number;
  source_video_url: string;
  created_at: string;
}

const SEGMENT_COLORS = ['#7c3aed', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899'];
const BROLL_COLOR = '#10b981';

export const VideoRepoTimeline = ({ videoUrl, onClose }: VideoRepoTimelineProps) => {
  const { session } = useAuth();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isDragging, setIsDragging] = useState<'playhead' | 'trimStart' | 'trimEnd' | null>(null);

  // Segments state for split & b-roll
  const [segments, setSegments] = useState<TimelineSegment[]>([]);

  // Save template dialog
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');
  const [saveCategory, setSaveCategory] = useState('outro');
  const [isSaving, setIsSaving] = useState(false);

  // Saved clips library
  const [showLibrary, setShowLibrary] = useState(false);
  const [savedClips, setSavedClips] = useState<SavedClip[]>([]);
  const [loadingClips, setLoadingClips] = useState(false);

  // B-roll dialog
  const [showBrollDialog, setShowBrollDialog] = useState(false);
  const [brollUrl, setBrollUrl] = useState('');

  // Initialize segments from duration
  useEffect(() => {
    if (duration > 0 && segments.length === 0) {
      const mid = duration / 2;
      setSegments([
        { id: 'seg-1', type: 'original', startTime: 0, endTime: mid, label: 'Segment 1', color: SEGMENT_COLORS[0] },
        { id: 'seg-2', type: 'original', startTime: mid, endTime: duration, label: 'Segment 2', color: SEGMENT_COLORS[1] },
      ]);
    }
  }, [duration, segments.length]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onLoaded = () => { setDuration(video.duration); setTrimEnd(video.duration); };
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onEnded = () => setIsPlaying(false);
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEnded);
    return () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) { video.pause(); } else {
      if (video.currentTime < trimStart || video.currentTime >= trimEnd) video.currentTime = trimStart;
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    if (isPlaying && currentTime >= trimEnd) {
      videoRef.current?.pause();
      setIsPlaying(false);
    }
  }, [currentTime, trimEnd, isPlaying]);

  const seekTo = (time: number) => {
    if (videoRef.current) { videoRef.current.currentTime = time; setCurrentTime(time); }
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 10);
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !duration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(pct * duration);
  };

  const handleTimelineMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !timelineRef.current || !duration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = pct * duration;
    if (isDragging === 'playhead') seekTo(time);
    else if (isDragging === 'trimStart') setTrimStart(Math.min(time, trimEnd - 0.5));
    else if (isDragging === 'trimEnd') setTrimEnd(Math.max(time, trimStart + 0.5));
  }, [isDragging, duration, trimEnd, trimStart]);

  const handleMouseUp = useCallback(() => setIsDragging(null), []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleTimelineMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleTimelineMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleTimelineMouseMove, handleMouseUp]);

  // --- SPLIT AT PLAYHEAD ---
  const splitAtPlayhead = () => {
    if (!duration || currentTime <= 0 || currentTime >= duration) return;
    const hitSegment = segments.find(s => currentTime > s.startTime && currentTime < s.endTime);
    if (!hitSegment) return;

    const newSegments = segments.flatMap(seg => {
      if (seg.id !== hitSegment.id) return [seg];
      const colorIdx = segments.length % SEGMENT_COLORS.length;
      return [
        { ...seg, endTime: currentTime, label: `${seg.label} (A)` },
        {
          id: `seg-${Date.now()}`,
          type: seg.type as 'original' | 'broll' | 'template',
          startTime: currentTime,
          endTime: seg.endTime,
          label: `${seg.label.replace(' (A)', '')} (B)`,
          color: SEGMENT_COLORS[colorIdx],
          videoUrl: seg.videoUrl,
        },
      ];
    });
    setSegments(newSegments);
    toast({ title: 'Split', description: `Split at ${formatTime(currentTime)}` });
  };

  // --- SAVE SELECTION AS TEMPLATE ---
  const saveSelectionAsTemplate = async () => {
    if (!session?.user?.id) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('video_clip_templates' as any).insert({
        user_id: session.user.id,
        source_video_url: videoUrl,
        start_time: trimStart,
        end_time: trimEnd,
        label: saveLabel || 'Untitled Clip',
        category: saveCategory,
      });
      if (error) throw error;
      toast({ title: 'Saved!', description: `"${saveLabel || 'Untitled Clip'}" saved as ${saveCategory} template` });
      setShowSaveDialog(false);
      setSaveLabel('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // --- LOAD SAVED CLIPS LIBRARY ---
  const loadSavedClips = async () => {
    if (!session?.user?.id) return;
    setLoadingClips(true);
    try {
      const { data, error } = await supabase
        .from('video_clip_templates' as any)
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSavedClips((data || []) as SavedClip[]);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingClips(false);
    }
  };

  const insertSavedClip = (clip: SavedClip) => {
    const insertTime = currentTime;
    const clipDuration = clip.end_time - clip.start_time;

    const newSegment: TimelineSegment = {
      id: `tmpl-${Date.now()}`,
      type: 'template',
      startTime: insertTime,
      endTime: insertTime + clipDuration,
      label: `📎 ${clip.label}`,
      color: '#ec4899',
      videoUrl: clip.source_video_url,
    };

    // Insert after current position, shifting subsequent segments
    const updated = [...segments];
    const insertIdx = updated.findIndex(s => s.endTime > insertTime);
    if (insertIdx >= 0) {
      updated.splice(insertIdx + 1, 0, newSegment);
    } else {
      updated.push(newSegment);
    }

    setSegments(updated);
    setShowLibrary(false);
    toast({ title: 'Inserted', description: `"${clip.label}" added at ${formatTime(insertTime)}` });
  };

  const deleteSavedClip = async (clipId: string) => {
    try {
      await supabase.from('video_clip_templates' as any).delete().eq('id', clipId);
      setSavedClips(prev => prev.filter(c => c.id !== clipId));
      toast({ title: 'Deleted' });
    } catch { /* ignore */ }
  };

  // --- ADD B-ROLL ---
  const addBrollAtPlayhead = () => {
    if (!brollUrl.trim()) return;
    const brollSegment: TimelineSegment = {
      id: `broll-${Date.now()}`,
      type: 'broll',
      startTime: currentTime,
      endTime: Math.min(currentTime + 3, duration), // default 3s b-roll
      label: 'B-Roll',
      color: BROLL_COLOR,
      videoUrl: brollUrl.trim(),
    };

    const updated = [...segments];
    const insertIdx = updated.findIndex(s => s.endTime > currentTime);
    if (insertIdx >= 0) {
      updated.splice(insertIdx + 1, 0, brollSegment);
    } else {
      updated.push(brollSegment);
    }
    setSegments(updated);
    setShowBrollDialog(false);
    setBrollUrl('');
    toast({ title: 'B-Roll Added', description: `Inserted at ${formatTime(currentTime)}` });
  };

  const removeSegment = (segId: string) => {
    setSegments(prev => prev.filter(s => s.id !== segId));
  };

  // Waveform bars memoized to prevent re-render flicker
  const waveformBars = useMemo(() => 
    Array.from({ length: 80 }, () => 10 + Math.random() * 25),
  []);

  const playheadPct = duration ? (currentTime / duration) * 100 : 0;
  const trimStartPct = duration ? (trimStart / duration) * 100 : 0;
  const trimEndPct = duration ? (trimEnd / duration) * 100 : 100;

  return (
    <>
      <Card className="glass border-primary/20">
        <CardContent className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scissors className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Timeline Editor</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">
                {formatTime(currentTime)} / {formatTime(duration)}
              </Badge>
              <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
            </div>
          </div>

          {/* Video preview */}
          <div className="flex justify-center">
            <video ref={videoRef} src={videoUrl} className="rounded-lg max-h-[300px] w-auto bg-black" onClick={togglePlay} />
          </div>

          {/* Transport + Action controls */}
          <div className="flex items-center justify-center gap-1 flex-wrap">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => seekTo(trimStart)}>
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="default" className="h-10 w-10 rounded-full" onClick={togglePlay}>
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => seekTo(trimEnd)}>
              <SkipForward className="w-4 h-4" />
            </Button>

            <div className="mx-1 h-4 w-px bg-border" />

            {/* Split */}
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={splitAtPlayhead}
              title="Split at playhead">
              <SplitSquareHorizontal className="w-3.5 h-3.5" /> Split
            </Button>

            {/* Save Section */}
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => setShowSaveDialog(true)}
              title="Save trimmed selection as a reusable template">
              <BookmarkPlus className="w-3.5 h-3.5" /> Save Section
            </Button>

            {/* Library */}
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => { setShowLibrary(true); loadSavedClips(); }}
              title="Browse saved clip templates">
              <Library className="w-3.5 h-3.5" /> Library
            </Button>

            {/* Add B-Roll */}
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => setShowBrollDialog(true)}
              title="Add B-Roll clip at playhead">
              <Film className="w-3.5 h-3.5" /> B-Roll
            </Button>

            <div className="mx-1 h-4 w-px bg-border" />

            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground w-8 text-center">{Math.round(zoom * 100)}%</span>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom(z => Math.min(4, z + 0.25))}>
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>

          {/* Timeline */}
          <div className="relative" style={{ overflowX: 'auto' }}>
            <div
              ref={timelineRef}
              className="relative h-20 rounded-lg cursor-pointer select-none"
              style={{ width: `${100 * zoom}%`, minWidth: '100%' }}
              onClick={handleTimelineClick}
            >
              {/* Segment backgrounds */}
              <div className="absolute inset-0 flex rounded-lg overflow-hidden">
                {segments.map((seg, i) => {
                  const widthPct = duration ? ((seg.endTime - seg.startTime) / duration) * 100 : 0;
                  return (
                    <React.Fragment key={seg.id}>
                      {i > 0 && <div className="w-px bg-border flex-shrink-0" />}
                      <div
                        className="h-full relative flex-shrink-0"
                        style={{ width: `${widthPct}%`, backgroundColor: `${seg.color}22` }}
                      >
                        <div className="absolute inset-x-0 top-0 h-5 flex items-center justify-center gap-1">
                          <span className="text-[10px] font-medium truncate px-1" style={{ color: seg.color }}>
                            {seg.type === 'broll' ? '🎬 ' : seg.type === 'template' ? '📎 ' : ''}{seg.label}
                          </span>
                          {(seg.type === 'broll' || seg.type === 'template') && (
                            <button
                              className="text-[10px] hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); removeSegment(seg.id); }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Waveform visualization */}
              <div className="absolute bottom-0 left-0 right-0 h-10 flex items-end px-1">
                {waveformBars.map((height, i) => {
                  const pct = (i / waveformBars.length) * 100;
                  const inTrim = pct >= trimStartPct && pct <= trimEndPct;
                  const seg = segments.find(s => {
                    const sPct = duration ? (s.startTime / duration) * 100 : 0;
                    const ePct = duration ? (s.endTime / duration) * 100 : 100;
                    return pct >= sPct && pct < ePct;
                  });
                  return (
                    <div
                      key={i}
                      className="flex-1 mx-px rounded-t transition-colors"
                      style={{
                        height: `${height}px`,
                        backgroundColor: inTrim ? (seg?.color || SEGMENT_COLORS[0]) : '#9ca3af44',
                        opacity: inTrim ? 0.7 : 0.3,
                      }}
                    />
                  );
                })}
              </div>

              {/* Trim region dimming */}
              <div className="absolute inset-y-0 left-0 bg-black/30 rounded-l-lg pointer-events-none" style={{ width: `${trimStartPct}%` }} />
              <div className="absolute inset-y-0 right-0 bg-black/30 rounded-r-lg pointer-events-none" style={{ width: `${100 - trimEndPct}%` }} />

              {/* Trim handles */}
              <div className="absolute top-0 bottom-0 w-2 bg-primary cursor-col-resize z-20 rounded-l"
                style={{ left: `${trimStartPct}%` }}
                onMouseDown={(e) => { e.stopPropagation(); setIsDragging('trimStart'); }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 left-0 w-2 h-8 bg-primary rounded-sm flex items-center justify-center">
                  <div className="w-0.5 h-3 bg-primary-foreground rounded" />
                </div>
              </div>
              <div className="absolute top-0 bottom-0 w-2 bg-primary cursor-col-resize z-20 rounded-r"
                style={{ left: `${trimEndPct}%`, transform: 'translateX(-100%)' }}
                onMouseDown={(e) => { e.stopPropagation(); setIsDragging('trimEnd'); }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 right-0 w-2 h-8 bg-primary rounded-sm flex items-center justify-center">
                  <div className="w-0.5 h-3 bg-primary-foreground rounded" />
                </div>
              </div>

              {/* Playhead */}
              <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-auto cursor-col-resize"
                style={{ left: `${playheadPct}%` }}
                onMouseDown={(e) => { e.stopPropagation(); setIsDragging('playhead'); }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full border-2 border-background" />
              </div>

              {/* Time markers */}
              <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 pointer-events-none">
                {Array.from({ length: 7 }, (_, i) => {
                  const t = (i / 6) * duration;
                  return <span key={i} className="text-[9px] text-muted-foreground">{formatTime(t)}</span>;
                })}
              </div>
            </div>
          </div>

          {/* Segment chips */}
          <div className="flex flex-wrap gap-1.5">
            {segments.map(seg => (
              <Badge key={seg.id} variant="outline" className="text-[10px] gap-1" style={{ borderColor: seg.color, color: seg.color }}>
                {seg.type === 'broll' ? '🎬' : seg.type === 'template' ? '📎' : '▶'} {seg.label}: {formatTime(seg.endTime - seg.startTime)}
              </Badge>
            ))}
          </div>

          {/* Trim info */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="font-medium">Selection:</span>
              <span>{formatTime(trimStart)} → {formatTime(trimEnd)}</span>
              <Badge variant="outline" className="text-[10px]">{formatTime(trimEnd - trimStart)} total</Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px]">{segments.length} segment{segments.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Section Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookmarkPlus className="w-5 h-5 text-primary" /> Save Section as Template
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Save the current selection ({formatTime(trimStart)} → {formatTime(trimEnd)}) as a reusable clip template.
            </p>
            <Input placeholder="e.g., Exit CTA, Intro Hook" value={saveLabel} onChange={e => setSaveLabel(e.target.value)} />
            <Select value={saveCategory} onValueChange={setSaveCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="intro">Intro</SelectItem>
                <SelectItem value="outro">Outro / Exit</SelectItem>
                <SelectItem value="hook">Hook</SelectItem>
                <SelectItem value="cta">CTA</SelectItem>
                <SelectItem value="broll">B-Roll</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSaveDialog(false)}>Cancel</Button>
            <Button onClick={saveSelectionAsTemplate} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Saved Clips Library Dialog */}
      <Dialog open={showLibrary} onOpenChange={setShowLibrary}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Library className="w-5 h-5 text-primary" /> Clip Template Library
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            {loadingClips ? (
              <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
            ) : savedClips.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No saved templates yet. Use "Save Section" to create one.</p>
            ) : (
              <div className="space-y-2">
                {savedClips.map(clip => (
                  <div key={clip.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50">
                    <div>
                      <p className="text-sm font-medium text-foreground">{clip.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {clip.category} • {formatTime(clip.end_time - clip.start_time)} duration
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => insertSavedClip(clip)}>
                        <Plus className="w-3 h-3" /> Insert
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteSavedClip(clip.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* B-Roll Dialog */}
      <Dialog open={showBrollDialog} onOpenChange={setShowBrollDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Film className="w-5 h-5 text-primary" /> Add B-Roll at {formatTime(currentTime)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Paste a video URL or describe the B-roll you want to insert at the playhead position.</p>
            <Input placeholder="Paste video URL or describe B-roll..." value={brollUrl} onChange={e => setBrollUrl(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowBrollDialog(false)}>Cancel</Button>
            <Button onClick={addBrollAtPlayhead} disabled={!brollUrl.trim()}>
              <Plus className="w-4 h-4 mr-1" /> Add B-Roll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
