import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Plus, Image as ImageIcon, Loader2, Trash2, RefreshCw, Sparkles, Sun, Moon, Sunrise, Sunset } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Location {
  id: string;
  name: string;
  description: string;
  referenceImage?: string;
  lightingSetup: string;
  timeOfDay: 'day' | 'night' | 'golden-hour' | 'blue-hour' | 'overcast';
  props: string[];
  mood: string;
}

interface LocationManagerProps {
  locations: Location[];
  onLocationsChange: (locations: Location[]) => void;
  outline?: string;
  onExtractLocations?: () => void;
  isExtracting?: boolean;
}

const TIME_OF_DAY_OPTIONS = [
  { value: 'day', label: 'Day', icon: Sun },
  { value: 'night', label: 'Night', icon: Moon },
  { value: 'golden-hour', label: 'Golden Hour', icon: Sunrise },
  { value: 'blue-hour', label: 'Blue Hour', icon: Sunset },
  { value: 'overcast', label: 'Overcast', icon: Sun },
];

const LIGHTING_PRESETS = [
  'Natural daylight streaming through windows',
  'Warm golden hour glow',
  'Cool blue moonlight',
  'Harsh fluorescent overhead',
  'Soft ambient candlelight',
  'Neon city lights reflecting',
  'Dramatic rim lighting',
  'Diffused overcast lighting',
];

