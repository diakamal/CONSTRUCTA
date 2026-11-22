'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from './api';

/**
 * Loads data and optionally re-polls it. Polling stands in for Supabase Realtime in the mock.
 * Re-runs whenever `deps` change.
 */
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[], pollMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(async () => {
    try {
      setData(await loaderRef.current());
      setError('');
    } catch (e) {
      setError(errorMessage(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    setData(null);
    reload();
    if (!pollMs) return;
    const id = setInterval(() => { if (document.visibilityState === 'visible') reload(); }, pollMs);
    return () => clearInterval(id);
  }, [reload, pollMs]);

  return { data, error, reload };
}
