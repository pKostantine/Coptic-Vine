'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import MusicLyricsView, { LyricsLanguageSwitch } from '@/components/music/MusicLyricsView';
import SeekBar from '@/components/music/SeekBar';
import PlaybackQueueList from '@/components/playback/PlaybackQueueList';
import PlayerLyricsFullscreen from '@/components/playback/PlayerLyricsFullscreen';
import {
  PlayerArtworkFrame,
  PlayerColumn,
  playerColumns,
  playerFrame,
  PlayerLandscape,
  playerSheetTop,
  type PlayerSlots,
  PlayerStacked,
} from '@/components/playback/PlayerLayouts';
import {
  nextLearningSpeed,
  PlayerBackdrop,
  PlayerBarButton,
  PlayerPanel,
  PlayerTopBar,
  PlayerTransport,
  SpeedChip,
  usePlayerLayout,
} from '@/components/playback/PlayerParts';
import { usePullDownToClose } from '@/components/playback/usePullDownToClose';
import PlayerSheet from '@/components/playback/PlayerSheet';
import PlayerVolume from '@/components/playback/PlayerVolume';
import RoundIconButton from '@/components/playback/RoundIconButton';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { type LearningQueueItem, useLearningPlayer } from '@/context/LearningPlayerContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { learningService } from '@/services/learningService';
import type { PublishedLyricSet } from '@/types/musicConsumer';
import { goBack } from '@/utils/navigation';
import { PLAYER_VOLUME_ADJUSTABLE } from '@/utils/playerVolume';
import { useArtworkPalette } from '@/utils/useArtworkPalette';
import LearningArtwork from './LearningArtwork';
import LearningItemActionsMenu from './LearningItemActionsMenu';
import LessonModeSwitch, { LESSON_MODE_SWITCH_HEIGHT } from './LessonModeSwitch';
import LessonVideoPanel, { lessonVideoAspect } from './LessonVideoPanel';

import { tr } from '../../utils/appText';
// How far the lesson player's step buttons move through a lesson.
const STEP_MS = 10000;

const EMPTY_LYRIC_SETS: PublishedLyricSet[] = [];

function itemKind(item: LearningQueueItem): 'album_recording' | 'lesson' {
  return item.kind === 'recording' ? 'album_recording' : 'lesson';
}

/**
 * The Learn & Study player — the same player as Music's (Coptic Vine Player
 * design, "Lesson player"), with what learning needs besides: a step of ten
 * seconds either side of the skips, and the speed between the times. A
 * lesson with a picture shows it in place of the cover, in a frame of the
 * video's shape, with Video | Audio only above it and full screen in its
 * corner; switching keeps the lesson playing where it is.
 */
