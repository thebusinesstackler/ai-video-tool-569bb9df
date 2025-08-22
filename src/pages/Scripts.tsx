import React from 'react';
import { Layout } from '@/components/Layout';
import { ScriptGenerator } from '@/components/ScriptGenerator';

const Scripts = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Script Generator</h1>
          <p className="text-muted-foreground">
            Create AI-powered video scripts using successful content patterns and your brand voice.
          </p>
        </div>
        <ScriptGenerator />
      </div>
    </Layout>
  );
};

export default Scripts;