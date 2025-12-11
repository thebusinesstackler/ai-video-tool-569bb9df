import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageDropZoneProps {
  onFilesSelected: (files: FileList) => void;
  isUploading?: boolean;
  className?: string;
  compact?: boolean;
}

export const ImageDropZone: React.FC<ImageDropZoneProps> = ({
  onFilesSelected,
  isUploading = false,
  className,
  compact = false
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      onFilesSelected(files);
    }
  }, [onFilesSelected]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('handleFileChange triggered', e.target.files);
    if (e.target.files && e.target.files.length > 0) {
      console.log('Files selected:', e.target.files.length, 'files');
      // Create a copy of files before clearing the input, since FileList is a live reference
      const filesCopy = new DataTransfer();
      Array.from(e.target.files).forEach(file => filesCopy.items.add(file));
      onFilesSelected(filesCopy.files);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (compact) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative",
          className
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className={cn(
            "transition-all",
            isDragOver && "ring-2 ring-primary ring-offset-2"
          )}
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Upload className="w-4 h-4 mr-2" />
          )}
          Upload
        </Button>
        {isDragOver && (
          <div className="absolute inset-0 bg-primary/10 rounded-md pointer-events-none" />
        )}
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !isUploading && fileInputRef.current?.click()}
      className={cn(
        "relative border-2 border-dashed rounded-lg p-8 transition-all cursor-pointer",
        "flex flex-col items-center justify-center gap-3",
        "hover:border-primary/50 hover:bg-primary/5",
        isDragOver 
          ? "border-primary bg-primary/10 scale-[1.02]" 
          : "border-muted-foreground/25",
        isUploading && "pointer-events-none opacity-60",
        className
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      
      <div className={cn(
        "p-4 rounded-full transition-colors",
        isDragOver ? "bg-primary/20" : "bg-muted"
      )}>
        {isUploading ? (
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        ) : (
          <ImageIcon className={cn(
            "w-8 h-8 transition-colors",
            isDragOver ? "text-primary" : "text-muted-foreground"
          )} />
        )}
      </div>

      <div className="text-center">
        <p className={cn(
          "font-medium transition-colors",
          isDragOver ? "text-primary" : "text-foreground"
        )}>
          {isUploading ? "Uploading..." : isDragOver ? "Drop images here" : "Drag & drop images"}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          or click to browse
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Supports JPG, PNG, WebP, GIF (max 10MB each)
      </p>
    </div>
  );
};