import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';

export interface SelectedProductContext {
  productId: string;
  productName: string;
  description: string | null;
  benefits: string[] | null;
  targetAudience: string | null;
  imageUrl: string;
  imageLabel: string | null;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  benefits: string[] | null;
  target_audience: string | null;
  category: string | null;
  brand_id: string;
}

interface GalleryImage {
  id: string;
  image_url: string;
  label: string | null;
  is_primary: boolean;
  source: 'gallery' | 'graphic';
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (ctx: SelectedProductContext) => void;
}

export function ProductPickerDialog({ open, onOpenChange, onSelect }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [primaryImages, setPrimaryImages] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productImages, setProductImages] = useState<GalleryImage[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setSelectedProduct(null);
    setProductImages([]);
    loadProducts();
  }, [open, user]);

  const loadProducts = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const list = (data || []) as Product[];
      setProducts(list);

      // Fetch primary image per product
      if (list.length) {
        const ids = list.map((p) => p.id);
        const { data: gal } = await supabase
          .from('product_gallery')
          .select('product_id, image_url, is_primary')
          .in('product_id', ids);
        const map: Record<string, string> = {};
        (gal || []).forEach((row: any) => {
          if (row.is_primary || !map[row.product_id]) {
            map[row.product_id] = row.image_url;
          }
        });
        setPrimaryImages(map);
      }
    } catch (err: any) {
      console.error('Load products error:', err);
      toast({ title: 'Failed to load products', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickProduct = async (product: Product) => {
    setSelectedProduct(product);
    setIsLoadingImages(true);
    try {
      const [galleryRes, graphicsRes] = await Promise.all([
        supabase
          .from('product_gallery')
          .select('id, image_url, label, is_primary')
          .eq('product_id', product.id)
          .order('is_primary', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('product_graphics')
          .select('id, image_url, label')
          .eq('product_id', product.id)
          .order('created_at', { ascending: false }),
      ]);

      const combined: GalleryImage[] = [
        ...((galleryRes.data || []) as any[]).map((r) => ({
          id: r.id,
          image_url: r.image_url,
          label: r.label,
          is_primary: !!r.is_primary,
          source: 'gallery' as const,
        })),
        ...((graphicsRes.data || []) as any[]).map((r) => ({
          id: r.id,
          image_url: r.image_url,
          label: r.label,
          is_primary: false,
          source: 'graphic' as const,
        })),
      ];
      setProductImages(combined);
    } catch (err: any) {
      console.error('Load product images error:', err);
      toast({ title: 'Failed to load images', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoadingImages(false);
    }
  };

  const handlePickImage = (img: GalleryImage) => {
    if (!selectedProduct) return;
    onSelect({
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      description: selectedProduct.description,
      benefits: selectedProduct.benefits,
      targetAudience: selectedProduct.target_audience,
      imageUrl: img.image_url,
      imageLabel: img.label,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {selectedProduct ? (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedProduct(null); setProductImages([]); }}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                {selectedProduct.name}
              </>
            ) : (
              <>
                <Package className="w-5 h-5" />
                Pick a product to feature
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {selectedProduct
              ? 'Choose an image from this product to use as the reference. Product details will be added to your AI prompt automatically.'
              : 'Select a product from your library — its details and images become available for the video.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-2 px-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !selectedProduct ? (
            products.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>No products yet.</p>
                <p className="mt-1">Add products in the Product Library first.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-2">
                {products.map((p) => (
                  <Card
                    key={p.id}
                    className="cursor-pointer hover:ring-2 hover:ring-primary transition overflow-hidden"
                    onClick={() => handlePickProduct(p)}
                  >
                    <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                      {primaryImages[p.id] ? (
                        <img src={primaryImages[p.id]} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      {p.category && <p className="text-xs text-muted-foreground truncate">{p.category}</p>}
                    </div>
                  </Card>
                ))}
              </div>
            )
          ) : isLoadingImages ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : productImages.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No images yet for this product.</p>
              <p className="mt-1">Add images in the Product Library.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-2">
              {productImages.map((img) => (
                <Card
                  key={`${img.source}-${img.id}`}
                  className="cursor-pointer hover:ring-2 hover:ring-primary transition overflow-hidden relative"
                  onClick={() => handlePickImage(img)}
                >
                  <div className="aspect-square bg-muted overflow-hidden">
                    <img src={img.image_url} alt={img.label || 'Product image'} className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute top-1.5 left-1.5 flex gap-1">
                    {img.is_primary && <Badge className="text-[10px] h-4 px-1.5">Primary</Badge>}
                    {img.source === 'graphic' && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Graphic</Badge>}
                  </div>
                  {img.label && (
                    <div className="p-2">
                      <p className="text-xs text-muted-foreground truncate">{img.label}</p>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
