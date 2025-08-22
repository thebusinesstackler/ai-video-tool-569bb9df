import React from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SettingsIcon, ShieldCheckIcon, ServerIcon } from 'lucide-react';

const Settings = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Platform configuration and security information.
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <ShieldCheckIcon className="w-5 h-5 text-green-500" />
                Security Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm">
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-200">API Keys Secured</p>
                    <p className="text-green-600 dark:text-green-300">All API keys are stored server-side in Supabase</p>
                  </div>
                  <ShieldCheckIcon className="w-5 h-5 text-green-500" />
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium text-foreground">Configured Services:</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• OpenAI API (Script Generation)</li>
                    <li>• Kie.ai API (Video Creation)</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <ServerIcon className="w-5 h-5 text-primary" />
                Backend Integration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm">
                <div className="space-y-2">
                  <h4 className="font-medium text-foreground">Supabase Edge Functions:</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• generate-script (OpenAI integration)</li>
                    <li>• kie-video (Video generation & status)</li>
                  </ul>
                </div>
                
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-blue-800 dark:text-blue-200 text-xs">
                    All API communications are handled securely through Supabase Edge Functions, 
                    keeping your API keys safe and never exposing them to the browser.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <SettingsIcon className="w-5 h-5 text-primary" />
                Coming Soon
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-muted-foreground">
                <p>Additional features coming soon:</p>
                <ul className="space-y-2">
                  <li>• ElevenLabs API (Text-to-Speech)</li>
                  <li>• Brand Voice Configuration</li>
                  <li>• Export Settings</li>
                  <li>• Usage Analytics</li>
                  <li>• Team Collaboration</li>
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