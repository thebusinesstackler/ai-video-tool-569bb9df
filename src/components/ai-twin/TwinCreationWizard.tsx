import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { ImageGrouper } from './ImageGrouper';
import { VoiceCloner } from './VoiceCloner';

interface TwinCreationWizardProps {
  onComplete: () => void;
  onCancel: () => void;
}

export const TwinCreationWizard: React.FC<TwinCreationWizardProps> = ({ onComplete, onCancel }) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
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

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('ai_twins')
        .insert({
          user_id: user.id,
          name: name.trim(),
          description: description.trim() || null,
          reference_images: selectedImages,
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
                <h4 className="font-medium text-sm text-muted-foreground mb-1">Voice Clone</h4>
                <p className="text-lg">{voiceCloningKey ? '✅ Voice cloned' : '❌ No voice clone'}</p>
              </div>
            </div>

            {description && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-1">Description</h4>
                <p>{description}</p>
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
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {step === 1 ? 'Cancel' : 'Back'}
        </Button>

        {step < 4 ? (
          <Button 
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
          >
            Next
            <ArrowRight className="w-4 h-4 ml-2" />
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
