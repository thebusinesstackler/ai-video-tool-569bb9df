import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Upload, Film, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ImageGallerySelectorProps {
  onSelectImage: (imageUrl: string) => void;
  selectedImage?: string;
}

interface MovieProject {
  id: string;
  title: string;
  scenes: any;
}

interface Character {
  id: string;
  name: string;
  reference_images: string[];
}

export const ImageGallerySelector: React.FC<ImageGallerySelectorProps> = ({
  onSelectImage,
  selectedImage
}) => {
  const [movieProjects, setMovieProjects] = useState<MovieProject[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    loadMovieProjects();
    loadCharacters();
  }, []);

  const loadMovieProjects = async () => {
    const { data, error } = await supabase
      .from('movie_projects')
      .select('id, title, scenes')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error loading movie projects', variant: 'destructive' });
      return;
    }

    const projectsWithParsedScenes = (data || []).map(project => ({
      ...project,
      scenes: Array.isArray(project.scenes) ? project.scenes : []
    }));

    setMovieProjects(projectsWithParsedScenes);
  };

  const loadCharacters = async () => {
    const { data, error } = await supabase
      .from('characters')
      .select('id, name, reference_images')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error loading characters', variant: 'destructive' });
      return;
    }

    setCharacters(data || []);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('project-files')
      .upload(filePath, file);

    if (uploadError) {
      toast({ title: 'Error uploading image', variant: 'destructive' });
      return;
    }

    const { data } = supabase.storage.from('project-files').getPublicUrl(filePath);
    setUploadedImage(data.publicUrl);
    onSelectImage(data.publicUrl);
  };

  const filteredProjects = movieProjects.filter(p =>
    p.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCharacters = characters.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Source Image</CardTitle>
        <CardDescription>
          Choose from your movie projects, characters, or upload a new image
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload">
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="projects">
              <Film className="w-4 h-4 mr-2" />
              Movie Projects
            </TabsTrigger>
            <TabsTrigger value="characters">
              <User className="w-4 h-4 mr-2" />
              Characters
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <div>
              <Label htmlFor="image-upload">Upload Image</Label>
              <Input
                id="image-upload"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="mt-2"
              />
            </div>
            {uploadedImage && (
              <div className="mt-4">
                <img
                  src={uploadedImage}
                  alt="Uploaded"
                  className="w-full h-48 object-cover rounded-lg border-2 border-primary"
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="projects" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {filteredProjects.map((project) => (
                <div key={project.id} className="space-y-2">
                  <h4 className="font-semibold text-sm">{project.title}</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {project.scenes
                      .filter(scene => scene.generatedImage)
                      .map((scene, idx) => (
                        <div
                          key={idx}
                          onClick={() => onSelectImage(scene.generatedImage!)}
                          className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                            selectedImage === scene.generatedImage
                              ? 'border-primary ring-2 ring-primary'
                              : 'border-border hover:border-primary'
                          }`}
                        >
                          <img
                            src={scene.generatedImage}
                            alt={scene.description || `Scene ${idx + 1}`}
                            className="w-full h-24 object-cover"
                          />
                        </div>
                      ))}
                  </div>
                </div>
              ))}
              {filteredProjects.length === 0 && (
                <p className="text-muted-foreground text-center py-8">
                  No movie projects found
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="characters" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search characters..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {filteredCharacters.map((character) => (
                <div key={character.id} className="space-y-2">
                  <h4 className="font-semibold text-sm">{character.name}</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {character.reference_images.map((image, idx) => (
                      <div
                        key={idx}
                        onClick={() => onSelectImage(image)}
                        className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                          selectedImage === image
                            ? 'border-primary ring-2 ring-primary'
                            : 'border-border hover:border-primary'
                        }`}
                      >
                        <img
                          src={image}
                          alt={`${character.name} reference ${idx + 1}`}
                          className="w-full h-24 object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {filteredCharacters.length === 0 && (
                <p className="text-muted-foreground text-center py-8">
                  No characters found
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