export const LocationManager: React.FC<LocationManagerProps> = ({
  locations,
  onLocationsChange,
  outline,
  onExtractLocations,
  isExtracting = false
}) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [generatingImageFor, setGeneratingImageFor] = useState<string | null>(null);
  const [newLocation, setNewLocation] = useState<Partial<Location>>({
    name: '',
    description: '',
    lightingSetup: '',
    timeOfDay: 'day',
    props: [],
    mood: ''
  });
  const [propsInput, setPropsInput] = useState('');
  const { toast } = useToast();

  const generateLocationImage = async (location: Location) => {
    setGeneratingImageFor(location.id);
    try {
      const prompt = `Wide establishing shot of ${location.name}. ${location.description}. 
Lighting: ${location.lightingSetup}. Time of day: ${location.timeOfDay}. 
Mood: ${location.mood}. 
Props visible: ${location.props.join(', ')}.
Cinematic, photorealistic, high detail, no people, empty location for movie set.`;

      const { data, error } = await supabase.functions.invoke('generate-scene-image', {
        body: { prompt }
      });

      if (error) throw error;

      const updatedLocations = locations.map(loc =>
        loc.id === location.id ? { ...loc, referenceImage: data.imageUrl } : loc
      );
      onLocationsChange(updatedLocations);

      toast({
        title: "Location Image Generated",
        description: `Reference image for "${location.name}" created.`
      });
    } catch (error: any) {
      console.error('Error generating location image:', error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate location image.",
        variant: "destructive"
      });
    } finally {
      setGeneratingImageFor(null);
    }
  };

  const addLocation = () => {
    if (!newLocation.name || !newLocation.description) {
      toast({
        title: "Missing Information",
        description: "Please provide a name and description for the location.",
        variant: "destructive"
      });
      return;
    }

    const location: Location = {
      id: `loc_${Date.now()}`,
      name: newLocation.name!,
      description: newLocation.description!,
      lightingSetup: newLocation.lightingSetup || 'Natural lighting',
      timeOfDay: newLocation.timeOfDay as Location['timeOfDay'] || 'day',
      props: propsInput.split(',').map(p => p.trim()).filter(Boolean),
      mood: newLocation.mood || 'neutral'
    };

    onLocationsChange([...locations, location]);
    setIsAddDialogOpen(false);
    resetForm();

    toast({
      title: "Location Added",
      description: `"${location.name}" added to your locations.`
    });
  };

  const updateLocation = () => {
    if (!editingLocation) return;

    const updatedLocations = locations.map(loc =>
      loc.id === editingLocation.id ? {
        ...editingLocation,
        props: propsInput.split(',').map(p => p.trim()).filter(Boolean)
      } : loc
    );
    onLocationsChange(updatedLocations);
    setEditingLocation(null);
    resetForm();

    toast({
      title: "Location Updated",
      description: `"${editingLocation.name}" has been updated.`
    });
  };

  const deleteLocation = (id: string) => {
    onLocationsChange(locations.filter(loc => loc.id !== id));
    toast({
      title: "Location Deleted",
      description: "Location removed from your project."
    });
  };

  const resetForm = () => {
    setNewLocation({
      name: '',
      description: '',
      lightingSetup: '',
      timeOfDay: 'day',
      props: [],
      mood: ''
    });
    setPropsInput('');
  };

  const openEditDialog = (location: Location) => {
    setEditingLocation(location);
    setPropsInput(location.props.join(', '));
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Location Sets
            </CardTitle>
            <CardDescription>
              Manage locations for consistent backgrounds across scenes
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {outline && onExtractLocations && (
              <Button
                variant="outline"
                size="sm"
                onClick={onExtractLocations}
                disabled={isExtracting}
              >
                {isExtracting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Extract from Outline
              </Button>
            )}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Location
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add New Location</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Location Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Maria's Kitchen, City Street"
                      value={newLocation.name}
                      onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Visual Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe the location in detail: layout, style, colors, atmosphere..."
                      value={newLocation.description}
                      onChange={(e) => setNewLocation({ ...newLocation, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Time of Day</Label>
                      <Select
                        value={newLocation.timeOfDay}
                        onValueChange={(value) => setNewLocation({ ...newLocation, timeOfDay: value as Location['timeOfDay'] })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select time" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OF_DAY_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Mood</Label>
                      <Input
                        placeholder="e.g., cozy, tense, romantic"
                        value={newLocation.mood}
                        onChange={(e) => setNewLocation({ ...newLocation, mood: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Lighting Setup</Label>
                    <Select
                      value={newLocation.lightingSetup}
                      onValueChange={(value) => setNewLocation({ ...newLocation, lightingSetup: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select lighting style" />
                      </SelectTrigger>
                      <SelectContent>
                        {LIGHTING_PRESETS.map(preset => (
                          <SelectItem key={preset} value={preset}>
                            {preset}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="props">Props (comma-separated)</Label>
                    <Input
                      id="props"
                      placeholder="wooden table, coffee maker, potted plant"
                      value={propsInput}
                      onChange={(e) => setPropsInput(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={addLocation}>
                    Add Location
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {locations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No locations defined yet</p>
            <p className="text-sm">Add locations to maintain consistent backgrounds</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {locations.map((location) => (
              <Card key={location.id} className="bg-muted/50 border-border overflow-hidden">
                <div className="aspect-video relative bg-muted">
                  {location.referenceImage ? (
                    <img
                      src={location.referenceImage}
                      alt={location.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7"
                      onClick={() => generateLocationImage(location)}
                      disabled={generatingImageFor === location.id}
                    >
                      {generatingImageFor === location.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-7 w-7"
                      onClick={() => deleteLocation(location.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="p-3">
                  <h4 className="font-medium text-sm mb-1">{location.name}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {location.description}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-xs">
                      {location.timeOfDay}
                    </Badge>
                    {location.mood && (
                      <Badge variant="secondary" className="text-xs">
                        {location.mood}
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={!!editingLocation} onOpenChange={(open) => !open && setEditingLocation(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Location</DialogTitle>
          </DialogHeader>
          {editingLocation && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Location Name</Label>
                <Input
                  id="edit-name"
                  value={editingLocation.name}
                  onChange={(e) => setEditingLocation({ ...editingLocation, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Visual Description</Label>
                <Textarea
                  id="edit-description"
                  value={editingLocation.description}
                  onChange={(e) => setEditingLocation({ ...editingLocation, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Time of Day</Label>
                  <Select
                    value={editingLocation.timeOfDay}
                    onValueChange={(value) => setEditingLocation({ ...editingLocation, timeOfDay: value as Location['timeOfDay'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OF_DAY_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Mood</Label>
                  <Input
                    value={editingLocation.mood}
                    onChange={(e) => setEditingLocation({ ...editingLocation, mood: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Lighting Setup</Label>
                <Select
                  value={editingLocation.lightingSetup}
                  onValueChange={(value) => setEditingLocation({ ...editingLocation, lightingSetup: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LIGHTING_PRESETS.map(preset => (
                      <SelectItem key={preset} value={preset}>
                        {preset}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-props">Props (comma-separated)</Label>
                <Input
                  id="edit-props"
                  value={propsInput}
                  onChange={(e) => setPropsInput(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLocation(null)}>
              Cancel
            </Button>
            <Button onClick={updateLocation}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
