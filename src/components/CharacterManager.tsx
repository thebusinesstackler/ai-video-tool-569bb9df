import React, { useState, useEffect } from 'react';
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
  UploadIcon
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface Character {
  id: string;
  name: string;
  description: string;
  appearanceImage?: string; // Base64 image data
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
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    appearanceImage: '',
    voiceType: 'professional-female',
    kieVoiceId: '',
    personality: 'professional'
  });
  const [imagePreview, setImagePreview] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    loadCharacters();
  }, []);

  const loadCharacters = () => {
    const stored = localStorage.getItem('ai_video_characters');
    if (stored) {
      setCharacters(JSON.parse(stored));
    }
  };

  const saveCharacters = (newCharacters: Character[]) => {
    localStorage.setItem('ai_video_characters', JSON.stringify(newCharacters));
    setCharacters(newCharacters);
  };

  const handleCreateCharacter = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a character name.",
        variant: "destructive"
      });
      return;
    }

    const newCharacter: Character = {
      id: Date.now().toString(),
      ...formData,
      createdAt: new Date().toISOString()
    };

    const updatedCharacters = [...characters, newCharacter];
    saveCharacters(updatedCharacters);
    
    setFormData({
      name: '',
      description: '',
      appearanceImage: '',
      voiceType: 'professional-female',
      kieVoiceId: '',
      personality: 'professional'
    });
    setImagePreview('');
    setIsCreateDialogOpen(false);
    
    toast({
      title: "Character Created",
      description: `${newCharacter.name} has been added to your character library.`
    });
  };

  const handleUpdateCharacter = () => {
    if (!editingCharacter || !formData.name.trim()) return;

    const updatedCharacters = characters.map(char =>
      char.id === editingCharacter.id
        ? { ...char, ...formData }
        : char
    );
    
    saveCharacters(updatedCharacters);
    setEditingCharacter(null);
    
    toast({
      title: "Character Updated",
      description: "Character has been updated successfully."
    });
  };

  const handleDeleteCharacter = (id: string) => {
    const updatedCharacters = characters.filter(char => char.id !== id);
    saveCharacters(updatedCharacters);
    
    toast({
      title: "Character Deleted",
      description: "Character has been removed from your library."
    });
  };

  const openEditDialog = (character: Character) => {
    setFormData({
      name: character.name,
      description: character.description,
      appearanceImage: character.appearanceImage || '',
      voiceType: character.voiceType,
      kieVoiceId: character.kieVoiceId || '',
      personality: character.personality
    });
    setImagePreview(character.appearanceImage || '');
    setEditingCharacter(character);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      appearanceImage: '',
      voiceType: 'professional-female',
      kieVoiceId: '',
      personality: 'professional'
    });
    setImagePreview('');
    setEditingCharacter(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "File Too Large",
          description: "Please select an image smaller than 5MB.",
          variant: "destructive"
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = event.target?.result as string;
        setFormData(prev => ({ ...prev, appearanceImage: base64String }));
        setImagePreview(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setFormData(prev => ({ ...prev, appearanceImage: '' }));
    setImagePreview('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Your Characters</h2>
          <p className="text-muted-foreground">Manage AI avatars for your video content</p>
        </div>
        
        <Dialog open={isCreateDialogOpen || !!editingCharacter} onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateDialogOpen(true)} className="flex items-center gap-2">
              <PlusIcon className="w-4 h-4" />
              Create Character
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
                <Label htmlFor="char-appearance">Character Image</Label>
                <div className="space-y-3">
                  {imagePreview ? (
                    <div className="relative">
                      <img 
                        src={imagePreview} 
                        alt="Character preview" 
                        className="w-full h-32 object-cover rounded-md border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={removeImage}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-border rounded-md p-6 text-center">
                      <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground mb-2">Upload a character image</p>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="image-upload"
                      />
                      <Label htmlFor="image-upload" className="cursor-pointer">
                        <Button type="button" variant="outline" size="sm">
                          <UploadIcon className="w-4 h-4 mr-2" />
                          Choose Image
                        </Button>
                      </Label>
                    </div>
                  )}
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

      {/* Characters Grid */}
      {characters.length === 0 ? (
        <Card className="glass">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <UserIcon className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No Characters Yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              Create your first AI character to get started with personalized video content.
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
                      <AvatarImage src={character.avatar} />
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
                
                {character.appearanceImage && (
                  <div>
                    <p className="text-xs font-medium text-foreground mb-1">Character Image:</p>
                    <img 
                      src={character.appearanceImage} 
                      alt={`${character.name} appearance`}
                      className="w-full h-24 object-cover rounded-md border"
                    />
                  </div>
                )}
                
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