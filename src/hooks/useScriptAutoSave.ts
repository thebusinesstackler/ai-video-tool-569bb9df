import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AutoSaveOptions {
  /** Supabase table name */
  table: 'projects' | 'movie_projects' | 'scripts' | 'reels' | 'testimonial_commercials';
  /** Row ID (skip saving if null/undefined — project not yet created) */
  id: string | null | undefined;
  /** Debounce interval in ms (default 2000) */
  debounceMs?: number;
}

/**
 * Generic debounced auto-save hook for any Supabase table.
 *
 * Usage:
 *   const save = useScriptAutoSave({ table: 'projects', id: projectId });
 *   // Call whenever content changes:
 *   save({ script: newScript });
 */
export function useScriptAutoSave({ table, id, debounceMs = 2000 }: AutoSaveOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPayload = useRef<Record<string, unknown> | null>(null);

  const flush = useCallback(async () => {
    if (!id || !latestPayload.current) return;
    const payload = { ...latestPayload.current, updated_at: new Date().toISOString() };
    latestPayload.current = null;

    try {
      const { error } = await supabase
        .from(table)
        .update(payload)
        .eq('id', id);

      if (error) {
        console.error(`[auto-save] ${table}/${id} failed:`, error.message);
      } else {
        console.log(`[auto-save] ${table}/${id} saved`);
      }
    } catch (err) {
      console.error(`[auto-save] ${table}/${id} exception:`, err);
    }
  }, [table, id]);

  const save = useCallback(
    (fields: Record<string, unknown>) => {
      if (!id) return;
      // Merge with any pending unsaved fields
      latestPayload.current = { ...(latestPayload.current || {}), ...fields };

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, debounceMs);
    },
    [id, flush, debounceMs],
  );

  // Flush on unmount so we never lose the last edit
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        // Fire-and-forget final save
        flush();
      }
    };
  }, [flush]);

  return save;
}
