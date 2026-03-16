import React, { useState } from 'react';
import { Layout } from '@/components/Layout';
import { ImageGallery } from '@/components/ImageGallery';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Database, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { useImageGallery } from '@/hooks/useImageGallery';
import { ImageDropZone } from '@/components/ImageDropZone';

const Gallery = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isUploading, uploadImages, fetchImages } = useImageGallery();
  const [isMigrating, setIsMigrating] = useState(false);
  const [isAutoMigrating, setIsAutoMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<{
    totalMigrated: number;
    errors: number;
    remaining: number;
    message: string;
  } | null>(null);

  const handleFilesSelected = async (files: FileList) => {
    await uploadImages(files);
    await fetchImages();
  };

  const runSingleBatch = async (): Promise<{ migrated: number; errors: number; remaining: number; success: boolean }> => {
    const { data, error } = await supabase.functions.invoke('migrate-images-to-storage', {});
    
    if (error) throw error;
    
    return {
      migrated: data.migrated || 0,
      errors: data.errors || 0,
      remaining: data.remaining || 0,
      success: data.success
    };
  };

  const runAutoMigration = async () => {
    if (!user) {
      toast({
        title: "Not Authenticated",
        description: "Please log in to run the migration.",
        variant: "destructive"
      });
      return;
    }

    setIsAutoMigrating(true);
    setIsMigrating(true);
    setMigrationProgress({ totalMigrated: 0, errors: 0, remaining: 0, message: 'Starting migration...' });

    let totalMigrated = 0;
    let totalErrors = 0;
    let remaining = 1;
    let batchCount = 0;
    const MAX_BATCHES = 100; // Safety limit to prevent infinite loops

    try {
      while (remaining > 0 && batchCount < MAX_BATCHES) {
        batchCount++;
        const result = await runSingleBatch();
        totalMigrated += result.migrated;
        totalErrors += result.errors;
        remaining = result.remaining;

        setMigrationProgress({
          totalMigrated,
          errors: totalErrors,
          remaining,
          message: remaining > 0 
            ? `Migrated ${totalMigrated} images, ${remaining} remaining...` 
            : `Complete! Migrated ${totalMigrated} images.`
        });

        // If no images were migrated in this batch, we're done
        if (result.migrated === 0) break;
        
        // Small delay to prevent overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      toast({
        title: "Migration Complete",
        description: `Successfully migrated ${totalMigrated} images${totalErrors > 0 ? ` with ${totalErrors} errors` : ''}.`
      });

      // Refresh to show updated images
      if (totalMigrated > 0) {
        await fetchImages(true);
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
      setIsAutoMigrating(false);
    }
  };

  const stopMigration = () => {
    setIsAutoMigrating(false);
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
        </div>
        
        {/* Drag and Drop Zone */}
        <ImageDropZone
          onFilesSelected={handleFilesSelected}
          isUploading={isUploading}
        />

        <div className="flex items-center justify-end">
          {/* Migration Tool */}
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium">Fix Loading Issues</p>
                <p className="text-xs text-muted-foreground">
                  Auto-migrate all base64 images to storage URLs
                </p>
              </div>
              {isAutoMigrating ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={stopMigration}
                >
                  Stop
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={runAutoMigration}
                  disabled={isMigrating || !user}
                >
                  {isMigrating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Database className="w-4 h-4 mr-2" />
                  )}
                  {isMigrating ? 'Migrating...' : 'Auto-Migrate All'}
                </Button>
              )}
            </CardContent>
            {migrationProgress && (
              <div className="px-4 pb-4 pt-0">
                <div className={`flex items-center gap-2 text-xs ${migrationProgress.errors > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                  {migrationProgress.remaining > 0 ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : migrationProgress.errors > 0 ? (
                    <AlertCircle className="w-3 h-3" />
                  ) : (
                    <CheckCircle className="w-3 h-3" />
                  )}
                  {migrationProgress.message}
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
