import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from 'lucide-react';
import { ImageGrouper } from './ImageGrouper';
import { VoiceCloner } from './VoiceCloner';
import { convertImagesToStorageUrls, hasBase64Images } from '@/lib/imageUtils';

interface TwinCreationWizardProps {
  onComplete: () => void;
  onCancel: () => void;
}

export const TwinCreationWizard: React.FC<TwinCreationWizardProps> = ({ onComplete, onCancel }) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzingFace, setIsAnalyzingFace] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [gender, setGender] = useState('male');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [faceDescription, setFaceDescription] = useState<string | null>(null);
  const [voiceSampleUrl, setVoiceSampleUrl] = useState<string | null>(null);
  const [voiceCloningKey, setVoiceCloningKey] = useState<string | null>(null);

  const steps = [
    { number: 1, title: 'Basic Info' },
    { number: 2, title: 'Select Images' },
    { number: 3, title: 'Voice Clone' },
    { number: 4, title: 'Review & Save' }
  ];

  const canProceed = () => {
    switch (step) {
      case 1: return name.trim().length > 0;
      case 2: return selectedImages.length > 0;
      case 3: return true; // Voice is optional
      case 4: return true;
      default: return false;
    }
  };

  const analyzeFaceDescription = async () => {
    if (selectedImages.length === 0) return;
    
    setIsAnalyzingFace(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-face-description', {
        body: { 
          imageUrls: selectedImages,
          name: name.trim(),
          gender
        }
      });

      if (error) throw error;

      if (data?.description) {
        setFaceDescription(data.description);
        toast({
          title: 'Face Analyzed!',
          description: 'AI has generated a detailed description of your twin.'
        });
      }
    } catch (error: any) {
      console.error('Error analyzing face:', error);
      toast({
        title: 'Analysis Failed',
        description: error.message || 'Could not analyze face. You can still proceed.',
        variant: 'destructive'
      });
    } finally {
      setIsAnalyzingFace(false);
    }
  };

  const handleStepChange = async (newStep: number) => {
    // When moving from step 2 to step 3, analyze face if images selected
    if (step === 2 && newStep === 3 && selectedImages.length > 0 && !faceDescription) {
      await analyzeFaceDescription();
    }
    setStep(newStep);
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Convert any base64 images to storage URLs before saving
      let finalImages = selectedImages;
      if (hasBase64Images(selectedImages)) {
        toast({
          title: 'Converting Images',
          description: 'Optimizing images for storage...'
        });
        finalImages = await convertImagesToStorageUrls(selectedImages, user.id, 'reels');
      }

      const { error } = await supabase
        .from('ai_twins')
        .insert({
          user_id: user.id,
          name: name.trim(),
          description: description.trim() || null,
          face_description: faceDescription,
          gender: gender,
          reference_images: finalImages,
          voice_sample_url: voiceSampleUrl,
          voice_cloning_key: voiceCloningKey
        });

      if (error) throw error;

      toast({
        title: 'Success!',
        description: `AI Twin "${name}" has been created`
      });
      
      onComplete();
    } catch (error: any) {
      console.error('Error creating twin:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create AI Twin',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((s, idx) => (
          <React.Fragment key={s.number}>
            <div className="flex flex-col items-center">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                  step > s.number 
                    ? 'bg-primary text-primary-foreground' 
                    : step === s.number 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {step > s.number ? <Check className="w-5 h-5" /> : s.number}
              </div>
              <span className={`text-xs mt-1 ${step >= s.number ? 'text-foreground' : 'text-muted-foreground'}`}>
                {s.title}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`flex-1 h-1 mx-2 rounded ${step > s.number ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <div className="min-h-[300px]">
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Twin Name *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., My Digital Avatar"
                className="max-w-md"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Gender *</label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger className="max-w-md">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="non-binary">Non-binary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description (optional)</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this AI Twin..."
                rows={4}
                className="max-w-md"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <ImageGrouper
            selectedImages={selectedImages}
            onImagesChange={setSelectedImages}
          />
        )}

        {step === 3 && (
          <VoiceCloner
            voiceSampleUrl={voiceSampleUrl}
            voiceCloningKey={voiceCloningKey}
            onVoiceSampleChange={setVoiceSampleUrl}
            onVoiceCloningKeyChange={setVoiceCloningKey}
          />
        )}

        {step === 4 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Review Your AI Twin</h3>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-1">Name</h4>
                <p className="text-lg">{name}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-1">Gender</h4>
                <p className="text-lg capitalize">{gender}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-1">Voice Clone</h4>
                <p className="text-lg">{voiceCloningKey ? '✅ Voice cloned' : '❌ No voice clone'}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-1">Face Analysis</h4>
                <p className="text-lg">{faceDescription ? '✅ Analyzed' : '❌ Not analyzed'}</p>
              </div>
            </div>

            {description && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-1">Description</h4>
                <p>{description}</p>
              </div>
            )}

            {faceDescription && (
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium text-sm text-muted-foreground mb-1 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  AI Face Description
                </h4>
                <p className="text-sm">{faceDescription}</p>
              </div>
            )}

            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-2">
                Reference Images ({selectedImages.length})
              </h4>
              <div className="grid grid-cols-6 gap-2">
                {selectedImages.map((img, idx) => (
                  <img 
                    key={idx}
                    src={img}
                    alt={`Reference ${idx + 1}`}
                    className="w-full aspect-square object-cover rounded-lg"
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button 
          variant="ghost" 
          onClick={step === 1 ? onCancel : () => setStep(step - 1)}
          disabled={isAnalyzingFace}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {step === 1 ? 'Cancel' : 'Back'}
        </Button>

        {step < 4 ? (
          <Button 
            onClick={() => handleStepChange(step + 1)}
            disabled={!canProceed() || isAnalyzingFace}
          >
            {isAnalyzingFace ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing Face...
              </>
            ) : (
              <>
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        ) : (
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-gradient-primary"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Create AI Twin
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};
