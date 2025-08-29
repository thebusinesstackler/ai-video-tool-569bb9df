import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  VideoIcon, 
  FileTextIcon, 
  UsersIcon, 
  BarChart3Icon,
  SettingsIcon,
  HomeIcon,
  SparklesIcon,
  PlayCircleIcon,
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const navigationItems = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Content Analysis', href: '/analysis', icon: BarChart3Icon },
  { name: 'Script Generator', href: '/scripts', icon: FileTextIcon },
  { name: 'Videos', href: '/videos', icon: VideoIcon },
  { name: 'Characters', href: '/characters', icon: UsersIcon },
  { name: 'Projects', href: '/projects', icon: PlayCircleIcon },
  { name: 'Settings', href: '/settings', icon: SettingsIcon },
];

export const Navigation = () => {
  const location = useLocation();
  const { signOut } = useAuth();
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error: any) {
      toast({
        title: "Sign Out Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <nav className="fixed left-0 top-0 h-full w-64 glass border-r border-border z-50">
      <div className="p-6">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center animate-glow">
            <SparklesIcon className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="font-bold text-xl gradient-text">VideoAI Pro</h1>
        </div>

        {/* Navigation Items */}
        <div className="space-y-2">
          {navigationItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300",
                  "hover:bg-accent/10 hover:shadow-glow/20 group",
                  isActive && "bg-gradient-accent border border-primary/20 shadow-ai"
                )}
              >
                <item.icon 
                  className={cn(
                    "w-5 h-5 transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                  )} 
                />
                <span 
                  className={cn(
                    "font-medium transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Usage Stats */}
        <div className="mt-8 p-4 glass rounded-lg">
          <h3 className="text-sm font-semibold text-foreground mb-3">Monthly Usage</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Videos Generated</span>
              <span className="text-primary font-semibold">247/500</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div className="bg-gradient-primary h-2 rounded-full w-[49%] animate-glow"></div>
            </div>
          </div>
        </div>

        {/* Sign Out Button */}
        <div className="mt-6">
          <Button
            onClick={handleSignOut}
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </Button>
        </div>
      </div>
    </nav>
  );
};