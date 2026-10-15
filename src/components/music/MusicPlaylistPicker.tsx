'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import MusicArtwork from '@/components/music/MusicArtwork';
import ActionSheetFrame, {
  SheetButton,
  SheetError,
  SheetHeader,
  SheetLoading,
  SheetNote,
  SheetRow,
  SheetRowGroup,
  SheetSectionLabel,
  SheetSegments,
  SheetTextField,
} from '@/components/playback/ActionSheetFrame';
import Icon from '@/components/vine/ui/Icon';
import { COLORS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { musicService } from '@/services/musicService';
import type { MusicConsumerAsset, MusicLibraryPlaylist } from '@/types/musicConsumer';
import type { MusicPlaylistVisibility } from '@/types/mediaPlatform';

import { tr } from '../../utils/appText';

/** "12 hymns", in the App Language. */
function hymnCount(count: number): string {
  if (count === 1) return tr('1 hymn', '1 hymne', 'ترنيمة واحدة');
  if (count === 2) return tr('2 hymns', '2 hymnes', 'ترنيمتان');
  return tr(`${count} hymns`, `${count} hymnes`, count >= 3 && count <= 10 ? `${count} ترانيم` : `${count} ترنيمة`);
}

interface MusicPlaylistPanelProps {
  trackId: string;
  /** Leaves for the account page, when no one is signed in to keep playlists. */
  onSignIn: () => void;
}

/**
 * Add to playlist, Music (Coptic Vine Player design, "Add to playlist ·
 * Music"): the reader's playlists, each ticked when it holds the track, and a
 * new one made on the spot. A row toggles: tapping a ticked playlist takes
 * the track out again. Drawn inside a sheet that already shows the track.
 */
export function MusicPlaylistPanel({ trackId, onSignIn }: MusicPlaylistPanelProps) {
  const { user } = useAuth();
  const { preferences } = useReadingPreferences();
  const locale = preferences.appLanguage === 'ar' ? 'ar' : 'en';
  const [playlists, setPlaylists] = useState<MusicLibraryPlaylist[] | null>(null);
  // The playlists that already hold the track, so the ticks are true when the sheet opens.
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newVisibility, setNewVisibility] = useState<MusicPlaylistVisibility>('private');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    void (async () => {
      try {
        const library = await musicService.getLibrary(locale);
        // The library lists playlists, not their tracks; each one is read to
        // know whether it holds this track. One that fails to load shows
        // unticked, and adding to it again is harmless.
        const contents = await Promise.allSettled(library.playlists.map((playlist) => musicService.getPlaylist(playlist.id, locale)));
        if (!active) return;
        const members = new Set<string>();
        contents.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value.tracks.some((track) => track.id === trackId)) {
            members.add(library.playlists[index].id);
          }
        });
        setMemberIds(members);
        setPlaylists(library.playlists);
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : tr('Unable to load your playlists.', 'Impossible de charger vos playlists.', 'تعذر تحميل قوائم التشغيل.'));
        setPlaylists([]);
      }
    })();
    return () => { active = false; };
  }, [locale, trackId, user]);

  if (!user) {
    return (
      <>
        <SheetSectionLabel>{tr('Your playlists', 'Vos playlists', 'قوائم التشغيل')}</SheetSectionLabel>
        <SheetRowGroup>
          <SheetRow icon="person-circle-outline" label={tr('Sign in', 'Se connecter', 'تسجيل الدخول')} trailing="chevron" onPress={onSignIn} />
        </SheetRowGroup>
        <SheetNote>{tr('Sign in to keep playlists of the hymns you love.', 'Connectez-vous pour garder des playlists des hymnes que vous aimez.', 'سجّل الدخول لتحفظ قوائم بالترانيم التي تحبها.')}</SheetNote>
      </>
    );
  }

  const toggle = async (playlist: MusicLibraryPlaylist) => {
    if (busyId) return;
    const holds = memberIds.has(playlist.id);
    setBusyId(playlist.id);
    setError(null);
    try {
      if (holds) await musicService.removeFromPlaylist(playlist.id, trackId);
      else await musicService.addToPlaylist(playlist.id, trackId);
      setMemberIds((current) => {
        const next = new Set(current);
        if (holds) next.delete(playlist.id);
        else next.add(playlist.id);
        return next;
      });
      setPlaylists((current) => (current ?? []).map((entry) => (
        entry.id === playlist.id ? { ...entry, trackCount: Math.max(0, entry.trackCount + (holds ? -1 : 1)) } : entry
      )));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr('Unable to update this playlist.', 'Impossible de modifier cette playlist.', 'تعذر تحديث قائمة التشغيل.'));
    } finally {
      setBusyId(null);
    }
  };

  const createAndAdd = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    const description = newDescription.trim() || null;
    setCreating(true);
    setError(null);
    try {
      const playlistId = await musicService.createPlaylist(name, description, newVisibility);
      await musicService.addToPlaylist(playlistId, trackId);
      setPlaylists((current) => [{
        id: playlistId,
        name,
        description,
        visibility: newVisibility,
        trackCount: 1,
        coverAsset: null,
      }, ...(current ?? [])]);
      setMemberIds((current) => new Set(current).add(playlistId));
      setNewName('');
      setNewDescription('');
      setFormOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr('Unable to create the playlist.', 'Impossible de créer la playlist.', 'تعذر إنشاء قائمة التشغيل.'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <SheetSectionLabel>{tr('Your playlists', 'Vos playlists', 'قوائم التشغيل')}</SheetSectionLabel>
      {playlists === null ? <SheetLoading /> : (
        <SheetRowGroup>
          <SheetRow
            icon="add"
            label={tr('New playlist', 'Nouvelle playlist', 'قائمة تشغيل جديدة')}
            tone="accent"
            accessibilityHint={tr('Make a playlist and add this hymn to it', 'Créer une playlist et y ajouter cet hymne', 'أنشئ قائمة تشغيل وأضف إليها هذه الترنيمة')}
            onPress={() => setFormOpen((open) => !open)}
          />
          {formOpen ? (
            <View style={styles.form}>
              <SheetTextField
                autoFocus
                value={newName}
                onChangeText={setNewName}
                placeholder={tr('Playlist name', 'Nom de la playlist', 'اسم قائمة التشغيل')}
                accessibilityLabel={tr('Playlist name', 'Nom de la playlist', 'اسم قائمة التشغيل')}
                returnKeyType="done"
                onSubmitEditing={() => void createAndAdd()}
              />
              <SheetTextField
                value={newDescription}
                onChangeText={setNewDescription}
                placeholder={tr('Description (optional)', 'Description (facultative)', 'الوصف (اختياري)')}
                accessibilityLabel={tr('Description', 'Description', 'الوصف')}
                multiline
              />
              <SheetSegments
                value={newVisibility}
                onChange={setNewVisibility}
                options={[
                  { value: 'private', label: tr('Private', 'Privée', 'خاصة') },
                  { value: 'public', label: tr('Public', 'Publique', 'عامة') },
                ]}
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
              icon="musical-notes"
              chip="grey"
              label={playlist.name}
              detail={hymnCount(playlist.trackCount)}
              trailing="check"
              checked={memberIds.has(playlist.id)}
              busy={busyId === playlist.id}
              onPress={() => void toggle(playlist)}
            />
          ))}
        </SheetRowGroup>
      )}
      {playlists !== null && !playlists.length && !formOpen ? (
        <SheetNote>{tr('No playlists yet. Make one to keep the hymns you love together.', 'Aucune playlist pour l’instant. Créez-en une pour réunir les hymnes que vous aimez.', 'لا توجد قوائم تشغيل بعد. أنشئ قائمة تجمع فيها الترانيم التي تحبها.')}</SheetNote>
      ) : null}
      {error ? <SheetError>{error}</SheetError> : null}
    </>
  );
}

