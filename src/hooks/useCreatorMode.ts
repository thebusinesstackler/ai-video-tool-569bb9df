import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

export type CreatorMode = 'quick' | 'beginner' | 'advanced';

export function useCreatorMode() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [mode, setModeState] = useState<CreatorMode>('beginner');
  const [loading, setLoading] = useState(true);

  // Load preference from DB
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('creator_mode')
          .eq('user_id', userId)
          .maybeSingle();

        if (!error && data?.creator_mode) {
          setModeState(data.creator_mode as CreatorMode);
        }
      } catch (err) {
        console.error('Error loading creator mode:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [userId]);

  // Persist preference
  const setMode = useCallback(async (newMode: CreatorMode) => {
    const previousMode = mode;
    setModeState(newMode); // Optimistic update
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert(
          { user_id: userId, creator_mode: newMode, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );

      if (error) {
        console.error('Error saving creator mode:', error);
        setModeState(previousMode); // Rollback on failure
      }
    } catch (err) {
      console.error('Error saving creator mode:', err);
      setModeState(previousMode); // Rollback on failure
    }
  }, [userId, mode]);

  const isAdvanced = mode === 'advanced';
  const isBeginner = mode === 'beginner';
  const isQuick = mode === 'quick';

  return { mode, setMode, isAdvanced, isBeginner, isQuick, loading };
}
