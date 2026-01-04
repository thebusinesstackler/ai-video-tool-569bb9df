import React from 'react';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/components/Dashboard';
import { Landing } from '@/pages/Landing';
import { useAuth } from '@/components/AuthProvider';
import { isDevPreview } from '@/lib/devBypass';

const Index = () => {
  const { user, loading } = useAuth();

  // Bypass auth in dev preview - show dashboard directly
  if (isDevPreview) {
    return (
      <Layout>
        <Dashboard />
      </Layout>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Landing />;
  }

  return (
    <Layout>
      <Dashboard />
    </Layout>
  );
};

export default Index;
