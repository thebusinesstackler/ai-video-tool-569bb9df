import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  VideoIcon, 
  FileTextIcon, 
  UsersIcon,
  SettingsIcon,
  HomeIcon,
  SparklesIcon,
  PlayCircleIcon,
  LogOut,
  Clapperboard,
  Film,
  Smartphone,
  ImageIcon,
  ScanFace,
  Menu,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ThemeToggle } from '@/components/ThemeToggle';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const navigationItems = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Movie Scene Creator', href: '/movie-scene-creator', icon: Clapperboard },
  { name: 'Movies', href: '/movies', icon: Film },
  { name: 'Script Generator', href: '/scripts', icon: FileTextIcon },
  { name: 'Reels & Stories', href: '/reels', icon: Smartphone },
  { name: 'Image Gallery', href: '/gallery', icon: ImageIcon },
  { name: 'AI Twin', href: '/ai-twin', icon: ScanFace },
  { name: 'Characters', href: '/characters', icon: UsersIcon },
  { name: 'Projects', href: '/projects', icon: PlayCircleIcon },
  { name: 'Settings', href: '/settings', icon: SettingsIcon },
];

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

export const Navigation = () => {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const [videosCount, setVideosCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved === 'true';
  });
  const isMobile = useIsMobile();

  useEffect(() => {
    if (user) {
      loadUsageStats();
    }
  }, [user]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Persist collapse state
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
  }, [isCollapsed]);

  const loadUsageStats = async () => {
    try {
      setIsLoading(true);
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) return;

      const { data: projects, error } = await supabase
        .from('projects')
        .select('id')
        .eq('user_id', currentUser.id);

      if (error) {
        console.error('Error loading usage stats:', error);
        return;
      }

      setVideosCount(projects?.length || 0);
    } catch (error) {
      console.error('Error loading usage stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out."
      });
      setTimeout(() => {
        window.location.href = '/';
      }, 100);
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast({
        title: "Sign Out Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const NavContent = ({ collapsed = false }: { collapsed?: boolean }) => (
    <div className="p-4 h-full flex flex-col">
      {/* Logo */}
      <div className={cn("flex items-center mb-8", collapsed ? "justify-center" : "justify-between")}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center animate-glow flex-shrink-0">
            <SparklesIcon className="w-6 h-6 text-primary-foreground" />
          </div>
          {!collapsed && <h1 className="font-bold text-xl gradient-text">VideoAI Pro</h1>}
        </div>
        {!collapsed && <ThemeToggle />}
      </div>

      {/* Navigation Items */}
      <div className="space-y-2 flex-1 overflow-y-auto">
        <TooltipProvider delayDuration={0}>
          {navigationItems.map((item) => {
            const isActive = location.pathname === item.href;
            const linkContent = (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300",
                  "hover:bg-accent/10 hover:shadow-glow/20 group",
                  isActive && "bg-gradient-accent border border-primary/20 shadow-ai",
                  collapsed && "justify-center px-3"
                )}
              >
                <item.icon 
                  className={cn(
                    "w-5 h-5 transition-colors flex-shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-white"
                  )}
                />
                {!collapsed && (
                  <span 
                    className={cn(
                      "font-medium transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-white"
                    )}
                  >
                    {item.name}
                  </span>
                )}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.name}>
                  <TooltipTrigger asChild>
                    {linkContent}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-popover border-border">
                    {item.name}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return linkContent;
          })}
        </TooltipProvider>
      </div>

      {/* Usage Stats - only show when expanded */}
      {!collapsed && (
        <div className="mt-4 p-4 bg-card border border-border rounded-lg shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-3">Monthly Usage</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Videos Generated</span>
              <span className="text-primary font-semibold">
                {isLoading ? '...' : `${videosCount}/500`}
              </span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div 
                className="bg-gradient-primary h-2 rounded-full animate-glow transition-all duration-300" 
                style={{ width: `${Math.min((videosCount / 500) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Sign Out Button */}
      <div className="mt-4">
        <TooltipProvider delayDuration={0}>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleSignOut}
                  variant="ghost"
                  size="icon"
                  className="w-full text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-popover border-border">
                Sign Out
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              onClick={handleSignOut}
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </Button>
          )}
        </TooltipProvider>
      </div>
    </div>
  );

  // Mobile: Sheet drawer
  if (isMobile) {
    return (
      <>
        {/* Mobile Header */}
        <header className="fixed top-0 left-0 right-0 h-16 bg-[hsl(222_47%_6%)] border-b border-[hsl(222_47%_12%)] z-50 flex items-center px-4">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="mr-3">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 bg-[hsl(222_47%_6%)] border-[hsl(222_47%_12%)]">
              <NavContent collapsed={false} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <SparklesIcon className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold gradient-text">VideoAI Pro</span>
          </div>
        </header>
      </>
    );
  }

  // Desktop: Fixed sidebar with collapse toggle
  return (
    <nav 
      className={cn(
        "fixed left-0 top-0 h-full bg-[hsl(222_47%_6%)] border-r border-[hsl(222_47%_12%)] z-50 backdrop-blur-xl transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <NavContent collapsed={isCollapsed} />
      
      {/* Collapse Toggle Button */}
      <Button
        onClick={toggleCollapse}
        variant="ghost"
        size="icon"
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-background border border-border shadow-md hover:bg-accent"
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </Button>
    </nav>
  );
};