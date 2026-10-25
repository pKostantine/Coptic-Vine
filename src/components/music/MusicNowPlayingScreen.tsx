'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Easing,
    PanResponder,
    PanResponderGestureState,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import MusicArtwork from '@/components/music/MusicArtwork';
import MusicTrackActionsMenu from '@/components/music/MusicTrackActionsMenu';
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
    PLAYER_INK,
    PlayerBackdrop,
    PlayerBarButton,
    PlayerPanel,
    PlayerTopBar,
    PlayerTransport,
    shortPerformerLine,
    usePlayerLayout,
} from '@/components/playback/PlayerParts';
import PlayerSheet from '@/components/playback/PlayerSheet';
import PlayerVolume from '@/components/playback/PlayerVolume';
import RoundIconButton from '@/components/playback/RoundIconButton';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useMusicPlayer } from '@/context/MusicPlayerContext';
import { useAuth } from '@/context/AuthContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { musicService } from '@/services/musicService';
import type { PublishedLyricSet } from '@/types/musicConsumer';
import { goBack } from '@/utils/navigation';
import { PLAYER_VOLUME_ADJUSTABLE } from '@/utils/playerVolume';
import { motionDuration, useReducedMotion } from '@/utils/useReducedMotion';
import { useArtworkPalette } from '@/utils/useArtworkPalette';

import { tr } from '../../utils/appText';
// Swipe distance (or flick speed) that dismisses the player.
const DISMISS_DISTANCE = 130;
const DISMISS_VELOCITY = 0.75;
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

interface MusicNowPlayingScreenProps {
  embedded?: boolean;
  onClose?: () => void;
}

/**
 * The Music player (Coptic Vine Player design): the cover over its own
 * glow, the song, the seek bar and transport, and Lyrics · Like · More ·
 * Queue along the foot. A phone raises the queue as a sheet and opens the
 * lyrics full screen; an iPad sets the queue beside the player; a desktop
 * window sets the lyrics on its other side.
 */
