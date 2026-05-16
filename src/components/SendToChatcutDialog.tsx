import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { ArrowUp, ArrowDown, Upload, Loader2, Scissors, Trash2, Film } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ChatcutHandoffClip {
  url: string;
  name: string;
  thumbnail?: string | null;
  duration?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clips: ChatcutHandoffClip[];
  title?: string;
  transcript?: any;
}

export function SendToChatcutDialog({ open, onOpenChange, clips: initialClips, title, transcript }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [clips, setClips] = useState<ChatcutHandoffClip[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [projectName, setProjectName] = useState(title || "ChatCut Project");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setClips(initialClips);
      setSelected(new Set(initialClips.map((_, i) => i)));
      setProjectName(title || "ChatCut Project");
    }
  }, [open, initialClips, title]);

  const toggle = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= clips.length) return;
    const next = [...clips];
    [next[i], next[j]] = [next[j], next[i]];
    setClips(next);
    // remap selection
    const sel = new Set<number>();
    selected.forEach(idx => {
      if (idx === i) sel.add(j);
      else if (idx === j) sel.add(i);
      else sel.add(idx);
    });
    setSelected(sel);
  };

  const remove = (i: number) => {
    setClips(clips.filter((_, idx) => idx !== i));
    const sel = new Set<number>();
    selected.forEach(idx => {
      if (idx < i) sel.add(idx);
      else if (idx > i) sel.add(idx - 1);
    });
    setSelected(sel);
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Sign in required", variant: "destructive" });
      return;
    }
    setUploading(true);
    const newClips: ChatcutHandoffClip[] = [];
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("video/")) continue;
        const ext = file.name.split('.').pop() || 'mp4';
        const path = `${user.id}/uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from('reels').upload(path, file, { contentType: file.type });
        if (error) {
          console.error('upload failed', error);
          continue;
        }
        const { data: pub } = supabase.storage.from('reels').getPublicUrl(path);
        newClips.push({ url: pub.publicUrl, name: file.name });
      }
      const merged = [...clips, ...newClips];
      setClips(merged);
      // auto-select new ones
      setSelected(prev => {
        const next = new Set(prev);
        newClips.forEach((_, idx) => next.add(clips.length + idx));
        return next;
      });
      if (newClips.length > 0) {
        toast({ title: `Uploaded ${newClips.length} clip(s)` });
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const send = () => {
    const chosen = clips.filter((_, i) => selected.has(i));
    if (chosen.length === 0) {
      toast({ title: "Select at least one clip", variant: "destructive" });
      return;
    }
    const payload: any = {
      title: projectName,
      timelineVideos: chosen.map(c => ({ url: c.url, name: c.name, duration: c.duration })),
      // legacy single-video fields so existing handler still bootstraps a player
      videoUrl: chosen[0].url,
      transcript,
    };
    sessionStorage.setItem('chatcut-handoff', JSON.stringify(payload));
    // also write legacy key for backward compat with handler
    sessionStorage.setItem('vizard-to-chatcut', JSON.stringify(payload));
    onOpenChange(false);
    toast({ title: "Sending to ChatCut AI", description: `${chosen.length} clip(s) queued` });
    navigate('/chatcut-ai');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-primary" />
            Send to ChatCut AI
          </DialogTitle>
          <DialogDescription>
            Pick clips, reorder them, and we'll drop them onto a fresh ChatCut timeline ready to edit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 flex-1 min-h-0 flex flex-col">
          <div>
            <label className="text-xs text-muted-foreground">Project name</label>
            <Input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="ChatCut Project" />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              Clips ({selected.size}/{clips.length} selected)
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelected(new Set(clips.map((_, i) => i)))}>All</Button>
              <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>None</Button>
            </div>
          </div>

          <ScrollArea className="flex-1 border rounded-lg p-2 max-h-[50vh]">
            {clips.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-12">
                <Film className="w-10 h-10 mx-auto mb-2 opacity-40" />
                No clips yet — upload some below.
              </div>
            ) : (
              <div className="space-y-2">
                {clips.map((clip, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded border bg-card">
                    <Checkbox checked={selected.has(i)} onCheckedChange={() => toggle(i)} />
                    <div className="w-16 h-12 rounded overflow-hidden bg-muted shrink-0">
                      {clip.thumbnail ? (
                        <img src={clip.thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <video src={`${clip.url}#t=0.5`} className="w-full h-full object-cover" preload="metadata" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{clip.name}</p>
                      {clip.duration ? <p className="text-xs text-muted-foreground">{clip.duration.toFixed(1)}s</p> : null}
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, -1)} disabled={i === 0}>
                        <ArrowUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, 1)} disabled={i === clips.length - 1}>
                        <ArrowDown className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(i)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div>
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              multiple
              hidden
              onChange={e => handleUpload(e.target.files)}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Upload more clips
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={send} disabled={selected.size === 0} className="bg-gradient-primary">
            <Scissors className="w-4 h-4 mr-2" />
            Send {selected.size} clip{selected.size === 1 ? '' : 's'} to ChatCut
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
