import React, { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Search, Loader2, ExternalLink, Scissors, Film, Eye, ThumbsUp, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface VideoResult {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  thumbnail: string;
  url: string;
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const YouTubeSearch = () => {
  const [query, setQuery] = useState('');
  const [duration, setDuration] = useState('any');
  const [order, setOrder] = useState('relevance');
  const [results, setResults] = useState<VideoResult[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searched, setSearched] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const doSearch = async (pageToken?: string) => {
    const isLoadMore = !!pageToken;
    isLoadMore ? setLoadingMore(true) : setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('youtube-search', {
        body: { query: query.trim(), duration, order, pageToken, maxResults: 25 },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (isLoadMore) {
        setResults(prev => [...prev, ...data.items]);
      } else {
        setResults(data.items);
        setSearched(true);
      }
      setNextPageToken(data.nextPageToken);
    } catch (e: any) {
      toast({ title: 'Search failed', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    doSearch();
  };

  const openInVizard = (url: string) => {
    navigate(`/vizard?url=${encodeURIComponent(url)}`);
  };

  const openInChatcut = (url: string) => {
    navigate(`/chatcut-ai?url=${encodeURIComponent(url)}`);
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">YouTube Search</h1>
          <p className="text-muted-foreground mt-1">Find videos by keyword, then send them to Vizard or Chatcut AI</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search YouTube videos..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={loading || !query.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span className="ml-2 hidden sm:inline">Search</span>
            </Button>
          </div>

          <div className="flex flex-wrap gap-3">
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any duration</SelectItem>
                <SelectItem value="short">Short (&lt;4 min)</SelectItem>
                <SelectItem value="medium">Medium (4-20 min)</SelectItem>
                <SelectItem value="long">Long (&gt;20 min)</SelectItem>
              </SelectContent>
            </Select>

            <Select value={order} onValueChange={setOrder}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">Relevance</SelectItem>
                <SelectItem value="date">Upload date</SelectItem>
                <SelectItem value="viewCount">View count</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </form>

        {/* Results */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            No results found. Try a different keyword.
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="grid gap-4">
            {results.map(video => (
              <Card key={video.videoId} className="flex flex-col sm:flex-row gap-4 p-4">
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative flex-shrink-0 sm:w-64 w-full aspect-video rounded-lg overflow-hidden bg-muted"
                >
                  <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                  <Badge className="absolute bottom-2 right-2 bg-black/80 text-white border-0 text-xs">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatDuration(video.durationSeconds)}
                  </Badge>
                </a>

                <div className="flex-1 min-w-0 space-y-2">
                  <a href={video.url} target="_blank" rel="noopener noreferrer" className="block">
                    <h3 className="font-semibold text-foreground line-clamp-2 hover:text-primary transition-colors">
                      {video.title}
                    </h3>
                  </a>
                  <p className="text-sm text-muted-foreground">{video.channelTitle}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{formatViews(video.viewCount)}</span>
                    <span className="flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5" />{formatViews(video.likeCount)}</span>
                    <span>{new Date(video.publishedAt).toLocaleDateString()}</span>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => openInVizard(video.url)}>
                      <Film className="w-4 h-4 mr-1" /> Open in Vizard
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openInChatcut(video.url)}>
                      <Scissors className="w-4 h-4 mr-1" /> Open in Chatcut AI
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <a href={video.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-1" /> YouTube
                      </a>
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {nextPageToken && !loading && (
          <div className="flex justify-center pt-4">
            <Button variant="outline" onClick={() => doSearch(nextPageToken)} disabled={loadingMore}>
              {loadingMore ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Load More
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default YouTubeSearch;
