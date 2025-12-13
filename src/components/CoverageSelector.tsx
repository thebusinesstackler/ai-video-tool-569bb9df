import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Users, Camera, Video, Loader2, Sparkles, Eye, UserSquare, ArrowLeftRight, Focus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface CoverageShot {
  id: string;
  type: 'establishing' | 'close-up' | 'over-shoulder' | 'two-shot' | 'reaction' | 'insert';
  characterFocus?: string;
  fromCharacter?: string; // For over-shoulder shots
  description: string;
  cameraAngle: string;
  imageUrl?: string;
  selected: boolean;
}

export interface SceneCoverage {
  sceneNumber: number;
  locationId?: string;
  charactersPresent: string[];
  shots: CoverageShot[];
}

interface CoverageSelectorProps {
  sceneNumber: number;
  sceneTitle: string;
  charactersInScene: string[];
  locationId?: string;
  coverage?: SceneCoverage;
  onCoverageChange: (coverage: SceneCoverage) => void;
  onGenerateCoverage: (coverage: SceneCoverage) => Promise<void>;
  isGenerating?: boolean;
}

const SHOT_TYPES = [
  { 
    type: 'establishing' as const, 
    label: 'Establishing Shot', 
    icon: Eye,
    description: 'Wide shot showing all characters in location',
    requiresCharacter: false
  },
  { 
    type: 'two-shot' as const, 
    label: 'Two-Shot', 
    icon: Users,
    description: 'Both characters together in frame',
    requiresCharacter: false,
    minCharacters: 2
  },
  { 
    type: 'close-up' as const, 
    label: 'Close-Up', 
    icon: Focus,
    description: 'Tight shot on character face',
    requiresCharacter: true
  },
  { 
    type: 'over-shoulder' as const, 
    label: 'Over-the-Shoulder', 
    icon: ArrowLeftRight,
    description: 'View from behind one character facing another',
    requiresCharacter: true,
    minCharacters: 2
  },
  { 
    type: 'reaction' as const, 
    label: 'Reaction Shot', 
    icon: UserSquare,
    description: 'Character reacting to off-screen action',
    requiresCharacter: true
  },
  { 
    type: 'insert' as const, 
    label: 'Insert Shot', 
    icon: Camera,
    description: 'Detail shot of object or action',
    requiresCharacter: false
  },
];

