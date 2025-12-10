import { supabase } from '@/integrations/supabase/client';

/**
 * Converts a base64 data URL to a storage URL by uploading to Supabase Storage
 */
export async function convertBase64ToStorageUrl(
  base64Url: string,
  userId: string,
  bucket: string = 'reels'
): Promise<string> {
  // If it's already a regular URL, return as-is
  if (!base64Url.startsWith('data:')) {
    return base64Url;
  }

  try {
    // Parse the base64 data
    const matches = base64Url.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      console.warn('Invalid base64 format, returning original');
      return base64Url;
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    
    // Determine file extension
    const extMap: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/webp': 'webp',
      'image/gif': 'gif'
    };
    const ext = extMap[mimeType] || 'png';

    // Convert base64 to blob
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    // Upload to storage
    const fileName = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, blob, { contentType: mimeType });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return base64Url; // Return original on failure
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (error) {
    console.error('Error converting base64 to storage URL:', error);
    return base64Url; // Return original on failure
  }
}

/**
 * Converts an array of image URLs, converting any base64 URLs to storage URLs
 */
export async function convertImagesToStorageUrls(
  imageUrls: string[],
  userId: string,
  bucket: string = 'reels'
): Promise<string[]> {
  const results = await Promise.all(
    imageUrls.map(url => convertBase64ToStorageUrl(url, userId, bucket))
  );
  return results;
}

/**
 * Checks if any URLs in the array are base64 data URLs
 */
export function hasBase64Images(imageUrls: string[]): boolean {
  return imageUrls.some(url => url.startsWith('data:'));
}
