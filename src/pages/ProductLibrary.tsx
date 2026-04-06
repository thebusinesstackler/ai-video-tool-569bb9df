import { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Package, Plus, Trash2, ArrowLeft, Image as ImageIcon, Loader2,
  Building2, Upload, ChevronRight, Star, LinkIcon, Youtube, Edit2,
  X,
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

export default function ProductLibrary() {
  const { user } = useAuth();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewBrand, setShowNewBrand] = useState(false);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [viewingImage, setViewingImage] = useState<GalleryImage | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [isSavingLabel, setIsSavingLabel] = useState(false);

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

  useEffect(() => { loadBrands(); }, [loadBrands]);
  useEffect(() => { if (selectedBrand) loadProducts(selectedBrand.id); }, [selectedBrand, loadProducts]);
  useEffect(() => { if (selectedProduct) loadGallery(selectedProduct.id); }, [selectedProduct, loadGallery]);

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
    const { error } = await supabase.from('products').insert({
      user_id: user.id,
      brand_id: selectedBrand.id,
      name: productForm.name.trim(),
      description: productForm.description.trim() || null,
      category: productForm.category.trim() || null,
      benefits: benefits.length > 0 ? benefits : null,
      target_audience: productForm.target_audience.trim() || null,
      youtube_short_url: productForm.youtube_short_url.trim() || null,
    } as any);
    if (error) { toast.error('Failed to create product'); return; }
    toast.success(`Product "${productForm.name}" created`);
    setProductForm({ name: '', description: '', category: '', benefits: '', target_audience: '', youtube_short_url: '' });
    setShowNewProduct(false);
    loadProducts(selectedBrand.id);
    loadBrands(); // refresh counts
  };

  const deleteProduct = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) { toast.error('Failed to delete product'); return; }
    toast.success('Product deleted');
    if (selectedProduct?.id === id) { setSelectedProduct(null); setGallery([]); }
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

  // === RENDER ===

  // Product detail view
  if (selectedProduct && selectedBrand) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => { setSelectedProduct(null); setGallery([]); }}>
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

            {/* Right: Image Gallery */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" /> Product Images
                      <Badge variant="secondary" className="text-[10px]">{gallery.length}</Badge>
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
                    <div className="text-center py-8 text-muted-foreground">
                      <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-xs">No images yet. Upload product photos.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {gallery.map(img => (
                        <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden border">
                          <img src={img.image_url} alt={img.label || 'Product'} className="w-full h-full object-cover" />
                          {img.is_primary && (
                            <Badge className="absolute top-1 left-1 text-[8px] h-4 bg-primary/80">
                              <Star className="h-2 w-2 mr-0.5" /> Primary
                            </Badge>
                          )}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            {!img.is_primary && (
                              <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => setPrimary(img.id)}>
                                <Star className="h-3 w-3" />
                              </Button>
                            )}
                            <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => deleteImage(img.id)}>
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
