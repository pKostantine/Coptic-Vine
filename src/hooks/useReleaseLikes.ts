import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { musicService } from '@/services/musicService';

import { tr } from '../utils/appText';

interface LikesState {
  /** Whose library this is: a sign-out or a new account leaves the old one behind. */
  userId: string;
  authenticated: boolean;
  ids: Set<string>;
}

/**
 * The hearts on a shelf of releases (Coptic Vine design, "Music", "Artist"):
 * which of them the listener likes, read once from their library rather than
 * release by release, and a toggle that turns a heart at once and turns it
 * back if the change fails.
 */
export function useReleaseLikes(locale: string) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<LikesState | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    musicService.getLibrary(locale)
      .then((library) => {
        if (active) setState({ userId, authenticated: library.authenticated, ids: new Set(library.likedReleases.map((release) => release.id)) });
      })
      .catch(() => { if (active) setState({ userId, authenticated: false, ids: new Set() }); });
    return () => { active = false; };
  }, [userId, locale]);

  const current = state && state.userId === userId ? state : null;
  const isLiked = (releaseId: string) => Boolean(current?.ids.has(releaseId));

  const toggle = (releaseId: string) => {
    if (busyId) return;
    if (!userId) {
      Alert.alert(
        tr('Like release', 'Ajouter aux favoris', 'إعجاب'),
        tr('Sign in to your Coptic Vine account to like releases.', 'Connectez-vous à votre compte Coptic Vine pour ajouter des parutions à vos favoris.', 'سجّل الدخول إلى حساب كوبتك فاين لحفظ الإصدارات.'),
      );
      return;
    }
    const next = !isLiked(releaseId);
    const turn = (liked: boolean) => setState((previous) => {
      const ids = new Set(previous && previous.userId === userId ? previous.ids : []);
      if (liked) ids.add(releaseId); else ids.delete(releaseId);
      return { userId, authenticated: previous?.authenticated ?? true, ids };
    });
    turn(next);
    setBusyId(releaseId);
    musicService.setReleaseLiked(releaseId, next)
      .catch((cause) => {
        turn(!next);
        Alert.alert(tr('Like release', 'Ajouter aux favoris', 'إعجاب'), cause instanceof Error ? cause.message : 'Unable to update this release.');
      })
      .finally(() => setBusyId(null));
  };

  return {
    isLiked,
    toggle,
    busyId,
    /** Signed in with a library to save to (follows and likes need one). */
    authenticated: Boolean(current?.authenticated),
  };
}
