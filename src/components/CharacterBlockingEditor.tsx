import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Users, Move, ArrowRight } from 'lucide-react';

export interface CharacterBlocking {
  characterName: string;
  startPosition: 'left' | 'center' | 'right' | 'foreground' | 'background' | 'off-screen-left' | 'off-screen-right';
  endPosition: 'left' | 'center' | 'right' | 'foreground' | 'background' | 'off-screen-left' | 'off-screen-right';
  movement: string;
  facing: 'camera' | 'left' | 'right' | 'away';
}

interface CharacterBlockingEditorProps {
  sceneNumber: number;
  charactersInScene: string[];
  blocking: CharacterBlocking[];
  onBlockingChange: (blocking: CharacterBlocking[]) => void;
}

const POSITION_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
  { value: 'foreground', label: 'Foreground' },
  { value: 'background', label: 'Background' },
  { value: 'off-screen-left', label: 'Off-screen Left' },
  { value: 'off-screen-right', label: 'Off-screen Right' },
];

const FACING_OPTIONS = [
  { value: 'camera', label: 'Facing Camera' },
  { value: 'left', label: 'Facing Left' },
  { value: 'right', label: 'Facing Right' },
  { value: 'away', label: 'Facing Away' },
];

const MOVEMENT_PRESETS = [
  'Stays stationary',
  'Walks slowly across frame',
  'Enters from left',
  'Exits to right',
  'Turns around',
  'Steps forward toward camera',
  'Steps back',
  'Gestures while speaking',
  'Sits down',
  'Stands up',
];

export const CharacterBlockingEditor: React.FC<CharacterBlockingEditorProps> = ({
  sceneNumber,
  charactersInScene,
  blocking,
  onBlockingChange
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [localBlocking, setLocalBlocking] = useState<CharacterBlocking[]>(blocking);

  const openEditor = () => {
    // Initialize blocking for any characters not yet defined
    const existingCharacters = new Set(blocking.map(b => b.characterName));
    const newBlocking = [...blocking];
    
    charactersInScene.forEach((char, idx) => {
      if (!existingCharacters.has(char)) {
        // Default positioning: first char left, second char right, others center
        const defaultPosition = idx === 0 ? 'left' : idx === 1 ? 'right' : 'center';
        newBlocking.push({
          characterName: char,
          startPosition: defaultPosition as CharacterBlocking['startPosition'],
          endPosition: defaultPosition as CharacterBlocking['endPosition'],
          movement: 'Stays stationary',
          facing: idx === 0 ? 'right' : idx === 1 ? 'left' : 'camera'
        });
      }
    });
    
    setLocalBlocking(newBlocking);
    setIsDialogOpen(true);
  };

  const updateCharacterBlocking = (charName: string, field: keyof CharacterBlocking, value: string) => {
    setLocalBlocking(prev =>
      prev.map(b =>
        b.characterName === charName ? { ...b, [field]: value } : b
      )
    );
  };

  const saveBlocking = () => {
    onBlockingChange(localBlocking);
    setIsDialogOpen(false);
  };

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'left': return 'bg-blue-500/20 text-blue-400';
      case 'center': return 'bg-green-500/20 text-green-400';
      case 'right': return 'bg-purple-500/20 text-purple-400';
      case 'foreground': return 'bg-yellow-500/20 text-yellow-400';
      case 'background': return 'bg-gray-500/20 text-gray-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={openEditor}
        className="gap-2"
      >
        <Move className="h-4 w-4" />
        Blocking
        {blocking.length > 0 && (
          <Badge variant="secondary" className="ml-1">
            {blocking.length}
          </Badge>
        )}
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Character Blocking - Scene {sceneNumber}
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-6">
            {/* Visual Stage Preview */}
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="relative h-32 border border-dashed border-border rounded-lg">
                  {/* Stage grid */}
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-2">
                    <div className="border-r border-dashed border-border/50" />
                    <div className="border-r border-dashed border-border/50" />
                    <div />
                    <div className="border-r border-t border-dashed border-border/50" />
                    <div className="border-r border-t border-dashed border-border/50" />
                    <div className="border-t border-dashed border-border/50" />
                  </div>
                  
                  {/* Character positions */}
                  {localBlocking.map((char, idx) => {
                    const positionStyles: Record<string, string> = {
                      'left': 'left-4 top-1/2 -translate-y-1/2',
                      'center': 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
                      'right': 'right-4 top-1/2 -translate-y-1/2',
                      'foreground': 'left-1/2 bottom-2 -translate-x-1/2',
                      'background': 'left-1/2 top-2 -translate-x-1/2',
                      'off-screen-left': '-left-2 top-1/2 -translate-y-1/2 opacity-50',
                      'off-screen-right': '-right-2 top-1/2 -translate-y-1/2 opacity-50',
                    };
                    
                    return (
                      <div
                        key={char.characterName}
                        className={`absolute ${positionStyles[char.startPosition] || ''} transition-all duration-300`}
                      >
                        <Badge className={`${getPositionColor(char.startPosition)} text-xs`}>
                          {char.characterName.split(' ')[0]}
                        </Badge>
                      </div>
                    );
                  })}
                  
                  {/* Camera indicator */}
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full pt-2">
                    <span className="text-xs text-muted-foreground">📷 Camera</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Per-character controls */}
            {localBlocking.map((charBlocking) => (
              <Card key={charBlocking.characterName} className="bg-card">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium">
                    {charBlocking.characterName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-0 pb-4 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Start Position</Label>
                      <Select
                        value={charBlocking.startPosition}
                        onValueChange={(val) => updateCharacterBlocking(charBlocking.characterName, 'startPosition', val)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {POSITION_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 flex flex-col items-center justify-end">
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">End Position</Label>
                      <Select
                        value={charBlocking.endPosition}
                        onValueChange={(val) => updateCharacterBlocking(charBlocking.characterName, 'endPosition', val)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {POSITION_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Facing</Label>
                      <Select
                        value={charBlocking.facing}
                        onValueChange={(val) => updateCharacterBlocking(charBlocking.characterName, 'facing', val)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FACING_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Movement</Label>
                      <Select
                        value={charBlocking.movement}
                        onValueChange={(val) => updateCharacterBlocking(charBlocking.characterName, 'movement', val)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MOVEMENT_PRESETS.map(preset => (
                            <SelectItem key={preset} value={preset}>
                              {preset}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveBlocking}>
              Save Blocking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
