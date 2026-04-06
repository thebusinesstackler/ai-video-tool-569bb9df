import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { ImageGallery } from '@/components/ImageGallery';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Database, CheckCircle, AlertCircle, Package, Upload, Trash2, Image as ImageIcon, Video, Play, Download, Calendar, FileDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { useImageGallery } from '@/hooks/useImageGallery';
import { ImageDropZone } from '@/components/ImageDropZone';

interface ProductImage {
  id: string;
  image_url: string;
  name: string | null;
  created_at: string;
}

const Gallery = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { images, isUploading, uploadImages, fetchImages } = useImageGallery();
  const [isMigrating, setIsMigrating] = useState(false);
  const [isAutoMigrating, setIsAutoMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<{
    totalMigrated: number;
    errors: number;
    remaining: number;
    message: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState('gallery');
  const [products, setProducts] = useState<ProductImage[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isUploadingProduct, setIsUploadingProduct] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  const [videoRepoEntries, setVideoRepoEntries] = useState<{ id: string; image_url: string; prompt: string | null; created_at: string }[]>([]);
  const [isLoadingVideoRepo, setIsLoadingVideoRepo] = useState(false);
  const [calendarImages, setCalendarImages] = useState<{ id: string; image_url: string; label: string | null; created_at: string }[]>([]);
  const [isLoadingCalendarImages, setIsLoadingCalendarImages] = useState(false);
  const [isUploadingCalendar, setIsUploadingCalendar] = useState(false);

  const fetchVideoRepoEntries = async () => {
    if (!user) return;
    setIsLoadingVideoRepo(true);
    try {
      const { data, error } = await supabase
        .from('generated_images')
        .select('id, image_url, prompt, created_at')
        .eq('user_id', user.id)
        .eq('source', 'video-repo')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setVideoRepoEntries(data || []);
    } catch (error: any) {
      console.error('Error fetching video repo entries:', error);
    } finally {
      setIsLoadingVideoRepo(false);
    }
  };

  const fetchProducts = async () => {
    if (!user) return;
    setIsLoadingProducts(true);
    try {
      const { data, error } = await supabase
        .from('product_images')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      console.error('Error fetching products:', error);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const fetchCalendarImages = async () => {
    if (!user) return;
    setIsLoadingCalendarImages(true);
    try {
      const { data, error } = await supabase
        .from('calendar_images')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCalendarImages(data || []);
    } catch (error: any) {
      console.error('Error fetching calendar images:', error);
    } finally {
      setIsLoadingCalendarImages(false);
    }
  };

  const handleCalendarUpload = async (files: FileList) => {
    if (!user) return;
    setIsUploadingCalendar(true);
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    try {
      for (const file of Array.from(files)) {
        if (!validTypes.includes(file.type)) continue;
        if (file.size > 10 * 1024 * 1024) continue;
        const ext = file.name.split('.').pop() || 'jpg';
        const fileName = `${user.id}/calendar/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('reels')
          .upload(fileName, file, { contentType: file.type });
        if (uploadError) continue;
        const { data: { publicUrl } } = supabase.storage.from('reels').getPublicUrl(fileName);
        const label = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        await supabase.from('calendar_images').insert({
          user_id: user.id,
          image_url: publicUrl,
          label,
        });
      }
      toast({ title: 'Images Uploaded', description: 'Your calendar images are ready to use.' });
      await fetchCalendarImages();
    } catch (error: any) {
      toast({ title: 'Upload Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploadingCalendar(false);
    }
  };

  const deleteCalendarImage = async (id: string) => {
    try {
      const { error } = await supabase.from('calendar_images').delete().eq('id', id);
      if (error) throw error;
      setCalendarImages(prev => prev.filter(i => i.id !== id));
      toast({ title: 'Image Deleted' });
    } catch (error: any) {
      toast({ title: 'Delete Failed', description: error.message, variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (user) {
      fetchProducts();
      fetchVideoRepoEntries();
      fetchCalendarImages();
    }
  }, [user]);

  const handleProductUpload = async (files: FileList) => {
    if (!user) return;
    setIsUploadingProduct(true);
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    try {
      for (const file of Array.from(files)) {
        if (!validTypes.includes(file.type)) {
          toast({ title: "Invalid File", description: `${file.name} is not a supported format.`, variant: "destructive" });
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          toast({ title: "File Too Large", description: `${file.name} exceeds 10MB.`, variant: "destructive" });
          continue;
        }
        const ext = file.name.split('.').pop() || 'jpg';
        const fileName = `${user.id}/products/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('reels')
          .upload(fileName, file, { contentType: file.type });
        if (uploadError) {
          toast({ title: "Upload Failed", description: uploadError.message, variant: "destructive" });
          continue;
        }
        const { data: { publicUrl } } = supabase.storage.from('reels').getPublicUrl(fileName);
        const productName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        await supabase.from('product_images').insert({
          user_id: user.id,
          image_url: publicUrl,
          name: productName,
        });
      }
      toast({ title: "Products Uploaded", description: "Your product images are ready to use in scenes." });
      await fetchProducts();
    } catch (error: any) {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploadingProduct(false);
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const { error } = await supabase.from('product_images').delete().eq('id', id);
      if (error) throw error;
      setProducts(prev => prev.filter(p => p.id !== id));
      toast({ title: "Product Deleted" });
    } catch (error: any) {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    }
  };

  const updateProductName = async (id: string, name: string) => {
    try {
      const { error } = await supabase.from('product_images').update({ name }).eq('id', id);
      if (error) throw error;
      setProducts(prev => prev.map(p => p.id === id ? { ...p, name } : p));
      setEditingName(null);
    } catch (error: any) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    }
  };

  const handleFilesSelected = async (files: FileList) => {
    await uploadImages(files);
    await fetchImages();
  };

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const downloadPdf = async () => {
    if (images.length === 0) return;
    setIsGeneratingPdf(true);
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 10;
      const cols = 2;
      const gap = 8;
      const cellW = (pageWidth - margin * 2 - gap * (cols - 1)) / cols;
      const cellH = cellW; // square
      let col = 0;
      let y = margin;

      for (let i = 0; i < images.length; i++) {
        if (y + cellH > pageHeight - margin) {
          pdf.addPage();
          y = margin;
          col = 0;
        }
        const x = margin + col * (cellW + gap);
        try {
          const res = await fetch(images[i].image_url);
          const blob = await res.blob();
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          pdf.addImage(dataUrl, x, y, cellW, cellH);
        } catch {
          pdf.setFillColor(230, 230, 230);
          pdf.rect(x, y, cellW, cellH, 'F');
          pdf.setFontSize(8);
          pdf.text('Failed to load', x + cellW / 2, y + cellH / 2, { align: 'center' });
        }
        col++;
        if (col >= cols) {
          col = 0;
          y += cellH + gap;
        }
      }
      pdf.save('image-gallery.pdf');
      toast({ title: 'PDF Downloaded', description: `${images.length} images exported.` });
    } catch (error: any) {
      toast({ title: 'PDF Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const runSingleBatch = async () => {
    const { data, error } = await supabase.functions.invoke('migrate-images-to-storage', {});
    if (error) throw error;
    return { migrated: data.migrated || 0, errors: data.errors || 0, remaining: data.remaining || 0, success: data.success };
  };

  const runAutoMigration = async () => {
    if (!user) { toast({ title: "Not Authenticated", description: "Please log in.", variant: "destructive" }); return; }
    setIsAutoMigrating(true); setIsMigrating(true);
    setMigrationProgress({ totalMigrated: 0, errors: 0, remaining: 0, message: 'Starting migration...' });
    let totalMigrated = 0, totalErrors = 0, remaining = 1, batchCount = 0;
    try {
      while (remaining > 0 && batchCount < 100) {
        batchCount++;
        const result = await runSingleBatch();
        totalMigrated += result.migrated; totalErrors += result.errors; remaining = result.remaining;
        setMigrationProgress({
          totalMigrated, errors: totalErrors, remaining,
          message: remaining > 0 ? `Migrated ${totalMigrated} images, ${remaining} remaining...` : `Complete! Migrated ${totalMigrated} images.`
        });
        if (result.migrated === 0) break;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      toast({ title: "Migration Complete", description: `Migrated ${totalMigrated} images${totalErrors > 0 ? ` with ${totalErrors} errors` : ''}.` });
      if (totalMigrated > 0) await fetchImages(true);
    } catch (error: any) {
      toast({ title: "Migration Failed", description: error.message, variant: "destructive" });
    } finally { setIsMigrating(false); setIsAutoMigrating(false); }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Image Gallery</h1>
          <p className="text-muted-foreground mt-2">All your generated images and product library</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="gallery" className="flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4" /> All Images
              {images.length > 0 && (
                <span className="ml-1 bg-primary/20 text-primary text-xs px-1.5 py-0.5 rounded-full">{images.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-1.5">
              <Package className="w-4 h-4" /> Product Library
              {products.length > 0 && (
                <span className="ml-1 bg-primary/20 text-primary text-xs px-1.5 py-0.5 rounded-full">{products.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="video-repo" className="flex items-center gap-1.5">
              <Video className="w-4 h-4" /> Video Repo
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" /> Calendar Images
              {calendarImages.length > 0 && (
                <span className="ml-1 bg-primary/20 text-primary text-xs px-1.5 py-0.5 rounded-full">{calendarImages.length}</span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gallery" className="space-y-6 mt-4">
            <ImageDropZone onFilesSelected={handleFilesSelected} isUploading={isUploading} />
            <div className="flex items-center justify-end">
              <Card className="bg-muted/50 border-dashed">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium">Fix Loading Issues</p>
                    <p className="text-xs text-muted-foreground">Auto-migrate all base64 images to storage URLs</p>
                  </div>
                  {isAutoMigrating ? (
                    <Button variant="destructive" size="sm" onClick={() => setIsAutoMigrating(false)}>Stop</Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={runAutoMigration} disabled={isMigrating || !user}>
                      {isMigrating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Database className="w-4 h-4 mr-2" />}
                      {isMigrating ? 'Migrating...' : 'Auto-Migrate All'}
                    </Button>
                  )}
                </CardContent>
                {migrationProgress && (
                  <div className="px-4 pb-4 pt-0">
                    <div className={`flex items-center gap-2 text-xs ${migrationProgress.errors > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                      {migrationProgress.remaining > 0 ? <Loader2 className="w-3 h-3 animate-spin" /> : migrationProgress.errors > 0 ? <AlertCircle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                      {migrationProgress.message}
                    </div>
                  </div>
                )}
              </Card>
            </div>
            <ImageGallery />
          </TabsContent>

          <TabsContent value="products" className="space-y-6 mt-4">
            {/* Product upload zone */}
            <Card className="border-dashed border-2 border-muted-foreground/25">
              <CardContent className="p-6">
                <div className="flex flex-col items-center gap-3 text-center">
                  <Package className="w-10 h-10 text-muted-foreground/50" />
                  <div>
                    <p className="font-medium text-foreground">Add Products to Your Library</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Upload product photos here. They'll be available for placement in any scene, B-roll, or product shot generation.
                    </p>
                  </div>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={(e) => e.target.files && handleProductUpload(e.target.files)}
                    />
                    <Button asChild variant="default" size="sm" disabled={isUploadingProduct}>
                      <span>
                        {isUploadingProduct ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                        {isUploadingProduct ? 'Uploading...' : 'Upload Product Images'}
                      </span>
                    </Button>
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Products grid */}
            {isLoadingProducts ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : products.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No products yet</p>
                <p className="text-sm mt-1">Upload product images to use them in your scenes and B-roll</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {products.map((product) => (
                  <Card key={product.id} className="overflow-hidden group relative">
                    <div className="aspect-square relative">
                      <img
                        src={product.image_url}
                        alt={product.name || 'Product'}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => deleteProduct(product.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-2">
                      {editingName === product.id ? (
                        <input
                          className="w-full text-xs bg-transparent border-b border-primary focus:outline-none text-foreground"
                          value={tempName}
                          autoFocus
                          onChange={(e) => setTempName(e.target.value)}
                          onBlur={() => updateProductName(product.id, tempName)}
                          onKeyDown={(e) => e.key === 'Enter' && updateProductName(product.id, tempName)}
                        />
                      ) : (
                        <p
                          className="text-xs text-muted-foreground truncate cursor-pointer hover:text-foreground"
                          onClick={() => { setEditingName(product.id); setTempName(product.name || ''); }}
                          title="Click to rename"
                        >
                          {product.name || 'Unnamed Product'}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="video-repo" className="space-y-6 mt-4">
            {isLoadingVideoRepo ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : videoRepoEntries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Video className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No Video Repo projects yet</p>
                <p className="text-sm mt-1">Generated videos from Video Repo will appear here</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {videoRepoEntries.map((entry) => (
                  <Card key={entry.id} className="overflow-hidden group">
                    <div className="aspect-[9/16] relative bg-black">
                      <video
                        src={entry.image_url}
                        className="w-full h-full object-cover"
                        muted
                        preload="metadata"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 gap-2">
                        <Button variant="secondary" size="icon" className="h-10 w-10 rounded-full" asChild>
                          <a href={entry.image_url} target="_blank" rel="noopener noreferrer">
                            <Play className="w-4 h-4" />
                          </a>
                        </Button>
                        <Button variant="secondary" size="icon" className="h-10 w-10 rounded-full" asChild>
                          <a href={entry.image_url} download>
                            <Download className="w-4 h-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground line-clamp-2">{entry.prompt || 'Video Repo project'}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">{new Date(entry.created_at).toLocaleDateString()}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="calendar" className="space-y-6 mt-4">
            <Card className="border-dashed border-2 border-muted-foreground/25">
              <CardContent className="p-6">
                <div className="flex flex-col items-center gap-3 text-center">
                  <Calendar className="w-10 h-10 text-muted-foreground/50" />
                  <div>
                    <p className="font-medium text-foreground">Calendar Cover Images</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Upload images here to use as thumbnails in the Content Calendar.
                    </p>
                  </div>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={(e) => e.target.files && handleCalendarUpload(e.target.files)}
                    />
                    <Button asChild variant="default" size="sm" disabled={isUploadingCalendar}>
                      <span>
                        {isUploadingCalendar ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                        {isUploadingCalendar ? 'Uploading...' : 'Upload Calendar Images'}
                      </span>
                    </Button>
                  </label>
                </div>
              </CardContent>
            </Card>

            {isLoadingCalendarImages ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : calendarImages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No calendar images yet</p>
                <p className="text-sm mt-1">Upload images to use as covers in your Content Calendar</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {calendarImages.map((img) => (
                  <Card key={img.id} className="overflow-hidden group relative">
                    <div className="aspect-square relative">
                      <img src={img.image_url} alt={img.label || 'Calendar image'} className="w-full h-full object-cover" loading="lazy" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => deleteCalendarImage(img.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-2">
                      <p className="text-xs text-muted-foreground truncate">{img.label || 'Untitled'}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Gallery;
