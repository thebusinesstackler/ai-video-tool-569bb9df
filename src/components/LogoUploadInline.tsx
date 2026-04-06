import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, X, Shirt } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

interface LogoUploadInlineProps {
  logoUrl: string | null;
  onLogoChange: (url: string | null) => void;
  label?: string;
  description?: string;
}

export const LogoUploadInline: React.FC<LogoUploadInlineProps> = ({
  logoUrl,
  onLogoChange,
  label = 'Shirt/Brand Logo (optional)',
  description = 'Upload a logo to place on your character\'s shirt in generated images.'
}) => {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const fileName = `logos/${user.id}/${Date.now()}-shirt-logo.${ext}`;

      const { data, error } = await supabase.storage
        .from('reels')
        .upload(fileName, file, { contentType: file.type, upsert: true });

      if (error) throw error;

      const { data: publicUrl } = supabase.storage.from('reels').getPublicUrl(fileName);
      onLogoChange(publicUrl.publicUrl);
    } catch (err: any) {
      console.error('Logo upload error:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Shirt className="w-4 h-4 text-primary" />
        {label}
      </Label>
      <p className="text-xs text-muted-foreground">{description}</p>

      {logoUrl ? (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border">
          <img
            src={logoUrl}
            alt="Shirt logo"
            className="w-16 h-16 object-contain rounded bg-white p-1 border"
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Logo uploaded</p>
            <p className="text-xs text-muted-foreground">Will be placed on character's shirt</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onLogoChange(null)}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="gap-2"
        >
          <Upload className="w-4 h-4" />
          {isUploading ? 'Uploading...' : 'Upload Logo'}
        </Button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};
