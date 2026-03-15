import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  PlusIcon, 
  UserIcon, 
  EditIcon, 
  TrashIcon,
  SparklesIcon,
  VolumeXIcon,
  PlayIcon,
  ImageIcon,
  UploadIcon,
  LayoutTemplateIcon
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AICharacterCreator } from '@/components/AICharacterCreator';
import templateProduct1 from '@/assets/template-char-product1.jpg';
import templateProduct2 from '@/assets/template-char-product2.jpg';
import templateProduct3 from '@/assets/template-char-product3.jpg';
import templateCar from '@/assets/template-char-car.jpg';

interface CharacterTemplate {
  name: string;
  description: string;
  image: string;
  voiceType: string;
  personality: string;
}

const CHARACTER_TEMPLATES: CharacterTemplate[] = [
  {
    name: 'Sarah – Product Ambassador',
    description: 'Professional businesswoman holding a skincare/beauty product. Great for cosmetics, wellness, and lifestyle brand commercials.',
    image: templateProduct1,
    voiceType: 'professional-female',
    personality: 'confident, trustworthy',
  },
  {
    name: 'Jake – Tech Reviewer',
    description: 'Friendly tech enthusiast showcasing a gadget. Perfect for electronics, SaaS, and tech product demos.',
    image: templateProduct2,
    voiceType: 'casual-male',
    personality: 'enthusiastic, knowledgeable',
  },
  {
    name: 'Maya – Fitness Influencer',
    description: 'Energetic fitness instructor holding a supplement bottle. Ideal for health, fitness, and nutrition brand promotions.',
    image: templateProduct3,
    voiceType: 'energetic-female',
    personality: 'energetic, motivating',
  },
  {
    name: 'Carlos – Luxury Lifestyle',
    description: 'Stylish man in a luxury car interior. Perfect for automotive, real estate, finance, and premium lifestyle content.',
    image: templateCar,
    voiceType: 'authoritative-male',
    personality: 'sophisticated, aspirational',
  },
];

interface Character {
  id: string;
  name: string;
  description: string;
  appearanceImage?: string; // Base64 image data (deprecated, kept for backwards compatibility)
  referenceImages: string[]; // Array of Base64 image data
  voiceType: string;
  kieVoiceId?: string;
  personality: string;
  avatar?: string;
  createdAt: string;
}

const VOICE_TYPES = [
  { value: 'professional-male', label: 'Professional Male' },
  { value: 'professional-female', label: 'Professional Female' },
  { value: 'casual-male', label: 'Casual Male' },
  { value: 'casual-female', label: 'Casual Female' },
  { value: 'energetic-male', label: 'Energetic Male' },
  { value: 'energetic-female', label: 'Energetic Female' },
  { value: 'authoritative-male', label: 'Authoritative Male' },
  { value: 'authoritative-female', label: 'Authoritative Female' }
];

