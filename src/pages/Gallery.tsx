import React, { useState } from 'react';
import { Layout } from '@/components/Layout';
import { ImageGallery } from '@/components/ImageGallery';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Database, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';

const Gallery = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{
    migrated: number;
    errors: number;
    message: string;
  } | null>(null);

  const runMigration = async () => {
    if (!user) {
      toast({
        title: "Not Authenticated",
        description: "Please log in to run the migration.",
        variant: "destructive"
      });
      return;
    }

    setIsMigrating(true);
    setMigrationResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('migrate-images-to-storage', {});

      if (error) throw error;

      setMigrationResult({
        migrated: data.migrated || 0,
        errors: data.errors || 0,
        message: data.message || 'Migration complete'
      });

      toast({
        title: data.migrated > 0 ? "Migration Complete" : "No Images to Migrate",
        description: data.message
      });

      // Refresh the page to show updated images
      if (data.migrated > 0) {
        window.location.reload();
      }
    } catch (error: any) {
      console.error('Migration error:', error);
      toast({
        title: "Migration Failed",
        description: error.message || "Failed to migrate images.",
        variant: "destructive"
      });
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Image Gallery</h1>
            <p className="text-muted-foreground mt-2">
              All your generated images in one place
            </p>
          </div>
          
          {/* Migration Tool */}
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium">Fix Loading Issues</p>
                <p className="text-xs text-muted-foreground">
                  Convert base64 images to storage URLs
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={runMigration}
                disabled={isMigrating || !user}
              >
                {isMigrating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Database className="w-4 h-4 mr-2" />
                )}
                {isMigrating ? 'Migrating...' : 'Migrate Images'}
              </Button>
            </CardContent>
            {migrationResult && (
              <div className={`px-4 pb-4 pt-0`}>
                <div className={`flex items-center gap-2 text-xs ${migrationResult.errors > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                  {migrationResult.errors > 0 ? (
                    <AlertCircle className="w-3 h-3" />
                  ) : (
                    <CheckCircle className="w-3 h-3" />
                  )}
                  {migrationResult.message}
                </div>
              </div>
            )}
          </Card>
        </div>
        
        <ImageGallery />
      </div>
    </Layout>
  );
};

export default Gallery;
