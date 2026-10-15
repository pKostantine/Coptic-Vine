'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import LearningArtwork from '@/components/learning/LearningArtwork';
import ActionSheetFrame, {
  SheetButton,
  SheetError,
  SheetHeader,
  SheetLoading,
  SheetNote,
  SheetRow,
  SheetRowGroup,
  SheetSectionLabel,
  SheetTextField,
  isArabicText,
  useActionSheetMode,
} from '@/components/playback/ActionSheetFrame';
import Icon, { type IconName } from '@/components/vine/ui/Icon';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { learningService } from '@/services/learningService';
import type {
  LearningMediaAsset,
  LearningPlaylistDetail,
  LearningPlaylistItemKind,
  LearningPlaylistSummary,
  LearningProgressState,
} from '@/types/learningPlatform';

import { tr } from '../../utils/appText';

const BUILT_IN_LISTS: { state: LearningProgressState; label: () => string; icon: IconName; iconOn: IconName }[] = [
  { state: 'will_learn', label: () => tr('Will Learn', 'À apprendre', 'سأتعلم'), icon: 'bookmark-outline', iconOn: 'bookmark' },
  { state: 'learning', label: () => tr('Learning', 'En cours', 'أتعلّم الآن'), icon: 'school-outline', iconOn: 'school-outline' },
  { state: 'finished', label: () => tr('Finished', 'Terminé', 'أكملت'), icon: 'checkmark-done', iconOn: 'checkmark-done' },
];

/** "3 items", in the App Language — a playlist holds recordings and lessons alike. */
function itemCount(count: number): string {
  return count === 1
    ? tr('1 item', '1 élément', 'عنصر واحد')
    : tr(`${count} items`, `${count} éléments`, `${count} عناصر`);
}

/** The entry of a playlist that is this item, if it holds it. */
function entryFor(playlist: LearningPlaylistDetail, itemKind: LearningPlaylistItemKind, itemId: string): string | null {
  const entry = playlist.items.find((item) => (
    item.kind === 'lesson'
      ? itemKind === 'lesson' && item.lesson.id === itemId
      : itemKind === 'album_recording' && item.recording.id === itemId
  ));
  return entry?.id ?? null;
}

interface LearningPlaylistPanelProps {
  itemKind: LearningPlaylistItemKind;
  itemId: string;
  locale: string;
  /** Leaves for the account page, when no one is signed in to keep a list. */
  onSignIn: () => void;
}

/**
 * Add to playlist, Learn & Study (Coptic Vine Player design, "Add to playlist
 * · Learn"): where the lesson stands — Will Learn, Learning, Finished — as
 * three tiles, the chosen one gold; then the reader's own playlists, each
 * ticked when it holds the lesson, and a new one made on the spot. Drawn
 * inside a sheet that already shows the lesson.
 */