/**
 * A button that opens Add to playlist on its own sheet, for a track shown
 * outside a More menu. Signed out, it leads to the account page instead.
 */
export default function MusicPlaylistPicker({
  trackId,
  compact = false,
  label = 'Add to playlist',
  menuRow = false,
  round = false,
  title,
  coverAsset,
  onOpen,
  onDismiss,
}: {
  trackId: string;
  compact?: boolean;
  label?: string;
  menuRow?: boolean;
  round?: boolean;
  /** The track's name and artwork, for the top of the sheet. */
  title?: string;
  coverAsset?: MusicConsumerAsset | null;
  onOpen?: () => void;
  onDismiss?: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);

  const dismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  const open = () => {
    if (!user) {
      router.push('/account');
      return;
    }
    setVisible(true);
    onOpen?.();
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={(event) => { event.stopPropagation(); open(); }}
        style={menuRow ? styles.menuTrigger : round ? styles.roundTrigger : compact ? styles.compactTrigger : styles.trigger}
      >
        <Icon name="playlist-add" size={compact || round ? 18 : 20} color={COLORS.goldBright} />
        {menuRow || (!compact && !round) ? <Text style={[styles.triggerText, menuRow && styles.menuTriggerText]}>{label}</Text> : null}
      </Pressable>

      <ActionSheetFrame visible={visible} onClose={dismiss} closeLabel={tr('Close Add to playlist', 'Fermer Ajouter à une playlist', 'إغلاق الإضافة إلى قائمة تشغيل')}>
        <SheetHeader
          artwork={title ? <MusicArtwork asset={coverAsset} size={52} radius={10} label={title} /> : null}
          kicker={title ? tr('Add to playlist', 'Ajouter à une playlist', 'إضافة إلى قائمة تشغيل') : null}
          title={title ?? tr('Add to playlist', 'Ajouter à une playlist', 'إضافة إلى قائمة تشغيل')}
        />
        {visible ? (
          <MusicPlaylistPanel
            trackId={trackId}
            onSignIn={() => { dismiss(); router.push('/account'); }}
          />
        ) : null}
      </ActionSheetFrame>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { alignItems: 'center', borderColor: COLORS.border, borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: SPACING.sm, justifyContent: 'center', minHeight: 42, paddingHorizontal: SPACING.md },
  triggerText: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 13, fontWeight: '800' },
  compactTrigger: { alignItems: 'center', borderRadius: 8, height: 34, justifyContent: 'center', width: 34 },
  roundTrigger: { alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.08)' },
  menuTrigger: { alignItems: 'center', flexDirection: 'row', gap: SPACING.md, minHeight: 52, paddingHorizontal: SPACING.md, borderRadius: 10 },
  menuTriggerText: { flex: 1, fontSize: 15 },
  form: { gap: 8 },
});