export default function MusicNowPlayingScreen({ embedded = false, onClose }: MusicNowPlayingScreenProps = {}) {
  const { user } = useAuth();
  const router = useRouter();
  const { preferences } = useReadingPreferences();
  const isArabic = preferences.appLanguage === 'ar';
  const {
    currentItem,
    entries,
    currentIndex,
    playing,
    buffering,
    currentTimeMs,
    durationMs,
    togglePlayback,
    next,
    previous,
    seekToMs,
    selectQueueIndex,
    moveQueueItem,
    clearUpcoming,
    repeatMode,
    shuffleEnabled,
    cycleRepeatMode,
    toggleShuffle,
  } = useMusicPlayer();
  const layout = usePlayerLayout();
  const { kind, height } = layout;
  const wide = kind === 'desktop' || kind === 'split';
  const reduced = useReducedMotion();
  const [lyricsFullscreen, setLyricsFullscreen] = useState(false);
  const [queueSheetOpen, setQueueSheetOpen] = useState(false);
  // The desktop's Lyrics and Queue buttons put their panels away and back.
  const [lyricsPanelHidden, setLyricsPanelHidden] = useState(false);
  const [queuePanelHidden, setQueuePanelHidden] = useState(false);
  const [dismissDrag] = useState(() => new Animated.Value(0));
  const dismiss = useRef({ close: () => undefined as void, height: 0, reduced: false });
  const [lyricSets, setLyricSets] = useState<PublishedLyricSet[]>([]);
  const [selectedLyricSetId, setSelectedLyricSetId] = useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [likedTrackIds, setLikedTrackIds] = useState<Set<string>>(new Set());
  const [libraryAuthenticated, setLibraryAuthenticated] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  const closePlayer = () => {
    if (embedded && onClose) {
      onClose();
      return;
    }
    goBack(router, '/music');
  };

  useEffect(() => {
    dismiss.current = { close: closePlayer, height, reduced };
  }, [closePlayer, height, reduced]);

  // Pull the whole player down to put it away, the way a sheet behaves. The
  // gesture only starts on a clear downward drag, so the seek bar, the queue
  // and horizontal swipes keep working. Taken in the capture phase: asked
  // after them, the artwork, the buttons and the seek bar had already taken
  // the touch, and a pull down did nothing.
  // eslint-disable-next-line react-hooks/refs -- refs are read in gesture callbacks, not during render
  const [dismissResponder] = useState(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_event, gesture: PanResponderGestureState) => (
      gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.5
    ),
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_event, gesture: PanResponderGestureState) => {
      dismissDrag.setValue(Math.max(0, gesture.dy));
    },
    onPanResponderRelease: (_event, gesture: PanResponderGestureState) => {
      if (gesture.dy > DISMISS_DISTANCE || gesture.vy > DISMISS_VELOCITY) {
        Animated.timing(dismissDrag, {
          toValue: dismiss.current.height,
          duration: motionDuration(200, dismiss.current.reduced),
          easing: Easing.in(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }).start(() => {
          dismissDrag.setValue(0);
          dismiss.current.close();
        });
        return;
      }
      Animated.spring(dismissDrag, { toValue: 0, useNativeDriver: USE_NATIVE_DRIVER, bounciness: 4 }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(dismissDrag, { toValue: 0, useNativeDriver: USE_NATIVE_DRIVER, bounciness: 4 }).start();
    },
  }));

  useEffect(() => {
    if (!currentItem) {
      setLyricSets([]);
      setSelectedLyricSetId(null);
      return;
    }
    let active = true;
    setLyricsLoading(true);
    musicService.getLyrics(currentItem.track.id)
      .then((payload) => {
        if (!active) return;
        setLyricSets(payload.lyricSets);
        const preferredLocale = preferences.appLanguage === 'ar' ? 'ar' : 'en';
        const preferred = payload.lyricSets.find((set) => set.locale === preferredLocale)
          ?? payload.lyricSets.find((set) => set.kind === 'original')
          ?? payload.lyricSets[0]
          ?? null;
        setSelectedLyricSetId(preferred?.id ?? null);
      })
      .catch(() => {
        if (active) {
          setLyricSets([]);
          setSelectedLyricSetId(null);
        }
      })
      .finally(() => { if (active) setLyricsLoading(false); });
    return () => { active = false; };
  }, [currentItem?.track.id, preferences.appLanguage, user?.id]);

  useEffect(() => {
    if (!currentItem) return;
    let active = true;
    musicService.getLibrary(preferences.appLanguage === 'ar' ? 'ar' : 'en')
      .then((library) => {
        if (!active) return;
        setLibraryAuthenticated(library.authenticated);
        setLikedTrackIds(new Set(library.likedTracks.map((track) => track.id)));
      })
      .catch(() => {
        if (active) {
          setLibraryAuthenticated(false);
          setLikedTrackIds(new Set());
        }
      });
    return () => { active = false; };
  }, [currentItem?.track.id, preferences.appLanguage, user?.id]);

  const selectedSet = lyricSets.find((set) => set.id === selectedLyricSetId) ?? null;
  const activeLineId = useMemo(() => {
    if (!selectedSet) return null;
    const active = selectedSet.lines.find((line, index) => {
      if (line.startMs == null) return false;
      const nextStart = selectedSet.lines[index + 1]?.startMs ?? null;
      const effectiveEnd = line.endMs ?? nextStart ?? Number.POSITIVE_INFINITY;
      return currentTimeMs >= line.startMs && currentTimeMs < effectiveEnd;
    });
    return active?.id ?? null;
  }, [currentTimeMs, selectedSet]);

  const toggleTrackLike = async (trackId: string) => {
    if (likeBusy) return;
    if (!libraryAuthenticated) {
      Alert.alert(
        tr('Liked Songs', 'Titres aimés', 'الأغاني المعجبة'),
        tr('Sign in to your Coptic Vine account to save Liked Songs.', 'Connectez-vous à votre compte Coptic Vine pour enregistrer vos titres aimés.', 'سجّل الدخول إلى حساب كوبتك فاين لحفظ الأغاني المعجبة.'),
      );
      return;
    }
    setLikeBusy(true);
    try {
      const wasLiked = likedTrackIds.has(trackId);
      const nextLiked = !wasLiked;
      await musicService.setLiked(trackId, nextLiked);
      setLikedTrackIds((current) => {
        const nextSet = new Set(current);
        if (nextLiked) nextSet.add(trackId); else nextSet.delete(trackId);
        return nextSet;
      });
    } catch (cause) {
      Alert.alert(tr('Liked Songs', 'Titres aimés', 'الأغاني المعجبة'), cause instanceof Error ? cause.message : 'Unable to update Liked Songs.');
    } finally {
      setLikeBusy(false);
    }
  };

  const header = (
    <PlayerTopBar
      onClose={closePlayer}
      source={currentItem?.releaseTitle ?? null}
      isArabic={isArabic}
      compact={kind === 'phoneLandscape'}
    />
  );
  const rootStyle = embedded ? styles.embedded : styles.root;

  // The cover's colours, for the panels; the backdrop reads them itself.
  // Read before the empty state, so the hook runs on every render.
  const palette = useArtworkPalette(currentItem ? musicService.resolveAsset(currentItem.coverAsset ?? null) : null);

  if (!currentItem) {
    return (
      <View style={rootStyle}>
        <View style={[styles.layer, playerFrame(layout)]}>
          {header}
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{tr('Nothing playing', 'Aucune lecture en cours', 'لا شيء قيد التشغيل')}</Text>
            <Text style={styles.emptyBody}>{tr('Choose a track from Music to start listening.', 'Choisissez un titre dans Musique pour commencer l’écoute.', 'اختر مقطعاً من الموسيقى لبدء الاستماع.')}</Text>
            <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => router.replace('/music')}>
              <Text style={styles.primaryButtonText}>{tr('Browse Music', 'Parcourir la musique', 'تصفّح الموسيقى')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const performerLine = shortPerformerLine(currentItem.track, 'Coptic Vine');
  const classifierLine = [currentItem.recordingType, currentItem.musicType].filter(Boolean).join(' • ');
  const effectiveDurationMs = durationMs || currentItem.track.durationMs || 0;
  const artworkUri = musicService.resolveAsset(currentItem.coverAsset ?? null);
  const liked = likedTrackIds.has(currentItem.track.id);
  const noLyrics = !lyricsLoading && lyricSets.length === 0;
  const artLabel = currentItem.releaseTitle ?? currentItem.track.title;
  // Lyrics take a panel only on the desktop, and only when there are some:
  // otherwise that panel steps aside.
  const lyricsPanelShown = kind === 'desktop' && !noLyrics && !lyricsPanelHidden;
  const queuePanelShown = wide && !queuePanelHidden;

  const lyricsProps = {
    lyricSets,
    selectedSetId: selectedLyricSetId,
    onSelectSet: setSelectedLyricSetId,
    activeLineId,
    loading: lyricsLoading,
    onSeekLine: (startMs: number) => void seekToMs(startMs),
  };

  const queueProps = {
    entries,
    currentIndex,
    playing,
    isArabic,
    onSelect: selectQueueIndex,
    onMove: moveQueueItem,
    onClear: clearUpcoming,
    shuffleEnabled,
    repeatMode,
    onToggleShuffle: toggleShuffle,
    onCycleRepeat: cycleRepeatMode,
    tone: 'music' as const,
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
    artwork: (size) => (
      <PlayerArtworkFrame size={size}>
        <MusicArtwork asset={currentItem.coverAsset} size={size} radius={18} label={artLabel} />
      </PlayerArtworkFrame>
    ),
    title: currentItem.track.title,
    subtitle: performerLine,
    meta: classifierLine || null,
    seek: (dense) => (
      <SeekBar
        key={currentItem.track.id}
        positionMs={currentTimeMs}
        durationMs={effectiveDurationMs}
        onSeek={(positionMs) => void seekToMs(positionMs)}
        dense={dense}
      />
    ),
    transport: (size, maxWidth, align) => (
      <PlayerTransport
        playing={playing}
        buffering={buffering}
        onPrevious={previous}
        onTogglePlayback={togglePlayback}
        onNext={next}
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
          onPress={() => void toggleTrackLike(currentItem.track.id)}
          gold={liked}
          disabled={likeBusy}
          size={size}
        />
        <MusicTrackActionsMenu
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

  const columns = playerColumns(layout, { lyrics: lyricsPanelShown, queue: queuePanelShown });
  const sharedPanels = columns.panelWidth == null;

  const body = wide ? (
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
        <View style={styles.playerColumn} {...dismissResponder.panHandlers}>
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
  );

  return (
    <View style={rootStyle}>
      <Animated.View
        style={[styles.layer, { transform: [{ translateY: dismissDrag }] }]}
        {...(wide ? {} : dismissResponder.panHandlers)}
      >
        <PlayerBackdrop uri={artworkUri} />
        <View style={[styles.frame, playerFrame(layout)]}>
          {/* Beside the panels the lyrics and the queue scroll themselves, so
              the pull is taken on the header and the player only. */}
          {wide ? <View {...dismissResponder.panHandlers}>{header}</View> : header}
          {body}
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
        renderArtwork={(size, radius) => <MusicArtwork asset={currentItem.coverAsset} size={size} radius={radius} label={artLabel} />}
        title={currentItem.track.title}
        subtitle={performerLine}
        isArabic={isArabic}
        {...lyricsProps}
        positionMs={currentTimeMs}
        durationMs={effectiveDurationMs}
        onSeek={(positionMs) => void seekToMs(positionMs)}
        playing={playing}
        buffering={buffering}
        onPrevious={previous}
        onTogglePlayback={togglePlayback}
        onNext={next}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.black },
  // Over the app: pulled down, the player uncovers the page it rose from.
  embedded: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 90,
    elevation: 90,
  },
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

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 25, fontWeight: '700' },
  emptyBody: { color: 'rgba(255, 255, 255, 0.62)', fontFamily: TYPOGRAPHY.body, fontSize: 14, textAlign: 'center', marginTop: 8 },
  primaryButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 24, borderRadius: 99, backgroundColor: COLORS.gold, marginTop: 24 },
  primaryButtonText: { color: PLAYER_INK, fontFamily: TYPOGRAPHY.body, fontWeight: '800' },
});
