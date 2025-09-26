import React from 'react';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/components/Dashboard';
import { useAuth } from '@/components/AuthProvider';

const Index = () => {
  const { user } = useAuth();
  return (
    <Layout>
      <Dashboard />
    </Layout>
  );
};

export default Index;
