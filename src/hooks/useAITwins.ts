import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import type { AITwin } from '@/types/aiTwin';

/**
 * Shared hook for loading AI Twins across all pages.
 * Uses the lightweight `get_twins_summary` RPC to avoid pulling large reference_images arrays.
 * Full images are lazy-loaded on demand via `loadFullImages`.
 */
export function useAITwins() {
  const { user } = useAuth();
  const [twins, setTwins] = useState<AITwin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTwins = useCallback(async (retryCount = 0) => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error: rpcError } = await supabase.rpc('get_twins_summary', { _user_id: user.id });

      if (rpcError) {
        if ((rpcError.code === '57014' || rpcError.message?.includes('fetch') || rpcError.message?.includes('JSON')) && retryCount < 2) {
          setTimeout(() => loadTwins(retryCount + 1), 1000 * (retryCount + 1));
          return;
        }
        throw rpcError;
      }

      const mapped: AITwin[] = (data || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        reference_images: t.first_image ? [t.first_image] : [],
        voice_cloning_key: t.voice_cloning_key,
        voice_sample_url: t.voice_sample_url,
        face_description: t.face_description,
        gender: t.gender,
        image_count: t.image_count,
      }));

      setTwins(mapped);
      setError(null);
    } catch (err: any) {
      if (err?.message?.includes('fetch') && retryCount < 2) {
        setTimeout(() => loadTwins(retryCount + 1), 1000 * (retryCount + 1));
        return;
      }
      console.error('Failed to load AI twins:', err);
      setError(err?.message || 'Failed to load AI twins');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadTwins();
  }, [loadTwins]);

  const loadFullImages = useCallback(async (twinId: string): Promise<string[] | null> => {
    if (!user?.id) return null;
    try {
      const { data, error } = await supabase
        .from('ai_twins')
        .select('reference_images')
        .eq('id', twinId)
        .eq('user_id', user.id)
        .single();
      if (error || !data) return null;
      return data.reference_images || [];
    } catch {
      return null;
    }
  }, [user?.id]);

  const refresh = useCallback(() => {
    setLoading(true);
    loadTwins();
  }, [loadTwins]);

  return { twins, loading, error, loadFullImages, refresh };
}
