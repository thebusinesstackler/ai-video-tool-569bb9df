import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { ImageGallery } from '@/components/ImageGallery';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Database, CheckCircle, AlertCircle, Package, Upload, Trash2, Image as ImageIcon, Video, Play, Download, Calendar, FileDown, Pencil, Check, X, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { useImageGallery } from '@/hooks/useImageGallery';
import { ImageDropZone } from '@/components/ImageDropZone';
import { ExportToDriveButton } from '@/components/ExportToDriveButton';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface ProductImage {
  id: string;
  image_url: string;
  name: string | null;
  created_at: string;
}

const Gallery = () => {
  const navigate = useNavigate();
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
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [calendarImages, setCalendarImages] = useState<{ id: string; image_url: string; label: string | null; created_at: string }[]>([]);
  const [isLoadingCalendarImages, setIsLoadingCalendarImages] = useState(false);
  const [isUploadingCalendar, setIsUploadingCalendar] = useState(false);
  const [isGeneratingVideoReport, setIsGeneratingVideoReport] = useState(false);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editVideoPrompt, setEditVideoPrompt] = useState('');
  const [videoDragOver, setVideoDragOver] = useState(false);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const [isAddingCharacter, setIsAddingCharacter] = useState<string | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);

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

  const handleVideoUpload = async (files: FileList) => {
    if (!user) return;
    setIsUploadingVideo(true);
    const validTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/mov'];
    try {
      let uploaded = 0;
      for (const file of Array.from(files)) {
        if (!validTypes.includes(file.type) && !file.name.match(/\.(mp4|mov|webm)$/i)) {
          toast({ title: "Invalid File", description: `${file.name} is not a supported video format.`, variant: "destructive" });
          continue;
        }
        if (file.size > 100 * 1024 * 1024) {
          toast({ title: "File Too Large", description: `${file.name} exceeds 100MB.`, variant: "destructive" });
          continue;
        }
        const ext = file.name.split('.').pop() || 'mp4';
        const fileName = `${user.id}/videos/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('reels')
          .upload(fileName, file, { contentType: file.type || 'video/mp4' });
        if (uploadError) {
          toast({ title: "Upload Failed", description: uploadError.message, variant: "destructive" });
          continue;
        }
        const { data: { publicUrl } } = supabase.storage.from('reels').getPublicUrl(fileName);
        await supabase.from('generated_images').insert({
          user_id: user.id,
          image_url: publicUrl,
          prompt: file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '),
          source: 'video-repo',
        });
        uploaded++;
      }
      if (uploaded > 0) {
        toast({ title: "Videos Uploaded", description: `${uploaded} video(s) added to your library.` });
        await fetchVideoRepoEntries();
      }
    } catch (error: any) {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const updateVideoPrompt = async (id: string, newPrompt: string) => {
    try {
      const { error } = await supabase.from('generated_images').update({ prompt: newPrompt }).eq('id', id);
      if (error) throw error;
      setVideoRepoEntries(prev => prev.map(e => e.id === id ? { ...e, prompt: newPrompt } : e));
      setEditingVideoId(null);
      toast({ title: 'Prompt Updated' });
    } catch (error: any) {
      toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
    }
  };

  const deleteVideoEntry = async (id: string) => {
    try {
      const { error } = await supabase.from('generated_images').delete().eq('id', id);
      if (error) throw error;
      setVideoRepoEntries(prev => prev.filter(e => e.id !== id));
      toast({ title: 'Video Deleted' });
    } catch (error: any) {
      toast({ title: 'Delete Failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleVideoDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setVideoDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleVideoUpload(files);
    }
  }, [user]);

  const addVideoAsCharacter = async (entry: { id: string; image_url: string; prompt: string | null }) => {
    if (!user) return;
    setIsAddingCharacter(entry.id);
    try {
      // Extract a frame from the video to use as character reference image
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.preload = 'auto';
      video.muted = true;
      video.src = entry.image_url;

      const frameUrl = await new Promise<string>((resolve, reject) => {
        video.onloadeddata = () => {
          video.currentTime = Math.min(1, video.duration * 0.3);
        };
        video.onseeked = () => {
          const canvas = document.createElement('canvas');
          canvas.width = Math.min(video.videoWidth, 640);
          canvas.height = Math.round(canvas.width * (video.videoHeight / video.videoWidth));
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (!blob) { reject(new Error('Frame capture failed')); return; }
            const file = new File([blob], 'character-frame.jpg', { type: 'image/jpeg' });
            const ext = 'jpg';
            const fileName = `${user.id}/characters/${crypto.randomUUID()}.${ext}`;
            supabase.storage.from('reels').upload(fileName, file, { contentType: 'image/jpeg' })
              .then(({ error }) => {
                if (error) { reject(error); return; }
                const { data: { publicUrl } } = supabase.storage.from('reels').getPublicUrl(fileName);
                resolve(publicUrl);
              });
          }, 'image/jpeg', 0.85);
        };
        video.onerror = () => reject(new Error('Failed to load video'));
      });

      // Create character with reference image
      const charName = entry.prompt
        ? entry.prompt.substring(0, 30).replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Video Character'
        : 'Video Character';

      const { error } = await supabase.from('characters').insert({
        user_id: user.id,
        name: charName,
        description: entry.prompt || 'Character extracted from video',
        reference_images: [frameUrl],
      });

      if (error) throw error;
      toast({ title: 'Character Created!', description: `"${charName}" added to your Characters library.` });
    } catch (err: any) {
      console.error('Add character error:', err);
      toast({ title: 'Failed to add character', description: err.message, variant: 'destructive' });
    } finally {
      setIsAddingCharacter(null);
    }
  };

  const downloadVideoReport = async () => {
    if (videoRepoEntries.length === 0) return;
    setIsGeneratingVideoReport(true);
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const margin = 15;
      let y = margin;

      // Header
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Lifecykel — Video Library Report', margin, y);
      y += 10;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Generated: ${new Date().toLocaleDateString()} • ${videoRepoEntries.length} videos`, margin, y);
      y += 12;

      pdf.setDrawColor(200);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 8;

      for (let i = 0; i < videoRepoEntries.length; i++) {
        const entry = videoRepoEntries[i];
        if (y > 270) {
          pdf.addPage();
          y = margin;
        }
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${i + 1}. ${entry.prompt || 'Untitled Video'}`, margin, y);
        y += 6;
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Date: ${new Date(entry.created_at).toLocaleDateString()}`, margin + 4, y);
        y += 5;
        pdf.setTextColor(60, 120, 200);
        pdf.textWithLink('Watch Video →', margin + 4, y, { url: entry.image_url });
        pdf.setTextColor(0);
        y += 10;
      }

      pdf.save('lifecykel-video-report.pdf');
      toast({ title: 'Report Downloaded', description: `${videoRepoEntries.length} videos exported.` });
    } catch (error: any) {
      toast({ title: 'Report Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsGeneratingVideoReport(false);
    }
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
          // Calculate aspect-ratio-preserving dimensions
          const img = new Image();
          await new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); img.src = dataUrl; });
          const imgW = img.naturalWidth || 1;
          const imgH = img.naturalHeight || 1;
          const ratio = imgW / imgH;
          let drawW = cellW;
          let drawH = cellW / ratio;
          if (drawH > cellH) { drawH = cellH; drawW = cellH * ratio; }
          const drawX = x + (cellW - drawW) / 2;
          const drawY = y + (cellH - drawH) / 2;
          pdf.addImage(dataUrl, drawX, drawY, drawW, drawH);
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
          <h1 className="text-3xl font-bold text-foreground">Lifecykel Image Gallery</h1>
          <p className="text-muted-foreground mt-2">All your Lifecykel brand images, products & video library</p>
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
              {videoRepoEntries.length > 0 && (
                <span className="ml-1 bg-primary/20 text-primary text-xs px-1.5 py-0.5 rounded-full">{videoRepoEntries.length}</span>
              )}
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
            <div className="flex items-center justify-between">
              <Button onClick={downloadPdf} disabled={isGeneratingPdf || images.length === 0} variant="outline" size="sm">
                {isGeneratingPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
                {isGeneratingPdf ? 'Generating PDF...' : `Download PDF (${images.length})`}
              </Button>
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
            {/* Drag & drop video upload zone */}
            <input
              ref={videoFileInputRef}
              type="file"
              className="hidden"
              accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
              multiple
              onChange={(e) => e.target.files && handleVideoUpload(e.target.files)}
            />
            <div
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setVideoDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setVideoDragOver(false); }}
              onDrop={handleVideoDrop}
              onClick={() => !isUploadingVideo && videoFileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-8 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                videoDragOver
                  ? 'border-primary bg-primary/10 scale-[1.01]'
                  : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5'
              } ${isUploadingVideo ? 'pointer-events-none opacity-60' : ''}`}
            >
              <div className={`p-4 rounded-full transition-colors ${videoDragOver ? 'bg-primary/20' : 'bg-muted'}`}>
                {isUploadingVideo ? (
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                ) : (
                  <Upload className={`w-8 h-8 transition-colors ${videoDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
                )}
              </div>
              <div className="text-center">
                <p className={`font-medium transition-colors ${videoDragOver ? 'text-primary' : 'text-foreground'}`}>
                  {isUploadingVideo ? 'Uploading...' : videoDragOver ? 'Drop videos here' : 'Drag & drop videos'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">or click to browse • MP4, MOV, WebM (max 100MB)</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Add your prompt after upload so the AI Director can remix with the same character
              </p>
            </div>

            {/* Download report button */}
            {videoRepoEntries.length > 0 && (
              <div className="flex justify-start">
                <Button onClick={downloadVideoReport} disabled={isGeneratingVideoReport} variant="outline" size="sm">
                  {isGeneratingVideoReport ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
                  {isGeneratingVideoReport ? 'Generating...' : `Download Report (${videoRepoEntries.length})`}
                </Button>
              </div>
            )}

            {isLoadingVideoRepo ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : videoRepoEntries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Video className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No videos yet</p>
                <p className="text-sm mt-1">Upload videos or generate them from Video Repo</p>
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
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 gap-2">
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-10 w-10 rounded-full"
                            onClick={() => setPreviewVideoUrl(entry.image_url)}
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                          <Button variant="secondary" size="icon" className="h-10 w-10 rounded-full" asChild>
                            <a href={entry.image_url} download>
                              <Download className="w-4 h-4" />
                            </a>
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-10 w-10 rounded-full"
                            onClick={() => { setEditingVideoId(entry.id); setEditVideoPrompt(entry.prompt || ''); }}
                            title="Edit prompt"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="destructive" size="icon" className="h-10 w-10 rounded-full" onClick={() => deleteVideoEntry(entry.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="rounded-full gap-1.5 text-xs"
                          onClick={() => addVideoAsCharacter(entry)}
                          disabled={isAddingCharacter === entry.id}
                        >
                          {isAddingCharacter === entry.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <UserPlus className="w-3 h-3" />
                          )}
                          Add as Character
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-3 space-y-1">
                      {editingVideoId === entry.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editVideoPrompt}
                            onChange={(e) => setEditVideoPrompt(e.target.value)}
                            placeholder="Enter the prompt used to create this video"
                            rows={3}
                            className="text-xs"
                            autoFocus
                          />
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => setEditingVideoId(null)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="default"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => updateVideoPrompt(entry.id, editVideoPrompt)}
                            >
                              <Check className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-1">
                          <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{entry.prompt || 'No prompt — click edit to add one'}</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => { setEditingVideoId(entry.id); setEditVideoPrompt(entry.prompt || ''); }}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground/60">{new Date(entry.created_at).toLocaleDateString()}</p>
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

      {/* Video Preview Dialog */}
      <Dialog open={!!previewVideoUrl} onOpenChange={(open) => { if (!open) setPreviewVideoUrl(null); }}>
        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden bg-black border-none [&>button]:text-white [&>button]:bg-black/50 [&>button]:rounded-full [&>button]:hover:bg-black/80">
          {previewVideoUrl && (
            <video
              src={previewVideoUrl}
              className="w-full max-h-[80vh] object-contain"
              controls
              autoPlay
            />
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Gallery;
