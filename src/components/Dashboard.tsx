import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  VideoIcon, 
  FileTextIcon, 
  UsersIcon, 
  TrendingUpIcon,
  PlayIcon,
  UploadIcon,
  SparklesIcon,
  BarChart3Icon,
  LogInIcon
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import heroImage from '@/assets/hero-image.jpg';

const stats = [
  { name: 'Videos Created', value: '2,547', change: '+12%', icon: VideoIcon },
  { name: 'Scripts Generated', value: '3,142', change: '+8%', icon: FileTextIcon },
  { name: 'Characters Active', value: '24', change: '+3%', icon: UsersIcon },
  { name: 'Engagement Rate', value: '94.2%', change: '+5.1%', icon: TrendingUpIcon },
];

const quickActions = [
  { 
    name: 'Analyze Content', 
    description: 'Upload videos to analyze patterns and successful elements',
    icon: BarChart3Icon, 
    variant: 'glass' as const,
    href: '/analysis'
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
  { 
    name: 'Create Video', 
    description: 'Transform scripts into engaging videos with VEO3',
    icon: PlayIcon, 
    variant: 'hero' as const,
    href: '/production'
  },
];

export const Dashboard = () => {
  const { user } = useAuth();

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
    <div className="space-y-8 animate-slide-in">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl glass">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20" 
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="relative p-8 lg:p-12">
          <div className="max-w-3xl">
            <h1 className="text-4xl lg:text-6xl font-bold mb-6 gradient-text animate-float">
              AI Video Automation Platform
            </h1>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Create stunning videos with AI-powered content analysis, script generation, 
              and automated production using the latest VEO3 technology.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button variant="hero" size="lg">
                <PlayIcon className="w-5 h-5" />
                Start Creating
              </Button>
              <Button variant="glass" size="lg">
                <UploadIcon className="w-5 h-5" />
                Analyze Content
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={stat.name} className="glass hover:shadow-glow transition-all duration-300" style={{ animationDelay: `${index * 100}ms` }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.name}
              </CardTitle>
              <stat.icon className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-primary mt-1">
                {stat.change} from last month
              </p>
            </CardContent>
          </Card>
        ))}
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

      {/* Recent Activity */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold text-foreground">Recent Activity</CardTitle>
            <Button variant="ghost">View All</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { 
                action: 'Video "Social Media Strategy" completed', 
                time: '2 minutes ago',
                type: 'video'
              },
              { 
                action: 'Script generated for "Product Launch"', 
                time: '15 minutes ago',
                type: 'script'
              },
              { 
                action: 'Character "Business Executive" added', 
                time: '1 hour ago',
                type: 'character'
              },
              { 
                action: 'Content analysis for 5 videos completed', 
                time: '2 hours ago',
                type: 'analysis'
              }
            ].map((activity, index) => (
              <div key={index} className="flex items-center gap-4 p-3 rounded-lg hover:bg-accent/5 transition-colors">
                <div className="w-8 h-8 bg-gradient-accent rounded-full flex items-center justify-center">
                  <SparklesIcon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-foreground">{activity.action}</p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};