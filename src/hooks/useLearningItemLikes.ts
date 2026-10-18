import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { learningService } from '@/services/learningService';
import type { LearningPlaylistItemKind } from '@/types/learningPlatform';

import { tr } from '../utils/appText';

interface LikesState {
  /** Whose library this is: a sign-out or a new account leaves the old one behind. */
  userId: string;
  authenticated: boolean;
  ids: Set<string>;
}

/**
 * The hearts on a list of recordings or lessons, as on an album's songs:
 * which of them the listener likes, read once from My Learning, and a toggle
 * that turns a heart at once and turns it back if the change fails
 * (useReleaseLikes is the same for Music's releases).
 */
export function useLearningItemLikes(locale: string) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<LikesState | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    learningService.getItemLibrary(locale)
      .then((library) => {
        if (active) setState({ userId, authenticated: library.authenticated, ids: new Set(library.likedItemIds) });
      })
      .catch(() => { if (active) setState({ userId, authenticated: false, ids: new Set() }); });
    return () => { active = false; };
  }, [userId, locale]);

  const current = state && state.userId === userId ? state : null;
  const isLiked = (itemId: string) => Boolean(current?.ids.has(itemId));

  const toggle = (itemKind: LearningPlaylistItemKind, itemId: string) => {
    if (busyId) return;
    if (!userId) {
      Alert.alert(
        tr('Liked Learning', 'Apprentissages aimés', 'المحتوى المفضّل'),
        tr('Sign in to save liked lessons and recordings.', 'Connectez-vous pour enregistrer les leçons et enregistrements aimés.', 'سجّل الدخول لحفظ الدروس والتسجيلات المفضّلة.'),
      );
      return;
    }
    const next = !isLiked(itemId);
    const turn = (liked: boolean) => setState((previous) => {
      const ids = new Set(previous && previous.userId === userId ? previous.ids : []);
      if (liked) ids.add(itemId); else ids.delete(itemId);
      return { userId, authenticated: previous?.authenticated ?? true, ids };
    });
    turn(next);
    setBusyId(itemId);
    learningService.setItemLiked(itemKind, itemId, next)
      .catch((cause) => {
        turn(!next);
        Alert.alert(tr('Liked Learning', 'Apprentissages aimés', 'المحتوى المفضّل'), cause instanceof Error ? cause.message : 'Unable to update this item.');
      })
      .finally(() => setBusyId(null));
  };

  return { isLiked, toggle };
}
