import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { createDriveFolder, uploadToDriveFolder, requestDriveAccess } from '@/lib/googleDrive';
import { Loader2, Check, Copy, FolderUp } from 'lucide-react';

const DriveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 19.5h20L12 2z" />
    <path d="M2 19.5l5-8.5h14" />
    <path d="M17 11L22 19.5" />
  </svg>
);

interface BulkDriveExportProps {
  items: { url: string; name: string; mimeType?: string }[];
  folderName: string;
  label?: string;
  className?: string;
}

export const BulkDriveExport: React.FC<BulkDriveExportProps> = ({
  items,
  folderName,
  label,
  className,
}) => {
  const [uploading, setUploading] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [folderLink, setFolderLink] = useState<string | null>(null);
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

    if (items.length === 0) {
      toast({ title: 'Nothing to export', description: 'No files to upload.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    setCurrent(0);
    setTotal(items.length);
    setFolderLink(null);

    try {
      // Ensure we have access first
      await requestDriveAccess();

      // Create a folder
      const folderId = await createDriveFolder(folderName);

      let uploaded = 0;
      for (const item of items) {
        try {
          await uploadToDriveFolder(item.url, item.name, folderId, item.mimeType);
          uploaded++;
        } catch (err) {
          console.warn('Failed to upload:', item.name, err);
        }
        setCurrent(uploaded);
      }

      const link = `https://drive.google.com/drive/folders/${folderId}`;
      setFolderLink(link);
      navigator.clipboard.writeText(link).catch(() => {});
      toast({
        title: 'Exported to Google Drive!',
        description: `${uploaded}/${items.length} files uploaded. Folder link copied.`,
      });
    } catch (err: any) {
      console.error('Bulk Drive export error:', err);
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
    if (folderLink) {
      navigator.clipboard.writeText(folderLink);
      toast({ title: 'Folder link copied!' });
    }
  };

  const progress = total > 0 ? (current / total) * 100 : 0;

  if (folderLink) {
    return (
      <div className={className}>
        <Button size="sm" variant="outline" className="text-xs gap-1 h-7" onClick={copyLink}>
          <Check className="w-3.5 h-3.5 text-primary" />
          <Copy className="w-3 h-3" />
          Drive Folder Link
        </Button>
      </div>
    );
  }

  return (
    <div className={className}>
      {uploading ? (
        <div className="flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <Progress value={progress} className="w-24 h-1.5" />
          <span className="text-xs text-muted-foreground">{current}/{total}</span>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="text-xs gap-1.5 h-7" onClick={handleExport}>
          <DriveIcon />
          {label || `Export ${items.length} to Drive`}
        </Button>
      )}
    </div>
  );
};
