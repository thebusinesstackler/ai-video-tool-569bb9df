import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { KeyIcon, EyeIcon, EyeOffIcon, CheckIcon, XIcon, VideoIcon } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export const KieApiKeyManager = () => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const storedKey = localStorage.getItem('kie_api_key');
    if (storedKey) {
      setApiKey(storedKey);
      setIsConfigured(true);
    }
  }, []);

  const handleSaveKey = () => {
    if (!apiKey.trim()) {
      toast({
        title: "Invalid API Key",
        description: "Please enter a valid Kie.ai API key.",
        variant: "destructive"
      });
      return;
    }

    localStorage.setItem('kie_api_key', apiKey);
    setIsConfigured(true);
    
    toast({
      title: "API Key Saved",
      description: "Your Kie.ai API key has been saved locally.",
    });
  };

  const handleRemoveKey = () => {
    localStorage.removeItem('kie_api_key');
    setApiKey('');
    setIsConfigured(false);
    
    toast({
      title: "API Key Removed",
      description: "Your Kie.ai API key has been removed.",
    });
  };

  const maskedKey = apiKey ? `${apiKey.substring(0, 8)}${'*'.repeat(20)}${apiKey.substring(apiKey.length - 4)}` : '';

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <VideoIcon className="w-5 h-5 text-primary" />
          Kie.ai API Configuration
          {isConfigured && <Badge variant="default" className="ml-2"><CheckIcon className="w-3 h-3" /></Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            Your Kie.ai API key enables video generation and text-to-speech functionality.
            The key is stored locally in your browser for development use.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="kieApiKey">Kie.ai API Key</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="kieApiKey"
                type={showKey ? 'text' : 'password'}
                placeholder="kie_..."
                value={showKey ? apiKey : maskedKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="pr-10"
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-2"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
              </Button>
            </div>
            <Button onClick={handleSaveKey} variant="default">
              Save
            </Button>
            {isConfigured && (
              <Button onClick={handleRemoveKey} variant="destructive" size="sm">
                <XIcon className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {!isConfigured && (
          <Alert>
            <AlertDescription>
              You need to add your Kie.ai API key to enable video generation and voiceovers.
              Get your API key from <a href="https://kie.ai" target="_blank" rel="noopener noreferrer" className="text-primary underline">Kie.ai Platform</a>.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};