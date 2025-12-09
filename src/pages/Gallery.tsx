import React from 'react';
import { Layout } from '@/components/Layout';
import { ImageGallery } from '@/components/ImageGallery';

const Gallery = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Image Gallery</h1>
          <p className="text-muted-foreground mt-2">
            All your generated images in one place
          </p>
        </div>
        <ImageGallery />
      </div>
    </Layout>
  );
};

export default Gallery;
