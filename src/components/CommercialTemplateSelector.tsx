import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Film, Heart, ShoppingBag, Briefcase, Building2, Users, Clock, 
  ArrowRight, Sparkles, CheckCircle2, Play
} from 'lucide-react';
import { COMMERCIAL_TEMPLATES, CommercialTemplate, TemplateScene } from '@/data/commercialTemplates';
import { MovieSceneWithKeyframes, KeyframeData } from './KeyframeSceneCard';

interface CommercialTemplateSelectorProps {
  onApplyTemplate: (scenes: MovieSceneWithKeyframes[], movieIdea: string) => void;
}

const categoryIcons: Record<CommercialTemplate['category'], React.ReactNode> = {
  awareness: <Heart className="w-4 h-4" />,
  product: <ShoppingBag className="w-4 h-4" />,
  service: <Briefcase className="w-4 h-4" />,
  nonprofit: <Building2 className="w-4 h-4" />,
  brand: <Film className="w-4 h-4" />,
  testimonial: <Users className="w-4 h-4" />,
};

const categoryLabels: Record<CommercialTemplate['category'], string> = {
  awareness: 'Awareness',
  product: 'Product',
  service: 'Service',
  nonprofit: 'Nonprofit',
  brand: 'Brand',
  testimonial: 'Testimonial',
};

const durationLabels: Record<CommercialTemplate['duration'], string> = {
  '30sec': '30 seconds',
  '60sec': '1 minute',
  '90sec': '90 seconds',
  '3min': '3 minutes',
};

export const CommercialTemplateSelector: React.FC<CommercialTemplateSelectorProps> = ({ onApplyTemplate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<CommercialTemplate | null>(null);
  const [activeCategory, setActiveCategory] = useState<'all' | CommercialTemplate['category']>('all');

  const filteredTemplates = activeCategory === 'all' 
    ? COMMERCIAL_TEMPLATES 
    : COMMERCIAL_TEMPLATES.filter(t => t.category === activeCategory);

  const convertTemplateToScenes = (template: CommercialTemplate): MovieSceneWithKeyframes[] => {
    return template.scenes.map((scene, index) => {
      const defaultKeyframe: KeyframeData = {
        imagePrompt: '',
        cameraAngle: 'eye-level',
        position: ''
      };
      
      return {
        sceneNumber: index + 1,
        title: scene.title,
        location: 'To be defined',
        timeOfDay: 'Day',
        description: `${scene.startFrameGuide} → ${scene.endFrameGuide}`,
        dialogue: scene.dialogueGuide,
        otherCharacterDialogue: undefined,
        imagePrompt: scene.startFrameGuide,
        selectedCameraAngle: 'eye-level',
        selectedLighting: scene.lighting,
        mood: scene.mood,
        suggestedMusic: scene.musicGuide,
        startFrame: {
          imagePrompt: scene.startFrameGuide,
          cameraAngle: scene.cameraMovement.includes('static') ? 'eye-level' : 'medium-shot',
          position: 'Center frame'
        },
        endFrame: {
          imagePrompt: scene.endFrameGuide,
          cameraAngle: 'close-up',
          position: 'Center frame'
        },
        transitionAction: scene.transitionGuide,
        transitionCameraMovement: scene.cameraMovement
      };
    });
  };

  const handleApplyTemplate = () => {
    if (!selectedTemplate) return;
    
    const scenes = convertTemplateToScenes(selectedTemplate);
    const movieIdea = `${selectedTemplate.name} Commercial: ${selectedTemplate.description}`;
    
    onApplyTemplate(scenes, movieIdea);
    setIsOpen(false);
    setSelectedTemplate(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="w-4 h-4" />
          Commercial Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="w-5 h-5" />
            Commercial Templates
          </DialogTitle>
          <DialogDescription>
            Choose a pre-built template with scene structures, emotional arcs, and timing guides.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex gap-4 h-[60vh]">
          {/* Template List */}
          <div className="w-1/2 space-y-3">
            {/* Category Tabs */}
            <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as any)}>
              <TabsList className="grid grid-cols-4 h-8">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="awareness" className="text-xs">Awareness</TabsTrigger>
                <TabsTrigger value="product" className="text-xs">Product</TabsTrigger>
                <TabsTrigger value="nonprofit" className="text-xs">Nonprofit</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <ScrollArea className="h-[calc(60vh-50px)]">
              <div className="space-y-2 pr-4">
                {filteredTemplates.map((template) => (
                  <Card 
                    key={template.id}
                    className={`cursor-pointer transition-all hover:border-primary/50 ${
                      selectedTemplate?.id === template.id ? 'border-primary ring-2 ring-primary/20' : ''
                    }`}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {categoryIcons[template.category]}
                          <CardTitle className="text-sm">{template.name}</CardTitle>
                        </div>
                        {selectedTemplate?.id === template.id && (
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px]">
                          {categoryLabels[template.category]}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          <Clock className="w-3 h-3 mr-1" />
                          {durationLabels[template.duration]}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {template.scenes.length} scenes
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="py-2 px-4">
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {template.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
          
          {/* Template Preview */}
          <div className="w-1/2 border-l pl-4">
            {selectedTemplate ? (
              <ScrollArea className="h-full">
                <div className="space-y-4 pr-4">
                  <div>
                    <h3 className="font-semibold text-lg">{selectedTemplate.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{selectedTemplate.description}</p>
                  </div>
                  
                  <div className="p-3 bg-primary/5 rounded-lg">
                    <p className="text-xs font-medium text-primary mb-1">Emotional Arc</p>
                    <p className="text-sm">{selectedTemplate.emotionalArc}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Scene Breakdown</h4>
                    <div className="space-y-2">
                      {selectedTemplate.scenes.map((scene, index) => (
                        <div 
                          key={index}
                          className="p-2 bg-muted/50 rounded border border-border/50"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm">{index + 1}. {scene.title}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {scene.duration}s
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {scene.startFrameGuide}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-[10px] capitalize">
                              {scene.mood}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {scene.cameraMovement}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <div className="h-full flex items-center justify-center text-center text-muted-foreground">
                <div>
                  <Play className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Select a template to preview</p>
                  <p className="text-sm">See scene breakdown and emotional arc</p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleApplyTemplate} 
            disabled={!selectedTemplate}
          >
            <ArrowRight className="w-4 h-4 mr-2" />
            Apply Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
