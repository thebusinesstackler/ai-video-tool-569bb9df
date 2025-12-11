import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  VideoIcon, 
  FileTextIcon, 
  UsersIcon, 
  TrendingUpIcon,
  PlayIcon,
  UploadIcon,
  LogInIcon
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import heroImage from '@/assets/hero-image.jpg';

const quickActions = [
  { 
    name: 'Create Video', 
    description: 'Transform scripts into engaging videos with AI',
    icon: VideoIcon, 
    variant: 'hero' as const,
    href: '/projects'
  },
  { 
    name: 'Generate Script', 
    description: 'Create AI-powered scripts using successful patterns',
    icon: FileTextIcon, 
    variant: 'ai' as const,
    href: '/scripts'
  },
  { 
    name: 'Create Character', 
    description: 'Design AI avatars for your video productions',
    icon: UsersIcon, 
    variant: 'glass' as const,
    href: '/characters'
  },
];

interface ProjectStats {
  videosCount: number;
  charactersCount: number;
  recentProjects: Array<{
    id: string;
    title: string;
    created_at: string;
    model_type: string;
  }>;
}

export const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<ProjectStats>({
    videosCount: 0,
    charactersCount: 0,
    recentProjects: []
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Force component re-render to clear any cached errors
  const componentKey = `dashboard-${Date.now()}`;

  useEffect(() => {
    if (user) {
      loadStats();
    } else {
      // Reset stats when user logs out
      setStats({
        videosCount: 0,
        charactersCount: 0,
        recentProjects: []
      });
      setIsLoadingStats(false);
    }
  }, [user]);

  const loadStats = async () => {
    try {
      setIsLoadingStats(true);
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) return;

      // Fetch projects count
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, title, created_at, model_type')
        .eq('user_id', currentUser.id);

      // Fetch characters count
      const { data: characters, error: charactersError } = await supabase
        .from('characters')
        .select('id')
        .eq('user_id', currentUser.id);

      // Fetch reels count for total videos
      const { data: reels, error: reelsError } = await supabase
        .from('reels')
        .select('id')
        .eq('user_id', currentUser.id);

      // Fetch movie projects count
      const { data: movieProjects, error: movieError } = await supabase
        .from('movie_projects')
        .select('id')
        .eq('user_id', currentUser.id);

      if (projectsError) {
        console.error('Error loading projects:', projectsError);
      }

      if (charactersError) {
        console.error('Error loading characters:', charactersError);
      }

      // Total videos = projects + reels + movie projects
      const totalVideos = (projects?.length || 0) + (reels?.length || 0) + (movieProjects?.length || 0);

      setStats({
        videosCount: totalVideos,
        charactersCount: characters?.length || 0,
        recentProjects: []
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  };

  if (!user) {
    return (
      <div className="space-y-8 animate-slide-in">
        {/* Welcome Section for Non-Authenticated Users */}
        <div className="relative overflow-hidden rounded-2xl glass">
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-20" 
            style={{ backgroundImage: `url(${heroImage})` }}
          />
          <div className="relative p-8 lg:p-12 text-center">
            <h1 className="text-4xl lg:text-6xl font-bold mb-6 gradient-text animate-float">
              AI Video Creator
            </h1>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed max-w-2xl mx-auto">
              Transform your scripts into professional videos with multiple AI models including the new Alibaba WAN 2.5 image-to-video technology.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button asChild variant="hero" size="lg">
                <Link to="/auth">
                  <LogInIcon className="w-5 h-5 mr-2" />
                  Get Started
                </Link>
              </Button>
              <Button asChild variant="glass" size="lg">
                <Link to="/auth">
                  <PlayIcon className="w-5 h-5 mr-2" />
                  Sign In
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div key={componentKey} className="space-y-8 animate-slide-in">{/* Force re-render */}
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl glass">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20" 
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="relative p-8 lg:p-12">
          <div className="max-w-3xl">
            <h1 className="text-4xl lg:text-6xl font-bold mb-6 text-foreground">
              AI Video Automation Platform
            </h1>
            <p className="text-xl text-foreground/90 font-medium mb-8 leading-relaxed">
              Create stunning videos with AI-powered content analysis, script generation, 
              and automated production using the latest VEO3 technology.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button variant="hero" size="lg">
                <PlayIcon className="w-5 h-5" />
                Start Creating
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="glass hover:shadow-glow transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Videos Created
            </CardTitle>
            <VideoIcon className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {isLoadingStats ? '...' : stats.videosCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total projects
            </p>
          </CardContent>
        </Card>

        <Card className="glass hover:shadow-glow transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Characters Created
            </CardTitle>
            <UsersIcon className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {isLoadingStats ? '...' : stats.charactersCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              AI avatars ready
            </p>
          </CardContent>
        </Card>

        <Card className="glass hover:shadow-glow transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent Activity
            </CardTitle>
            <TrendingUpIcon className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {isLoadingStats ? '...' : stats.recentProjects.length > 0 ? 'Active' : 'Ready'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.recentProjects.length > 0 ? 'Creating content' : 'Start creating'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {quickActions.map((action, index) => (
          <Link key={action.name} to={action.href}>
            <Card className="glass hover:shadow-ai hover:scale-105 transition-all duration-300 cursor-pointer group" style={{ animationDelay: `${index * 150}ms` }}>
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center mb-4 group-hover:animate-glow">
                  <action.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <CardTitle className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                  {action.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  {action.description}
                </p>
                <Button variant={action.variant} className="w-full">
                  Get Started
                </Button>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

    </div>
  );
};