export const CharacterManager = () => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAICreatorOpen, setIsAICreatorOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    referenceImages: [] as string[],
    voiceType: 'professional-female',
    kieVoiceId: '',
    personality: 'professional'
  });
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadCharacters();
  }, []);

  const loadCharacters = async () => {
    try {
      // First try to load from localStorage for migration
      const stored = localStorage.getItem('ai_video_characters');
      if (stored) {
        const localCharacters = JSON.parse(stored);
        // Migrate to database if we have local data
        if (localCharacters.length > 0) {
          await migrateCharactersToDatabase(localCharacters);
        }
        // Clear localStorage after migration
        localStorage.removeItem('ai_video_characters');
      }

      // Load from database - get current user first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to view your characters.",
          variant: "destructive"
        });
        return;
      }

      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading characters:', error);
        toast({
          title: "Error Loading Characters",
          description: "Failed to load characters. Please try again.",
          variant: "destructive"
        });
        return;
      }

      // Transform database data to component format
      const transformedCharacters = (data || []).map((char: any) => ({
        id: char.id,
        name: char.name,
        description: char.description || '',
        appearanceImage: char.appearance_image || '',
        referenceImages: char.reference_images || [],
        voiceType: char.voice_type || 'professional-female',
        kieVoiceId: char.kie_voice_id || '',
        personality: char.personality || 'professional',
        createdAt: char.created_at
      }));

      setCharacters(transformedCharacters);
    } catch (error) {
      console.error('Error loading characters:', error);
    }
  };

  const migrateCharactersToDatabase = async (localCharacters: Character[]) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { error } = await supabase
        .from('characters')
        .insert(localCharacters.map(char => ({
          id: char.id,
          user_id: user.user.id,
          name: char.name,
          description: char.description,
          appearance_image: char.appearanceImage,
          voice_type: char.voiceType,
          kie_voice_id: char.kieVoiceId,
          personality: char.personality
        })));

      if (error) {
        console.error('Migration error:', error);
      }
    } catch (error) {
      console.error('Migration error:', error);
    }
  };

  const handleCreateCharacter = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a character name.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: user } = await supabase.auth.getUser();
      
      if (!user.user) {
        toast({
          title: "Authentication Required",
          description: "Please log in to create characters.",
          variant: "destructive"
        });
        return;
      }

      const { data, error } = await supabase
        .from('characters')
        .insert({
          user_id: user.user.id,
          name: formData.name,
          description: formData.description,
          reference_images: formData.referenceImages,
          voice_type: formData.voiceType,
          kie_voice_id: formData.kieVoiceId,
          personality: formData.personality,
        })
        .select()
        .single();

      if (error) {
        toast({
          title: "Error Creating Character",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      const newCharacter: Character = {
        id: data.id,
        name: data.name,
        description: data.description,
        referenceImages: data.reference_images || [],
        voiceType: data.voice_type,
        kieVoiceId: data.kie_voice_id,
        personality: data.personality,
        createdAt: data.created_at,
      };

      setCharacters(prev => [newCharacter, ...prev]);

      setIsCreateDialogOpen(false);
      setFormData({
        name: '',
        description: '',
        referenceImages: [],
        voiceType: 'professional-female',
        kieVoiceId: '',
        personality: 'professional'
      });
      setImagePreviews([]);
      
      toast({
        title: "Character Created",
        description: `${newCharacter.name} has been created successfully.`,
      });
    } catch (error) {
      console.error('Error creating character:', error);
      toast({
        title: "Error",
        description: "Failed to create character.",
        variant: "destructive"
      });
    }
  };

  const handleUpdateCharacter = async () => {
    if (!editingCharacter) return;

    try {
      const { error } = await supabase
        .from('characters')
        .update({
          name: formData.name,
          description: formData.description,
          reference_images: formData.referenceImages,
          voice_type: formData.voiceType,
          kie_voice_id: formData.kieVoiceId,
          personality: formData.personality,
        })
        .eq('id', editingCharacter.id);

      if (error) {
        toast({
          title: "Error Updating Character",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      const updatedCharacter: Character = {
        ...editingCharacter,
        name: formData.name,
        description: formData.description,
        referenceImages: formData.referenceImages,
        voiceType: formData.voiceType,
        kieVoiceId: formData.kieVoiceId,
        personality: formData.personality,
      };

      setCharacters(prev => prev.map(char =>
        char.id === editingCharacter.id ? updatedCharacter : char
      ));

      setEditingCharacter(null);
      setFormData({
        name: '',
        description: '',
        referenceImages: [],
        voiceType: 'professional-female',
        kieVoiceId: '',
        personality: 'professional'
      });
      setImagePreviews([]);
      
      toast({
        title: "Character Updated",
        description: `${updatedCharacter.name} has been updated successfully.`,
      });
    } catch (error) {
      console.error('Error updating character:', error);
      toast({
        title: "Error",
        description: "Failed to update character.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteCharacter = async (id: string) => {
    try {
      const { error } = await supabase
        .from('characters')
        .delete()
        .eq('id', id);

      if (error) {
        toast({
          title: "Error Deleting Character",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      setCharacters(prev => prev.filter(char => char.id !== id));
      
      toast({
        title: "Character Deleted",
        description: "Character has been deleted successfully.",
      });
    } catch (error) {
      console.error('Error deleting character:', error);
      toast({
        title: "Error",
        description: "Failed to delete character.",
        variant: "destructive"
      });
    }
  };

  const openEditDialog = (character: Character) => {
    setFormData({
      name: character.name,
      description: character.description,
      referenceImages: character.referenceImages || [],
      voiceType: character.voiceType,
      kieVoiceId: character.kieVoiceId || '',
      personality: character.personality
    });
    setImagePreviews(character.referenceImages || []);
    setEditingCharacter(character);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      referenceImages: [],
      voiceType: 'professional-female',
      kieVoiceId: '',
      personality: 'professional'
    });
    setImagePreviews([]);
    setEditingCharacter(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "File Too Large",
          description: `${file.name} is larger than 5MB. Please select a smaller image.`,
          variant: "destructive"
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = event.target?.result as string;
        setFormData(prev => ({ 
          ...prev, 
          referenceImages: [...prev.referenceImages, base64String] 
        }));
        setImagePreviews(prev => [...prev, base64String]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({ 
      ...prev, 
      referenceImages: prev.referenceImages.filter((_, i) => i !== index) 
    }));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Your Characters</h2>
          <p className="text-muted-foreground">Manage AI avatars for your video content</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsAICreatorOpen(true)} className="flex items-center gap-2" variant="default">
            <SparklesIcon className="w-4 h-4" />
            Create with AI
          </Button>

          <Dialog open={isCreateDialogOpen || !!editingCharacter} onOpenChange={(open) => {
            if (!open) {
              setIsCreateDialogOpen(false);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsCreateDialogOpen(true)} variant="outline" className="flex items-center gap-2">
                <PlusIcon className="w-4 h-4" />
                Manual
              </Button>
            </DialogTrigger>
          
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingCharacter ? 'Edit Character' : 'Create New Character'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="char-name">Character Name</Label>
                <Input
                  id="char-name"
                  placeholder="e.g., Alex Thompson, Sarah Miller..."
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="char-description">Description</Label>
                <Textarea
                  id="char-description"
                  placeholder="Brief description of the character's role and background..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="min-h-[80px]"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="char-appearance">Character Images</Label>
                <div className="space-y-3">
                  {imagePreviews.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {imagePreviews.map((image, index) => (
                        <div key={index} className="relative">
                          <img 
                            src={image} 
                            alt={`Character preview ${index + 1}`} 
                            className="w-full h-24 object-cover rounded-md border"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-1 right-1 h-6 w-6 p-0"
                            onClick={() => removeImage(index)}
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  
                  <div className="border-2 border-dashed border-border rounded-md p-6 text-center">
                    <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      {imagePreviews.length > 0 ? 'Add more character images' : 'Upload character images'}
                    </p>
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                    />
                    <Label 
                      htmlFor="image-upload" 
                      className="cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
                    >
                      <UploadIcon className="w-4 h-4 mr-2" />
                      Choose Images
                    </Label>
                    <p className="text-xs text-muted-foreground mt-2">
                      Multiple images help with character consistency
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Voice Type</Label>
                <Select value={formData.voiceType} onValueChange={(value) => setFormData(prev => ({ ...prev, voiceType: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICE_TYPES.map(voice => (
                      <SelectItem key={voice.value} value={voice.value}>
                        {voice.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="kie-voice-id">Kie.ai Voice ID (Optional)</Label>
                <Input
                  id="kie-voice-id"
                  placeholder="e.g., voice_123..."
                  value={formData.kieVoiceId}
                  onChange={(e) => setFormData(prev => ({ ...prev, kieVoiceId: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="char-personality">Personality</Label>
                <Input
                  id="char-personality"
                  placeholder="e.g., professional, enthusiastic, friendly..."
                  value={formData.personality}
                  onChange={(e) => setFormData(prev => ({ ...prev, personality: e.target.value }))}
                />
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={editingCharacter ? handleUpdateCharacter : handleCreateCharacter}
                  className="flex-1"
                >
                  {editingCharacter ? 'Update Character' : 'Create Character'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* AI Character Creator Dialog */}
      <Dialog open={isAICreatorOpen} onOpenChange={setIsAICreatorOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] p-0 overflow-hidden">
          <AICharacterCreator
            onCharacterSaved={loadCharacters}
            onClose={() => setIsAICreatorOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Character Templates */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <LayoutTemplateIcon className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Character Templates</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">Quick-start with pre-made characters — click to use as a starting point</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {CHARACTER_TEMPLATES.map((template, i) => (
              <button
                key={i}
                className="group text-left rounded-lg border border-border bg-card p-2 hover:border-primary/50 hover:shadow-md transition-all"
                onClick={async () => {
                  const { data: user } = await supabase.auth.getUser();
                  if (!user.user) {
                    toast({ title: 'Sign in required', variant: 'destructive' });
                    return;
                  }
                  // Convert template image to base64 for storage
                  try {
                    const resp = await fetch(template.image);
                    const blob = await resp.blob();
                    const reader = new FileReader();
                    reader.onload = async (e) => {
                      const base64 = e.target?.result as string;
                      const { data, error } = await supabase
                        .from('characters')
                        .insert({
                          user_id: user.user!.id,
                          name: template.name,
                          description: template.description,
                          reference_images: [base64],
                          voice_type: template.voiceType,
                          personality: template.personality,
                        })
                        .select()
                        .single();
                      if (error) {
                        toast({ title: 'Error', description: error.message, variant: 'destructive' });
                        return;
                      }
                      setCharacters(prev => [{
                        id: data.id,
                        name: data.name,
                        description: data.description || '',
                        referenceImages: data.reference_images || [],
                        voiceType: data.voice_type,
                        kieVoiceId: data.kie_voice_id || '',
                        personality: data.personality || '',
                        createdAt: data.created_at,
                      }, ...prev]);
                      toast({ title: 'Character Created', description: `${template.name} added to your characters.` });
                    };
                    reader.readAsDataURL(blob);
                  } catch (err) {
                    console.error('Template error:', err);
                    toast({ title: 'Error', description: 'Failed to create from template.', variant: 'destructive' });
                  }
                }}
              >
                <img 
                  src={template.image} 
                  alt={template.name} 
                  className="w-full aspect-square object-cover rounded-md mb-2 group-hover:scale-[1.02] transition-transform" 
                />
                <p className="text-sm font-medium truncate">{template.name}</p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{template.description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Characters Grid */}
      {characters.length === 0 ? (
        <Card className="glass">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <UserIcon className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No Characters Yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              Create your first AI character or use a template above to get started.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <PlusIcon className="w-4 h-4 mr-2" />
              Create Your First Character
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {characters.map((character) => (
            <Card key={character.id} className="glass hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={character.appearanceImage} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {character.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">{character.name}</CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        {VOICE_TYPES.find(v => v.value === character.voiceType)?.label || character.voiceType}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(character)}
                    >
                      <EditIcon className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCharacter(character.id)}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                {character.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {character.description}
                  </p>
                )}
                
                {(character.referenceImages && character.referenceImages.length > 0) ? (
                  <div>
                    <p className="text-xs font-medium text-foreground mb-2">Reference Images:</p>
                    <div className="grid grid-cols-2 gap-1">
                      {character.referenceImages.slice(0, 4).map((image, index) => (
                        <img 
                          key={index}
                          src={image} 
                          alt={`${character.name} reference ${index + 1}`}
                          className="w-full h-16 object-cover rounded-md border"
                        />
                      ))}
                      {character.referenceImages.length > 4 && (
                        <div className="w-full h-16 bg-muted rounded-md border flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">
                            +{character.referenceImages.length - 4} more
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : character.appearanceImage ? (
                  <div>
                    <p className="text-xs font-medium text-foreground mb-1">Character Image:</p>
                    <img 
                      src={character.appearanceImage} 
                      alt={`${character.name} appearance`}
                      className="w-full h-24 object-cover rounded-md border"
                    />
                  </div>
                ) : null}
                
                <div className="flex items-center justify-between pt-2">
                  <Badge variant="outline" className="text-xs">
                    {character.personality}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" disabled>
                      <VolumeXIcon className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="sm" disabled>
                      <PlayIcon className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};