import React, { useEffect, useState, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2, Search, Film, Pencil, Check, X, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';

interface BRollFrame {
  id: string;
  image_url: string;
  prompt: string | null;
  project_id: string | null;
  reference_image_url: string | null;
  created_at: string;
}

interface ProjectMeta {
  id: string;
  custom_name: string | null;
  prompt: string | null;
  generated_video_url: string | null;
}

export default function BRollLibrary() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [frames, setFrames] = useState<BRollFrame[]>([]);
  const [projects, setProjects] = useState<Record<string, ProjectMeta>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const loadFrames = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('generated_images')
        .select('id, image_url, prompt, project_id, reference_image_url, created_at')
        .eq('user_id', user.id)
        .eq('source', 'broll-frame')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setFrames(data || []);

      const projectIds = [...new Set((data || []).map((f) => f.project_id).filter(Boolean))] as string[];
      if (projectIds.length > 0) {
        const { data: projData } = await supabase
          .from('video_repo_projects')
          .select('id, custom_name, prompt, generated_video_url')
          .in('id', projectIds);
        const map: Record<string, ProjectMeta> = {};
        (projData || []).forEach((p) => (map[p.id] = p));
        setProjects(map);
      }
    } catch (e: any) {
      toast({ title: 'Failed to load b-roll', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFrames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const grouped = useMemo(() => {
    const filtered = frames.filter((f) =>
      search ? (f.prompt || '').toLowerCase().includes(search.toLowerCase()) : true
    );
    const groups: Record<string, BRollFrame[]> = {};
    filtered.forEach((f) => {
      const key = f.project_id || 'unsorted';
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    });
    return groups;
  }, [frames, search]);

  const deleteFrame = async (id: string) => {
    try {
      const { error } = await supabase.from('generated_images').delete().eq('id', id);
      if (error) throw error;
      setFrames((prev) => prev.filter((f) => f.id !== id));
      toast({ title: 'Frame deleted' });
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    }
  };

  const saveLabel = async (id: string) => {
    try {
      const { error } = await supabase
        .from('generated_images')
        .update({ prompt: editLabel })
        .eq('id', id);
      if (error) throw error;
      setFrames((prev) => prev.map((f) => (f.id === id ? { ...f, prompt: editLabel } : f)));
      setEditingId(null);
    } catch (e: any) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Layout>
      <div className="container max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Film className="w-7 h-7 text-primary" /> B-Roll Library
            </h1>
            <p className="text-muted-foreground mt-1">
              Reusable frames extracted from your videos. Use them as b-roll in Chatcut AI.
            </p>
          </div>
          <Badge variant="secondary" className="text-sm">
            {frames.length} frame{frames.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by label (e.g. Lion's Mane)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Film className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No b-roll frames yet</p>
              <p className="text-sm mt-1">
                Open a video in Video Repo Pro and click <strong>Extract Frames</strong> to start.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([projectId, projectFrames]) => {
              const project = projects[projectId];
              const title =
                project?.custom_name ||
                project?.prompt?.slice(0, 60) ||
                (projectId === 'unsorted' ? 'Unsorted' : 'Untitled video');
              return (
                <div key={projectId} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">{title}</h2>
                    <Badge variant="outline">{projectFrames.length}</Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {projectFrames.map((f) => (
                      <Card key={f.id} className="overflow-hidden group">
                        <div className="relative aspect-video bg-muted">
                          <img
                            src={f.image_url}
                            alt={f.prompt || 'b-roll frame'}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                            <Button size="icon" variant="secondary" className="h-8 w-8" asChild>
                              <a href={f.image_url} download target="_blank" rel="noopener noreferrer">
                                <Download className="w-4 h-4" />
                              </a>
                            </Button>
                            <Button
                              size="icon"
                              variant="destructive"
                              className="h-8 w-8"
                              onClick={() => deleteFrame(f.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <CardContent className="p-2">
                          {editingId === f.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={editLabel}
                                onChange={(e) => setEditLabel(e.target.value)}
                                className="h-7 text-xs"
                                autoFocus
                              />
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveLabel(f.id)}>
                                <Check className="w-3 h-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <p className="text-xs flex-1 truncate" title={f.prompt || ''}>
                                {f.prompt || 'Untitled'}
                              </p>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => {
                                  setEditingId(f.id);
                                  setEditLabel(f.prompt || '');
                                }}
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
