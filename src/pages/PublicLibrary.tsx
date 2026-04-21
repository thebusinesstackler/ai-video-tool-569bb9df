import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Download, Star } from 'lucide-react';

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

const PublicLibrary = () => {
  const { userId } = useParams<{ userId: string }>();
  const [videos, setVideos] = useState<PublicVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  useEffect(() => {
    document.title = 'Shared Video Library';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Public video library shared from Video Repo Pro.');
  }, []);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('video_repo_projects')
        .select('id,generated_video_url,custom_name,prompt,thumbnail_url,product_image_url,is_favorite,created_at')
        .eq('user_id', userId)
        .not('generated_video_url', 'is', null)
        .order('is_favorite', { ascending: false })
        .order('created_at', { ascending: false });
      if (!error && data) setVideos(data as PublicVideo[]);
      setLoading(false);
    })();
  }, [userId]);

  const filtered = videos.filter(v => !favoritesOnly || v.is_favorite);

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Shared Video Library</h1>
            <p className="text-sm text-muted-foreground">{filtered.length} video{filtered.length === 1 ? '' : 's'}</p>
          </div>
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
              return (
                <Card key={v.id} className="overflow-hidden">
                  <div className="relative aspect-[9/16] bg-muted">
                    <video
                      src={`${v.generated_video_url}#t=0.5`}
                      poster={poster}
                      controls
                      preload="metadata"
                      className="w-full h-full object-cover"
                    />
                    {v.is_favorite && (
                      <Badge className="absolute top-2 left-2 bg-yellow-500/90 text-white border-0">
                        <Star className="w-3 h-3 mr-1 fill-current" /> Favorite
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-3 space-y-2">
                    <p className="text-sm font-medium line-clamp-2 min-h-[2.5rem]" title={label}>
                      {label}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(v.created_at).toLocaleDateString()}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-8 text-xs"
                      onClick={() => downloadAsMp4(v.generated_video_url, label)}
                    >
                      <Download className="w-3 h-3 mr-1" /> Download
                    </Button>
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