export function LearningPlaylistPanel({ itemKind, itemId, locale, onSignIn }: LearningPlaylistPanelProps) {
  const mode = useActionSheetMode();
  const [loaded, setLoaded] = useState(false);
  const [signedIn, setSignedIn] = useState(true);
  const [playlists, setPlaylists] = useState<LearningPlaylistSummary[]>([]);
  // Playlist → its entry for this item, so a tick can be taken back out.
  const [entries, setEntries] = useState<Map<string, string>>(new Map());
  const [currentState, setCurrentState] = useState<LearningProgressState | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [playlistPayload, itemLibrary] = await Promise.all([
          learningService.getPlaylists(locale),
          learningService.getItemLibrary(locale),
        ]);
        if (!playlistPayload.authenticated || !itemLibrary.authenticated) {
          if (active) {
            setSignedIn(false);
            setLoaded(true);
          }
          return;
        }
        const contents = await Promise.allSettled(playlistPayload.playlists.map((playlist) => learningService.getPlaylist(playlist.id, locale)));
        if (!active) return;
        const found = new Map<string, string>();
        contents.forEach((result) => {
          const entry = result.status === 'fulfilled' ? entryFor(result.value, itemKind, itemId) : null;
          if (result.status === 'fulfilled' && entry) found.set(result.value.id, entry);
        });
        setEntries(found);
        setPlaylists(playlistPayload.playlists);
        setCurrentState(itemLibrary.items.find((item) => item.itemKind === itemKind && item.itemId === itemId)?.state ?? null);
        setLoaded(true);
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : tr('Unable to load My Learning.', 'Impossible de charger Mon apprentissage.', 'تعذر تحميل «تعلّمي».'));
        setLoaded(true);
      }
    })();
    return () => { active = false; };
  }, [itemId, itemKind, locale]);

  if (!loaded) return <SheetLoading />;

  if (!signedIn) {
    return (
      <>
        <SheetSectionLabel>{tr('Learning', 'Apprentissage', 'التعلّم')}</SheetSectionLabel>
        <SheetRowGroup>
          <SheetRow icon="person-circle-outline" label={tr('Sign in', 'Se connecter', 'تسجيل الدخول')} trailing="chevron" onPress={onSignIn} />
        </SheetRowGroup>
        <SheetNote>{tr('Sign in to save learning progress and playlists.', 'Connectez-vous pour enregistrer votre progression et vos playlists.', 'سجّل الدخول لحفظ تقدّمك وقوائم التعلّم.')}</SheetNote>
      </>
    );
  }

  const selectState = async (state: LearningProgressState) => {
    if (busyId || currentState === state) return;
    setBusyId(state);
    setError(null);
    try {
      await learningService.setItemProgress(itemKind, itemId, state);
      setCurrentState(state);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr('Unable to update My Learning.', 'Impossible de modifier Mon apprentissage.', 'تعذر تحديث «تعلّمي».'));
    } finally {
      setBusyId(null);
    }
  };

  const toggle = async (playlist: LearningPlaylistSummary) => {
    if (busyId) return;
    const entry = entries.get(playlist.id);
    setBusyId(playlist.id);
    setError(null);
    try {
      const updated = entry
        ? await learningService.removePlaylistItem(playlist.id, entry)
        : await learningService.addPlaylistItem(playlist.id, itemKind, itemId);
      const nextEntry = entry ? null : entryFor(updated, itemKind, itemId);
      setEntries((current) => {
        const next = new Map(current);
        if (nextEntry) next.set(playlist.id, nextEntry);
        else next.delete(playlist.id);
        return next;
      });
      setPlaylists((current) => current.map((item) => (item.id === playlist.id ? { ...item, itemCount: updated.items.length } : item)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr('Unable to update this playlist.', 'Impossible de modifier cette playlist.', 'تعذر تحديث القائمة.'));
    } finally {
      setBusyId(null);
    }
  };

  const createAndAdd = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    setError(null);
    try {
      const created = await learningService.createPlaylist(name, null, 'private');
      const updated = await learningService.addPlaylistItem(created.id, itemKind, itemId);
      const entry = entryFor(updated, itemKind, itemId);
      setPlaylists((current) => [{ ...created, itemCount: updated.items.length }, ...current]);
      if (entry) setEntries((current) => new Map(current).set(created.id, entry));
      setNewName('');
      setFormOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr('Unable to create the playlist.', 'Impossible de créer la playlist.', 'تعذر إنشاء القائمة.'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <SheetSectionLabel>{tr('Learning', 'Apprentissage', 'التعلّم')}</SheetSectionLabel>
      <View style={styles.tiles} accessibilityRole="radiogroup">
        {BUILT_IN_LISTS.map((entry) => {
          const on = currentState === entry.state;
          const busy = busyId === entry.state;
          return (
            <Pressable
              key={entry.state}
              accessibilityRole="radio"
              accessibilityLabel={entry.label()}
              accessibilityState={{ checked: on, busy }}
              disabled={Boolean(busyId)}
              onPress={() => void selectState(entry.state)}
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                styles.tile,
                mode === 'side' && styles.tileSide,
                hovered && !on && styles.tileHovered,
                pressed && !on && styles.tilePressed,
                on && styles.tileOn,
              ]}
            >
              {busy
                ? <ActivityIndicator size="small" color={on ? COLORS.greenDeep : COLORS.gold} style={styles.tileSpinner} />
                : <Icon name={on ? entry.iconOn : entry.icon} size={22} color={on ? COLORS.greenDeep : COLORS.gold} />}
              <Text numberOfLines={1} style={[styles.tileText, on && styles.tileTextOn, isArabicText(entry.label()) && styles.arabic]}>{entry.label()}</Text>
            </Pressable>
          );
        })}
      </View>

      <SheetSectionLabel>{tr('Custom playlists', 'Playlists personnelles', 'قوائم مخصّصة')}</SheetSectionLabel>
      <SheetRowGroup>
        <SheetRow
          icon="add"
          label={tr('New playlist', 'Nouvelle playlist', 'قائمة جديدة')}
          tone="accent"
          accessibilityHint={tr('Make a playlist and add this to it', 'Créer une playlist et y ajouter ceci', 'أنشئ قائمة وأضف إليها هذا')}
          onPress={() => setFormOpen((open) => !open)}
        />
        {formOpen ? (
          <View style={styles.form}>
            <SheetTextField
              autoFocus
              value={newName}
              onChangeText={setNewName}
              placeholder={tr('Playlist name', 'Nom de la playlist', 'اسم القائمة')}
              accessibilityLabel={tr('Playlist name', 'Nom de la playlist', 'اسم القائمة')}
              returnKeyType="done"
              onSubmitEditing={() => void createAndAdd()}
            />
            <SheetButton
              label={tr('Create and add', 'Créer et ajouter', 'إنشاء وإضافة')}
              disabled={!newName.trim()}
              busy={creating}
              onPress={() => void createAndAdd()}
            />
          </View>
        ) : null}
        {playlists.map((playlist) => (
          <SheetRow
            key={playlist.id}
            icon="list-outline"
            chip="grey"
            label={playlist.name}
            detail={itemCount(playlist.itemCount)}
            trailing="check"
            checked={entries.has(playlist.id)}
            busy={busyId === playlist.id}
            onPress={() => void toggle(playlist)}
          />
        ))}
      </SheetRowGroup>
      {!playlists.length && !formOpen ? (
        <SheetNote>{tr('No custom playlists yet. Make one to group lessons your way.', 'Aucune playlist personnelle pour l’instant. Créez-en une pour regrouper vos leçons à votre façon.', 'لا توجد قوائم مخصّصة بعد. أنشئ قائمة لتجمع الدروس على طريقتك.')}</SheetNote>
      ) : null}
      {error ? <SheetError>{error}</SheetError> : null}
    </>
  );
}

