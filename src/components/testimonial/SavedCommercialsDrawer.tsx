import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TestimonialCommercial } from '@/types/testimonialCommercial';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FolderOpen, Trash2, Download, Film, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface SavedCommercialsDrawerProps {
  onLoad: (id: string) => void;
  refreshTrigger?: unknown;
}

export function SavedCommercialsDrawer({ onLoad, refreshTrigger }: SavedCommercialsDrawerProps) {
  const [open, setOpen] = useState(false);
  const [commercials, setCommercials] = useState<TestimonialCommercial[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCommercials = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('testimonial_commercials')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    if (data) setCommercials(data as unknown as TestimonialCommercial[]);
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchCommercials();
  }, [open, refreshTrigger]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('testimonial_commercials').delete().eq('id', id);
    if (error) toast.error('Failed to delete');
    else {
      setCommercials(prev => prev.filter(c => c.id !== id));
      toast.success('Deleted');
    }
  };

  const handleLoad = (id: string) => {
    onLoad(id);
    setOpen(false);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
          <FolderOpen className="h-3 w-3" /> Open
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[60vh]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <Film className="h-4 w-4 text-primary" />
            Saved Commercials
          </DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6 overflow-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : commercials.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No saved commercials yet</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {commercials.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleLoad(c.id)}
                  className="text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-all group"
                >
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Film className="h-2.5 w-2.5" />
                      {c.segments?.length || 0} segments
                    </Badge>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {formatDate(c.updated_at)}
                    </span>
                  </div>
                  <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {c.video_url && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" asChild onClick={(e) => e.stopPropagation()}>
                        <a href={c.video_url} target="_blank" rel="noopener"><Download className="h-3 w-3" /></a>
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => handleDelete(c.id, e)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
