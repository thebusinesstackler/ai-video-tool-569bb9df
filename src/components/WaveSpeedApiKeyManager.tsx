import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EyeIcon, EyeOffIcon, KeyIcon, CheckCircleIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const WaveSpeedApiKeyManager = () => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const stored = localStorage.getItem('wavespeed_api_key');
    if (stored) {
      setApiKey(stored);
      setIsConfigured(true);
    }
  }, []);

  const handleSaveKey = () => {
    if (!apiKey.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid API key",
        variant: "destructive"
      });
      return;
    }

    localStorage.setItem('wavespeed_api_key', apiKey.trim());
    setIsConfigured(true);
    toast({
      title: "Success",
      description: "WaveSpeed AI API key saved successfully",
    });
  };

  const handleRemoveKey = () => {
    localStorage.removeItem('wavespeed_api_key');
    setApiKey('');
    setIsConfigured(false);
    toast({
      title: "Success",
      description: "WaveSpeed AI API key removed",
    });
  };

  const maskedKey = apiKey ? `${apiKey.substring(0, 8)}${'*'.repeat(Math.max(0, apiKey.length - 12))}${apiKey.substring(apiKey.length - 4)}` : '';

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyIcon className="h-5 w-5" />
          WaveSpeed AI API Key
          {isConfigured && (
            <Badge variant="secondary" className="ml-auto">
              <CheckCircleIcon className="h-3 w-3 mr-1" />
              Configured
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            Your WaveSpeed AI API key is used to generate videos. Get your API key from{' '}
            <a 
              href="https://wavespeed.ai" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              wavespeed.ai
            </a>
          </AlertDescription>
        </Alert>
        
        <div className="space-y-2">
          <div className="relative">
            <Input
              type={showKey ? "text" : "password"}
              placeholder="Enter your WaveSpeed AI API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? (
                <EyeOffIcon className="h-4 w-4" />
              ) : (
                <EyeIcon className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={handleSaveKey} disabled={!apiKey.trim()}>
              Save API Key
            </Button>
            {isConfigured && (
              <Button variant="outline" onClick={handleRemoveKey}>
                Remove Key
              </Button>
            )}
          </div>
        </div>

        {isConfigured && (
          <div className="text-sm text-muted-foreground">
            Current key: <code className="bg-muted px-1 py-0.5 rounded">{maskedKey}</code>
          </div>
        )}

        {!isConfigured && (
          <Alert>
            <AlertDescription>
              Please add your WaveSpeed AI API key to start creating videos.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default WaveSpeedApiKeyManager;