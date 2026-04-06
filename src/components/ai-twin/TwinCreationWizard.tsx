import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles, Camera, Wand2 } from 'lucide-react';
import { LogoUploadInline } from '@/components/LogoUploadInline';
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
  
  // Post-creation automation state
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [autoProgress, setAutoProgress] = useState(0);
  const [autoStatus, setAutoStatus] = useState('');
  const [autoStep, setAutoStep] = useState(0);
  const [generatedAngles, setGeneratedAngles] = useState<string[]>([]);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [gender, setGender] = useState('male');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [faceDescription, setFaceDescription] = useState<string | null>(null);
  const [voiceSampleUrl, setVoiceSampleUrl] = useState<string | null>(null);
  const [voiceCloningKey, setVoiceCloningKey] = useState<string | null>(null);
  const [shirtLogoUrl, setShirtLogoUrl] = useState<string | null>(null);

  const steps = [
    { number: 1, title: 'Basic Info' },
    { number: 2, title: 'Reference Images' },
    { number: 3, title: 'Voice Clone' },
    { number: 4, title: 'Review & Create' }
  ];

  const autoSteps = [
    { label: 'Saving AI Twin...', icon: '💾' },
    { label: 'Analyzing face features...', icon: '🔍' },
    { label: 'Generating front portrait...', icon: '📸' },
    { label: 'Generating 3/4 profile...', icon: '📸' },
    { label: 'Generating side profile...', icon: '📸' },
    { label: 'Generating hero angle...', icon: '📸' },
    { label: 'Finalizing AI Twin...', icon: '✨' },
  ];

  const canProceed = () => {
    switch (step) {
      case 1: return name.trim().length > 0;
      case 2: return true; // Images are optional now - we can generate them
      case 3: return true;
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
    if (step === 2 && newStep === 3 && selectedImages.length > 0 && !faceDescription) {
      await analyzeFaceDescription();
    }
    setStep(newStep);
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setIsAutoGenerating(true);
      setAutoStep(0);
      setAutoProgress(5);
      setAutoStatus('Saving AI Twin...');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Step 1: Convert images and save twin
      let finalImages = selectedImages;
      if (hasBase64Images(selectedImages)) {
        finalImages = await convertImagesToStorageUrls(selectedImages, user.id, 'reels');
      }

      const { data: insertData, error } = await supabase
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
        })
        .select('id')
        .single();

      if (error) throw error;

      const twinId = insertData.id;
      setAutoStep(1);
      setAutoProgress(15);
      setAutoStatus('Analyzing face features...');

      // Step 2: Analyze face if not done yet and we have images
      let finalFaceDescription = faceDescription;
      if (!finalFaceDescription && selectedImages.length > 0) {
        try {
          const { data: faceData } = await supabase.functions.invoke('analyze-face-description', {
            body: { imageUrls: finalImages, name: name.trim(), gender }
          });
          if (faceData?.description) {
            finalFaceDescription = faceData.description;
            await supabase.from('ai_twins').update({ face_description: finalFaceDescription }).eq('id', twinId);
          }
        } catch (faceErr) {
          console.warn('Face analysis failed, continuing...', faceErr);
        }
      }

      // If we still don't have a face description, create one from the name/description
      if (!finalFaceDescription) {
        finalFaceDescription = `${gender === 'female' ? 'A woman' : gender === 'male' ? 'A man' : 'A person'} named ${name}. ${description || 'Professional appearance, confident demeanor.'}`;
      }

      setAutoStep(2);
      setAutoProgress(25);
      setAutoStatus('Loop AI is generating camera angles...');

      // Step 3: Generate 4 camera angle images
      try {
        const referenceImageUrl = finalImages.length > 0 ? finalImages[0] : undefined;

        // Stream progress updates as each angle is generated
        const progressInterval = setInterval(() => {
          setAutoProgress(prev => {
            if (prev >= 85) {
              clearInterval(progressInterval);
              return 85;
            }
            return prev + 3;
          });
        }, 2000);

        // Update status messages as images generate
        const statusMessages = [
          'Generating front portrait...',
          'Generating 3/4 profile view...',
          'Generating side profile...',
          'Generating hero angle shot...',
        ];
        let msgIndex = 0;
        const statusInterval = setInterval(() => {
          msgIndex++;
          if (msgIndex < statusMessages.length) {
            setAutoStep(2 + msgIndex);
            setAutoStatus(`Loop AI: ${statusMessages[msgIndex]}`);
          } else {
            clearInterval(statusInterval);
          }
        }, 4000);

        const { data: angleData, error: angleError } = await supabase.functions.invoke('generate-twin-angles', {
          body: {
            twinId,
            faceDescription: finalFaceDescription,
            gender,
            name: name.trim(),
            referenceImageUrl,
            shirtLogoUrl: shirtLogoUrl || undefined
          }
        });

        clearInterval(progressInterval);
        clearInterval(statusInterval);

        if (angleError) {
          console.warn('Angle generation failed:', angleError);
          toast({
            title: 'Note',
            description: 'Some camera angles could not be generated. You can add more images later.',
          });
        } else if (angleData?.generatedUrls) {
          setGeneratedAngles(angleData.generatedUrls);
        }
      } catch (angleErr) {
        console.warn('Angle generation error:', angleErr);
      }

      // Final step
      setAutoStep(6);
      setAutoProgress(100);
      setAutoStatus('AI Twin ready! 🎬');

      toast({
        title: '🎬 AI Twin Created!',
        description: `"${name}" is ready for reels, stories, and movies. Powered by Loop AI.`
      });

      // Brief pause to show completion
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      onComplete();
    } catch (error: any) {
      console.error('Error creating twin:', error);
      setIsAutoGenerating(false);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create AI Twin',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-generation in progress screen
  if (isAutoGenerating) {
    return (
      <div className="space-y-8 py-8">
        {/* Loop AI Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full">
            <Wand2 className="w-5 h-5 text-primary animate-pulse" />
            <span className="text-sm font-semibold text-primary">Loop AI</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground">
            Creating Your AI Twin
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Loop AI is generating premium camera angle reference images for consistent character appearance across all your content.
          </p>
        </div>

        {/* Main Progress Bar */}
        <div className="space-y-3 max-w-lg mx-auto">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{autoStatus}</span>
            <span className="font-mono text-primary">{Math.round(autoProgress)}%</span>
          </div>
          <Progress value={autoProgress} className="h-3" />
        </div>

        {/* Step indicators */}
        <div className="space-y-2 max-w-md mx-auto">
          {autoSteps.map((s, idx) => (
            <div 
              key={idx}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-300 ${
                idx < autoStep 
                  ? 'bg-primary/10 text-foreground' 
                  : idx === autoStep 
                    ? 'bg-primary/5 text-foreground border border-primary/20' 
                    : 'text-muted-foreground/50'
              }`}
            >
              <span className="text-lg w-6 text-center">
                {idx < autoStep ? '✅' : idx === autoStep ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary inline" />
                ) : s.icon}
              </span>
              <span className={`text-sm ${idx <= autoStep ? 'font-medium' : ''}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Generated images preview */}
        {generatedAngles.length > 0 && (
          <div className="space-y-2 max-w-lg mx-auto">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Generated Camera Angles ({generatedAngles.length}/4)
            </h4>
            <div className="grid grid-cols-4 gap-2">
              {generatedAngles.map((url, idx) => (
                <img 
                  key={idx}
                  src={url}
                  alt={`Angle ${idx + 1}`}
                  className="w-full aspect-[9/16] object-cover rounded-lg border border-border"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

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
                placeholder="Describe this AI Twin's appearance, style, personality..."
                rows={4}
                className="max-w-md"
              />
            </div>
            <LogoUploadInline
              logoUrl={shirtLogoUrl}
              onLogoChange={setShirtLogoUrl}
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="font-medium text-foreground">Loop AI will auto-generate 4 camera angles</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Upload a reference photo and Loop AI will create front, 3/4, side, and hero angle shots for character consistency. Or skip this step and Loop AI will generate from your description.
              </p>
            </div>
            <ImageGrouper
              selectedImages={selectedImages}
              onImagesChange={setSelectedImages}
            />
          </div>
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
                <h4 className="font-medium text-sm text-muted-foreground mb-1">Reference Images</h4>
                <p className="text-lg">{selectedImages.length > 0 ? `${selectedImages.length} uploaded` : 'Will auto-generate'}</p>
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

            {selectedImages.length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-2">
                  Uploaded Reference Images ({selectedImages.length})
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
            )}

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Wand2 className="w-4 h-4 text-primary" />
                <span className="font-medium text-sm text-foreground">Loop AI Automation</span>
              </div>
              <p className="text-xs text-muted-foreground">
                After saving, Loop AI will automatically generate 4 cinematic camera angle images of your character for use across reels, stories, and movies.
              </p>
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
                <Wand2 className="w-4 h-4 mr-2" />
                Create with Loop AI
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};
