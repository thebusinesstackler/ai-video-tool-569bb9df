import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, FileText, Table2, Loader2, Calendar, Video, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';

interface ContentItem {
  id: string;
  type: 'reel' | 'video-repo';
  title: string;
  script: string;
  hook: string;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  createdAt: string;
  suggestedDay: string;
  suggestedTime: string;
}

const POSTING_SCHEDULE = [
  { day: 'Monday', time: '9:00 AM' },
  { day: 'Tuesday', time: '12:00 PM' },
  { day: 'Wednesday', time: '6:00 PM' },
  { day: 'Thursday', time: '9:00 AM' },
  { day: 'Friday', time: '12:00 PM' },
  { day: 'Saturday', time: '10:00 AM' },
  { day: 'Sunday', time: '5:00 PM' },
];

function extractScriptFromScenes(scenes: any[]): string {
  if (!scenes || !Array.isArray(scenes)) return '';
  return scenes.map((s: any) => s.text || '').filter(Boolean).join(' ');
}

function extractHookFromTopic(topic: string): string {
  if (!topic) return '';
  const lines = topic.split('\n').filter(Boolean);
  const firstLine = lines[0]?.replace(/\*+/g, '').trim() || '';
  return firstLine.length > 120 ? firstLine.substring(0, 120) + '...' : firstLine;
}

