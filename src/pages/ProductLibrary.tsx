import { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Package, Plus, Trash2, ArrowLeft, Image as ImageIcon, Loader2,
  Building2, Upload, ChevronRight, Star, Youtube, Edit2,
  Sparkles, Wand2, Palette,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Brand {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  productCount?: number;
}

interface Product {
  id: string;
  brand_id: string;
  name: string;
  description: string | null;
  category: string | null;
  benefits: string[] | null;
  target_audience: string | null;
  youtube_short_url: string | null;
}

interface GalleryImage {
  id: string;
  product_id: string;
  image_url: string;
  label: string | null;
  is_primary: boolean;
}

interface GraphicImage {
  id: string;
  product_id: string;
  image_url: string;
  label: string | null;
  source_style: string | null;
  is_original: boolean;
}

const VARIATION_STYLES = [
  { key: 'lifestyle', label: 'Lifestyle Setting', icon: '🏡', desc: 'Warm home setting' },
  { key: 'white_bg', label: 'White Background', icon: '⬜', desc: 'Clean e-commerce shot' },
  { key: 'ugc', label: 'In-Hand UGC', icon: '🤳', desc: 'Authentic selfie style' },
  { key: 'flat_lay', label: 'Flat Lay', icon: '📐', desc: 'Top-down composition' },
  { key: 'nature', label: 'Nature/Outdoor', icon: '🌿', desc: 'Fresh outdoor feel' },
  { key: 'studio', label: 'Studio Dramatic', icon: '🎬', desc: 'Dark, premium lighting' },
];

export default function ProductLibrary() {
  const { user } = useAuth();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [graphics, setGraphics] = useState<GraphicImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewBrand, setShowNewBrand] = useState(false);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingGraphic, setIsUploadingGraphic] = useState(false);
  const [viewingImage, setViewingImage] = useState<GalleryImage | null>(null);
  const [viewingGraphic, setViewingGraphic] = useState<GraphicImage | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [isSavingLabel, setIsSavingLabel] = useState(false);
  const [generatingVariation, setGeneratingVariation] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generatingStyleCount, setGeneratingStyleCount] = useState(0);
  const [showVariationPicker, setShowVariationPicker] = useState<string | null>(null);

  // Form states
  const [brandForm, setBrandForm] = useState({ name: '', description: '' });
  const [productForm, setProductForm] = useState({
    name: '', description: '', category: '', benefits: '', target_audience: '', youtube_short_url: '',
  });

  const loadBrands = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .eq('user_id', user.id)
      .order('name');
    if (error) { console.error(error); setIsLoading(false); return; }

    // Get product counts
    const { data: prods } = await supabase
      .from('products')
      .select('brand_id')
      .eq('user_id', user.id);
    const countMap: Record<string, number> = {};
    prods?.forEach((p: any) => { countMap[p.brand_id] = (countMap[p.brand_id] || 0) + 1; });

    setBrands((data || []).map((b: any) => ({ ...b, productCount: countMap[b.id] || 0 })));
    setIsLoading(false);
  }, [user]);

  const loadProducts = useCallback(async (brandId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', user.id)
      .eq('brand_id', brandId)
      .order('name');
    setProducts((data || []) as Product[]);
  }, [user]);

  const loadGallery = useCallback(async (productId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from('product_gallery')
      .select('*')
      .eq('user_id', user.id)
      .eq('product_id', productId)
      .order('is_primary', { ascending: false });
    setGallery((data || []) as GalleryImage[]);
  }, [user]);

  const loadGraphics = useCallback(async (productId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from('product_graphics')
      .select('*')
      .eq('user_id', user.id)
      .eq('product_id', productId)
      .order('is_original', { ascending: false });
    setGraphics((data || []) as GraphicImage[]);
  }, [user]);

  useEffect(() => { loadBrands(); }, [loadBrands]);
  useEffect(() => { if (selectedBrand) loadProducts(selectedBrand.id); }, [selectedBrand, loadProducts]);
  useEffect(() => {
    if (selectedProduct) {
      loadGallery(selectedProduct.id);
      loadGraphics(selectedProduct.id);
    }
  }, [selectedProduct, loadGallery, loadGraphics]);

  const createBrand = async () => {
    if (!user || !brandForm.name.trim()) return;
    const { error } = await supabase.from('brands').insert({
      user_id: user.id, name: brandForm.name.trim(), description: brandForm.description.trim() || null,
    } as any);
    if (error) { toast.error('Failed to create brand'); return; }
    toast.success(`Brand "${brandForm.name}" created`);
    setBrandForm({ name: '', description: '' });
    setShowNewBrand(false);
    loadBrands();
  };

  const deleteBrand = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('brands').delete().eq('id', id);
    if (error) { toast.error('Failed to delete brand'); return; }
    toast.success('Brand deleted');
    if (selectedBrand?.id === id) { setSelectedBrand(null); setProducts([]); }
    loadBrands();
  };

  const createProduct = async () => {
    if (!user || !selectedBrand || !productForm.name.trim()) return;
    const benefits = productForm.benefits.split(',').map(b => b.trim()).filter(Boolean);
    const { data: inserted, error } = await supabase.from('products').insert({
      user_id: user.id,
      brand_id: selectedBrand.id,
      name: productForm.name.trim(),
      description: productForm.description.trim() || null,
      category: productForm.category.trim() || null,
      benefits: benefits.length > 0 ? benefits : null,
      target_audience: productForm.target_audience.trim() || null,
      youtube_short_url: productForm.youtube_short_url.trim() || null,
    } as any).select().single();
    if (error) { toast.error('Failed to create product'); return; }
    toast.success(`Product "${productForm.name}" created — upload images now`);
    setProductForm({ name: '', description: '', category: '', benefits: '', target_audience: '', youtube_short_url: '' });
    setShowNewProduct(false);
    loadBrands(); // refresh counts

    // Auto-navigate to the new product detail so user can upload images
    if (inserted) {
      setSelectedProduct(inserted as Product);
    } else {
      loadProducts(selectedBrand.id);
    }
  };

  const deleteProduct = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) { toast.error('Failed to delete product'); return; }
    toast.success('Product deleted');
    if (selectedProduct?.id === id) { setSelectedProduct(null); setGallery([]); setGraphics([]); }
    if (selectedBrand) loadProducts(selectedBrand.id);
    loadBrands();
  };

  const uploadImage = async (file: File) => {
    if (!user || !selectedProduct) return;
    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/products/${selectedProduct.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('project-files').upload(path, file);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(path);
      const imageUrl = urlData.publicUrl;

      const isPrimary = gallery.length === 0;
      const { error } = await supabase.from('product_gallery').insert({
        user_id: user.id, product_id: selectedProduct.id, image_url: imageUrl, is_primary: isPrimary,
      } as any);
      if (error) throw error;
      toast.success('Image uploaded');
      loadGallery(selectedProduct.id);
    } catch (err: any) {
      toast.error('Upload failed');
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const deleteImage = async (id: string) => {
    const { error } = await supabase.from('product_gallery').delete().eq('id', id);
    if (error) { toast.error('Failed to delete image'); return; }
    toast.success('Image deleted');
    if (selectedProduct) loadGallery(selectedProduct.id);
  };

  const setPrimary = async (id: string) => {
    if (!selectedProduct) return;
    // Unset all, then set this one
    await supabase.from('product_gallery').update({ is_primary: false } as any).eq('product_id', selectedProduct.id);
    await supabase.from('product_gallery').update({ is_primary: true } as any).eq('id', id);
    toast.success('Primary image set');
    loadGallery(selectedProduct.id);
  };

  const openImageViewer = (img: GalleryImage) => {
    setViewingImage(img);
    setEditingLabel(img.label || '');
  };

  const saveImageLabel = async () => {
    if (!viewingImage) return;
    setIsSavingLabel(true);
    const { error } = await supabase
      .from('product_gallery')
      .update({ label: editingLabel.trim() || null } as any)
      .eq('id', viewingImage.id);
    if (error) { toast.error('Failed to rename'); setIsSavingLabel(false); return; }
    toast.success('Image renamed');
    setViewingImage({ ...viewingImage, label: editingLabel.trim() || null });
    setGallery(prev => prev.map(g => g.id === viewingImage.id ? { ...g, label: editingLabel.trim() || null } : g));
    setIsSavingLabel(false);
  };

  // Upload graphic
  const uploadGraphic = async (file: File) => {
    if (!user || !selectedProduct) return;
    setIsUploadingGraphic(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/graphics/${selectedProduct.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('project-files').upload(path, file);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(path);
      const imageUrl = urlData.publicUrl;

      const { error } = await supabase.from('product_graphics').insert({
        user_id: user.id, product_id: selectedProduct.id, image_url: imageUrl, is_original: true,
      } as any);
      if (error) throw error;
      toast.success('Graphic uploaded');
      loadGraphics(selectedProduct.id);
    } catch (err: any) {
      toast.error('Upload failed');
      console.error(err);
    } finally {
      setIsUploadingGraphic(false);
    }
  };

  const deleteGraphic = async (id: string) => {
    const { error } = await supabase.from('product_graphics').delete().eq('id', id);
    if (error) { toast.error('Failed to delete graphic'); return; }
    toast.success('Graphic deleted');
    if (selectedProduct) loadGraphics(selectedProduct.id);
  };

  // Generate variations from a graphic
  const generateVariation = async (sourceImage: GraphicImage, styles: string[]) => {
    if (!selectedProduct || !user) return;
    const styleKey = styles.length === 1 ? styles[0] : 'all';
    setGeneratingVariation(styleKey);
    setGeneratingStyleCount(styles.length);
    setGenerationProgress(0);
    setShowVariationPicker(null);

    // Animate progress — ~20s per style, cap at 90% until done
    const estTotal = styles.length * 20000;
    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(90, (elapsed / estTotal) * 100);
      setGenerationProgress(pct);
    }, 500);

    try {
      const { data, error } = await supabase.functions.invoke('generate-product-variations', {
        body: {
          imageUrl: sourceImage.image_url,
          productName: selectedProduct.name,
          productDescription: selectedProduct.description,
          variationStyle: styles.length === 1 ? styles[0] : styles,
          productId: selectedProduct.id,
          targetTable: 'product_graphics',
        },
      });

      clearInterval(progressInterval);

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setGenerationProgress(100);
      const count = data?.results?.length || 0;
      if (count > 0) {
        toast.success(`${count} variation${count > 1 ? 's' : ''} generated!`);
        loadGraphics(selectedProduct.id);
      } else {
        toast.error('No variations generated — try again');
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      console.error('Variation error:', err);
      toast.error(err.message || 'Failed to generate variations');
    } finally {
      setTimeout(() => {
        setGeneratingVariation(null);
        setGenerationProgress(0);
        setGeneratingStyleCount(0);
      }, 1000);
    }
  };

  // === RENDER ===

  // Product detail view
  if (selectedProduct && selectedBrand) {
    const primaryImage = gallery.find(g => g.is_primary) || gallery[0];

    return (
      <Layout>
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => { setSelectedProduct(null); setGallery([]); setGraphics([]); }}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <p className="text-[10px] text-muted-foreground">{selectedBrand.name}</p>
              <h1 className="text-xl font-bold">{selectedProduct.name}</h1>
            </div>
            {selectedProduct.category && <Badge variant="secondary">{selectedProduct.category}</Badge>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Product Info */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Product Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {selectedProduct.description && (
                    <div><span className="text-muted-foreground text-xs">Description</span><p>{selectedProduct.description}</p></div>
                  )}
                  {selectedProduct.target_audience && (
                    <div><span className="text-muted-foreground text-xs">Target Audience</span><p>{selectedProduct.target_audience}</p></div>
                  )}
                  {selectedProduct.benefits && selectedProduct.benefits.length > 0 && (
                    <div>
                      <span className="text-muted-foreground text-xs">Benefits</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedProduct.benefits.map((b, i) => (
                          <Badge key={i} variant="outline" className="text-[10px]">{b}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedProduct.youtube_short_url && (
                    <div>
                      <span className="text-muted-foreground text-xs flex items-center gap-1"><Youtube className="h-3 w-3" /> YouTube Short</span>
                      <a href={selectedProduct.youtube_short_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline break-all">
                        {selectedProduct.youtube_short_url}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right: Reference Images */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" /> Product Images
                      <Badge variant="secondary" className="text-[10px]">{gallery.length}</Badge>
                      <span className="text-[10px] text-muted-foreground font-normal">(reference)</span>
                    </CardTitle>
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" className="hidden" multiple onChange={(e) => {
                        Array.from(e.target.files || []).forEach(uploadImage);
                      }} />
                      <Button variant="outline" size="sm" className="gap-1 text-xs pointer-events-none" asChild>
                        <span>{isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Upload</span>
                      </Button>
                    </label>
                  </div>
                </CardHeader>
                <CardContent>
                  {gallery.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <ImageIcon className="h-6 w-6 mx-auto mb-2 opacity-30" />
                      <p className="text-xs">Upload product reference photos.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {gallery.map(img => (
                        <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden border cursor-pointer"
                          onClick={() => openImageViewer(img)}>
                          <img src={img.image_url} alt={img.label || 'Product'} className="w-full h-full object-cover" />
                          {img.is_primary && (
                            <Badge className="absolute top-1 left-1 text-[8px] h-4 bg-primary/80">
                              <Star className="h-2 w-2 mr-0.5" /> Primary
                            </Badge>
                          )}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                            {!img.is_primary && (
                              <Button size="icon" variant="secondary" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setPrimary(img.id); }}>
                                <Star className="h-3 w-3" />
                              </Button>
                            )}
                            <Button size="icon" variant="destructive" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); deleteImage(img.id); }}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Product Graphics Section - full width below */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Palette className="h-4 w-4" /> Product Graphics
                  <Badge variant="secondary" className="text-[10px]">{graphics.length}</Badge>
                </CardTitle>
                <div className="flex gap-1.5">
                  {graphics.filter(g => g.is_original).length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs"
                      disabled={!!generatingVariation}
                      onClick={() => {
                        const original = graphics.find(g => g.is_original);
                        if (original) generateVariation(original, VARIATION_STYLES.map(s => s.key));
                      }}
                    >
                      {generatingVariation === 'all' ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      Generate All
                    </Button>
                  )}
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" multiple onChange={(e) => {
                      Array.from(e.target.files || []).forEach(uploadGraphic);
                    }} />
                    <Button variant="outline" size="sm" className="gap-1 text-xs pointer-events-none" asChild>
                      <span>{isUploadingGraphic ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Upload Graphic</span>
                    </Button>
                  </label>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {graphics.filter(g => g.is_original).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Palette className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Upload product graphics to generate variations.</p>
                  <p className="text-[10px] mt-1">These are your marketing graphics — upload them and click Generate to create lifestyle, studio, flat lay, and more.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {graphics.filter(g => g.is_original).map(gfx => (
                    <div key={gfx.id} className="relative group aspect-square rounded-lg overflow-hidden border cursor-pointer"
                      onClick={() => setViewingGraphic(gfx)}>
                      <img src={gfx.image_url} alt={gfx.label || 'Graphic'} className="w-full h-full object-cover" />
                      <Badge className="absolute top-1 left-1 text-[8px] h-4 bg-primary/80">Original</Badge>
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                        <Button size="icon" variant="secondary" className="h-7 w-7"
                          onClick={(e) => { e.stopPropagation(); setShowVariationPicker(gfx.id); }}
                          disabled={!!generatingVariation}
                          title="Generate variations"
                        >
                          {generatingVariation && showVariationPicker === gfx.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Wand2 className="h-3 w-3" />
                          )}
                        </Button>
                        <Button size="icon" variant="destructive" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); deleteGraphic(gfx.id); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Generated Graphics */}
          {graphics.filter(g => !g.is_original).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> AI Generated Graphics
                  <Badge variant="secondary" className="text-[10px]">{graphics.filter(g => !g.is_original).length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {graphics.filter(g => !g.is_original).map(gfx => (
                    <div key={gfx.id} className="relative group aspect-square rounded-lg overflow-hidden border cursor-pointer"
                      onClick={() => setViewingGraphic(gfx)}>
                      <img src={gfx.image_url} alt={gfx.label || 'Graphic'} className="w-full h-full object-cover" />
                      {gfx.source_style && (
                        <Badge variant="secondary" className="absolute top-1 left-1 text-[8px] h-4">
                          {gfx.source_style.replace(/_/g, ' ')}
                        </Badge>
                      )}
                      {gfx.label && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                          <p className="text-[9px] text-white truncate">{gfx.label}</p>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                        <Button size="icon" variant="secondary" className="h-7 w-7"
                          onClick={(e) => { e.stopPropagation(); setShowVariationPicker(gfx.id); }}
                          disabled={!!generatingVariation}
                          title="Generate new variation from this"
                        >
                          <Wand2 className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="destructive" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); deleteGraphic(gfx.id); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Variation Style Picker Dialog */}
          <Dialog open={!!showVariationPicker} onOpenChange={(open) => { if (!open) setShowVariationPicker(null); }}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-sm flex items-center gap-2">
                  <Wand2 className="h-4 w-4" /> Generate Variation
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-2">
                {VARIATION_STYLES.map(style => {
                  const sourceImg = graphics.find(g => g.id === showVariationPicker);
                  return (
                    <Button
                      key={style.key}
                      variant="outline"
                      className="h-auto py-3 flex flex-col items-center gap-1 text-xs"
                      disabled={!!generatingVariation}
                      onClick={() => {
                        if (sourceImg) generateVariation(sourceImg, [style.key]);
                      }}
                    >
                      {generatingVariation === style.key ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <span className="text-lg">{style.icon}</span>
                      )}
                      <span className="font-medium">{style.label}</span>
                      <span className="text-muted-foreground text-[10px]">{style.desc}</span>
                    </Button>
                  );
                })}
              </div>
              <Button
                className="w-full gap-1.5 mt-1"
                disabled={!!generatingVariation}
                onClick={() => {
                  const sourceImg = graphics.find(g => g.id === showVariationPicker);
                  if (sourceImg) generateVariation(sourceImg, VARIATION_STYLES.map(s => s.key));
                }}
              >
                {generatingVariation === 'all' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Generate All Styles
              </Button>
            </DialogContent>
          </Dialog>

          {/* Image Viewer Dialog (reference images) */}
          <Dialog open={!!viewingImage} onOpenChange={(open) => { if (!open) setViewingImage(null); }}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-sm">Product Image (Reference)</DialogTitle>
              </DialogHeader>
              {viewingImage && (
                <div className="space-y-4">
                  <div className="rounded-lg overflow-hidden border bg-muted flex items-center justify-center max-h-[60vh]">
                    <img src={viewingImage.image_url} alt={viewingImage.label || 'Product'} className="max-w-full max-h-[60vh] object-contain" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Name this image..."
                      value={editingLabel}
                      onChange={(e) => setEditingLabel(e.target.value)}
                      className="flex-1"
                      onKeyDown={(e) => { if (e.key === 'Enter') saveImageLabel(); }}
                    />
                    <Button size="sm" onClick={saveImageLabel} disabled={isSavingLabel || editingLabel === (viewingImage.label || '')}>
                      {isSavingLabel ? <Loader2 className="h-3 w-3 animate-spin" /> : <Edit2 className="h-3 w-3 mr-1" />}
                      Rename
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Graphic Viewer Dialog */}
          <Dialog open={!!viewingGraphic} onOpenChange={(open) => { if (!open) setViewingGraphic(null); }}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-sm">Product Graphic</DialogTitle>
              </DialogHeader>
              {viewingGraphic && (
                <div className="space-y-4">
                  <div className="rounded-lg overflow-hidden border bg-muted flex items-center justify-center max-h-[60vh]">
                    <img src={viewingGraphic.image_url} alt={viewingGraphic.label || 'Graphic'} className="max-w-full max-h-[60vh] object-contain" />
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs"
                      disabled={!!generatingVariation}
                      onClick={() => {
                        setViewingGraphic(null);
                        setTimeout(() => setShowVariationPicker(viewingGraphic.id), 200);
                      }}
                    >
                      <Wand2 className="h-3 w-3" /> Generate Variations
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </Layout>
    );
  }

  // Products list for a brand
  if (selectedBrand) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => { setSelectedBrand(null); setProducts([]); }}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{selectedBrand.name}</h1>
              <p className="text-xs text-muted-foreground">{products.length} products</p>
            </div>
            <Button size="sm" variant="outline" className="ml-auto gap-1 text-xs" onClick={() => setShowNewProduct(true)}>
              <Plus className="h-3 w-3" /> Add Product
            </Button>
          </div>

          {/* New Product Form */}
          {showNewProduct && (
            <Card className="border-primary/30">
              <CardContent className="p-4 space-y-3">
                <Input placeholder="Product name (e.g., Lion's Mane)" value={productForm.name}
                  onChange={(e) => setProductForm(p => ({ ...p, name: e.target.value }))} autoFocus />
                <Textarea placeholder="Description..." value={productForm.description} rows={2}
                  onChange={(e) => setProductForm(p => ({ ...p, description: e.target.value }))} className="text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Category (e.g., Focus)" value={productForm.category}
                    onChange={(e) => setProductForm(p => ({ ...p, category: e.target.value }))} />
                  <Input placeholder="Target audience" value={productForm.target_audience}
                    onChange={(e) => setProductForm(p => ({ ...p, target_audience: e.target.value }))} />
                </div>
                <Input placeholder="Benefits (comma-separated)" value={productForm.benefits}
                  onChange={(e) => setProductForm(p => ({ ...p, benefits: e.target.value }))} />
                <div className="flex items-center gap-2">
                  <Youtube className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input placeholder="YouTube Short URL (optional)" value={productForm.youtube_short_url}
                    onChange={(e) => setProductForm(p => ({ ...p, youtube_short_url: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={createProduct} disabled={!productForm.name.trim()}>
                    <Plus className="h-3 w-3 mr-1" /> Create
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNewProduct(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Product Cards */}
          {products.length === 0 && !showNewProduct ? (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No products yet</p>
              <p className="text-xs mt-1">Add your first product to this brand.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {products.map(product => (
                <Card key={product.id} className="cursor-pointer hover:border-primary/30 transition-colors group"
                  onClick={() => setSelectedProduct(product)}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{product.name}</p>
                      {product.category && <Badge variant="outline" className="text-[9px] h-4 mt-0.5">{product.category}</Badge>}
                      {product.description && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{product.description}</p>}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100"
                      onClick={(e) => deleteProduct(product.id, e)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // Brands list (top level)
  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                  <Package className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Product Library</h1>
                  <p className="text-sm text-muted-foreground">Organize products by brand</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground max-w-lg mt-2">
                Set up your brands and products with multiple images. Pick them across Reels, Video Repo, and Hook Engine.
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowNewBrand(true)}>
              <Plus className="h-4 w-4" /> New Brand
            </Button>
          </div>
        </div>

        {/* New Brand Form */}
        {showNewBrand && (
          <Card className="border-primary/30">
            <CardContent className="p-4 space-y-3">
              <Input placeholder="Brand name (e.g., Lifecykel)" value={brandForm.name}
                onChange={(e) => setBrandForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') createBrand(); }}
                autoFocus />
              <Textarea placeholder="Brand description (optional)" value={brandForm.description} rows={2}
                onChange={(e) => setBrandForm(f => ({ ...f, description: e.target.value }))} className="text-sm" />
              <div className="flex gap-2">
                <Button size="sm" onClick={createBrand} disabled={!brandForm.name.trim()}>
                  <Plus className="h-3 w-3 mr-1" /> Create Brand
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowNewBrand(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Brand Cards */}
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : brands.length === 0 && !showNewBrand ? (
          <div className="text-center py-16 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No brands yet</p>
            <p className="text-xs mt-1">Create a brand to start adding products.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {brands.map(brand => (
              <Card key={brand.id} className="cursor-pointer hover:border-primary/30 transition-colors group"
                onClick={() => setSelectedBrand(brand)}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{brand.name}</p>
                      <p className="text-[10px] text-muted-foreground">{brand.productCount || 0} products</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100"
                      onClick={(e) => deleteBrand(brand.id, e)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                  {brand.description && (
                    <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2">{brand.description}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
