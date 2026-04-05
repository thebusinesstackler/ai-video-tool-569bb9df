import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  FolderPlus, Folder, FolderOpen, ArrowLeft, Copy, Trash2,
  Plus, ChevronRight, Loader2, Volume2, Type, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface HookFolder {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
  hookCount?: number;
}

interface SavedHook {
  id: string;
  hook_text: string;
  hook_type: string | null;
  on_screen_text: string | null;
  voiceover_version: string | null;
  best_platform: string | null;
  why_chosen: string | null;
  created_at: string;
}

const FOLDER_COLORS = [
  '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6', '#10b981',
  '#ec4899', '#f97316', '#06b6d4', '#6366f1', '#14b8a6',
];

export function HookLibrary() {
  const { user } = useAuth();
  const [folders, setFolders] = useState<HookFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<HookFolder | null>(null);
  const [hooks, setHooks] = useState<SavedHook[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#f59e0b');

  const loadFolders = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data: foldersData, error } = await supabase
        .from('hook_folders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Get hook counts
      const { data: countData } = await supabase
        .from('saved_hooks')
        .select('folder_id')
        .eq('user_id', user.id);

      const countMap: Record<string, number> = {};
      countData?.forEach((h: any) => {
        countMap[h.folder_id] = (countMap[h.folder_id] || 0) + 1;
      });

      setFolders((foldersData || []).map((f: any) => ({
        ...f,
        hookCount: countMap[f.id] || 0,
      })));
    } catch (err: any) {
      console.error('Error loading folders:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const loadHooks = useCallback(async (folderId: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('saved_hooks')
      .select('*')
      .eq('user_id', user.id)
      .eq('folder_id', folderId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error loading hooks:', error);
      return;
    }
    setHooks((data || []) as SavedHook[]);
  }, [user]);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  useEffect(() => {
    if (selectedFolder) loadHooks(selectedFolder.id);
  }, [selectedFolder, loadHooks]);

  const createFolder = async () => {
    if (!user || !newFolderName.trim()) return;
    const { error } = await supabase.from('hook_folders').insert({
      user_id: user.id,
      name: newFolderName.trim(),
      color: newFolderColor,
    } as any);
    if (error) {
      toast.error('Failed to create folder');
      return;
    }
    toast.success(`Folder "${newFolderName.trim()}" created`);
    setNewFolderName('');
    setShowNewFolder(false);
    loadFolders();
  };

  const deleteFolder = async (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('hook_folders').delete().eq('id', folderId);
    if (error) { toast.error('Failed to delete folder'); return; }
    toast.success('Folder deleted');
    if (selectedFolder?.id === folderId) setSelectedFolder(null);
    loadFolders();
  };

  const deleteHook = async (hookId: string) => {
    const { error } = await supabase.from('saved_hooks').delete().eq('id', hookId);
    if (error) { toast.error('Failed to delete hook'); return; }
    toast.success('Hook deleted');
    setHooks(prev => prev.filter(h => h.id !== hookId));
  };

  const copyHook = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  // Folder list view
  if (!selectedFolder) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Organize your best hooks by brand or product.
          </p>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowNewFolder(!showNewFolder)}>
            <FolderPlus className="h-3.5 w-3.5" /> New Folder
          </Button>
        </div>

        {showNewFolder && (
          <Card className="border-primary/30">
            <CardContent className="p-3 space-y-3">
              <Input
                placeholder="Folder name (e.g., Likecyke)"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') createFolder(); }}
                autoFocus
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Color:</span>
                {FOLDER_COLORS.map(c => (
                  <button
                    key={c}
                    className={cn("w-5 h-5 rounded-full border-2 transition-all", newFolderColor === c ? 'border-foreground scale-110' : 'border-transparent')}
                    style={{ backgroundColor: c }}
                    onClick={() => setNewFolderColor(c)}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="gap-1" onClick={createFolder} disabled={!newFolderName.trim()}>
                  <Plus className="h-3 w-3" /> Create
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowNewFolder(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : folders.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Folder className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No folders yet</p>
            <p className="text-xs mt-1">Create a folder to start organizing hooks by brand or product.</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {folders.map(folder => (
                <Card
                  key={folder.id}
                  className="cursor-pointer hover:border-primary/30 transition-colors group"
                  onClick={() => setSelectedFolder(folder)}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${folder.color}20` }}>
                      <Folder className="h-4 w-4" style={{ color: folder.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{folder.name}</p>
                      <p className="text-[10px] text-muted-foreground">{folder.hookCount || 0} hooks</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100"
                      onClick={(e) => deleteFolder(folder.id, e)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    );
  }

  // Folder detail view — show hooks
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedFolder(null); setHooks([]); }}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: `${selectedFolder.color}20` }}>
          <FolderOpen className="h-3.5 w-3.5" style={{ color: selectedFolder.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{selectedFolder.name}</p>
          <p className="text-[10px] text-muted-foreground">{hooks.length} hooks</p>
        </div>
      </div>

      <ScrollArea className="h-[480px]">
        {hooks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hooks in this folder yet</p>
            <p className="text-xs mt-1">Generate hooks and save them here, or they'll be added automatically.</p>
          </div>
        ) : (
          <div className="space-y-2 pr-1">
            {hooks.map(hook => (
              <Card key={hook.id} className="group">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-relaxed">"{hook.hook_text}"</p>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100" onClick={() => deleteHook(hook.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                  {hook.hook_type && (
                    <Badge variant="outline" className="text-[9px] h-4 capitalize">{hook.hook_type.replace(/-/g, ' ')}</Badge>
                  )}
                  {hook.on_screen_text && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Type className="h-2.5 w-2.5" /> {hook.on_screen_text}</p>
                  )}
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => copyHook(hook.hook_text)}>
                      <Copy className="h-2.5 w-2.5" /> Copy
                    </Button>
                    {hook.voiceover_version && (
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => copyHook(hook.voiceover_version!)}>
                        <Volume2 className="h-2.5 w-2.5" /> Copy VO
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// Dialog component for saving a hook to a folder from HookCard
export function SaveToFolderDialog({ hookText, hookType, onScreenText, voiceoverVersion, visualDirection, scores, bestFor, bestPlatform, whyChosen, children }: {
  hookText: string;
  hookType?: string;
  onScreenText?: string;
  voiceoverVersion?: string;
  visualDirection?: string;
  scores?: any;
  bestFor?: string[];
  bestPlatform?: string;
  whyChosen?: string;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [folders, setFolders] = useState<{ id: string; name: string; color: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    supabase.from('hook_folders').select('id, name, color').eq('user_id', user.id).order('name').then(({ data }) => {
      setFolders((data || []) as any[]);
    });
  }, [open, user]);

  const saveToFolder = async (folderId: string) => {
    if (!user) return;
    setIsSaving(true);
    const { error } = await supabase.from('saved_hooks').insert({
      user_id: user.id,
      folder_id: folderId,
      hook_text: hookText,
      hook_type: hookType || null,
      on_screen_text: onScreenText || null,
      voiceover_version: voiceoverVersion || null,
      visual_direction: visualDirection || null,
      scores: scores || null,
      best_for: bestFor || null,
      best_platform: bestPlatform || null,
      why_chosen: whyChosen || null,
    } as any);
    setIsSaving(false);
    if (error) { toast.error('Failed to save hook'); return; }
    toast.success('Hook saved to folder');
    setOpen(false);
  };

  const createAndSave = async () => {
    if (!user || !newFolderName.trim()) return;
    setIsSaving(true);
    const { data, error } = await supabase.from('hook_folders').insert({
      user_id: user.id,
      name: newFolderName.trim(),
    } as any).select('id').single();
    if (error || !data) { toast.error('Failed to create folder'); setIsSaving(false); return; }
    await saveToFolder(data.id);
    setNewFolderName('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Save Hook to Folder</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground italic mb-2 line-clamp-2">"{hookText}"</p>
        {folders.length > 0 && (
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {folders.map(f => (
              <Button
                key={f.id}
                variant="outline"
                className="w-full justify-start gap-2 h-9 text-sm"
                disabled={isSaving}
                onClick={() => saveToFolder(f.id)}
              >
                <Folder className="h-3.5 w-3.5" style={{ color: f.color }} />
                {f.name}
              </Button>
            ))}
          </div>
        )}
        <div className="flex gap-2 mt-2">
          <Input
            placeholder="New folder name..."
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') createAndSave(); }}
            className="text-sm"
          />
          <Button size="sm" disabled={!newFolderName.trim() || isSaving} onClick={createAndSave}>
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
