import React, { useEffect, useState } from 'react';
import logoLight from '@/assets/logo-light.png';
import logoDark from '@/assets/logo-dark.png';
import { Link, useLocation } from 'react-router-dom';
import { 
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
  ChevronLeft,
  MessageSquareQuote,
  ChevronRight,
  Presentation,
  ChevronDown,
  Wand2,
  Scissors,
  FolderOpen,
  Layers,
  Zap,
  Package,
  RefreshCw,
  Mic
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ThemeToggle } from '@/components/ThemeToggle';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  beta?: boolean;
}

interface NavGroup {
  label: string;
  icon: React.ElementType;
  items: NavItem[];
}

const standaloneTop: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
];

const navGroups: NavGroup[] = [
  {
    label: 'Create',
    icon: Layers,
    items: [
      { name: 'Movie Scene Creator', href: '/movie-scene-creator', icon: Clapperboard, beta: true },
      { name: 'Movies', href: '/movies', icon: Film },
      { name: 'Reels & Stories', href: '/reels', icon: Smartphone, beta: true },
      { name: 'Podcast Talking Head', href: '/podcast', icon: Mic, beta: true },
      { name: 'AI Video Repurposer', href: '/video-repurposer', icon: RefreshCw, beta: true },
    ],
  },
  {
    label: 'AI Tools',
    icon: Wand2,
    items: [
      { name: 'AI Twin', href: '/ai-twin', icon: ScanFace },
      { name: 'AI Spokesperson', href: '/ai-spokesperson', icon: Presentation, beta: true },
      { name: 'Hook Engine', href: '/hook-engine', icon: Zap, beta: true },
      { name: 'Video Repo', href: '/video-repo', icon: Film },
      { name: 'Video Repo Pro', href: '/video-repo-pro', icon: SparklesIcon, beta: true },
      { name: 'Testimonial Ads', href: '/testimonial-commercial', icon: MessageSquareQuote, beta: true },
      { name: 'Lifestyle Stories', href: '/lifestyle-stories', icon: Film, beta: true },
      { name: 'Animate Statics', href: '/animate-statics', icon: Wand2, beta: true },
      { name: 'Chatcut AI', href: '/chatcut-ai', icon: Scissors, beta: true },
    ],
  },
  {
    label: 'Manage',
    icon: FolderOpen,
    items: [
      { name: 'Product Library', href: '/products', icon: Package },
      { name: 'Image Gallery', href: '/gallery', icon: ImageIcon },
      { name: 'Characters', href: '/characters', icon: UsersIcon },
    ],
  },
];

const standaloneBottom: NavItem[] = [
  { name: 'Settings', href: '/settings', icon: SettingsIcon },
];

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

export const Navigation = () => {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved === 'true';
  });
  const isMobile = useIsMobile();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
    window.dispatchEvent(new Event('sidebar-collapse-changed'));
  }, [isCollapsed]);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({ title: "Signed Out", description: "You have been successfully signed out." });
      // Use window.location for clean sign-out to clear all React state
      window.location.href = '/';
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast({ title: "Sign Out Failed", description: error.message, variant: "destructive" });
    }
  };

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  const renderNavLink = (item: NavItem, collapsed: boolean) => {
    const isActive = location.pathname === item.href;
    const link = (
      <Link
        key={item.name}
        to={item.href}
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200",
          "hover:bg-sidebar-accent group transition-colors duration-200",
          isActive && "bg-gradient-accent border border-primary/20 shadow-ai",
          collapsed && "justify-center px-3"
        )}
      >
        <item.icon
          className={cn(
            "w-5 h-5 transition-colors flex-shrink-0",
            isActive ? "text-primary" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground"
          )}
        />
        {!collapsed && (
          <span className={cn(
            "font-medium transition-colors text-sm flex-1",
            isActive ? "text-primary" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground"
          )}>
            {item.name}
          </span>
        )}
        {!collapsed && item.beta && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20">
            Beta
          </Badge>
        )}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.name}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right" className="bg-popover border-border">{item.name}</TooltipContent>
        </Tooltip>
      );
    }
    return link;
  };

  const renderGroup = (group: NavGroup, collapsed: boolean) => {
    const hasActiveChild = group.items.some(i => location.pathname === i.href);

    if (collapsed) {
      return (
        <div key={group.label} className="space-y-1">
          {group.items.map(item => renderNavLink(item, true))}
        </div>
      );
    }

    return (
      <Collapsible key={group.label} defaultOpen={hasActiveChild}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full px-4 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors">
          <group.icon className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1 text-left">{group.label}</span>
          <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-0.5 mt-0.5">
          {group.items.map(item => renderNavLink(item, false))}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const NavContent = ({ collapsed = false }: { collapsed?: boolean }) => (
    <div className="p-4 h-full flex flex-col">
      {/* Logo */}
      <div className={cn("flex items-center mb-6", collapsed ? "justify-center" : "justify-center")}>
        <div className="flex items-center">
          {collapsed ? (
            <div className="w-14 h-14 flex-shrink-0">
              <img src={logoDark} alt="Video AI Pro" className="w-full h-full object-contain hidden dark:block" />
              <img src={logoLight} alt="Video AI Pro" className="w-full h-full object-contain dark:hidden" />
            </div>
          ) : (
            <div className="w-full px-2">
              <img src={logoDark} alt="Video AI Pro" className="w-full object-contain hidden dark:block" />
              <img src={logoLight} alt="Video AI Pro" className="w-full object-contain dark:hidden" />
            </div>
          )}
        </div>
        {!collapsed && <ThemeToggle />}
      </div>

      {/* Navigation */}
      <div className="space-y-1.5 flex-1 overflow-y-auto min-h-0">
        <TooltipProvider delayDuration={0}>
          {standaloneTop.map(item => renderNavLink(item, collapsed))}
          <div className="h-px bg-sidebar-border my-3" />
          {navGroups.map(group => renderGroup(group, collapsed))}
          <div className="h-px bg-sidebar-border my-3" />
          {standaloneBottom.map(item => renderNavLink(item, collapsed))}
        </TooltipProvider>
      </div>

      {/* Sign Out */}
      <div className="mt-3">
        <TooltipProvider delayDuration={0}>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={handleSignOut} variant="ghost" size="icon" className="w-full text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent">
                  <LogOut className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-popover border-border">Sign Out</TooltipContent>
            </Tooltip>
          ) : (
            <Button onClick={handleSignOut} variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent">
              <LogOut className="w-5 h-5" />
              Sign Out
            </Button>
          )}
        </TooltipProvider>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <header className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-gray-900 border-b border-sidebar-border z-50 flex items-center px-4">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="mr-3">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 bg-white dark:bg-gray-900 border-sidebar-border">
            <NavContent collapsed={false} />
          </SheetContent>
        </Sheet>
        <div className="flex items-center flex-1 justify-center mr-12">
          <img src={logoDark} alt="Video AI Pro" className="h-12 max-w-[200px] object-contain hidden dark:block" />
          <img src={logoLight} alt="Video AI Pro" className="h-12 max-w-[200px] object-contain dark:hidden" />
        </div>
      </header>
    );
  }

  return (
    <nav
      className={cn(
        "fixed left-0 top-0 h-full bg-sidebar-background border-r border-sidebar-border z-50 backdrop-blur-xl transition-[width] duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <NavContent collapsed={isCollapsed} />
      <Button
        onClick={toggleCollapse}
        variant="ghost"
        size="icon"
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-background border border-border shadow-md hover:bg-accent"
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </Button>
    </nav>
  );
};
