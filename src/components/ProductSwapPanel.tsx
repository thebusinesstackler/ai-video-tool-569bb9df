import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { Package, Upload, Loader2, Wand2, X, FolderOpen, Trash2, RefreshCw } from 'lucide-react';

interface ProductSwapPanelProps {
  /** The character shot image URL to swap the product into */
  shotImageUrl: string;
  /** Character description for the edit prompt */
  characterDescription: string;
  /** Callback when the shot image is replaced with product-swapped version */
  onShotSwapped: (newImageUrl: string) => void;
  /** All character shots for batch propagation */
  allShots?: { label: string; url: string }[];
  /** Callback to update all shots after batch swap */
  onBatchSwapped?: (updatedShots: { label: string; url: string }[]) => void;
  /** Index of the currently selected shot */
  currentShotIndex?: number;
  disabled?: boolean;
  /** Controlled product URL from parent (persists across re-renders) */
  controlledProductUrl?: string | null;
  /** Controlled prompt from parent */
  controlledPrompt?: string;
  /** Callback to sync product selection to parent */
  onProductChange?: (url: string | null, prompt: string) => void;
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
  allShots,
  onBatchSwapped,
  currentShotIndex = 0,
  disabled = false,
  controlledProductUrl,
  controlledPrompt,
  onProductChange,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [selectedProductUrl, setSelectedProductUrl] = useState<string | null>(controlledProductUrl ?? null);
  const [productPrompt, setProductPrompt] = useState(controlledPrompt ?? '');

  // Sync from parent when controlled props change (e.g. after resize remount)
  useEffect(() => {
    if (controlledProductUrl !== undefined && controlledProductUrl !== selectedProductUrl) {
      setSelectedProductUrl(controlledProductUrl);
    }
  }, [controlledProductUrl]);

  useEffect(() => {
    if (controlledPrompt !== undefined && controlledPrompt !== productPrompt) {
      setProductPrompt(controlledPrompt);
    }
  }, [controlledPrompt]);

  // Wrapper to sync product selection changes to parent
  const updateProductUrl = (url: string | null) => {
    setSelectedProductUrl(url);
    onProductChange?.(url, productPrompt);
  };
  const updateProductPrompt = (prompt: string) => {
    setProductPrompt(prompt);
    onProductChange?.(selectedProductUrl, prompt);
  };

  const [isUploading, setIsUploading] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [isBatchSwapping, setIsBatchSwapping] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
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

  const buildSwapPrompt = () => {
    const basePrompt = productPrompt.trim()
      ? `Replace the product/item the person is holding with: ${productPrompt.trim()}.`
      : `Replace the product/item the person is holding with the product shown in the second reference image.`;
    
    return `${basePrompt}

CRITICAL RULES — DO NOT VIOLATE:
- Keep the ENTIRE scene EXACTLY identical: same person, same face, same pose, same clothing, same hand position, same background, same lighting, same colors, same composition.
- ONLY change the product/object in the person's hand. Nothing else changes.
- The new product must match the size, angle, and perspective of the original item being held.
- Do NOT alter the person's expression, skin tone, hair, or any body part.
- Do NOT change the background, lighting, shadows, or any environmental element.
- The result should look like the SAME photo with ONLY the held item swapped.`;
  };

  const handleSwap = async () => {
    if (!selectedProductUrl || !shotImageUrl) return;
    setIsSwapping(true);
    try {
      const { data, error } = await supabase.functions.invoke('edit-scene-image', {
        body: {
          prompt: buildSwapPrompt(),
          referenceImages: [shotImageUrl, selectedProductUrl],
          characterDescription,
        }
      });
      if (error) throw error;
      if (data?.imageUrl) {
        onShotSwapped(data.imageUrl);
        toast({ title: 'Product swapped! ✨', description: 'Only the product was replaced — scene preserved.' });
        
        // Auto-propagate to other shots if available
        if (allShots && allShots.length > 1 && onBatchSwapped) {
          const shouldBatch = confirm(`Swap this product into all ${allShots.length - 1} other angle shots too?`);
          if (shouldBatch) {
            await handleBatchSwap(data.imageUrl);
          }
        }
      } else {
        throw new Error('No image returned');
      }
    } catch (err: any) {
      toast({ title: 'Swap failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsSwapping(false);
    }
  };

  const handleBatchSwap = async (firstSwappedUrl?: string) => {
    if (!selectedProductUrl || !allShots || !onBatchSwapped) return;
    setIsBatchSwapping(true);
    
    const otherShots = allShots.filter((_, i) => i !== currentShotIndex);
    setBatchProgress({ current: 0, total: otherShots.length });
    
    const updatedShots = [...allShots];
    // If we already have the first swap result, update it
    if (firstSwappedUrl) {
      updatedShots[currentShotIndex] = { ...updatedShots[currentShotIndex], url: firstSwappedUrl };
    }
    
    for (let i = 0; i < otherShots.length; i++) {
      const shot = otherShots[i];
      const originalIndex = allShots.findIndex(s => s === shot);
      setBatchProgress({ current: i + 1, total: otherShots.length });
      
      try {
        const { data, error } = await supabase.functions.invoke('edit-scene-image', {
          body: {
            prompt: buildSwapPrompt(),
            referenceImages: [shot.url, selectedProductUrl],
            characterDescription,
          }
        });
        
        if (!error && data?.imageUrl) {
          updatedShots[originalIndex] = { ...updatedShots[originalIndex], url: data.imageUrl };
        }
      } catch (err) {
        console.error(`Batch swap failed for shot ${originalIndex}:`, err);
      }
    }
    
    onBatchSwapped(updatedShots);
    setIsBatchSwapping(false);
    setBatchProgress({ current: 0, total: 0 });
    toast({ 
      title: 'Product swapped across all shots! ✨', 
      description: `Updated ${otherShots.length + 1} angle shots with your product.` 
    });
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
          <span className="text-xs font-medium">Product Swap</span>
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

      {/* Selected product preview + prompt + swap */}
      {selectedProductUrl ? (
        <div className="space-y-2">
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
            <div className="flex-1 space-y-1">
              <Input
                placeholder="Optional: describe the product (e.g. 'blue water bottle')"
                value={productPrompt}
                onChange={(e) => setProductPrompt(e.target.value)}
                className="h-7 text-xs"
                disabled={isSwapping || isBatchSwapping || disabled}
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              size="sm"
              className="gap-1 text-xs h-8 flex-1"
              onClick={handleSwap}
              disabled={isSwapping || isBatchSwapping || disabled || !shotImageUrl}
            >
              {isSwapping ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Wand2 className="h-3 w-3" />
              )}
              Swap Product
            </Button>
            
            {allShots && allShots.length > 1 && onBatchSwapped && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-xs h-8"
                onClick={() => handleBatchSwap()}
                disabled={isSwapping || isBatchSwapping || disabled}
                title="Swap product in all angle shots"
              >
                {isBatchSwapping ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                All ({allShots.length})
              </Button>
            )}
          </div>
          
          {isBatchSwapping && batchProgress.total > 0 && (
            <p className="text-[10px] text-muted-foreground text-center">
              Swapping {batchProgress.current}/{batchProgress.total} remaining shots...
            </p>
          )}
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
      
      <p className="text-[9px] text-muted-foreground leading-tight">
        Only the held product is replaced — scene, person, pose & lighting stay identical.
      </p>
    </div>
  );
};