export const CoverageSelector: React.FC<CoverageSelectorProps> = ({
  sceneNumber,
  sceneTitle,
  charactersInScene,
  locationId,
  coverage,
  onCoverageChange,
  onGenerateCoverage,
  isGenerating = false
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedShots, setSelectedShots] = useState<CoverageShot[]>(coverage?.shots || []);
  const { toast } = useToast();

  const generateDefaultCoverage = (): CoverageShot[] => {
    const shots: CoverageShot[] = [];
    
    // Always include establishing shot
    shots.push({
      id: `shot_${Date.now()}_establishing`,
      type: 'establishing',
      description: `Wide establishing shot of ${sceneTitle}`,
      cameraAngle: 'wide-shot',
      selected: true
    });

    // Add two-shot if multiple characters
    if (charactersInScene.length >= 2) {
      shots.push({
        id: `shot_${Date.now()}_twoshot`,
        type: 'two-shot',
        description: `Two-shot of ${charactersInScene.slice(0, 2).join(' and ')}`,
        cameraAngle: 'medium-shot',
        selected: true
      });
    }

    // Add close-ups for each character
    charactersInScene.forEach((char, idx) => {
      shots.push({
        id: `shot_${Date.now()}_closeup_${idx}`,
        type: 'close-up',
        characterFocus: char,
        description: `Close-up on ${char}`,
        cameraAngle: 'close-up',
        selected: true
      });
    });

    // Add over-shoulder shots if 2+ characters
    if (charactersInScene.length >= 2) {
      charactersInScene.slice(0, 2).forEach((char, idx) => {
        const otherChar = charactersInScene[idx === 0 ? 1 : 0];
        shots.push({
          id: `shot_${Date.now()}_ots_${idx}`,
          type: 'over-shoulder',
          characterFocus: otherChar,
          fromCharacter: char,
          description: `Over ${char}'s shoulder, on ${otherChar}`,
          cameraAngle: 'over-shoulder',
          selected: idx === 0 // Only select first OTS by default
        });
      });
    }

    // Add reaction shots
    charactersInScene.forEach((char, idx) => {
      shots.push({
        id: `shot_${Date.now()}_reaction_${idx}`,
        type: 'reaction',
        characterFocus: char,
        description: `${char} reaction shot`,
        cameraAngle: 'close-up',
        selected: false
      });
    });

    return shots;
  };

  const openCoverageDialog = () => {
    if (selectedShots.length === 0) {
      setSelectedShots(generateDefaultCoverage());
    }
    setIsDialogOpen(true);
  };

  const toggleShot = (shotId: string) => {
    setSelectedShots(prev =>
      prev.map(shot =>
        shot.id === shotId ? { ...shot, selected: !shot.selected } : shot
      )
    );
  };

  const addCustomShot = (type: CoverageShot['type'], characterFocus?: string, fromCharacter?: string) => {
    const shotType = SHOT_TYPES.find(s => s.type === type);
    if (!shotType) return;

    let description = shotType.description;
    if (characterFocus) {
      if (type === 'over-shoulder' && fromCharacter) {
        description = `Over ${fromCharacter}'s shoulder, on ${characterFocus}`;
      } else {
        description = `${shotType.label} on ${characterFocus}`;
      }
    }

    const newShot: CoverageShot = {
      id: `shot_${Date.now()}_${type}`,
      type,
      characterFocus,
      fromCharacter,
      description,
      cameraAngle: type === 'establishing' ? 'wide-shot' : 
                   type === 'two-shot' ? 'medium-shot' : 
                   'close-up',
      selected: true
    };

    setSelectedShots(prev => [...prev, newShot]);
  };

  const saveCoverage = () => {
    const newCoverage: SceneCoverage = {
      sceneNumber,
      locationId,
      charactersPresent: charactersInScene,
      shots: selectedShots
    };
    onCoverageChange(newCoverage);
    setIsDialogOpen(false);
    toast({
      title: "Coverage Saved",
      description: `${selectedShots.filter(s => s.selected).length} shots configured for Scene ${sceneNumber}.`
    });
  };

  const handleGenerateCoverage = async () => {
    const newCoverage: SceneCoverage = {
      sceneNumber,
      locationId,
      charactersPresent: charactersInScene,
      shots: selectedShots.filter(s => s.selected)
    };
    
    try {
      await onGenerateCoverage(newCoverage);
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Coverage generation error:', error);
    }
  };

  const selectedCount = selectedShots.filter(s => s.selected).length;

  return (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={openCoverageDialog}
        className="gap-2"
      >
        <Video className="h-4 w-4" />
        Coverage
        {coverage && coverage.shots.length > 0 && (
          <Badge variant="secondary" className="ml-1">
            {coverage.shots.filter(s => s.selected).length}
          </Badge>
        )}
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              Shot Coverage - Scene {sceneNumber}
            </DialogTitle>
            <CardDescription>
              Select shots to generate for consistent coverage. 
              {charactersInScene.length > 0 && (
                <span className="block mt-1">
                  Characters: {charactersInScene.join(', ')}
                </span>
              )}
            </CardDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Shot Type Groups */}
            {SHOT_TYPES.map(shotType => {
              const shotsOfType = selectedShots.filter(s => s.type === shotType.type);
              const Icon = shotType.icon;
              
              // Skip if requires more characters than present
              if (shotType.minCharacters && charactersInScene.length < shotType.minCharacters) {
                return null;
              }

              return (
                <div key={shotType.type} className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {shotType.label}
                    <span className="text-xs text-muted-foreground">
                      ({shotType.description})
                    </span>
                  </div>
                  <div className="pl-6 space-y-2">
                    {shotsOfType.map(shot => (
                      <div key={shot.id} className="flex items-center gap-3">
                        <Checkbox
                          id={shot.id}
                          checked={shot.selected}
                          onCheckedChange={() => toggleShot(shot.id)}
                        />
                        <Label 
                          htmlFor={shot.id} 
                          className="flex-1 text-sm cursor-pointer"
                        >
                          {shot.description}
                        </Label>
                        {shot.imageUrl && (
                          <Badge variant="outline" className="text-xs">
                            Generated
                          </Badge>
                        )}
                      </div>
                    ))}
                    
                    {/* Add more shots of this type for characters not yet covered */}
                    {shotType.requiresCharacter && (
                      <div className="flex gap-2 flex-wrap mt-2">
                        {charactersInScene
                          .filter(char => !shotsOfType.some(s => s.characterFocus === char))
                          .map(char => (
                            <Button
                              key={char}
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => addCustomShot(shotType.type, char)}
                            >
                              + Add for {char}
                            </Button>
                          ))
                        }
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex-1 text-sm text-muted-foreground">
              {selectedCount} shot{selectedCount !== 1 ? 's' : ''} selected
            </div>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={saveCoverage}>
              Save Coverage
            </Button>
            <Button 
              onClick={handleGenerateCoverage}
              disabled={isGenerating || selectedCount === 0}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate {selectedCount} Shots
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
