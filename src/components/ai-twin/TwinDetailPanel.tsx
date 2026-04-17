import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  CAMERA_ANGLES, 
  CAMERA_CATEGORIES, 
  getCameraAnglesByCategory,
  type CameraAngle 
} from '@/data/cameraAngles';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { 
  Film, 
  Video, 
  Camera, 
  Loader2, 
  Plus, 
  Volume2, 
  ImageIcon,
  Sparkles,
  User,
  Wand2,
  X,
  Edit2,
  Save,
  XCircle,
  Trash2,
  Check,
  Star
} from 'lucide-react';
import { TwinSpeaker } from './TwinSpeaker';
import { VoiceCloner } from './VoiceCloner';
import { GalleryImagePicker } from '@/components/GalleryImagePicker';
import { FolderOpen } from 'lucide-react';

interface AITwin {
  id: string;
  name: string;
  reference_images: string[];
  voice_cloning_key: string | null;
  voice_sample_url: string | null;
  consent_audio_url: string | null;
  description: string | null;
  face_description: string | null;
  gender: string | null;
  voice_engine?: string;
  google_voice_id?: string | null;
}

interface TwinDetailPanelProps {
  twin: AITwin;
  onUpdate: () => void;
}

export const TwinDetailPanel: React.FC<TwinDetailPanelProps> = ({ twin, onUpdate }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>('framing');
  const [generatingAngles, setGeneratingAngles] = useState<Set<string>>(new Set());
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [selectedPose, setSelectedPose] = useState<string | null>(null);
  
  // Reference image variation state
  const [variationSourceImage, setVariationSourceImage] = useState<string | null>(null);
  const [variationPose, setVariationPose] = useState<string>('');
  const [isGeneratingVariation, setIsGeneratingVariation] = useState(false);
  
  // Editable fields
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState(twin.description || '');
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  
  // Name editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(twin.name);
  const [isSavingName, setIsSavingName] = useState(false);

  // Face description editing state
  const [isEditingFaceDesc, setIsEditingFaceDesc] = useState(false);
  const [editedFaceDesc, setEditedFaceDesc] = useState(twin.face_description || '');
  const [isSavingFaceDesc, setIsSavingFaceDesc] = useState(false);

  // WaveSpeed voice generation state
  const [isGeneratingWavespeedVoice, setIsGeneratingWavespeedVoice] = useState(false);

  // Unified save state
  const [isSavingAll, setIsSavingAll] = useState(false);

  const hasUnsavedChanges = 
    editedName !== twin.name ||
    editedDescription !== (twin.description || '') ||
    editedFaceDesc !== (twin.face_description || '');

  const saveAllChanges = async () => {
    const trimmedName = editedName.trim();
    if (!trimmedName) {
      toast({ title: 'Invalid name', description: 'Name cannot be empty', variant: 'destructive' });
      return;
    }
    setIsSavingAll(true);
    try {
      const { error } = await supabase
        .from('ai_twins')
        .update({
          name: trimmedName,
          description: editedDescription.trim() || null,
          face_description: editedFaceDesc.trim() || null,
        })
        .eq('id', twin.id);
      if (error) throw error;
      toast({ title: 'All changes saved', description: 'Your AI Twin has been updated' });
      setIsEditingName(false);
      setIsEditingDescription(false);
      setIsEditingFaceDesc(false);
      onUpdate();
    } catch (error: any) {
      console.error('Error saving all:', error);
      toast({ title: 'Error', description: 'Failed to save changes', variant: 'destructive' });
    } finally {
      setIsSavingAll(false);
    }
  };

  // Voice cloning state
  const [voiceSampleUrl, setVoiceSampleUrl] = useState<string | null>(twin.voice_sample_url);
  const [voiceCloningKey, setVoiceCloningKey] = useState<string | null>(twin.voice_cloning_key);
  const [voiceEngine, setVoiceEngine] = useState<string>(twin.voice_engine || 'speechify');
  const [googleVoiceId, setGoogleVoiceId] = useState<string | null>(twin.google_voice_id || null);

  // Batch generation state
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  
  // Delete confirmation state
  const [imageToDelete, setImageToDelete] = useState<string | null>(null);

  // Locked primary reference image — used as the "source of truth" for angle generation
  const [primaryImageUrl, setPrimaryImageUrl] = useState<string | null>(
    twin.reference_images?.[0] || null
  );

  // Keep primary in sync when twin prop changes (e.g. after add/delete refresh)
  React.useEffect(() => {
    if (!twin.reference_images || twin.reference_images.length === 0) {
      setPrimaryImageUrl(null);
      return;
    }
    // If current primary still exists in the list, keep it. Otherwise reset to first.
    if (!primaryImageUrl || !twin.reference_images.includes(primaryImageUrl)) {
      setPrimaryImageUrl(twin.reference_images[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [twin.reference_images]);

  const activeReferenceImage = primaryImageUrl || twin.reference_images?.[0] || null;

  const POSE_PRESETS = [
    { id: 'standing', label: 'Standing', prompt: 'standing upright, full body visible' },
    { id: 'sitting', label: 'Sitting', prompt: 'sitting down comfortably' },
    { id: 'walking', label: 'Walking', prompt: 'walking naturally, mid-stride' },
    { id: 'arms-crossed', label: 'Arms Crossed', prompt: 'standing with arms crossed confidently' },
    { id: 'hands-pockets', label: 'Hands in Pockets', prompt: 'standing casually with hands in pockets' },
    { id: 'leaning', label: 'Leaning', prompt: 'leaning against a wall or surface' },
    { id: 'gesturing', label: 'Gesturing', prompt: 'gesturing while speaking, expressive hands' },
    { id: 'thinking', label: 'Thinking', prompt: 'in a thoughtful pose, hand near chin' },
    { id: 'getting-up', label: 'Getting Up', prompt: 'in the motion of standing up from a seated position' },
    { id: 'sitting-down', label: 'Sitting Down', prompt: 'in the motion of sitting down' },
    { id: 'turning', label: 'Turning Around', prompt: 'turning around, mid-turn' },
    { id: 'reaching', label: 'Reaching', prompt: 'reaching for something with one arm' },
  ];

  const categoryAngles = getCameraAnglesByCategory(selectedCategory as any);


  const handleCreateMovie = () => {
    navigate('/movies', { 
      state: { 
        selectedTwin: twin,
        twinId: twin.id,
        twinName: twin.name,
        twinDescription: twin.description,
        referenceImage: twin.reference_images?.[0]
      }
    });
  };

  const handleCreateReel = () => {
    navigate('/reels', { 
      state: { 
        selectedTwin: twin,
        twinId: twin.id,
        twinName: twin.name,
        twinDescription: twin.description,
        referenceImage: twin.reference_images?.[0]
      }
    });
  };

  const saveName = async () => {
    const trimmedName = editedName.trim();
    if (!trimmedName) {
      toast({
        title: 'Invalid name',
        description: 'Name cannot be empty',
        variant: 'destructive'
      });
      return;
    }

    setIsSavingName(true);
    try {
      const { error } = await supabase
        .from('ai_twins')
        .update({ name: trimmedName })
        .eq('id', twin.id);

      if (error) throw error;

      toast({
        title: 'Name saved',
        description: 'Your AI Twin name has been updated'
      });
      setIsEditingName(false);
      onUpdate();
    } catch (error: any) {
      console.error('Error saving name:', error);
      toast({
        title: 'Error',
        description: 'Failed to save name',
        variant: 'destructive'
      });
    } finally {
      setIsSavingName(false);
    }
  };

  const saveDescription = async () => {
    setIsSavingDescription(true);
    try {
      const { error } = await supabase
        .from('ai_twins')
        .update({ description: editedDescription.trim() || null })
        .eq('id', twin.id);

      if (error) throw error;

      toast({
        title: 'Description saved',
        description: 'Your AI Twin description has been updated'
      });
      setIsEditingDescription(false);
      onUpdate();
    } catch (error: any) {
      console.error('Error saving description:', error);
      toast({
        title: 'Error',
        description: 'Failed to save description',
        variant: 'destructive'
      });
    } finally {
      setIsSavingDescription(false);
    }
  };

  const saveFaceDescription = async () => {
    setIsSavingFaceDesc(true);
    try {
      const { error } = await supabase
        .from('ai_twins')
        .update({ face_description: editedFaceDesc.trim() || null })
        .eq('id', twin.id);

      if (error) throw error;

      toast({
        title: 'Face description saved',
        description: 'AI face description has been updated'
      });
      setIsEditingFaceDesc(false);
      onUpdate();
    } catch (error: any) {
      console.error('Error saving face description:', error);
      toast({
        title: 'Error',
        description: 'Failed to save face description',
        variant: 'destructive'
      });
    } finally {
      setIsSavingFaceDesc(false);
    }
  };

  const generateWavespeedVoice = async () => {
    setIsGeneratingWavespeedVoice(true);
    try {
      const sampleText = `Hello, my name is ${twin.name}. This is a preview of how I sound using the WaveSpeed MiniMax voice engine.`;
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: {
          text: sampleText,
          gender: twin.gender || 'male',
          voice: 'ai-auto',
        }
      });

      if (error) throw error;

      // Save a marker key so we know wavespeed voice is configured
      const voiceKey = `wavespeed-${twin.gender || 'male'}`;
      setVoiceCloningKey(voiceKey);
      await supabase
        .from('ai_twins')
        .update({ voice_cloning_key: voiceKey })
        .eq('id', twin.id);

      // Play the preview
      const audioUrl = data?.audioUrl || data?.url;
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.play().catch(() => {});
      } else if (data?.audioContent) {
        const dataUrl = `data:audio/mp3;base64,${data.audioContent}`;
        const audio = new Audio(dataUrl);
        audio.play().catch(() => {});
      }

      toast({
        title: 'WaveSpeed Voice Generated!',
        description: 'Voice is ready. Click Regenerate if you want a different result.'
      });
      onUpdate();
    } catch (error: any) {
      console.error('Error generating WaveSpeed voice:', error);
      toast({
        title: 'Voice Generation Failed',
        description: error.message || 'Failed to generate voice',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingWavespeedVoice(false);
    }
  };

  const generateTwinImage = async (angle: CameraAngle) => {
    if (!activeReferenceImage) {
      toast({
        title: 'No reference image',
        description: 'This twin needs at least one reference image',
        variant: 'destructive'
      });
      return;
    }

    // Check if already generating this angle
    if (generatingAngles.has(angle.id)) {
      return;
    }

    // Add to generating set
    setGeneratingAngles(prev => new Set(prev).add(angle.id));

    try {
      // Build a more specific prompt that emphasizes keeping the same person
      const faceDesc = twin.face_description || twin.description || '';
      const customContext = customPrompt ? ` Scene context: ${customPrompt}.` : '';
      
      // Include selected pose in the prompt
      const poseContext = selectedPose 
        ? ` Pose: ${POSE_PRESETS.find(p => p.id === selectedPose)?.prompt || ''}.`
        : '';
      
      // Improved prompt structure for better consistency
      const prompt = `Create a photorealistic image of THIS EXACT PERSON from the reference image. 
Camera angle: ${angle.promptModifier}. 
${faceDesc ? `Person description: ${faceDesc}.` : 'Keep the exact same face, features, skin tone, and appearance as the reference.'}
${poseContext}${customContext}
CRITICAL: The person in the generated image MUST look identical to the reference - same face shape, eyes, nose, mouth, hair, and overall appearance. 
Style: Professional photography, high quality, sharp focus on the subject.`;

      const { data, error } = await supabase.functions.invoke('generate-scene-image', {
        body: {
          prompt,
          referenceImageUrl: activeReferenceImage,
          characterDescription: twin.face_description || twin.description
        }
      });

      if (error) throw error;

      if (data?.imageUrl) {
        setGeneratedImages(prev => [data.imageUrl, ...prev]);
        
        // Save to twin's reference images
        // Fetch current images first to avoid race conditions
        const { data: currentTwin } = await supabase
          .from('ai_twins')
          .select('reference_images')
          .eq('id', twin.id)
          .single();
        
        const currentImages = currentTwin?.reference_images || twin.reference_images || [];
        const updatedImages = [...currentImages, data.imageUrl];
        
        const { error: updateError } = await supabase
          .from('ai_twins')
          .update({ reference_images: updatedImages })
          .eq('id', twin.id);

        if (updateError) {
          console.error('Failed to save image to twin:', updateError);
        } else {
          onUpdate();
        }

        // Also save to gallery (generated_images table)
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error: galleryError } = await supabase
            .from('generated_images')
            .insert({
              user_id: user.id,
              image_url: data.imageUrl,
              prompt: prompt,
              source: 'ai-twin',
              reference_image_url: activeReferenceImage
            });

          if (galleryError) {
            console.error('Failed to save to gallery:', galleryError);
          }
        }

        toast({
          title: 'Image generated & saved',
          description: `${angle.name} shot saved to twin and gallery`
        });
      }
    } catch (error: any) {
      console.error('Error generating image:', error);
      toast({
        title: 'Generation failed',
        description: error.message || 'Failed to generate image',
        variant: 'destructive'
      });
    } finally {
      // Remove from generating set
      setGeneratingAngles(prev => {
        const next = new Set(prev);
        next.delete(angle.id);
        return next;
      });
    }
  };

  const generateVariation = async () => {
    if (!variationSourceImage || !variationPose.trim()) {
      toast({
        title: 'Missing information',
        description: 'Please describe the pose or action change',
        variant: 'destructive'
      });
      return;
    }

    setIsGeneratingVariation(true);

    try {
      const faceDesc = twin.face_description || twin.description || '';
      
      // Create prompt that emphasizes keeping the same scene/background but changing pose
      const prompt = `Create a photorealistic image of THIS EXACT PERSON from the reference image. 
CRITICAL INSTRUCTIONS:
1. Keep the EXACT SAME background, lighting, and scene as the reference image
2. Keep the person's face, features, skin tone, and appearance IDENTICAL to the reference
3. ONLY change the pose/action: ${variationPose}
${faceDesc ? `Person description: ${faceDesc}` : ''}
The background, lighting, camera angle, and environment must remain exactly the same as the reference.
Style: Professional photography, high quality, sharp focus on the subject.`;

      const { data, error } = await supabase.functions.invoke('generate-scene-image', {
        body: {
          prompt,
          referenceImageUrl: variationSourceImage,
          characterDescription: twin.face_description || twin.description
        }
      });

      if (error) throw error;

      if (data?.imageUrl) {
        setGeneratedImages(prev => [data.imageUrl, ...prev]);
        
        // Save to twin's reference images
        const { data: currentTwin } = await supabase
          .from('ai_twins')
          .select('reference_images')
          .eq('id', twin.id)
          .single();
        
        const currentImages = currentTwin?.reference_images || twin.reference_images || [];
        const updatedImages = [...currentImages, data.imageUrl];
        
        const { error: updateError } = await supabase
          .from('ai_twins')
          .update({ reference_images: updatedImages })
          .eq('id', twin.id);

        if (updateError) {
          console.error('Failed to save image to twin:', updateError);
        } else {
          onUpdate();
        }

        // Also save to gallery
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('generated_images')
            .insert({
              user_id: user.id,
              image_url: data.imageUrl,
              prompt: prompt,
              source: 'ai-twin-variation',
              reference_image_url: variationSourceImage
            });
        }

        toast({
          title: 'Variation generated & saved',
          description: 'New pose variation saved to twin and gallery'
        });
        
        setVariationSourceImage(null);
        setVariationPose('');
      }
    } catch (error: any) {
      console.error('Error generating variation:', error);
      toast({
        title: 'Generation failed',
        description: error.message || 'Failed to generate variation',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingVariation(false);
    }
  };

  // Voice cloning callbacks - sync with database
  const handleVoiceSampleChange = async (url: string | null) => {
    setVoiceSampleUrl(url);
    await supabase
      .from('ai_twins')
      .update({ voice_sample_url: url })
      .eq('id', twin.id);
  };

  const handleVoiceCloningKeyChange = async (key: string | null) => {
    setVoiceCloningKey(key);
    await supabase
      .from('ai_twins')
      .update({ voice_cloning_key: key })
      .eq('id', twin.id);
    onUpdate();
  };

  const clearVoice = async () => {
    setVoiceSampleUrl(null);
    setVoiceCloningKey(null);
    
    await supabase
      .from('ai_twins')
      .update({ voice_sample_url: null, voice_cloning_key: null })
      .eq('id', twin.id);
    
    onUpdate();
  };

  // Batch generate 5 images at once
  const generateBatchImages = async (angle: CameraAngle) => {
    if (!activeReferenceImage) {
      toast({
        title: 'No reference image',
        description: 'This twin needs at least one reference image',
        variant: 'destructive'
      });
      return;
    }

    if (isBatchGenerating || generatingAngles.has(angle.id)) {
      return;
    }

    setIsBatchGenerating(true);
    setGeneratingAngles(prev => new Set(prev).add(angle.id));

    try {
      const faceDesc = twin.face_description || twin.description || '';
      const customContext = customPrompt ? ` Scene context: ${customPrompt}.` : '';
      const poseContext = selectedPose 
        ? ` Pose: ${POSE_PRESETS.find(p => p.id === selectedPose)?.prompt || ''}.`
        : '';

      // Generate 5 images in parallel with slight prompt variations
      const variations = [
        '',
        ' Slight variation in expression.',
        ' Different subtle pose.',
        ' Alternative lighting mood.',
        ' Unique composition.'
      ];

      const promises = variations.map(async (variation, index) => {
        const prompt = `Create a photorealistic image of THIS EXACT PERSON from the reference image. 
Camera angle: ${angle.promptModifier}. 
${faceDesc ? `Person description: ${faceDesc}.` : 'Keep the exact same face, features, skin tone, and appearance as the reference.'}
${poseContext}${customContext}${variation}
CRITICAL: The person in the generated image MUST look identical to the reference - same face shape, eyes, nose, mouth, hair, and overall appearance. 
Style: Professional photography, high quality, sharp focus on the subject.`;

        const { data, error } = await supabase.functions.invoke('generate-scene-image', {
          body: {
            prompt,
            referenceImageUrl: twin.reference_images[0],
            characterDescription: twin.face_description || twin.description
          }
        });

        if (error) throw error;
        return data?.imageUrl;
      });

      const results = await Promise.allSettled(promises);
      const successfulUrls = results
        .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled' && !!r.value)
        .map(r => r.value);

      if (successfulUrls.length > 0) {
        setGeneratedImages(prev => [...successfulUrls, ...prev]);

        // Fetch current images and add all new ones
        const { data: currentTwin } = await supabase
          .from('ai_twins')
          .select('reference_images')
          .eq('id', twin.id)
          .single();

        const currentImages = currentTwin?.reference_images || twin.reference_images || [];
        const updatedImages = [...currentImages, ...successfulUrls];

        await supabase
          .from('ai_twins')
          .update({ reference_images: updatedImages })
          .eq('id', twin.id);

        // Save all to gallery
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const galleryInserts = successfulUrls.map(url => ({
            user_id: user.id,
            image_url: url,
            prompt: `${angle.name} batch generation`,
            source: 'ai-twin-batch',
            reference_image_url: twin.reference_images[0]
          }));

          await supabase.from('generated_images').insert(galleryInserts);
        }

        onUpdate();
        toast({
          title: `${successfulUrls.length} images generated`,
          description: `Batch generation complete for ${angle.name}`
        });
      }
    } catch (error: any) {
      console.error('Error in batch generation:', error);
      toast({
        title: 'Batch generation failed',
        description: error.message || 'Some images failed to generate',
        variant: 'destructive'
      });
    } finally {
      setIsBatchGenerating(false);
      setGeneratingAngles(prev => {
        const next = new Set(prev);
        next.delete(angle.id);
        return next;
      });
    }
  };

  // Delete a reference image from the twin (called after confirmation)
  const confirmDeleteImage = async () => {
    if (!imageToDelete) return;
    
    const imageUrl = imageToDelete;
    setImageToDelete(null);
    
    try {
      // Remove from local generated images state
      setGeneratedImages(prev => prev.filter(img => img !== imageUrl));

      // Fetch current images from database
      const { data: currentTwin } = await supabase
        .from('ai_twins')
        .select('reference_images')
        .eq('id', twin.id)
        .single();

      const currentImages = currentTwin?.reference_images || [];
      const updatedImages = currentImages.filter((img: string) => img !== imageUrl);

      // Update the twin's reference images
      const { error: updateError } = await supabase
        .from('ai_twins')
        .update({ reference_images: updatedImages })
        .eq('id', twin.id);

      if (updateError) throw updateError;

      // Also delete from gallery (generated_images table)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('generated_images')
          .delete()
          .eq('user_id', user.id)
          .eq('image_url', imageUrl);
      }

      onUpdate();
      toast({
        title: 'Image deleted',
        description: 'Image removed from twin and gallery'
      });
    } catch (error: any) {
      console.error('Error deleting image:', error);
      toast({
        title: 'Delete failed',
        description: error.message || 'Failed to delete image',
        variant: 'destructive'
      });
    }
  };

  const handleAddMoreImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: 'Error', description: 'Not authenticated', variant: 'destructive' });
        return;
      }

      const newImageUrls: string[] = [];

      for (const file of Array.from(files)) {
        const fileName = `${user.id}/twin-images/${twin.id}/${Date.now()}-${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('reels')
          .upload(fileName, file, { contentType: file.type });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        const { data: publicUrl } = supabase.storage.from('reels').getPublicUrl(fileName);
        newImageUrls.push(publicUrl.publicUrl);
      }

      if (newImageUrls.length > 0) {
        const updatedImages = [...(twin.reference_images || []), ...newImageUrls];
        const { error: updateError } = await supabase
          .from('ai_twins')
          .update({ reference_images: updatedImages })
          .eq('id', twin.id);

        if (updateError) throw updateError;

        onUpdate();
        toast({
          title: 'Images added',
          description: `Added ${newImageUrls.length} new image(s) to your AI Twin`
        });
      }
    } catch (error: any) {
      console.error('Error adding images:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload images',
        variant: 'destructive'
      });
    }

    // Reset input
    e.target.value = '';
  };

  const handleAddImageFromGallery = async (imageUrl: string) => {
    try {
      const updatedImages = [...(twin.reference_images || []), imageUrl];
      const { error: updateError } = await supabase
        .from('ai_twins')
        .update({ reference_images: updatedImages })
        .eq('id', twin.id);

      if (updateError) throw updateError;

      onUpdate();
      toast({
        title: 'Image added',
        description: 'Image from gallery added to your AI Twin'
      });
    } catch (error: any) {
      console.error('Error adding image from gallery:', error);
      toast({
        title: 'Failed to add image',
        description: error.message || 'Failed to add image from gallery',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Save All Banner - always visible */}
      <div className={`sticky top-0 z-10 flex items-center justify-between p-3 rounded-lg border ${hasUnsavedChanges ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30'}`}>
        {hasUnsavedChanges ? (
          <>
            <span className="text-sm text-muted-foreground">You have unsaved changes</span>
            <Button 
              onClick={saveAllChanges}
              disabled={isSavingAll}
              size="sm"
              className="bg-gradient-primary hover:opacity-90"
            >
              {isSavingAll ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save All Changes
            </Button>
          </>
        ) : (
          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-green-500" />
            All changes saved
          </span>
        )}
      </div>

      {/* Twin Info Header */}
      <div className="flex items-start gap-4">
        {twin.reference_images?.[0] && (
          <img 
            src={twin.reference_images[0]} 
            alt={twin.name}
            className="w-24 h-24 rounded-lg object-cover"
          />
        )}
        <div className="flex-1">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="text-xl font-bold h-10 max-w-[200px]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveName();
                  if (e.key === 'Escape') {
                    setEditedName(twin.name);
                    setIsEditingName(false);
                  }
                }}
              />
              <Button 
                size="sm" 
                onClick={saveName}
                disabled={isSavingName}
              >
                {isSavingName ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
              </Button>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => {
                  setEditedName(twin.name);
                  setIsEditingName(false);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold">{editedName || twin.name}</h2>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => {
                  setEditedName(editedName || twin.name);
                  setIsEditingName(true);
                }}
              >
                <Edit2 className="w-4 h-4" />
              </Button>
            </div>
          )}
          <div className="mt-1">
            <Select
              value={twin.gender || 'male'}
              onValueChange={async (newGender) => {
                try {
                  const { error } = await supabase
                    .from('ai_twins')
                    .update({ gender: newGender })
                    .eq('id', twin.id);
                  if (error) throw error;
                  toast({ title: 'Gender updated' });
                  onUpdate();
                } catch (err: any) {
                  toast({ title: 'Failed to update gender', description: err.message, variant: 'destructive' });
                }
              }}
            >
              <SelectTrigger className="h-7 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="non-binary">Non-binary</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Badge variant={voiceCloningKey ? "default" : "secondary"}>
              <Volume2 className="w-3 h-3 mr-1" />
              {voiceCloningKey ? '🎙️ Voice Cloned' 
                : '🎬 Sora-2 Native'}
            </Badge>
            <Badge variant="outline">
              <ImageIcon className="w-3 h-3 mr-1" />
              {twin.reference_images?.length || 0} Images
            </Badge>
          </div>
        </div>
      </div>

      {/* Editable Description */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="w-4 h-4" />
              Character Description
            </CardTitle>
            {!isEditingDescription && (
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => {
                  setEditedDescription(twin.description || '');
                  setIsEditingDescription(true);
                }}
              >
                <Edit2 className="w-4 h-4 mr-1" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isEditingDescription ? (
            <div className="space-y-3">
              <Textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                placeholder="Describe this person for movie generation. E.g., 'A tall African American man in his 30s with a short beard, confident demeanor, wearing business casual attire. He has warm brown eyes and a friendly smile.'"
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                This description will be used in movie scripts and image generation to ensure consistent portrayal.
              </p>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={saveDescription}
                  disabled={isSavingDescription}
                >
                  {isSavingDescription ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-1" />
                  )}
                  Save
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setIsEditingDescription(false)}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {twin.description || 'No description set. Click Edit to describe this AI Twin for accurate movie generation.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Face Description (AI-generated, editable & saveable) */}
      {(twin.face_description || isEditingFaceDesc) && (
        <Card className="bg-muted/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                AI-Analyzed Face Description
              </CardTitle>
              {!isEditingFaceDesc && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditedFaceDesc(twin.face_description || '');
                    setIsEditingFaceDesc(true);
                  }}
                >
                  <Edit2 className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isEditingFaceDesc ? (
              <div className="space-y-3">
                <Textarea
                  value={editedFaceDesc}
                  onChange={(e) => setEditedFaceDesc(e.target.value)}
                  placeholder="Describe the face features for consistent image generation..."
                  rows={4}
                  className="resize-none"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={saveFaceDescription}
                    disabled={isSavingFaceDesc}
                  >
                    {isSavingFaceDesc ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-1" />
                    )}
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditingFaceDesc(false)}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{twin.face_description}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button 
          size="lg" 
          className="bg-gradient-primary hover:opacity-90"
          onClick={handleCreateMovie}
        >
          <Film className="w-5 h-5 mr-2" />
          Create Movie
        </Button>
        <Button 
          size="lg" 
          variant="outline"
          onClick={handleCreateReel}
        >
          <Video className="w-5 h-5 mr-2" />
          Create Reel/Story
        </Button>
      </div>

      {/* Voice Engine Selector */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Volume2 className="w-4 h-4" />
            Voice Engine
            <Badge variant="outline" className="ml-auto text-xs">
              {voiceEngine === 'speechify' ? '🎙️ Cloned' : '🎬 Sora-2 Native'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select
            value={voiceEngine === 'wavespeed' ? 'native' : voiceEngine}
            onValueChange={async (newEngine) => {
              const engineToSave = newEngine === 'native' ? 'native' : newEngine;
              setVoiceEngine(engineToSave);
              try {
               const updateData: any = { voice_engine: engineToSave };
                const { error } = await supabase
                  .from('ai_twins')
                  .update(updateData)
                  .eq('id', twin.id);
                if (error) throw error;
                toast({ title: 'Voice engine updated' });
                onUpdate();
              } catch (err: any) {
                toast({ title: 'Failed to update', description: err.message, variant: 'destructive' });
              }
            }}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="speechify">🎙️ Cloned Voice (Speechify)</SelectItem>
              <SelectItem value="native">🎬 Sora-2 Native Audio</SelectItem>
            </SelectContent>
          </Select>

          {voiceEngine === 'speechify' && (
            <>
              <VoiceCloner
                voiceSampleUrl={voiceSampleUrl}
                voiceCloningKey={voiceCloningKey}
                onVoiceSampleChange={handleVoiceSampleChange}
                onVoiceCloningKeyChange={handleVoiceCloningKeyChange}
              />
              {voiceCloningKey && (
                <Badge className="bg-primary/20 text-primary border-primary/30" variant="outline">
                  <Check className="w-3 h-3 mr-1" />
                  Voice Cloned
                </Badge>
              )}
            </>
          )}

          {(voiceEngine === 'native' || voiceEngine === 'wavespeed') && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Sora-2 generates a unique, natural voice for each video. No configuration needed.
              </p>
              <Badge className="bg-green-500/10 text-green-500 border-green-500/30" variant="outline">
                <Check className="w-3 h-3 mr-1" />
                Ready — Sora-2 handles voice automatically
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Make Twin Speak Section */}
      <TwinSpeaker 
        twinName={twin.name}
        speechifyVoiceId={voiceCloningKey}
        voiceEngine={voiceEngine}
        googleVoiceId={googleVoiceId}
        gender={twin.gender}
      />
      <p className="text-xs text-muted-foreground flex items-center gap-1 -mt-4">
        <Check className="w-3 h-3 text-green-500" />
        Voice engine and settings are auto-saved
      </p>

      {/* Reference Images Gallery */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Reference Images ({twin.reference_images?.length || 0})
              <span className="text-xs font-normal text-muted-foreground ml-2">Click to create variation, hover for delete</span>
            </div>
            <div className="flex gap-2">
              <GalleryImagePicker
                onSelect={handleAddImageFromGallery}
                showGenerate={false}
                trigger={
                  <Button size="sm" variant="outline">
                    <FolderOpen className="w-4 h-4 mr-1" />
                    From Gallery
                  </Button>
                }
              />
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                id={`add-images-${twin.id}`}
                onChange={handleAddMoreImages}
              />
              <label htmlFor={`add-images-${twin.id}`}>
                <Button size="sm" variant="outline" asChild>
                  <span className="cursor-pointer">
                    <Plus className="w-4 h-4 mr-1" />
                    Upload
                  </span>
                </Button>
              </label>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            {twin.reference_images?.map((img, idx) => (
              <div 
                key={idx}
                className="relative group cursor-pointer"
              >
                <img 
                  src={img}
                  alt={`Reference ${idx + 1}`}
                  className="w-full aspect-square object-cover rounded-lg hover:ring-2 hover:ring-primary transition-all"
                  onClick={() => setVariationSourceImage(img)}
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="w-8 h-8 bg-white/20 hover:bg-white/40 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      setVariationSourceImage(img);
                    }}
                  >
                    <Wand2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="w-8 h-8 bg-destructive/80 hover:bg-destructive text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      setImageToDelete(img);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Generate More Images Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5" />
            Generate More Images
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Custom Prompt */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Scene Details (optional)</label>
            <Textarea
              placeholder="Describe the background, pose, or setting. E.g., 'standing in a modern office', 'sitting at a cafe', 'outdoor park with trees', 'wearing a suit', 'arms crossed confidently'"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="h-20 resize-none"
            />
          </div>

          {/* Pose Presets */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Pose (optional)</label>
            <div className="flex flex-wrap gap-2">
              {POSE_PRESETS.map(pose => (
                <Button
                  key={pose.id}
                  size="sm"
                  variant={selectedPose === pose.id ? "default" : "outline"}
                  onClick={() => setSelectedPose(selectedPose === pose.id ? null : pose.id)}
                >
                  {pose.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Category Tabs */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Camera Angle Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CAMERA_CATEGORIES.map(cat => (
                <Button
                  key={cat.id}
                  size="sm"
                  variant={selectedCategory === cat.id ? "default" : "ghost"}
                  className={selectedCategory === cat.id ? "" : "border border-border bg-background"}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Camera Angles Grid */}
          <ScrollArea className="h-72">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-3">
              {categoryAngles.map(angle => (
                <button
                  key={angle.id}
                  type="button"
                  disabled={generatingAngles.has(angle.id) || isBatchGenerating}
                  onClick={() => generateBatchImages(angle)}
                  className="group relative text-left rounded-xl border border-border bg-card/50 hover:bg-card hover:border-primary/40 hover:shadow-sm transition-all p-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {generatingAngles.has(angle.id) ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    ) : (
                      <Camera className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                    <span className="font-semibold text-sm text-foreground">{angle.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2.5">
                    {angle.description}
                  </p>
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    Generates 5 images
                  </Badge>
                </button>
              ))}
            </div>
          </ScrollArea>

          {/* Recently Generated Images */}
          {generatedImages.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Just Generated (click to enlarge, hover to delete)
              </h4>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {generatedImages.map((img, idx) => (
                  <div key={idx} className="relative group flex-shrink-0">
                    <img 
                      src={img}
                      alt={`Generated ${idx + 1}`}
                      className="w-20 h-20 object-cover rounded-lg cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                      onClick={() => setPreviewImage(img)}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute top-1 right-1 w-6 h-6 bg-destructive/80 hover:bg-destructive text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImageToDelete(img);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Variation Generation Dialog */}
      <Dialog open={!!variationSourceImage} onOpenChange={() => setVariationSourceImage(null)}>
        <DialogContent className="max-w-lg">
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5" />
            Create Scene Variation
          </DialogTitle>
          <DialogDescription>
            Generate a new image with the same background and lighting, but with a different pose or action.
          </DialogDescription>
          
          <div className="space-y-4 mt-4">
            {/* Source image preview */}
            {variationSourceImage && (
              <div className="flex gap-4 items-start">
                <img 
                  src={variationSourceImage}
                  alt="Source"
                  className="w-24 h-24 object-cover rounded-lg"
                />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    The new image will keep this exact background, lighting, and camera angle.
                  </p>
                </div>
              </div>
            )}
            
            {/* Pose presets */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Quick Pose Changes</label>
              <div className="flex flex-wrap gap-2">
                {POSE_PRESETS.map(pose => (
                  <Button
                    key={pose.id}
                    size="sm"
                    variant={variationPose === pose.prompt ? "default" : "outline"}
                    onClick={() => setVariationPose(pose.prompt)}
                  >
                    {pose.label}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Custom description */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Or describe the change</label>
              <Textarea
                placeholder="E.g., 'getting up from the chair', 'turning to look at camera', 'picking up a coffee cup', 'laughing'"
                value={variationPose}
                onChange={(e) => setVariationPose(e.target.value)}
                className="h-20 resize-none"
              />
            </div>
            
            {/* Generate button */}
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setVariationSourceImage(null);
                  setVariationPose('');
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={generateVariation}
                disabled={isGeneratingVariation || !variationPose.trim()}
                className="bg-gradient-primary"
              >
                {isGeneratingVariation ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Variation
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl p-2">
          <VisuallyHidden>
            <DialogTitle>Image Preview</DialogTitle>
            <DialogDescription>Preview of the generated image</DialogDescription>
          </VisuallyHidden>
          <Button 
            size="icon" 
            variant="ghost" 
            className="absolute right-2 top-2 z-10"
            onClick={() => setPreviewImage(null)}
          >
            <X className="w-4 h-4" />
          </Button>
          {previewImage && (
            <img 
              src={previewImage}
              alt="Preview"
              className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!imageToDelete} onOpenChange={() => setImageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the image from your AI Twin and gallery. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteImage} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