export const ContentCalendarDownload = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);

  const fetchAllContent = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [reelsRes, repoRes] = await Promise.all([
        supabase.from('reels').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('video_repo_projects').select('*').eq('user_id', user.id).eq('status', 'completed').order('created_at', { ascending: false }).limit(50),
      ]);

      const allItems: ContentItem[] = [];
      let scheduleIndex = 0;

      (reelsRes.data || []).forEach((reel: any) => {
        const scenes = typeof reel.scenes === 'string' ? JSON.parse(reel.scenes) : reel.scenes;
        const schedule = POSTING_SCHEDULE[scheduleIndex % POSTING_SCHEDULE.length];
        scheduleIndex++;
        allItems.push({
          id: reel.id,
          type: 'reel',
          title: extractHookFromTopic(reel.topic),
          script: extractScriptFromScenes(scenes),
          hook: extractHookFromTopic(reel.topic),
          thumbnailUrl: reel.thumbnail_url,
          videoUrl: reel.video_url,
          createdAt: reel.created_at,
          suggestedDay: schedule.day,
          suggestedTime: schedule.time,
        });
      });

      (repoRes.data || []).forEach((project: any) => {
        const schedule = POSTING_SCHEDULE[scheduleIndex % POSTING_SCHEDULE.length];
        scheduleIndex++;
        const narrationMatch = project.analysis_text?.match(/```narration\n([\s\S]*?)```/);
        const script = narrationMatch?.[1]?.trim() || project.video_prompt || '';
        const hookMatch = project.analysis_text?.match(/### Hook Strategy\n\n(.*?)(\n|$)/);
        const hook = hookMatch?.[1]?.trim() || (project.prompt || '').substring(0, 120);
        allItems.push({
          id: project.id,
          type: 'video-repo',
          title: project.prompt?.substring(0, 80) || 'Video Project',
          script,
          hook,
          thumbnailUrl: project.product_image_url,
          videoUrl: project.generated_video_url,
          createdAt: project.created_at,
          suggestedDay: schedule.day,
          suggestedTime: schedule.time,
        });
      });

      allItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setItems(allItems);
    } catch (err) {
      console.error('Error fetching content:', err);
      toast({ title: 'Error', description: 'Failed to load content', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadCSV = () => {
    const headers = ['Type', 'Title/Hook', 'Script', 'Suggested Day', 'Suggested Time', 'Video URL', 'Thumbnail URL', 'Created At'];
    const rows = items.map(item => [
      item.type,
      `"${item.title.replace(/"/g, '""')}"`,
      `"${item.script.replace(/"/g, '""')}"`,
      item.suggestedDay,
      item.suggestedTime,
      item.videoUrl || '',
      item.thumbnailUrl || '',
      new Date(item.createdAt).toLocaleDateString(),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `content-calendar-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Downloaded', description: 'CSV spreadsheet saved' });
  };

  const downloadPDF = () => {
    const html = `
      <!DOCTYPE html>
      <html><head><meta charset="utf-8">
      <title>Content Calendar</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 40px; color: #1a1a1a; }
        h1 { font-size: 28px; margin-bottom: 8px; color: #7c3aed; }
        .subtitle { color: #666; margin-bottom: 32px; font-size: 14px; }
        .item { page-break-inside: avoid; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
        .item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .badge { background: #7c3aed; color: white; padding: 3px 10px; border-radius: 20px; font-size: 11px; text-transform: uppercase; }
        .badge.repo { background: #2563eb; }
        .schedule { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 8px 14px; border-radius: 8px; font-size: 13px; color: #166534; }
        .hook { font-weight: bold; font-size: 16px; margin-bottom: 8px; }
        .section-label { font-size: 11px; text-transform: uppercase; color: #9ca3af; margin-bottom: 4px; letter-spacing: 0.5px; }
        .script { background: #f9fafb; padding: 12px; border-radius: 8px; font-size: 13px; line-height: 1.6; white-space: pre-wrap; margin-bottom: 12px; }
        .meta { display: flex; gap: 16px; font-size: 12px; color: #6b7280; }
        .thumb { width: 120px; height: 80px; object-fit: cover; border-radius: 8px; margin-right: 16px; float: left; }
        @media print { .item { break-inside: avoid; } }
      </style></head><body>
      <h1>📅 Content Calendar</h1>
      <p class="subtitle">Generated on ${new Date().toLocaleDateString()} • ${items.length} pieces of content</p>
      ${items.map((item, i) => `
        <div class="item">
          <div class="item-header">
            <span class="badge ${item.type === 'video-repo' ? 'repo' : ''}">${item.type === 'reel' ? '🎬 Reel' : '🎥 Video Repo'}</span>
            <div class="schedule">📅 ${item.suggestedDay} at ${item.suggestedTime}</div>
          </div>
          ${item.thumbnailUrl ? `<img class="thumb" src="${item.thumbnailUrl}" alt="thumbnail" />` : ''}
          <div class="hook">${item.hook}</div>
          <div class="section-label">Script</div>
          <div class="script">${item.script || 'No script available'}</div>
          <div class="meta">
            <span>Created: ${new Date(item.createdAt).toLocaleDateString()}</span>
            ${item.videoUrl ? `<span>📹 Video available</span>` : '<span>⏳ No video yet</span>'}
          </div>
        </div>
      `).join('')}
      </body></html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
    toast({ title: 'PDF Ready', description: 'Print dialog opened for PDF save' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (open) fetchAllContent(); }}>
      <DialogTrigger asChild>
        <Button variant="glass" size="lg" className="gap-2">
          <Calendar className="w-5 h-5" />
          Content Calendar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Calendar className="w-5 h-5 text-primary" />
            Content Calendar
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading your content...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Video className="w-12 h-12 mx-auto mb-4 opacity-40" />
            <p>No content found. Create some reels or video projects first!</p>
          </div>
        ) : (
          <>
            {/* Download Buttons */}
            <div className="flex gap-3 mb-4">
              <Button onClick={downloadPDF} variant="default" className="gap-2">
                <FileText className="w-4 h-4" />
                Download PDF
              </Button>
              <Button onClick={downloadCSV} variant="outline" className="gap-2">
                <Table2 className="w-4 h-4" />
                Download Spreadsheet
              </Button>
              <Badge variant="secondary" className="ml-auto self-center">
                {items.length} items
              </Badge>
            </div>

            {/* Preview List */}
            <ScrollArea className="h-[55vh]">
              <div className="space-y-3 pr-4">
                {items.map((item) => (
                  <Card key={item.id} className="glass">
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        {/* Thumbnail */}
                        <div className="flex-shrink-0 relative group">
                          {item.thumbnailUrl ? (
                            <img src={item.thumbnailUrl} alt="" className="w-24 h-16 object-cover rounded-lg" />
                          ) : (
                            <div className="w-24 h-16 bg-muted rounded-lg flex items-center justify-center">
                              <Video className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                          {item.videoUrl && (
                            <button
                              onClick={() => setPreviewVideo(item.videoUrl)}
                              className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Eye className="w-5 h-5 text-white" />
                            </button>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="text-[10px]">
                              {item.type === 'reel' ? 'Reel' : 'Video Repo'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {item.suggestedDay} • {item.suggestedTime}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-foreground truncate">{item.hook}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.script}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            {/* Video Preview Modal */}
            {previewVideo && (
              <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center" onClick={() => setPreviewVideo(null)}>
                <div className="max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
                  <video src={previewVideo} controls autoPlay className="w-full rounded-xl" />
                  <Button variant="glass" className="mt-3 w-full" onClick={() => setPreviewVideo(null)}>Close</Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
