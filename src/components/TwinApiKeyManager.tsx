import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Key, Plus, Copy, Check, Trash2, AlertTriangle, Clock } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
}

export const TwinApiKeyManager: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchApiKeys();
    }
  }, [user]);

  const fetchApiKeys = async () => {
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('id, name, key_prefix, created_at, last_used_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApiKeys(data || []);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      toast({
        title: 'Error',
        description: 'Failed to load API keys',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateApiKey = async () => {
    if (!newKeyName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a name for your API key',
        variant: 'destructive',
      });
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-api-key', {
        body: { name: newKeyName.trim() },
      });

      if (error) throw error;

      setNewlyCreatedKey(data.key);
      setApiKeys(prev => [{
        id: data.id,
        name: data.name,
        key_prefix: data.key_prefix,
        created_at: data.created_at,
        last_used_at: null,
      }, ...prev]);
      setNewKeyName('');

      toast({
        title: 'API Key Created',
        description: 'Copy your key now - it won\'t be shown again!',
      });
    } catch (error) {
      console.error('Error generating API key:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate API key',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    if (newlyCreatedKey) {
      await navigator.clipboard.writeText(newlyCreatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Copied!',
        description: 'API key copied to clipboard',
      });
    }
  };

  const deleteApiKey = async (id: string) => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setApiKeys(prev => prev.filter(key => key.id !== id));
      toast({
        title: 'API Key Deleted',
        description: 'The API key has been revoked',
      });
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete API key',
        variant: 'destructive',
      });
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setNewlyCreatedKey(null);
    setCopied(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (!user) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Twin API Keys
        </CardTitle>
        <CardDescription>
          Generate API keys to access the AI Video Creator API programmatically.
          Use these keys with the <code className="bg-muted px-1 rounded">X-API-Key</code> header.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Generate New Key Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setNewlyCreatedKey(null);
            setCopied(false);
          }
        }}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Generate New API Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {newlyCreatedKey ? 'Your New API Key' : 'Generate API Key'}
              </DialogTitle>
              <DialogDescription>
                {newlyCreatedKey 
                  ? 'Copy this key now. For security, it will not be shown again.'
                  : 'Give your API key a name to help you identify it later.'}
              </DialogDescription>
            </DialogHeader>

            {newlyCreatedKey ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <code className="flex-1 text-sm break-all font-mono">
                    {newlyCreatedKey}
                  </code>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={copyToClipboard}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    Store this key securely. You won't be able to see it again after closing this dialog.
                  </p>
                </div>
                <DialogFooter>
                  <Button onClick={closeDialog}>
                    I've Copied My Key
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4">
                <Input
                  placeholder="e.g., Make.com Integration"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && generateApiKey()}
                />
                <DialogFooter>
                  <Button
                    onClick={generateApiKey}
                    disabled={generating || !newKeyName.trim()}
                  >
                    {generating ? 'Generating...' : 'Generate Key'}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* API Keys List */}
        {loading ? (
          <div className="text-center py-4 text-muted-foreground">
            Loading API keys...
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Key className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No API keys yet</p>
            <p className="text-sm">Generate a key to get started with the API</p>
          </div>
        ) : (
          <div className="space-y-3">
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between p-3 border rounded-lg bg-card"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{key.name}</span>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {key.key_prefix}...
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span>Created {formatDate(key.created_at)}</span>
                    {key.last_used_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Last used {formatDate(key.last_used_at)}
                      </span>
                    )}
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to revoke "{key.name}"? This action cannot be undone and any integrations using this key will stop working.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteApiKey(key.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Revoke Key
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}

        {/* API Documentation Hint */}
        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            <strong>API Endpoint:</strong>{' '}
            <code className="bg-muted px-1 rounded text-xs">
              https://aarnfihphqhwvwwcqgoc.supabase.co/functions/v1/twin-api
            </code>
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Actions: <code className="bg-muted px-1 rounded text-xs">list-twins</code>,{' '}
            <code className="bg-muted px-1 rounded text-xs">generate-video</code>,{' '}
            <code className="bg-muted px-1 rounded text-xs">status</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
