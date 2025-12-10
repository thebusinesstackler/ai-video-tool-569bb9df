import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { 
  LOGO_ANIMATIONS, 
  LogoAnimation 
} from '@/data/reelTemplates';
import { 
  Upload, 
  X, 
  Image as ImageIcon,
  Sparkles,
  Loader2,
  Trash2
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface UserLogo {
  id: string;
  name: string | null;
  logo_url: string;
  created_at: string;
}

interface LogoUploaderProps {
  selectedLogoUrl: string | null;
  selectedAnimation: LogoAnimation;
  onLogoChange: (url: string | null) => void;
  onAnimationChange: (animation: LogoAnimation) => void;
  disabled?: boolean;
}

export function LogoUploader({
  selectedLogoUrl,
  selectedAnimation,
  onLogoChange,
  onAnimationChange,
  disabled = false
}: LogoUploaderProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [logos, setLogos] = useState<UserLogo[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchLogos();
    }
  }, [user]);

  const fetchLogos = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_logos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLogos(data || []);
    } catch (error) {
      console.error('Error fetching logos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    const validTypes = ['image/png', 'image/svg+xml', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a PNG, SVG, or WebP image (transparent background recommended)",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Logo must be under 5MB",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const fileName = `${user.id}/logos/${Date.now()}-logo.${ext}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('reels')
        .upload(fileName, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('reels').getPublicUrl(fileName);
      const logoUrl = urlData.publicUrl;

      // Save to database
      const { data: logoData, error: dbError } = await supabase
        .from('user_logos')
        .insert({
          user_id: user.id,
          name: file.name.replace(/\.[^/.]+$/, ''),
          logo_url: logoUrl
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setLogos(prev => [logoData, ...prev]);
      onLogoChange(logoUrl);

      toast({
        title: "Logo Uploaded",
        description: "Your logo has been saved"
      });
    } catch (error: any) {
      console.error('Logo upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload logo",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const deleteLogo = async (logo: UserLogo) => {
    if (!user) return;

    try {
      // Delete from storage
      const path = logo.logo_url.split('/reels/')[1];
      if (path) {
        await supabase.storage.from('reels').remove([path]);
      }

      // Delete from database
      await supabase.from('user_logos').delete().eq('id', logo.id);

      setLogos(prev => prev.filter(l => l.id !== logo.id));
      
      if (selectedLogoUrl === logo.logo_url) {
        onLogoChange(null);
      }

      toast({
        title: "Logo Deleted",
        description: "Logo has been removed"
      });
    } catch (error) {
      console.error('Delete logo error:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Your Logo</Label>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Upload className="w-4 h-4 mr-2" />
          )}
          Upload Logo
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/svg+xml,image/webp"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* Logo Selection Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : logos.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {logos.map((logo) => (
            <div key={logo.id} className="relative group">
              <button
                onClick={() => onLogoChange(logo.logo_url)}
                disabled={disabled}
                className={cn(
                  "w-full aspect-square rounded-lg border-2 transition-all overflow-hidden bg-muted/30",
                  "hover:border-primary/50",
                  selectedLogoUrl === logo.logo_url 
                    ? "border-primary ring-2 ring-primary/20" 
                    : "border-border",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <img 
                  src={logo.logo_url} 
                  alt={logo.name || 'Logo'}
                  className="w-full h-full object-contain p-2"
                />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteLogo(logo);
                }}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <ImageIcon className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No logos uploaded yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              PNG or SVG with transparent background recommended
            </p>
          </CardContent>
        </Card>
      )}

      {/* Animation Selector */}
      {selectedLogoUrl && (
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Logo Animation
          </Label>
          <Select
            value={selectedAnimation}
            onValueChange={(value) => onAnimationChange(value as LogoAnimation)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select animation" />
            </SelectTrigger>
            <SelectContent>
              {LOGO_ANIMATIONS.map((anim) => (
                <SelectItem key={anim.id} value={anim.id}>
                  <div className="flex flex-col">
                    <span>{anim.name}</span>
                    <span className="text-xs text-muted-foreground">{anim.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
