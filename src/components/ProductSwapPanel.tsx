import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { Package, Upload, Loader2, Wand2, X, FolderOpen, Trash2 } from 'lucide-react';

interface ProductSwapPanelProps {
  /** The character shot image URL to swap the product into */
  shotImageUrl: string;
  /** Character description for the edit prompt */
  characterDescription: string;
  /** Callback when the shot image is replaced with product-swapped version */
  onShotSwapped: (newImageUrl: string) => void;
  disabled?: boolean;
}

interface ProductImage {
  id: string;
  image_url: string;
  name: string | null;
  created_at: string;
}

export const ProductSwapPanel: React.FC<ProductSwapPanelProps> = ({
  shotImageUrl,
  characterDescription,
  onShotSwapped,
  disabled = false,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [selectedProductUrl, setSelectedProductUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  useEffect(() => {
    if (user) loadProductLibrary();
  }, [user]);

  const loadProductLibrary = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('product_images')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error && data) setProductImages(data as ProductImage[]);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const fileName = `products/${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('reels')
        .upload(fileName, file, { contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('reels').getPublicUrl(fileName);

      // Save to product library
      const { error: dbError } = await supabase.from('product_images').insert({
        user_id: user.id,
        image_url: publicUrl,
        name: file.name.replace(/\.[^/.]+$/, ''),
      } as any);
      if (dbError) console.error('DB save error:', dbError);

      setSelectedProductUrl(publicUrl);
      await loadProductLibrary();
      toast({ title: 'Product uploaded', description: 'Saved to your product library' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSwap = async () => {
    if (!selectedProductUrl || !shotImageUrl) return;
    setIsSwapping(true);
    try {
      const { data, error } = await supabase.functions.invoke('edit-scene-image', {
        body: {
          prompt: `Replace any product/item the person is holding with the product shown in the second reference image. Keep the person EXACTLY the same — same face, pose, clothing, lighting, and background. Only swap the product/item in their hand with the new product.`,
          referenceImages: [shotImageUrl, selectedProductUrl],
          characterDescription,
        }
      });
      if (error) throw error;
      if (data?.imageUrl) {
        onShotSwapped(data.imageUrl);
        toast({ title: 'Product swapped! ✨', description: 'Character image updated with your product' });
      } else {
        throw new Error('No image returned');
      }
    } catch (err: any) {
      toast({ title: 'Swap failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsSwapping(false);
    }
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from('product_images').delete().eq('id', id);
    if (!error) {
      setProductImages(prev => prev.filter(p => p.id !== id));
      if (productImages.find(p => p.id === id)?.image_url === selectedProductUrl) {
        setSelectedProductUrl(null);
      }
    }
  };

  return (
    <div className="border border-dashed border-muted-foreground/30 rounded-lg p-3 bg-muted/20 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium">Product Image</span>
        </div>
        {productImages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => setShowLibrary(!showLibrary)}
          >
            <FolderOpen className="w-3 h-3 mr-1" />
            Library ({productImages.length})
          </Button>
        )}
      </div>

      {/* Product Library */}
      {showLibrary && productImages.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto">
          {productImages.map(p => (
            <div
              key={p.id}
              className={`relative cursor-pointer rounded-md overflow-hidden border-2 transition-all ${
                selectedProductUrl === p.image_url
                  ? 'border-primary ring-2 ring-primary/40'
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => setSelectedProductUrl(p.image_url)}
            >
              <img src={p.image_url} alt={p.name || 'Product'} className="w-full aspect-square object-cover" />
              <button
                className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5"
                onClick={(e) => { e.stopPropagation(); deleteProduct(p.id); }}
              >
                <X className="h-2 w-2 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Selected product preview + swap */}
      {selectedProductUrl ? (
        <div className="flex items-center gap-3">
          <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-border shrink-0">
            <img src={selectedProductUrl} alt="Product" className="w-full h-full object-cover" />
            <button
              className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5"
              onClick={() => setSelectedProductUrl(null)}
            >
              <X className="h-2 w-2 text-white" />
            </button>
          </div>
          <Button
            size="sm"
            className="gap-1 text-xs h-8 flex-1"
            onClick={handleSwap}
            disabled={isSwapping || disabled || !shotImageUrl}
          >
            {isSwapping ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Wand2 className="h-3 w-3" />
            )}
            Swap Product In
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs h-8 flex-1"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || disabled}
          >
            {isUploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Upload className="h-3 w-3" />
            )}
            Upload Product
          </Button>
          {productImages.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-xs h-8"
              onClick={() => setShowLibrary(true)}
            >
              <FolderOpen className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
