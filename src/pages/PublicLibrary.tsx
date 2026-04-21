import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Download, Star, MessageCircle, Send } from 'lucide-react';
import { toast } from 'sonner';

interface PublicVideo {
  id: string;
  generated_video_url: string;
  custom_name: string | null;
  prompt: string | null;
  thumbnail_url: string | null;
  product_image_url: string | null;
  is_favorite: boolean;
  created_at: string;
}

interface PublicComment {
  id: string;
  project_id: string;
  author_name: string;
  comment: string;
  created_at: string;
}

const VISITOR_TOKEN_KEY = 'public_library_visitor_token';
const VISITOR_NAME_KEY = 'public_library_visitor_name';

function getVisitorToken(): string {
  let token = localStorage.getItem(VISITOR_TOKEN_KEY);
  if (!token) {
    token = `v_${crypto.randomUUID()}`;
    localStorage.setItem(VISITOR_TOKEN_KEY, token);
  }
  return token;
}

const PublicLibrary = () => {
  const { userId } = useParams<{ userId: string }>();
  const [searchParams] = useSearchParams();
  const sourceFilter = searchParams.get('source'); // e.g. 'animated' or 'vizard'
  const isAnimatedOnly = sourceFilter === 'animated';
  const isVizardOnly = sourceFilter === 'vizard';
  const [videos, setVideos] = useState<PublicVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  // Per-project favorite counts and which projects this visitor has favorited
  const [favCounts, setFavCounts] = useState<Record<string, number>>({});
  const [myFavorites, setMyFavorites] = useState<Set<string>>(new Set());

  // Comments per project
  const [comments, setComments] = useState<Record<string, PublicComment[]>>({});
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [draftComment, setDraftComment] = useState<Record<string, string>>({});
  const [authorName, setAuthorName] = useState<string>(
    () => localStorage.getItem(VISITOR_NAME_KEY) || ''
  );
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});

  const visitorToken = useMemo(() => getVisitorToken(), []);

  useEffect(() => {
    document.title = isAnimatedOnly ? 'Shared Animated Statics' : 'Shared Video Library';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', isAnimatedOnly
      ? 'Public gallery of animated static creatives shared for feedback.'
      : 'Public video library shared from Video Repo Pro.');
  }, [isAnimatedOnly]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      const animatedReq = supabase
        .from('animated_statics')
        .select('id,animation_url,prompt,source_image_url,created_at')
        .eq('user_id', userId)
        .not('animation_url', 'is', null)
        .order('created_at', { ascending: false });

      const [repoRes, podcastRes, chatcutRes, animatedRes] = isAnimatedOnly
        ? [{ data: [], error: null } as any, { data: [], error: null } as any, { data: [], error: null } as any, await animatedReq]
        : await Promise.all([
            supabase
              .from('video_repo_projects')
              .select('id,generated_video_url,custom_name,prompt,thumbnail_url,product_image_url,is_favorite,created_at')
              .eq('user_id', userId)
              .not('generated_video_url', 'is', null)
              .order('created_at', { ascending: false }),
            supabase
              .from('podcast_projects')
              .select('id,topic,hook,video_url,scene_image_url,twin_name,featured_product,created_at')
              .eq('user_id', userId)
              .not('video_url', 'is', null)
              .order('created_at', { ascending: false }),
            supabase
              .from('chatcut_drafts')
              .select('id,name,video_url,created_at')
              .eq('user_id', userId)
              .not('video_url', 'is', null)
              .order('created_at', { ascending: false }),
            animatedReq,
          ]);

      if ((isAnimatedOnly && !animatedRes.error) || (!repoRes.error && repoRes.data)) {
        const repoRows = ((repoRes.data || []) as PublicVideo[]);
        const podcastRows: PublicVideo[] = (podcastRes.data || []).map((p: any) => ({
          id: `podcast:${p.id}`,
          generated_video_url: p.video_url,
          custom_name: p.topic ? `🎙️ ${p.topic}` : (p.twin_name ? `🎙️ ${p.twin_name}` : '🎙️ Podcast'),
          prompt: p.hook || p.topic || null,
          thumbnail_url: p.scene_image_url || null,
          product_image_url: p.scene_image_url || null,
          is_favorite: false,
          created_at: p.created_at,
        }));
        const chatcutRows: PublicVideo[] = (chatcutRes.data || []).map((c: any) => ({
          id: `chatcut:${c.id}`,
          generated_video_url: c.video_url,
          custom_name: c.name ? `✂️ ${c.name}` : '✂️ Chatcut Edit',
          prompt: null,
          thumbnail_url: null,
          product_image_url: null,
          is_favorite: false,
          created_at: c.created_at,
        }));
        const animatedRows: PublicVideo[] = (animatedRes.data || []).map((a: any) => ({
          id: `animated:${a.id}`,
          generated_video_url: a.animation_url,
          custom_name: '🎞️ Animated Static',
          prompt: a.prompt || null,
          thumbnail_url: a.source_image_url || null,
          product_image_url: a.source_image_url || null,
          is_favorite: false,
          created_at: a.created_at,
        }));
        const list = [...repoRows, ...podcastRows, ...chatcutRows, ...animatedRows].sort((a, b) => {
          if ((b.is_favorite ? 1 : 0) !== (a.is_favorite ? 1 : 0)) return (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0);
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        setVideos(list);
        const ids = list.map(v => v.id);
        if (ids.length > 0) {
          // Load favorites and comments in parallel
          const [favRes, commentRes] = await Promise.all([
            supabase
              .from('public_video_favorites')
              .select('project_id,visitor_token')
              .in('project_id', ids),
            supabase
              .from('public_video_comments')
              .select('id,project_id,author_name,comment,created_at')
              .in('project_id', ids)
              .order('created_at', { ascending: false }),
          ]);
          if (favRes.data) {
            const counts: Record<string, number> = {};
            const mine = new Set<string>();
            for (const f of favRes.data as { project_id: string; visitor_token: string }[]) {
              counts[f.project_id] = (counts[f.project_id] || 0) + 1;
              if (f.visitor_token === visitorToken) mine.add(f.project_id);
            }
            setFavCounts(counts);
            setMyFavorites(mine);
          }
          if (commentRes.data) {
            const grouped: Record<string, PublicComment[]> = {};
            for (const c of commentRes.data as PublicComment[]) {
              (grouped[c.project_id] ||= []).push(c);
            }
            setComments(grouped);
          }
        }
      }
      setLoading(false);
    })();
  }, [userId, visitorToken, isAnimatedOnly]);

  const filtered = videos.filter(v => !favoritesOnly || myFavorites.has(v.id) || v.is_favorite);

  const downloadAsMp4 = async (url: string, name: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name.endsWith('.mp4') ? name : `${name}.mp4`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, '_blank');
    }
  };

  const toggleFavorite = async (projectId: string) => {
    const isFav = myFavorites.has(projectId);
    // Optimistic update
    setMyFavorites(prev => {
      const next = new Set(prev);
      isFav ? next.delete(projectId) : next.add(projectId);
      return next;
    });
    setFavCounts(prev => ({
      ...prev,
      [projectId]: Math.max(0, (prev[projectId] || 0) + (isFav ? -1 : 1)),
    }));

    if (isFav) {
      const { error } = await supabase
        .from('public_video_favorites')
        .delete()
        .eq('project_id', projectId)
        .eq('visitor_token', visitorToken);
      if (error) toast.error('Could not remove favorite');
    } else {
      const { error } = await supabase
        .from('public_video_favorites')
        .insert({ project_id: projectId, visitor_token: visitorToken });
      if (error) toast.error('Could not add favorite');
    }
  };

  const toggleComments = (projectId: string) => {
    setOpenComments(prev => {
      const next = new Set(prev);
      next.has(projectId) ? next.delete(projectId) : next.add(projectId);
      return next;
    });
  };

  const submitComment = async (projectId: string) => {
    const text = (draftComment[projectId] || '').trim();
    const name = authorName.trim() || 'Anonymous';
    if (!text) return;
    if (text.length > 1000) {
      toast.error('Comment is too long (max 1000 characters)');
      return;
    }
    setSubmitting(p => ({ ...p, [projectId]: true }));
    const { data, error } = await supabase
      .from('public_video_comments')
      .insert({ project_id: projectId, author_name: name.slice(0, 60), comment: text })
      .select('id,project_id,author_name,comment,created_at')
      .single();
    setSubmitting(p => ({ ...p, [projectId]: false }));
    if (error || !data) {
      toast.error('Could not post comment');
      return;
    }
    localStorage.setItem(VISITOR_NAME_KEY, name);
    setComments(prev => ({
      ...prev,
      [projectId]: [data as PublicComment, ...(prev[projectId] || [])],
    }));
    setDraftComment(p => ({ ...p, [projectId]: '' }));
    toast.success('Comment posted');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">{isAnimatedOnly ? 'Shared Animated Statics' : 'Shared Video Library'}</h1>
            <p className="text-sm text-muted-foreground">{filtered.length} {isAnimatedOnly ? 'animation' : 'video'}{filtered.length === 1 ? '' : 's'}</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Your name (optional)"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className="h-9 w-48"
              maxLength={60}
            />
            <Button
              variant={favoritesOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFavoritesOnly(v => !v)}
              className="gap-1.5"
            >
              <Star className={`w-3.5 h-3.5 ${favoritesOnly ? 'fill-current' : ''}`} />
              {favoritesOnly ? 'Showing favorites' : 'Favorites only'}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <p>No videos to show.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((v) => {
              const label = v.custom_name || v.prompt || 'Untitled';
              const poster = v.thumbnail_url || v.product_image_url || undefined;
              const myFav = myFavorites.has(v.id);
              const favCount = favCounts[v.id] || 0;
              const projectComments = comments[v.id] || [];
              const isOpen = openComments.has(v.id);
              return (
                <Card key={v.id} className="overflow-hidden flex flex-col">
                  <div className={`relative bg-muted flex items-center justify-center ${isAnimatedOnly ? 'aspect-square' : 'aspect-[9/16]'}`}>
                    <video
                      src={`${v.generated_video_url}#t=0.5`}
                      poster={poster}
                      controls
                      preload="metadata"
                      className={`w-full h-full ${isAnimatedOnly ? 'object-contain' : 'object-cover'}`}
                    />
                    {v.is_favorite && (
                      <Badge className="absolute top-2 left-2">
                        <Star className="w-3 h-3 mr-1 fill-current" /> Featured
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-3 space-y-2 flex-1 flex flex-col">
                    <p className="text-sm font-medium line-clamp-2 min-h-[2.5rem]" title={label}>
                      {label}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(v.created_at).toLocaleDateString()}
                    </p>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant={myFav ? 'default' : 'outline'}
                        className="h-9 flex-1 text-xs gap-1.5"
                        onClick={() => toggleFavorite(v.id)}
                        title={myFav ? 'Remove favorite' : 'Add to favorites'}
                      >
                        <Star className={`w-4 h-4 ${myFav ? 'fill-current' : ''}`} />
                        {myFav ? 'Favorited' : 'Favorite'}
                        {favCount > 0 && <span className="opacity-70">· {favCount}</span>}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 flex-1 text-xs gap-1.5"
                        onClick={() => toggleComments(v.id)}
                      >
                        <MessageCircle className="w-4 h-4" />
                        Comment
                        {projectComments.length > 0 && <span className="opacity-70">· {projectComments.length}</span>}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 text-muted-foreground"
                        onClick={() => downloadAsMp4(v.generated_video_url, label)}
                        title="Download MP4"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {isOpen && (
                      <div className="border-t border-border pt-2 space-y-2">
                        <div className="flex gap-1.5">
                          <Textarea
                            placeholder="Leave a comment…"
                            value={draftComment[v.id] || ''}
                            onChange={(e) => setDraftComment(p => ({ ...p, [v.id]: e.target.value }))}
                            className="min-h-[60px] text-xs resize-none"
                            maxLength={1000}
                          />
                          <Button
                            size="icon"
                            className="h-8 w-8 self-end"
                            disabled={submitting[v.id] || !(draftComment[v.id] || '').trim()}
                            onClick={() => submitComment(v.id)}
                          >
                            {submitting[v.id]
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Send className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {projectComments.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground text-center py-2">
                              No comments yet.
                            </p>
                          ) : (
                            projectComments.map(c => (
                              <div key={c.id} className="text-xs bg-muted/50 rounded p-2">
                                <div className="flex items-center justify-between gap-2 mb-0.5">
                                  <span className="font-medium truncate">{c.author_name}</span>
                                  <span className="text-[10px] text-muted-foreground shrink-0">
                                    {new Date(c.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                                <p className="whitespace-pre-wrap break-words">{c.comment}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default PublicLibrary;
