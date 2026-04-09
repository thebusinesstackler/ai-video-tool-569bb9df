import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { uploadToDrive } from '@/lib/googleDrive';
import { Loader2, Check, Copy } from 'lucide-react';

// Simple inline Google Drive icon
const DriveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 19.5h20L12 2z" />
    <path d="M2 19.5l5-8.5h14" />
    <path d="M17 11L22 19.5" />
  </svg>
);

interface ExportToDriveButtonProps {
  videoUrl: string;
  fileName?: string;
  className?: string;
}

export const ExportToDriveButton: React.FC<ExportToDriveButtonProps> = ({
  videoUrl,
  fileName = 'Chatcut-Export',
  className,
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [driveLink, setDriveLink] = useState<string | null>(null);
  const { toast } = useToast();

  const handleExport = async () => {
    if (!import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID) {
      toast({
        title: 'Google Drive not configured',
        description: 'A Google OAuth Client ID is needed. Ask your admin to set VITE_GOOGLE_DRIVE_CLIENT_ID.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    setProgress(0);
    setDriveLink(null);

    try {
      const link = await uploadToDrive(videoUrl, fileName, setProgress);
      setDriveLink(link);
      toast({ title: 'Uploaded to Google Drive!', description: 'Shareable link copied to clipboard.' });
      navigator.clipboard.writeText(link).catch(() => {});
    } catch (err: any) {
      console.error('Drive export error:', err);
      toast({
        title: 'Export failed',
        description: err.message || 'Could not upload to Google Drive',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const copyLink = () => {
    if (driveLink) {
      navigator.clipboard.writeText(driveLink);
      toast({ title: 'Link copied!' });
    }
  };

  if (driveLink) {
    return (
      <div className={className}>
        <Button size="sm" variant="outline" className="text-xs gap-1 h-7" onClick={copyLink}>
          <Check className="w-3.5 h-3.5 text-green-500" />
          <Copy className="w-3 h-3" />
          Drive Link
        </Button>
      </div>
    );
  }

  return (
    <div className={className}>
      {uploading ? (
        <div className="flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <Progress value={progress} className="w-20 h-1.5" />
          <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="text-xs gap-1 h-7" onClick={handleExport}>
          <DriveIcon />
          Google Drive
        </Button>
      )}
    </div>
  );
};
