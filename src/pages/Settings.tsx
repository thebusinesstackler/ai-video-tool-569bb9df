import React from 'react';
import { Layout } from '@/components/Layout';
import { ApiKeyManager } from '@/components/ApiKeyManager';
import { KieApiKeyManager } from '@/components/KieApiKeyManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SettingsIcon } from 'lucide-react';

const Settings = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Configure your API integrations and platform settings.
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ApiKeyManager />
          
          <KieApiKeyManager />
          
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <SettingsIcon className="w-5 h-5 text-primary" />
                Coming Soon
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-muted-foreground">
                <p>Additional integrations coming soon:</p>
                <ul className="space-y-2">
                  <li>• ElevenLabs API (Text-to-Speech)</li>
                  <li>• Kie.ai Integration (Video Generation)</li>
                  <li>• Brand Voice Configuration</li>
                  <li>• Export Settings</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;