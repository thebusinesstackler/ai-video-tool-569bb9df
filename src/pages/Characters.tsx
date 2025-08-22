import React from 'react';
import { CharacterManager } from '@/components/CharacterManager';

const Characters = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Character Management</h1>
        <p className="text-muted-foreground mt-2">
          Create and manage AI avatars for your video content
        </p>
      </div>
      <CharacterManager />
    </div>
  );
};

export default Characters;