export default function LearningNowPlayingScreen({
  embedded = false,
  onClose,
}: {
  embedded?: boolean;
  onClose?: () => void;
} = {}) {
  const router = useRouter();
  const layout = usePlayerLayout();
  const { kind } = layout;
  const wide = kind === 'desktop' || kind === 'split';
  const { preferences } = useReadingPreferences();
  const isArabic = preferences.appLanguage === 'ar';
  const locale = isArabic ? 'ar' : 'en';
  const player = useLearningPlayer();
  const {
    currentItem,
    entries,
    currentIndex,
    playing,
    buffering,
    currentTimeMs,
    durationMs,
    repeatMode,
    shuffleEnabled,
  } = player;
  const [queueSheetOpen, setQueueSheetOpen] = useState(false);
  const [lyricsFullscreen, setLyricsFullscreen] = useState(false);
  // The desktop's Lyrics and Queue buttons put their panels away and back.
  const [lyricsPanelHidden, setLyricsPanelHidden] = useState(false);
  const [queuePanelHidden, setQueuePanelHidden] = useState(false);
  // The lyrics loaded, with the item they belong to: another item's lyrics
  // are never shown while its own are on the way.
  const [lyricsState, setLyricsState] = useState<{ itemId: string | null; sets: PublishedLyricSet[]; selectedId: string | null }>({ itemId: null, sets: [], selectedId: null });
  const currentItemId = currentItem?.id ?? null;
  const currentItemKind = currentItem ? itemKind(currentItem) : null;
  const lyricsCurrent = lyricsState.itemId === currentItemId;
  const lyricSets = lyricsCurrent ? lyricsState.sets : EMPTY_LYRIC_SETS;
  const selectedLyricSetId = lyricsCurrent ? lyricsState.selectedId : null;
  const lyricsLoading = currentItemId != null && !lyricsCurrent;
  const setSelectedLyricSetId = (selectedId: string | null) => setLyricsState((current) => ({ ...current, selectedId }));
  const [likedItemIds, setLikedItemIds] = useState<Set<string>>(new Set());
  const [libraryAuthenticated, setLibraryAuthenticated] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  const closePlayer = () => {
    if (embedded && onClose) onClose();
    else goBack(router, '/learn');
  };
  // Pulled down, the player goes away, as the music player does.
  const pullDown = usePullDownToClose(closePlayer);

  useEffect(() => {
    if (!currentItemId || !currentItemKind) return;
    let active = true;
    learningService.getLyrics(currentItemKind, currentItemId)
      .then((payload) => {
        if (!active) return;
        const sets: PublishedLyricSet[] = payload.lyricSets.map((set) => ({
          id: set.id,
          trackId: set.itemId,
          locale: set.locale,
          kind: 'original',
          syncPrecision: set.syncPrecision,
          title: null,
          source: null,
          publicationStatus: set.publicationStatus,
          lines: set.lines.map((line) => ({ ...line, words: line.words ?? [] })),
        }));
        const preferred = sets.find((set) => set.locale === locale) ?? sets[0] ?? null;
        setLyricsState({ itemId: currentItemId, sets, selectedId: preferred?.id ?? null });
      })
      .catch(() => {
        if (!active) return;
        setLyricsState({ itemId: currentItemId, sets: [], selectedId: null });
      });
    return () => { active = false; };
  }, [currentItemId, currentItemKind, locale]);

  useEffect(() => {
    if (!currentItemId) return;
    let active = true;
    learningService.getItemLibrary(locale)
      .then((library) => {
        if (!active) return;
        setLibraryAuthenticated(library.authenticated);
        setLikedItemIds(new Set(library.likedItemIds));
      })
      .catch(() => {
        if (!active) return;
        setLibraryAuthenticated(false);
        setLikedItemIds(new Set());
      });
    return () => { active = false; };
  }, [currentItemId, locale]);

  const selectedSet = lyricSets.find((set) => set.id === selectedLyricSetId) ?? null;
  const activeLineId = useMemo(() => {
    if (!selectedSet || selectedSet.syncPrecision === 'unsynced') return null;
    return selectedSet.lines.find((line, index) => {
      if (line.startMs == null) return false;
      const nextStart = selectedSet.lines[index + 1]?.startMs ?? null;
      const effectiveEnd = line.endMs ?? nextStart ?? Number.POSITIVE_INFINITY;
      return currentTimeMs >= line.startMs && currentTimeMs < effectiveEnd;
    })?.id ?? null;
  }, [currentTimeMs, selectedSet]);

  const toggleLike = async (item: LearningQueueItem) => {
    if (likeBusy) return;
    if (!libraryAuthenticated) {
      Alert.alert(
        tr('Liked Learning', 'Apprentissages aimés', 'المحتوى المفضّل'),
        tr('Sign in to save liked lessons and recordings.', 'Connectez-vous pour enregistrer les leçons et enregistrements aimés.', 'سجّل الدخول لحفظ الدروس والتسجيلات المفضّلة.'),
      );
      return;
    }
    setLikeBusy(true);
    const nextLiked = !likedItemIds.has(item.id);
    try {
      await learningService.setItemLiked(itemKind(item), item.id, nextLiked);
      setLikedItemIds((current) => {
        const next = new Set(current);
        if (nextLiked) next.add(item.id); else next.delete(item.id);
        return next;
      });
    } catch (cause) {
      Alert.alert(tr('Liked Learning', 'Apprentissages aimés', 'المحتوى المفضّل'), cause instanceof Error ? cause.message : 'Unable to update this item.');
    } finally {
      setLikeBusy(false);
    }
  };

  const header = (
    <PlayerTopBar
      onClose={closePlayer}
      source={currentItem?.containerTitle ?? null}
      lesson={currentItem != null}
      isArabic={isArabic}
      compact={kind === 'phoneLandscape'}
    />
  );

  // The cover's colours, for the panels; the backdrop reads them itself.
  // Read before the empty state, so the hook runs on every render.
  const palette = useArtworkPalette(currentItem ? learningService.resolveAsset(currentItem.coverAsset) : null);

  if (!currentItem) {
    return (
      <View style={[styles.root, embedded && styles.embedded]}>
        <View style={[styles.layer, playerFrame(layout)]}>
          {header}
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{tr('Nothing playing', 'Aucune lecture en cours', 'لا يوجد درس قيد التشغيل')}</Text>
            <Text style={styles.emptyBody}>{tr('Choose a lesson or recording to start learning.', 'Choisissez une leçon ou un enregistrement pour commencer.', 'اختر درساً أو تسجيلاً للبدء.')}</Text>
          </View>
        </View>
      </View>
    );
  }

  const effectiveDuration = durationMs || currentItem.durationMs || 0;
  const artworkUri = learningService.resolveAsset(currentItem.coverAsset);
  const liked = likedItemIds.has(currentItem.id);
  const noLyrics = !lyricsLoading && lyricSets.length === 0;
  // Everything Learn & Study plays is a lesson to the listener, a recording
  // from a learning album as much as a lesson set's.
  const kindLabel = tr('Lesson', 'Leçon', 'درس');
  // Lyrics take a panel only on the desktop, and only when there are some:
  // a lesson without them, the panel steps aside.
  const lyricsPanelShown = kind === 'desktop' && !noLyrics && !lyricsPanelHidden;
  const queuePanelShown = wide && !queuePanelHidden;
  const stepBy = (deltaMs: number) => {
    const target = currentTimeMs + deltaMs;
    void player.seekToMs(Math.max(0, effectiveDuration > 0 ? Math.min(target, effectiveDuration) : target));
  };

  // A lesson with a picture: its video, or its sound alone, in the video's frame.
  const videoLesson = player.currentHasVideo && currentItem.kind === 'lesson';
  const aspect = lessonVideoAspect(currentItem, player.videoAspectRatio);

  const lyricsProps = {
    lyricSets,
    selectedSetId: selectedLyricSetId,
    onSelectSet: setSelectedLyricSetId,
    activeLineId,
    loading: lyricsLoading,
    onSeekLine: (startMs: number) => void player.seekToMs(startMs),
  };
  const queueProps = {
    entries,
    currentIndex,
    playing,
    isArabic,
    onSelect: player.selectQueueIndex,
    onMove: player.moveQueueItem,
    onRemove: player.removeQueueItem,
    onClear: player.clearUpcoming,
    shuffleEnabled,
    repeatMode,
    onToggleShuffle: player.toggleShuffle,
    onCycleRepeat: player.cycleRepeatMode,
    tone: 'learning' as const,
  };

  const openLyrics = () => {
    if (kind === 'desktop' && !noLyrics) setLyricsPanelHidden((hidden) => !hidden);
    else setLyricsFullscreen(true);
  };
  const openQueue = () => {
    if (wide) setQueuePanelHidden((hidden) => !hidden);
    else setQueueSheetOpen(true);
  };

  const slots: PlayerSlots = {
    lesson: true,
    artwork: (size) => (
      <PlayerArtworkFrame size={size}>
        <LearningArtwork asset={currentItem.coverAsset} size={size} radius={18} label={currentItem.containerTitle} />
      </PlayerArtworkFrame>
    ),
    media: videoLesson ? {
      aspect,
      render: (width, height) => <LessonVideoPanel item={currentItem} width={width} height={height} aspect={aspect} isArabic={isArabic} />,
      above: <LessonModeSwitch mode={player.lessonVideoMode} onChange={player.setLessonVideoMode} isArabic={isArabic} />,
      aboveHeight: LESSON_MODE_SWITCH_HEIGHT,
    } : undefined,
    title: currentItem.title,
    subtitle: currentItem.cantorName,
    meta: `${kindLabel} · ${currentItem.containerTitle}`,
    seek: (dense) => (
      <SeekBar
        key={currentItem.id}
        positionMs={currentTimeMs}
        durationMs={effectiveDuration}
        onSeek={(position) => void player.seekToMs(position)}
        dense={dense}
        center={<SpeedChip rate={player.playbackRate} onPress={() => player.setPlaybackRate(nextLearningSpeed(player.playbackRate))} />}
      />
    ),
    transport: (size, maxWidth, align) => (
      <PlayerTransport
        playing={playing}
        buffering={buffering}
        onPrevious={player.previous}
        onTogglePlayback={player.togglePlayback}
        onNext={player.next}
        onBack10={() => stepBy(-STEP_MS)}
        onForward10={() => stepBy(STEP_MS)}
        size={size}
        maxWidth={maxWidth}
        align={align}
      />
    ),
    volume: PLAYER_VOLUME_ADJUSTABLE ? () => <PlayerVolume /> : undefined,
    bar: (size) => (
      <>
        <PlayerBarButton
          icon="reader-outline"
          accessibilityLabel={tr('Lyrics', 'Paroles', 'الكلمات')}
          onPress={openLyrics}
          on={lyricsPanelShown}
          disabled={noLyrics}
          size={size}
        />
        <PlayerBarButton
          icon={liked ? 'heart' : 'heart-outline'}
          accessibilityLabel={liked ? tr('Unlike', 'Je n’aime plus', 'إزالة الإعجاب') : tr('Like', 'J’aime', 'إعجاب')}
          onPress={() => void toggleLike(currentItem)}
          gold={liked}
          disabled={likeBusy}
          size={size}
        />
        <LearningItemActionsMenu
          item={currentItem}
          isArabic={isArabic}
          size={size}
          onNavigate={embedded ? onClose : undefined}
          renderTrigger={(open) => (
            <PlayerBarButton icon="ellipsis-sharp" accessibilityLabel={tr('More', 'Plus', 'المزيد')} onPress={open} size={size} />
          )}
        />
        <PlayerBarButton
          icon="list"
          accessibilityLabel={tr('Queue', 'File d’attente', 'قائمة الانتظار')}
          onPress={openQueue}
          on={queuePanelShown}
          size={size}
        />
      </>
    ),
  };

  const columns = playerColumns(layout, { lyrics: lyricsPanelShown, queue: queuePanelShown }, videoLesson);
  const sharedPanels = columns.panelWidth == null;

  return (
    <View style={[styles.root, embedded && styles.embedded]}>
      <Animated.View style={[styles.layer, { transform: [{ translateY: pullDown.drag }] }]} {...(wide ? {} : pullDown.panHandlers)}>
        <PlayerBackdrop uri={artworkUri} />
        <View style={[styles.frame, playerFrame(layout)]}>
          {/* Beside the panels the lyrics and the queue scroll themselves, so
              the pull is taken on the header and the player only. */}
          {wide ? <View {...pullDown.panHandlers}>{header}</View> : header}
          {wide ? (
            <View style={[styles.columns, { gap: columns.gap }]}>
              {lyricsPanelShown ? (
                <PlayerPanel palette={palette} style={sharedPanels ? styles.flexPanel : { width: columns.panelWidth ?? undefined }}>
                  <View style={styles.panelHeader}>
                    <Text style={[styles.panelTitle, isArabic && styles.arabicTitle]}>{tr('Lyrics', 'Paroles', 'الكلمات')}</Text>
                    <LyricsLanguageSwitch
                      sets={lyricSets}
                      selectedId={selectedLyricSetId}
                      onSelect={setSelectedLyricSetId}
                      isArabic={isArabic}
                      style={styles.panelSwitch}
                    />
                    <RoundIconButton
                      icon="lyrics-expand"
                      accessibilityLabel={tr('Full screen lyrics', 'Paroles en plein écran', 'الكلمات بملء الشاشة')}
                      onPress={() => setLyricsFullscreen(true)}
                      size={36}
                      variant="filled"
                      fill="rgba(255, 255, 255, 0.08)"
                      iconSize={18}
                      iconColor="rgba(255, 255, 255, 0.8)"
                    />
                  </View>
                  <MusicLyricsView {...lyricsProps} variant="player" scale="panel" hideTabs style={styles.panelLyrics} />
                </PlayerPanel>
              ) : null}
              <View style={columns.playerWidth != null ? { width: columns.playerWidth } : styles.playerColumnFlex}>
                <View style={styles.playerColumn} {...pullDown.panHandlers}>
                  <PlayerColumn layout={layout} slots={slots} columns={columns} />
                </View>
              </View>
              {queuePanelShown ? (
                <PlayerPanel palette={palette} style={sharedPanels ? styles.flexPanel : { width: columns.panelWidth ?? undefined }}>
                  <PlaybackQueueList {...queueProps} scrollable surface="panel" />
                </PlayerPanel>
              ) : null}
            </View>
          ) : kind === 'phoneLandscape' ? (
            <PlayerLandscape layout={layout} slots={slots} />
          ) : (
            <PlayerStacked layout={layout} slots={slots} />
          )}
        </View>
      </Animated.View>

      {!wide ? (
        <PlayerSheet
          visible={queueSheetOpen}
          onClose={() => setQueueSheetOpen(false)}
          accessibilityLabel={tr('Queue', 'File d’attente', 'قائمة الانتظار')}
          top={playerSheetTop(layout)}
        >
          <PlaybackQueueList {...queueProps} scrollable surface="sheet" />
        </PlayerSheet>
      ) : null}

      <PlayerLyricsFullscreen
        visible={lyricsFullscreen}
        onExit={() => setLyricsFullscreen(false)}
        artworkUri={artworkUri}
        renderArtwork={(size, radius) => <LearningArtwork asset={currentItem.coverAsset} size={size} radius={radius} label={currentItem.containerTitle} />}
        title={currentItem.title}
        subtitle={currentItem.cantorName}
        isArabic={isArabic}
        {...lyricsProps}
        positionMs={currentTimeMs}
        durationMs={effectiveDuration}
        onSeek={(position) => void player.seekToMs(position)}
        playing={playing}
        buffering={buffering}
        onPrevious={player.previous}
        onTogglePlayback={player.togglePlayback}
        onNext={player.next}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.black },
  // Over the app: pulled down, the player uncovers the page it rose from.
  embedded: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90, elevation: 90, backgroundColor: 'transparent' },
  layer: { flex: 1, minHeight: 0, backgroundColor: COLORS.black, overflow: 'hidden' },
  frame: { flex: 1, minHeight: 0 },
  arabicTitle: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  columns: { flex: 1, minHeight: 0, flexDirection: 'row', marginTop: 16 },
  flexPanel: { flex: 1, minWidth: 0 },
  playerColumn: { flex: 1, justifyContent: 'center' },
  playerColumnFlex: { flex: 1, minWidth: 0 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  panelTitle: { flex: 1, color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 24, fontWeight: '700' },
  panelSwitch: { marginRight: 4 },
  panelLyrics: { marginTop: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 25, fontWeight: '700' },
  emptyBody: { color: 'rgba(255, 255, 255, 0.62)', fontFamily: TYPOGRAPHY.body, fontSize: 14, marginTop: 8, textAlign: 'center' },
});
