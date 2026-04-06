import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, FileText, Table2, Plus, Tag, Video, Trash2, FolderOpen, ImageIcon, Loader2, Camera, Play, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface VideoRepoProject {
  id: string;
  prompt: string | null;
  reference_video_url: string | null;
  product_image_url: string | null;
  analysis_text: string | null;
  generated_video_url: string | null;
  video_prompt: string | null;
  status: string;
  created_at: string;
  category?: string | null;
}

interface ContentCalendarTabProps {
  projects: VideoRepoProject[];
}

const DEFAULT_CATEGORIES = ['Product Demo', 'Testimonial', 'Tutorial', 'Behind the Scenes', 'Promo'];

const POSTING_SCHEDULE = [
  { day: 'Monday', time: '9:00 AM' },
  { day: 'Tuesday', time: '12:00 PM' },
  { day: 'Wednesday', time: '6:00 PM' },
  { day: 'Thursday', time: '9:00 AM' },
  { day: 'Friday', time: '12:00 PM' },
  { day: 'Saturday', time: '10:00 AM' },
  { day: 'Sunday', time: '5:00 PM' },
];

export const ContentCalendarTab = ({ projects }: ContentCalendarTabProps) => {
  const { toast } = useToast();
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [newCategory, setNewCategory] = useState('');
  const [assignments, setAssignments] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    projects.forEach(p => { if (p.category) initial[p.id] = p.category; });
    return initial;
  });

  // Sync assignments when projects change (e.g. after reload)
  useEffect(() => {
    setAssignments(prev => {
      const next = { ...prev };
      projects.forEach(p => {
        if (p.category && !next[p.id]) next[p.id] = p.category;
      });
      return next;
    });
  }, [projects]);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [generatingThumbnail, setGeneratingThumbnail] = useState<string | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  
  // Video preview & frame capture
  const [previewProject, setPreviewProject] = useState<VideoRepoProject | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  const completedProjects = useMemo(() => {
    const seen = new Set<string>();
    return projects.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      // Include if it has a generated video OR a reference video
      return (p.status === 'completed' && p.generated_video_url) || p.reference_video_url;
    });
  }, [projects]);

  const filteredProjects = useMemo(
    () =>
      filterCategory === 'all'
        ? completedProjects
        : filterCategory === 'uncategorized'
        ? completedProjects.filter((p) => !assignments[p.id])
        : completedProjects.filter((p) => assignments[p.id] === filterCategory),
    [completedProjects, filterCategory, assignments]
  );

  const addCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    setCategories((prev) => [...prev, trimmed]);
    setNewCategory('');
  };

  const removeCategory = (cat: string) => {
    setCategories((prev) => prev.filter((c) => c !== cat));
    setAssignments((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (next[k] === cat) delete next[k];
      });
      return next;
    });
  };

  const assignCategory = useCallback(async (projectId: string, category: string) => {
    const value = category === 'none' ? '' : category;
    setAssignments((prev) => ({ ...prev, [projectId]: value }));
    
    // Persist to database
    const dbValue = value || null;
    const { error } = await supabase
      .from('video_repo_projects')
      .update({ category: dbValue })
      .eq('id', projectId);
    
    if (error) {
      console.error('Failed to save category:', error);
      toast({ title: 'Failed to save category', variant: 'destructive' });
    }
  }, [toast]);

  const captureFrame = () => {
    const video = previewVideoRef.current;
    if (!video || !previewProject) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    
    setThumbnails(prev => ({ ...prev, [previewProject.id]: dataUrl }));
    toast({ title: 'Frame captured!', description: 'Thumbnail set from video frame.' });
  };

  const togglePlayPause = () => {
    const video = previewVideoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const generateThumbnail = async (project: VideoRepoProject) => {
    setGeneratingThumbnail(project.id);
    try {
      const hook = extractHook(project);
      const script = extractScript(project);
      const category = assignments[project.id] || 'Product Video';

      const { data, error } = await supabase.functions.invoke('generate-premium-visual', {
        body: {
          type: 'thumbnail',
          topic: hook || script.substring(0, 100),
          style: 'Bold',
          customPrompt: `Create a professional, eye-catching YouTube/social media thumbnail for a ${category} video. The video is about: ${hook}. Script excerpt: ${script.substring(0, 200)}. Make it vibrant, high-contrast with bold visual elements that grab attention. Do NOT include any text.`,
        },
      });

      if (error) throw error;
      if (data?.imageUrl) {
        setThumbnails(prev => ({ ...prev, [project.id]: data.imageUrl }));
        toast({ title: 'Thumbnail generated!', description: 'Your new thumbnail is ready.' });
      } else {
        throw new Error('No image returned');
      }
    } catch (err: any) {
      console.error('Thumbnail generation error:', err);
      toast({ title: 'Thumbnail failed', description: err.message || 'Could not generate thumbnail', variant: 'destructive' });
    } finally {
      setGeneratingThumbnail(null);
    }
  };

  const extractScript = (project: VideoRepoProject): string => {
    const match = project.analysis_text?.match(/```narration\n([\s\S]*?)```/);
    return match?.[1]?.trim() || project.video_prompt || '';
  };

  const extractHook = (project: VideoRepoProject): string => {
    const match = project.analysis_text?.match(/### Hook Strategy\n\n(.*?)(\n|$)/);
    return match?.[1]?.trim() || (project.prompt || '').substring(0, 120);
  };

  const downloadCSV = (items: VideoRepoProject[], label: string) => {
    const headers = ['Category', 'Title/Hook', 'Script', 'Suggested Day', 'Suggested Time', 'Video URL', 'Created At'];
    const rows = items.map((p, i) => {
      const schedule = POSTING_SCHEDULE[i % POSTING_SCHEDULE.length];
      return [
        assignments[p.id] || 'Uncategorized',
        `"${extractHook(p).replace(/"/g, '""')}"`,
        `"${extractScript(p).replace(/"/g, '""')}"`,
        schedule.day,
        schedule.time,
        p.generated_video_url || p.reference_video_url || '',
        new Date(p.created_at).toLocaleDateString(),
      ];
    });
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `content-calendar-${label}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Downloaded', description: `CSV for "${label}" saved` });
  };

  const downloadPDF = (items: VideoRepoProject[], label: string) => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Content Calendar – ${label}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:40px;color:#1a1a1a}
      h1{font-size:24px;margin-bottom:6px;color:#7c3aed}.sub{color:#666;margin-bottom:28px;font-size:13px}
      .item{page-break-inside:avoid;border:1px solid #e5e7eb;border-radius:12px;padding:18px;margin-bottom:16px}
      .row{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
      .badge{background:#7c3aed;color:white;padding:3px 10px;border-radius:20px;font-size:11px}
      .sched{background:#f0fdf4;border:1px solid #bbf7d0;padding:6px 12px;border-radius:8px;font-size:12px;color:#166534}
      .hook-section{margin-bottom:14px}
      .hook-label{font-size:11px;text-transform:uppercase;color:#7c3aed;font-weight:700;letter-spacing:.5px;margin-bottom:4px}
      .hook{font-weight:bold;font-size:16px;margin-bottom:0;color:#1a1a1a;line-height:1.4}
      .lbl{font-size:11px;text-transform:uppercase;color:#7c3aed;margin-bottom:4px;letter-spacing:.5px;font-weight:700}
      .script{background:#f9fafb;padding:12px;border-radius:8px;font-size:12px;line-height:1.7;white-space:pre-wrap;margin-bottom:10px;border:1px solid #e5e7eb}
      .meta{font-size:11px;color:#6b7280}
      .thumb-container{margin-bottom:12px;text-align:center}
      .thumb{width:100%;max-width:320px;height:auto;aspect-ratio:9/16;object-fit:cover;border-radius:10px;background:#000;border:1px solid #e5e7eb}
      .video-link{display:inline-flex;align-items:center;gap:6px;background:#7c3aed;color:white;padding:8px 18px;border-radius:8px;font-size:13px;text-decoration:none;margin-top:8px;font-weight:600}
      .video-link:hover{background:#6d28d9}
      .video-url{display:block;font-size:10px;color:#9ca3af;word-break:break-all;margin-top:4px}
      @media print{.item{break-inside:avoid}.video-link{background:#7c3aed!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body>
    <h1>📅 Content Calendar – ${label}</h1>
    <p class="sub">Generated ${new Date().toLocaleDateString()} • ${items.length} videos</p>
    ${items.map((p, i) => {
      const schedule = POSTING_SCHEDULE[i % POSTING_SCHEDULE.length];
      const thumbSrc = thumbnails[p.id] || null;
      const videoUrl = p.generated_video_url || '';
      return `<div class="item">
        <div class="row"><span class="badge">${assignments[p.id] || 'Uncategorized'}</span><div class="sched">📅 ${schedule.day} at ${schedule.time}</div></div>
        <div class="thumb-container">
          ${thumbSrc ? `<img class="thumb" src="${thumbSrc}" alt="Video thumbnail" />` : videoUrl ? `<video class="thumb" src="${videoUrl}#t=0.5" muted crossorigin="anonymous" preload="metadata"></video>` : ''}
          ${videoUrl ? `<br/><a class="video-link" href="${videoUrl}" target="_blank" rel="noopener noreferrer">▶ Watch Full Video</a><span class="video-url">${videoUrl}</span>` : ''}
        </div>
        <div class="hook-section">
          <div class="hook-label">🎯 Hook</div>
          <div class="hook">${extractHook(p) || 'No hook available'}</div>
        </div>
        <div class="lbl">📝 Full Script</div>
        <div class="script">${extractScript(p) || 'No script available'}</div>
        <div class="meta">Created: ${new Date(p.created_at).toLocaleDateString()}</div>
      </div>`;
    }).join('')}
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
    toast({ title: 'PDF Ready', description: 'Print dialog opened' });
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    completedProjects.forEach((p) => {
      const cat = assignments[p.id] || 'uncategorized';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [completedProjects, assignments]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
      {/* Category Management */}
      <Card className="glass">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Tag className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Categories</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Badge key={cat} variant="secondary" className="gap-1 text-xs">
                {cat}
                <span className="text-muted-foreground ml-0.5">({categoryCounts[cat] || 0})</span>
                <button onClick={() => removeCategory(cat)} className="ml-1 hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="New category..."
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory()}
              className="h-8 text-xs max-w-[200px]"
            />
            <Button size="sm" variant="outline" onClick={addCategory} className="gap-1 text-xs h-8">
              <Plus className="w-3 h-3" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filter + Download */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({completedProjects.length})</SelectItem>
            <SelectItem value="uncategorized">Uncategorized ({categoryCounts['uncategorized'] || 0})</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat} ({categoryCounts[cat] || 0})</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2 ml-auto flex-wrap">
          <Button size="sm" variant="default" disabled={filteredProjects.length === 0} onClick={() => downloadPDF(filteredProjects, filterCategory === 'all' ? 'All' : filterCategory)} className="gap-1.5 text-xs">
            <FileText className="w-3.5 h-3.5" /> PDF ({filteredProjects.length} {filterCategory === 'all' ? 'All' : filterCategory})
          </Button>
          <Button size="sm" variant="outline" disabled={filteredProjects.length === 0} onClick={() => downloadCSV(filteredProjects, filterCategory === 'all' ? 'All' : filterCategory)} className="gap-1.5 text-xs">
            <Table2 className="w-3.5 h-3.5" /> CSV
          </Button>
        </div>
      </div>

      {/* Per-category quick download */}
      {filterCategory === 'all' && categories.some(cat => (categoryCounts[cat] || 0) > 0) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-muted-foreground">Download by category:</span>
          {categories.filter(cat => (categoryCounts[cat] || 0) > 0).map(cat => (
            <Button
              key={cat}
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] gap-1 px-2"
              onClick={() => {
                const catItems = completedProjects.filter(p => assignments[p.id] === cat);
                downloadPDF(catItems, cat);
              }}
            >
              <FileText className="w-3 h-3" /> {cat} ({categoryCounts[cat]})
            </Button>
          ))}
        </div>
      )}

      {/* Video List */}
      {completedProjects.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Video className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <p className="text-sm">No completed videos yet. Generate some in the Create tab!</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No videos in this category.</p>
        </div>
      ) : (
        <ScrollArea className="h-[55vh]">
          <div className="space-y-3 pr-2">
            {filteredProjects.map((project) => (
              <Card key={project.id} className="glass">
                <CardContent className="p-3">
                  <div className="flex gap-3">
                    {/* Video Preview - click to open player */}
                    <div
                      className="flex-shrink-0 relative group cursor-pointer"
                      onClick={() => { setPreviewProject(project); setIsPlaying(false); }}
                    >
                      {thumbnails[project.id] ? (
                        <div className="relative">
                          <img src={thumbnails[project.id]} alt="Thumbnail" className="w-28 h-24 object-cover rounded-lg" />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                            <Play className="w-5 h-5 text-white" />
                          </div>
                        </div>
                      ) : project.generated_video_url ? (
                        <div className="relative">
                          <video
                            src={`${project.generated_video_url}#t=0.5`}
                            muted
                            playsInline
                            crossOrigin="anonymous"
                            preload="metadata"
                            className="w-28 h-24 object-cover rounded-lg bg-black"
                            onLoadedMetadata={(e) => { const v = e.target as HTMLVideoElement; if (isFinite(0.5)) v.currentTime = 0.5; }}
                            onMouseEnter={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
                            onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0.5; }}
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                            <Play className="w-5 h-5 text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-28 h-24 bg-muted rounded-lg flex items-center justify-center">
                          <Video className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-xs font-medium text-foreground truncate">{extractHook(project)}</p>
                      <p className="text-[11px] text-muted-foreground line-clamp-1">{extractScript(project)}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Select value={assignments[project.id] || 'none'} onValueChange={(v) => assignCategory(project.id, v)}>
                          <SelectTrigger className="h-6 text-[10px] w-[130px] border-dashed">
                            <SelectValue placeholder="Assign category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No category</SelectItem>
                            {categories.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {project.generated_video_url && (
                          <Button size="sm" variant="ghost" asChild className="h-6 text-[10px] gap-1 px-2">
                            <a href={project.generated_video_url} download target="_blank" rel="noopener noreferrer">
                              <Download className="w-3 h-3" /> Video
                            </a>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] gap-1 px-2"
                          disabled={generatingThumbnail === project.id}
                          onClick={() => generateThumbnail(project)}
                        >
                          {generatingThumbnail === project.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <ImageIcon className="w-3 h-3" />
                          )}
                          {generatingThumbnail === project.id ? 'Generating...' : thumbnails[project.id] ? 'Regen Thumb' : 'AI Thumbnail'}
                        </Button>
                        {project.generated_video_url && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] gap-1 px-2"
                            onClick={() => { setPreviewProject(project); setIsPlaying(false); }}
                          >
                            <Camera className="w-3 h-3" /> Freeze Frame
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Video Preview & Frame Capture Dialog */}
      <Dialog open={!!previewProject} onOpenChange={(open) => { if (!open) setPreviewProject(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm">Watch & Capture Thumbnail Frame</DialogTitle>
          </DialogHeader>
          {previewProject?.generated_video_url && (
            <div className="space-y-3">
              <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                <video
                  ref={previewVideoRef}
                  src={previewProject.generated_video_url}
                  className="w-full h-full object-contain"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  controls={false}
                  crossOrigin="anonymous"
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={togglePlayPause} className="gap-1.5 text-xs">
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {isPlaying ? 'Pause' : 'Play'}
                  </Button>
                  <span className="text-[10px] text-muted-foreground">Pause at the perfect moment, then capture</span>
                </div>
                <Button size="sm" variant="default" onClick={captureFrame} disabled={isPlaying} className="gap-1.5 text-xs">
                  <Camera className="w-3.5 h-3.5" /> Capture Frame as Thumbnail
                </Button>
              </div>
              {thumbnails[previewProject.id] && (
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Current Thumbnail</p>
                  <img src={thumbnails[previewProject.id]} alt="Captured thumbnail" className="w-40 h-auto rounded-lg border border-border" />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