/**
 * A button that opens Add to playlist on its own sheet, for a lesson or a
 * recording shown outside a More menu.
 */
export default function LearningPlaylistPicker({
  itemKind,
  itemId,
  locale,
  title,
  coverAsset,
}: {
  itemKind: LearningPlaylistItemKind;
  itemId: string;
  locale: string;
  /** Kept for the pages that pass it: the sheet sets Arabic by the text itself. */
  isArabic?: boolean;
  /** The item's name and artwork, for the top of the sheet. */
  title?: string;
  coverAsset?: LearningMediaAsset | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const addLabel = tr('Add to playlist', 'Ajouter à une playlist', 'إضافة إلى قائمة');

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={tr('Add to My Learning', 'Ajouter à Mon apprentissage', 'أضف إلى تعلّمي')} style={styles.trigger} onPress={() => setOpen(true)}>
        <Icon name="playlist-add" size={20} color={COLORS.learningBright} />
      </Pressable>
      <ActionSheetFrame visible={open} onClose={() => setOpen(false)} closeLabel={tr('Close Add to playlist', 'Fermer Ajouter à une playlist', 'إغلاق الإضافة إلى قائمة')}>
        <SheetHeader
          artwork={title ? <LearningArtwork asset={coverAsset} size={52} radius={10} label={title} /> : null}
          kicker={title ? addLabel : null}
          title={title ?? addLabel}
        />
        {open ? (
          <LearningPlaylistPanel
            itemKind={itemKind}
            itemId={itemId}
            locale={locale}
            onSignIn={() => { setOpen(false); router.push('/account'); }}
          />
        ) : null}
      </ActionSheetFrame>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: COLORS.learningSoft, borderWidth: 1, borderColor: COLORS.learningLine },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 16,
    flex: 1,
    flexBasis: 0,
    gap: 8,
    minWidth: 0,
    paddingHorizontal: 6,
    paddingVertical: 14,
  },
  tileSide: { gap: 5, paddingVertical: 10 },
  tileHovered: { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  tilePressed: { backgroundColor: 'rgba(255, 255, 255, 0.13)' },
  tileOn: { backgroundColor: COLORS.gold },
  tileSpinner: { height: 22 },
  tileText: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 13.5, fontWeight: '700', textAlign: 'center' },
  tileTextOn: { color: COLORS.greenDeep },
  form: { gap: 8 },
  // Centred like the English, only the script's direction changes.
  arabic: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
});
