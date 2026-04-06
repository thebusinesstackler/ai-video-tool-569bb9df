import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowRightLeft, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const ASSET_TYPES = [
  { id: 'images', label: 'Image Gallery', description: 'Generated images & calendar images' },
  { id: 'products', label: 'Product Library', description: 'Brands, products & product gallery' },
  { id: 'videos', label: 'Video Projects', description: 'Reels, movies, video repos & tasks' },
  { id: 'twins', label: 'AI Twins', description: 'All AI Twin characters' },
  { id: 'logos', label: 'Logos', description: 'Uploaded logos' },
];

export const TransferAssetsDialog = () => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [selected, setSelected] = useState<string[]>(['images', 'products', 'videos', 'twins', 'logos']);
  const [isTransferring, setIsTransferring] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleTransfer = async () => {
    if (!email.trim()) { toast.error('Please enter an email address'); return; }
    if (email !== confirmEmail) { toast.error('Email addresses do not match'); return; }
    if (selected.length === 0) { toast.error('Select at least one asset type'); return; }

    setIsTransferring(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Please sign in first'); return; }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transfer-assets`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ targetEmail: email.trim(), assetTypes: selected }),
        }
      );

      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Transfer failed');

      toast.success(result.message);
      setOpen(false);
      setEmail('');
      setConfirmEmail('');
    } catch (err: any) {
      toast.error(err.message || 'Transfer failed');
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <ArrowRightLeft className="w-4 h-4" />
          Transfer Assets
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary" />
            Transfer Assets to Another Account
          </DialogTitle>
          <DialogDescription>
            Move your content to another user's account on this platform.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-xs text-destructive">
              This action is permanent. Transferred assets will be removed from your account and moved to the target account.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Recipient Email</Label>
            <Input
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Confirm Email</Label>
            <Input
              type="email"
              placeholder="Re-enter email to confirm"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Select Assets to Transfer</Label>
            <div className="space-y-2">
              {ASSET_TYPES.map((type) => (
                <label
                  key={type.id}
                  className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selected.includes(type.id)}
                    onCheckedChange={() => toggle(type.id)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">{type.label}</p>
                    <p className="text-xs text-muted-foreground">{type.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <Button
            onClick={handleTransfer}
            disabled={isTransferring || !email || email !== confirmEmail || selected.length === 0}
            className="w-full"
            variant="destructive"
          >
            {isTransferring ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Transferring...</>
            ) : (
              'Transfer Selected Assets'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
