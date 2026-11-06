import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import {
  clearLocalCanonInstructions,
  laterCanonInstructions,
  loadCloudCanonInstructions,
  loadLocalCanonInstructions,
  saveCloudCanonInstructions,
  saveLocalCanonInstructions,
  type CanonInstructions,
} from '@/services/spiritualCanonService';

const CLOUD_SAVE_DELAY_MS = 800;
const NONE: CanonInstructions = { text: '', updatedAt: null };

/**
 * The canon's instructions from a father of confession: read from the device
 * and the account and the later kept; written, kept on the device at once
 * and sent to the account a moment after typing stops. What was written
 * signed out goes into the account the first time it is signed in to, if
 * the account has none of its own.
 */
export function useCanonInstructions() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const identity = userId ? `user-${userId}` : 'local';
  const [state, setState] = useState<{ identity: string | null; value: CanonInstructions }>({ identity: null, value: NONE });
  const [syncFailed, setSyncFailed] = useState(false);
  const pendingSave = useRef<CanonInstructions | null>(null);

  useEffect(() => {
    if (authLoading) return undefined;
    let cancelled = false;
    const load = async () => {
      let value = await loadLocalCanonInstructions(identity);
      if (userId) {
        let adopted = false;
        if (!value.text.trim()) {
          const signedOut = await loadLocalCanonInstructions('local');
          if (signedOut.text.trim()) {
            value = signedOut;
            adopted = true;
          }
        }
        try {
          const cloud = await loadCloudCanonInstructions();
          const later = adopted && !cloud.text.trim() ? value : laterCanonInstructions(cloud, value);
          value = later === cloud ? cloud : await saveCloudCanonInstructions(later);
          if (adopted) await clearLocalCanonInstructions('local');
          if (!cancelled) setSyncFailed(false);
        } catch (error) {
          console.warn('Unable to synchronize the canon’s instructions:', error);
          if (!cancelled) setSyncFailed(true);
          pendingSave.current = value.updatedAt ? value : null;
        }
      }
      if (cancelled) return;
      await saveLocalCanonInstructions(identity, value);
      setState({ identity, value });
    };
    void load();
    return () => { cancelled = true; };
  }, [authLoading, identity, userId]);

  const loaded = state.identity === identity;
  const value = loaded ? state.value : NONE;

  // Sent a moment after the typing stops; the account keeps the later copy and says which.
  const [saveTick, setSaveTick] = useState(0);
  useEffect(() => {
    if (!saveTick || !userId) return undefined;
    const timer = setTimeout(() => {
      const sending = pendingSave.current;
      if (!sending) return;
      pendingSave.current = null;
      saveCloudCanonInstructions(sending)
        .then((kept) => {
          setSyncFailed(false);
          // Another device's later copy comes back: it is the one kept, here too.
          if (kept.updatedAt && kept.text !== sending.text) {
            void saveLocalCanonInstructions(identity, kept);
            setState((current) => (current.identity === identity ? { identity, value: laterCanonInstructions(current.value, kept) } : current));
          }
        })
        .catch((error) => {
          console.warn('Unable to save the canon’s instructions:', error);
          pendingSave.current = pendingSave.current ?? sending;
          setSyncFailed(true);
        });
    }, CLOUD_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [identity, saveTick, userId]);

  const setText = useCallback((text: string) => {
    const next: CanonInstructions = { text: text.slice(0, 20_000), updatedAt: new Date().toISOString() };
    setState((current) => (current.identity === identity ? { identity, value: next } : current));
    void saveLocalCanonInstructions(identity, next);
    pendingSave.current = next;
    setSaveTick((tick) => tick + 1);
  }, [identity]);

  return { loaded, text: value.text, updatedAt: value.updatedAt, setText, syncFailed };
}
