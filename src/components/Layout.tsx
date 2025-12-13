import React, { useEffect, useState } from 'react';
import { Navigation } from './Navigation';
import { useIsMobile } from '@/hooks/use-mobile';

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved === 'true';
  });

  // Listen for localStorage changes to sync collapse state
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      setIsCollapsed(saved === 'true');
    };

    // Check periodically for changes (since storage events don't fire in same tab)
    const interval = setInterval(handleStorageChange, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className={isMobile ? "pt-16 p-4" : `${isCollapsed ? 'ml-16' : 'ml-64'} p-6 transition-all duration-300`}>
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};