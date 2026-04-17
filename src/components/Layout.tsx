import React, { useEffect, useState } from 'react';
import { Navigation } from './Navigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/components/AuthProvider';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const isMobile = useIsMobile();
  const { authServiceDown, clearLocalSession } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved === 'true';
  });
  const [hasMounted, setHasMounted] = useState(false);

  // Enable transitions only after first paint to prevent initial flash
  useEffect(() => {
    const id = requestAnimationFrame(() => setHasMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Listen for localStorage changes to sync collapse state
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === SIDEBAR_COLLAPSED_KEY) {
        setIsCollapsed(e.newValue === 'true');
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom event for same-tab updates
    const handleCustom = () => {
      const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      setIsCollapsed(saved === 'true');
    };
    window.addEventListener('sidebar-collapse-changed', handleCustom);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sidebar-collapse-changed', handleCustom);
    };
  }, []);

  const handleClearSession = () => {
    clearLocalSession();
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Auth Service Down Banner */}
      {authServiceDown && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-destructive/90 text-destructive-foreground px-4 py-2 flex items-center justify-center gap-3">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm font-medium">Authentication service is temporarily unavailable</span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleClearSession}
            className="ml-2 bg-background/20 border-destructive-foreground/30 hover:bg-background/30"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Clear Session & Retry
          </Button>
        </div>
      )}
      <Navigation />
      <main className={`${isMobile ? "pt-16 px-3 pb-24" : `${isCollapsed ? 'ml-16' : 'ml-64'} p-6 pb-24`} ${authServiceDown ? 'pt-20' : ''} ${hasMounted ? 'transition-[margin] duration-300' : ''}`}>
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};