import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { KeyIcon, EyeIcon, EyeOffIcon, CheckIcon, XIcon } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export const ApiKeyManager = () => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const storedKey = localStorage.getItem('openai_api_key');
    if (storedKey) {
      setApiKey(storedKey);
      setIsConfigured(true);
    }
  }, []);

  const handleSaveKey = () => {
    if (!apiKey.trim()) {
      toast({
        title: "Invalid API Key",
        description: "Please enter a valid OpenAI API key.",
        variant: "destructive"
      });
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      toast({
        title: "Invalid Format",
        description: "OpenAI API keys should start with 'sk-'.",
        variant: "destructive"
      });
      return;
    }

    localStorage.setItem('openai_api_key', apiKey);
    setIsConfigured(true);
    
    toast({
      title: "API Key Saved",
      description: "Your OpenAI API key has been saved locally.",
    });
  };

  const handleRemoveKey = () => {
    localStorage.removeItem('openai_api_key');
    setApiKey('');
    setIsConfigured(false);
    
    toast({
      title: "API Key Removed",
      description: "Your OpenAI API key has been removed.",
    });
  };

  const maskedKey = apiKey ? `${apiKey.substring(0, 7)}${'*'.repeat(20)}${apiKey.substring(apiKey.length - 4)}` : '';

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <KeyIcon className="w-5 h-5 text-primary" />
          OpenAI API Configuration
          {isConfigured && <Badge variant="default" className="ml-2"><CheckIcon className="w-3 h-3" /></Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            Your API key is stored locally in your browser and is only used to generate scripts. 
            For production use, connect to Supabase for secure key management.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="apiKey">OpenAI API Key</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="apiKey"
                type={showKey ? 'text' : 'password'}
                placeholder="sk-..."
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
              You need to add your OpenAI API key to generate scripts. 
              Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">OpenAI Platform</a>.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};