'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { usePathname } from 'expo-router';
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Alert, Animated, BackHandler, Easing, PanResponder, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MusicNowPlayingScreen from '@/components/music/MusicNowPlayingScreen';
import Icon from '@/components/vine/ui/Icon';
import LearningArtwork from '@/components/learning/LearningArtwork';
import LearningNowPlayingScreen from '@/components/learning/LearningNowPlayingScreen';
import { LessonPoster, lessonVideoAspect } from '@/components/learning/LessonVideoPanel';
import LessonVideoSurface from '@/components/playback/LessonVideoSurface';
import MusicArtwork from '@/components/music/MusicArtwork';
import type { DocumentTheme } from '@/constants/documentThemes';
import { COLORS } from '@/constants/theme';
import { useBottomChrome } from '@/context/BottomChromeContext';
import { useAuth } from '@/context/AuthContext';
import { useLearningPlayer } from '@/context/LearningPlayerContext';
import { useMusicPlayer } from '@/context/MusicPlayerContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { useVideoStage } from '@/context/VideoStageContext';
import { learningService } from '@/services/learningService';
import { musicService } from '@/services/musicService';
import { formatMusicTrackPerformers } from '@/utils/musicCredits';
import { motionDuration, useReducedMotion } from '@/utils/useReducedMotion';
import MiniPlayerCard from './MiniPlayerCard';
import { useOverlayTransition } from './useOverlayTransition';

import { tr } from '../../utils/appText';
// Same small gap whether the bar floats over a tab bar or the page edge.
const FLOATING_GAP = 10;
/** The hidden bar's round button, and how far a finger must travel before a press becomes a drag. */
const BUTTON_SIZE = 42;
const DRAG_SLOP = 6;
/** A video lesson's thumbnail in the bar: the cover's height, the picture's 16:9. */
const MINI_VIDEO = { width: 78, height: 44 };
/** Below this width a video lesson's bar gives its like to the Video / Audio switch (the full player keeps both). */
const ROOM_FOR_LIKE_AND_MODE = 480;

const EXCLUDED_PATHS = new Set([
  '/season-selector',
  '/settings',
  '/book-settings',
  '/downloads',
  '/music/now-playing',
  '/learn/now-playing',
]);

// The book pages, where Book Settings' "Display Now Playing Bar" decides. Home
// and Account are not among them: the bar shows there whenever something plays.
const BOOK_PATH_PREFIXES = [
  '/bible',
  '/psalmody',
  '/liturgy',
  '/agpeya',
  '/holy-week',
  '/lectionary',
  '/veneration',
  '/bookmarks',
  '/search',
];

interface GlobalNowPlayingOverlayProps {
  /** The page of the document this bar floats over, when its document mounts it (a subdocument). */
  documentTheme?: DocumentTheme;
  /**
   * A touch landed on the hidden bar's button. A subdocument's edge swipes
   * listen for it: dragging the button along the foot of the page moves it,
   * and never closes the subdocument or opens its contents.
   */
  onButtonTouchStart?: () => void;
  /**
   * This bar is a subdocument's, drawn inside its Modal over the whole app.
   * Its thumbnail takes the lesson's picture from the app's bar beneath it,
   * as the newer surface (utils/lessonPlayback.ts); a page asking for the full
   * player is answered by the app's bar, not this one.
   */
  covering?: boolean;
}

export default function GlobalNowPlayingOverlay({ documentTheme: ownDocumentTheme, onButtonTouchStart, covering = false }: GlobalNowPlayingOverlayProps = {}) {
  const { user } = useAuth();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { reportBarSlot } = useVideoStage();
  // Hidden or shown is one app-wide choice, not each bar's own: a subdocument
  // mounts a bar of its own, and it must open the way the reader left it.
  const {
    tabBarInset,
    reportNowPlayingInset,
    reportNowPlayingExpanded,
    documentTheme: focusedDocumentTheme,
    nowPlayingCollapsed: isCollapsed,
    setNowPlayingCollapsed: setIsCollapsed,
    nowPlayingOpenRequests,
  } = useBottomChrome();
  const overlayId = useId();
  const { preferences, setNowPlayingButtonSide } = useReadingPreferences();
  // Over one of the three coloured pages -- Walnut, Vine, Sepia -- the button
  // wears the page's own button colour, the one its subdocument buttons are
  // drawn in (honey, celadon, oxblood). The gold stays on Night and Paper, and
  // everywhere outside the documents.
  const documentTheme = ownDocumentTheme ?? focusedDocumentTheme;
  const colouredPage = documentTheme && documentTheme.id !== 'night' && documentTheme.id !== 'paper' ? documentTheme : null;
  const buttonColor = colouredPage ? colouredPage.colors.subdoc : COLORS.gold;
  const buttonIconColor = colouredPage ? colouredPage.colors.onAccent : COLORS.white;
  const music = useMusicPlayer();
  const learning = useLearningPlayer();
  const [expandedHeight, setExpandedHeight] = useState(60);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [miniLiked, setMiniLiked] = useState(false);
  const [miniLikeBusy, setMiniLikeBusy] = useState(false);
  const [libraryAuthenticated, setLibraryAuthenticated] = useState(false);

  const currentItem = music.currentItem ?? learning.currentItem;
  const normalizedPath = pathname.replace(/\?.*$/, '');
  const isBookRoute = BOOK_PATH_PREFIXES.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`));
  const isExcludedRoute = EXCLUDED_PATHS.has(normalizedPath) || EXCLUDED_PATHS.has(pathname);
  const allowDisplay = Boolean(currentItem) && !isExcludedRoute && (!isBookRoute || preferences.displayNowPlayingBar);
  const [collapseAnimation] = useState(() => new Animated.Value(isCollapsed ? 1 : 0));

  // The bar is anchored to the bottom of the page and lifted above the tab bar
  // when the focused screen has one. Animating the lift (rather than jumping
  // `bottom`) keeps it smooth when navigating between screens with and without
  // a tab bar, and a transform can run on the native driver.
  const targetLift = tabBarInset > 0 ? Math.max(0, tabBarInset - insets.bottom) : 0;
  const [liftAnimation] = useState(() => new Animated.Value(targetLift));
  const reduced = useReducedMotion();

  useEffect(() => {
    const animation = Animated.timing(liftAnimation, {
      toValue: targetLift,
      duration: motionDuration(260, reduced),
      easing: Easing.out(Easing.cubic),
      // Moving between two screens that both have a tab bar briefly reports no
      // tab bar at all, because the outgoing bar unregisters before the
      // incoming one has measured itself. Holding the drop back for a moment
      // keeps the bar still through that hand-off; rising is immediate.
      delay: targetLift === 0 ? 140 : 0,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [liftAnimation, reduced, targetLift]);

  // Hidden or shown, the card and the round button cross: each stays drawn
  // while it fades out, and is let go once the other has come in.
  const [cardMounted, setCardMounted] = useState(!isCollapsed);
  const [buttonMounted, setButtonMounted] = useState(isCollapsed);
  if (isCollapsed && !buttonMounted) setButtonMounted(true);
  if (!isCollapsed && !cardMounted) setCardMounted(true);
  useEffect(() => {
    const animation = Animated.timing(collapseAnimation, {
      toValue: isCollapsed ? 1 : 0,
      duration: motionDuration(220, reduced),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (!finished) return;
      if (isCollapsed) setCardMounted(false);
      else setButtonMounted(false);
    });
    return () => animation.stop();
  }, [collapseAnimation, isCollapsed, reduced]);
  // Pulled down out of sight, the card has already gone: it isn't faded out again.
  const hideBar = (swipedAway = false) => {
    setIsCollapsed(true);
    if (swipedAway) setCardMounted(false);
  };

  // The full player rises over the page from the bar, and goes back down into
  // it: kept drawn through its way down, over the bar it uncovers.
  const fullPlayer = useOverlayTransition(isPopupOpen && allowDisplay, { duration: 320 });
  // Each opening is a player of its own: opened again on its way down after
  // a pull, the one going would rise still pulled out of sight.
  const [playerKey, setPlayerKey] = useState(0);
  const [openSeen, setOpenSeen] = useState(isPopupOpen);
  if (openSeen !== isPopupOpen) {
    setOpenSeen(isPopupOpen);
    if (isPopupOpen) setPlayerKey((key) => key + 1);
  }
  const fullPlayerOffset = useMemo(
    () => fullPlayer.progress.interpolate({ inputRange: [0, 1], outputRange: [windowHeight, 0] }),
    [fullPlayer.progress, windowHeight],
  );

  // The hidden bar's button rests in either bottom corner, dragged there along
  // the foot of the page. Where it sits is its corner's offset along that row
  // (0 at the left end, `travel` at the right) plus any drag in progress, so a
  // dropped button carries on from wherever the finger let it go.
  const side = preferences.nowPlayingButtonSide;
  const [rowWidth, setRowWidth] = useState(0);
  const travel = Math.max(0, rowWidth - BUTTON_SIZE);
  const cornerOffset = side === 'left' ? 0 : travel;
  const [sideOffset] = useState(() => new Animated.Value(0));
  const [dragOffset] = useState(() => new Animated.Value(0));
  // Made once, not at each render: new nodes would be attached to the native
  // driver afresh every time the bar is drawn.
  const motion = useMemo(() => {
    const lift = Animated.multiply(liftAnimation, -1);
    return {
      buttonX: Animated.add(sideOffset, dragOffset),
      buttonY: lift,
      buttonScale: collapseAnimation.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0.96] }),
      buttonOpacity: collapseAnimation.interpolate({ inputRange: [0, 1], outputRange: [0, 0.92] }),
      cardY: Animated.add(lift, collapseAnimation.interpolate({ inputRange: [0, 1], outputRange: [0, 20] })),
      cardOpacity: collapseAnimation.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    };
  }, [collapseAnimation, dragOffset, liftAnimation, sideOffset]);
  const lastSideRef = useRef(side);
  useEffect(() => {
    // Moved to the other corner, it glides there; a turn of the device, or
    // the row's first measure, just puts it in its corner.
    const moved = lastSideRef.current !== side;
    lastSideRef.current = side;
    if (moved && !reduced) {
      Animated.spring(sideOffset, { toValue: cornerOffset, speed: 18, bounciness: 4, useNativeDriver: true }).start();
    } else {
      sideOffset.setValue(cornerOffset);
    }
  }, [cornerOffset, reduced, side, sideOffset]);

  const buttonDrag = useMemo(() => {
    const settle = () => {
      if (reduced) sideOffset.setValue(cornerOffset);
      else Animated.spring(sideOffset, { toValue: cornerOffset, speed: 18, bounciness: 4, useNativeDriver: true }).start();
    };
    return PanResponder.create({
      // A tap stays the button's own; only a drag along the foot is taken from it.
      onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dx) > DRAG_SLOP && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gesture) => {
        dragOffset.setValue(Math.min(Math.max(gesture.dx, -cornerOffset), travel - cornerOffset));
      },
      onPanResponderRelease: (_, gesture) => {
        const at = Math.min(Math.max(cornerOffset + gesture.dx, 0), travel);
        // A flick goes the way it was thrown; a slower drag, to the nearer corner.
        const next = Math.abs(gesture.vx) > 0.5
          ? (gesture.vx < 0 ? 'left' : 'right')
          : (at < travel / 2 ? 'left' : 'right');
        sideOffset.setValue(at);
        dragOffset.setValue(0);
        if (next === side) settle();
        else setNowPlayingButtonSide(next);
      },
      onPanResponderTerminate: () => {
        sideOffset.setValue(cornerOffset);
        dragOffset.setValue(0);
      },
    });
  }, [cornerOffset, dragOffset, reduced, setNowPlayingButtonSide, side, sideOffset, travel]);

  // The desktop sidebar steps aside while a full player is open, so the player
  // gets the whole window. Reported per overlay and cleared on unmount, the
  // same way the inset is, because a subdocument can mount one of its own over
  // the app's.
  // It comes back once the player has gone down, not under it on its way.
  const playerShown = allowDisplay && (isPopupOpen || fullPlayer.mounted);
  useEffect(() => {
    reportNowPlayingExpanded(overlayId, playerShown);
    return () => reportNowPlayingExpanded(overlayId, false);
  }, [overlayId, playerShown, reportNowPlayingExpanded]);

  // Out, the bar's thumbnail will show a lesson's picture: the engine fetches
  // a new lesson's picture the first time (utils/lessonPlayback.ts).
  const barOut = allowDisplay && !isCollapsed && !isPopupOpen;
  useEffect(() => {
    reportBarSlot(overlayId, barOut);
    return () => reportBarSlot(overlayId, false);
  }, [barOut, overlayId, reportBarSlot]);

  // A page asked for the full player (a lesson started to be watched). Only
  // the app's own bar answers; it opens once the lesson is current.
  const answeredOpenRequests = useRef(nowPlayingOpenRequests);
  useEffect(() => {
    if (covering || nowPlayingOpenRequests === answeredOpenRequests.current) return;
    answeredOpenRequests.current = nowPlayingOpenRequests;
    setIsPopupOpen(true);
  }, [covering, nowPlayingOpenRequests]);

  // The full player is drawn over the page rather than in a modal, so Android's
  // back would otherwise go to the page beneath it. It closes the player.
  useEffect(() => {
    if (!isPopupOpen || !allowDisplay) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setIsPopupOpen(false);
      return true;
    });
    return () => subscription.remove();
  }, [allowDisplay, isPopupOpen]);

  useEffect(() => {
    // The slideshow deliberately renders underneath the floating player. The
    // player is an overlay there, not bottom chrome that changes pagination.
    // Publishing its height while slideshow mode is active creates the exact
    // full-width dead band that the collapsed button is meant to avoid.
    if (!allowDisplay || preferences.slideshowMode) {
      reportNowPlayingInset(overlayId, null);
      return;
    }

    // Top-level tab screens already stop scrolling at the tab bar's top edge,
    // so only the floating card itself + its gap needs reserving there. On a
    // nested screen with no tab bar, include the device bottom safe area too.
    const safeAreaClearance = tabBarInset > 0 ? 0 : insets.bottom;
    const visibleHeight = isCollapsed ? 42 : expandedHeight;
    reportNowPlayingInset(overlayId, visibleHeight + FLOATING_GAP + safeAreaClearance);

    return () => reportNowPlayingInset(overlayId, null);
  }, [
    allowDisplay,
    expandedHeight,
    insets.bottom,
    isCollapsed,
    overlayId,
    preferences.slideshowMode,
    reportNowPlayingInset,
    tabBarInset,
  ]);

  const isMusic = Boolean(music.currentItem);
  const musicTrackId = music.currentItem?.track.id ?? null;
  const learningItemId = learning.currentItem?.id ?? null;
  const learningItemKind = learning.currentItem?.kind === 'recording' ? 'album_recording' : 'lesson';

  useEffect(() => {
    const trackId = music.currentItem?.track.id ?? null;
    const learnId = learning.currentItem?.id ?? null;
    if (!trackId && !learnId) return;

    let active = true;
    const locale = preferences.appLanguage === 'ar' ? 'ar' : 'en';
    const request = trackId
      ? musicService.getLibrary(locale).then((library) => ({
          authenticated: library.authenticated,
          liked: library.likedTracks.some((track) => track.id === trackId),
        }))
      : learningService.getItemLibrary(locale).then((library) => ({
          authenticated: library.authenticated,
          liked: library.likedItemIds.includes(learnId as string),
        }));
    request
      .then((library) => {
        if (!active) return;
        setLibraryAuthenticated(library.authenticated);
        setMiniLiked(library.liked);
      })
      .catch(() => {
        if (!active) return;
        setLibraryAuthenticated(false);
        setMiniLiked(false);
      });

    return () => { active = false; };
  }, [isPopupOpen, learning.currentItem?.id, music.currentItem?.track.id, preferences.appLanguage, user?.id]);

  if (!allowDisplay) {
    return null;
  }

  const playerScreen = fullPlayer.mounted && (isMusic || learning.currentItem) ? (
    <Animated.View
      pointerEvents={isPopupOpen ? 'box-none' : 'none'}
      style={[styles.fullPlayer, { transform: [{ translateY: fullPlayerOffset }] }]}
    >
      {isMusic ? (
        <MusicNowPlayingScreen key={playerKey} embedded onClose={() => setIsPopupOpen(false)} />
      ) : (
        <LearningNowPlayingScreen key={playerKey} embedded onClose={() => setIsPopupOpen(false)} />
      )}
    </Animated.View>
  ) : null;

  if (isPopupOpen) return playerScreen;

  // Everything opens the full player, a lesson's picture with it.
  const onOpen = () => setIsPopupOpen(true);
  const onTogglePlayback = isMusic ? music.togglePlayback : learning.togglePlayback;
  const onNext = isMusic ? music.next : learning.next;
  const onPrevious = isMusic ? music.previous : learning.previous;
  // One gold bar for everything that plays: a song, a recording, a lesson.
  const accentColor = COLORS.gold;

  let title = 'Now playing';
  let titleSuffix: string | null = null;
  let subtitle = 'Coptic Vine';
  let artwork: ReactNode = null;

  if (isMusic && music.currentItem) {
    const item = music.currentItem;
    title = item.track.title;
    titleSuffix = item.releaseType === 'album' || item.releaseType === 'ep'
      ? item.releaseTitle ?? null
      : null;
    subtitle = formatMusicTrackPerformers(item.track) || 'Coptic Vine';
    artwork = (
      <MusicArtwork
        asset={item.coverAsset ?? null}
        size={44}
        radius={8}
        label={item.releaseTitle ?? item.track.title}
      />
    );
  } else if (learning.currentItem) {
    const item = learning.currentItem;
    title = item.title;
    subtitle = `${item.cantorName} · ${item.containerTitle}`;
    // Watched as video, the bar shows the picture itself; as sound, the cover.
    artwork = learning.currentHasVideo && learning.lessonVideoMode === 'video' ? (
      <LessonVideoSurface
        kind="mini"
        aspect={lessonVideoAspect(item, learning.videoAspectRatio)}
        contentFit="cover"
        style={styles.miniVideo}
        poster={<LessonPoster uri={learningService.resolveAsset(item.coverAsset)} compact />}
      />
    ) : (
      <LearningArtwork
        asset={item.coverAsset}
        size={44}
        radius={8}
        label={item.containerTitle}
      />
    );
  }
  // A video lesson's bar switches between its picture and its sound alone.
  const videoLesson = !isMusic && learning.currentHasVideo;
  const modeButton = videoLesson
    ? learning.lessonVideoMode === 'video'
      ? { icon: 'headset-outline' as const, label: tr('Listen to the audio only', 'Écouter l’audio seulement', 'استمع إلى الصوت فقط'), onPress: () => learning.setLessonVideoMode('audio') }
      : { icon: 'videocam-outline' as const, label: tr('Watch the video', 'Regarder la vidéo', 'شاهد الفيديو'), onPress: () => learning.setLessonVideoMode('video') }
    : null;
  const likeFits = !videoLesson || windowWidth >= ROOM_FOR_LIKE_AND_MODE;

  const overlayBottom = insets.bottom + FLOATING_GAP;
  const otherSide = side === 'left' ? 'right' : 'left';

  const button = buttonMounted ? (
    <>
      {/* The foot of the page the button travels along, clear of the notch
          and the rounded corners on a phone on its side. No height, so it
          covers nothing: the button stays its own small box. */}
      <View
        pointerEvents="none"
        onLayout={(event) => setRowWidth(Math.round(event.nativeEvent.layout.width))}
        style={{ position: 'absolute', left: 18 + insets.left, right: 18 + insets.right, bottom: 0, height: 0 }}
      />
      <Animated.View
        testID="global-now-playing-collapsed"
        pointerEvents={isCollapsed ? 'box-none' : 'none'}
        style={{
          position: 'absolute',
          left: 18 + insets.left,
          bottom: overlayBottom,
          width: BUTTON_SIZE,
          height: BUTTON_SIZE,
          backgroundColor: 'transparent',
          // Shown once the foot is measured, so it never flashes in the wrong corner.
          opacity: rowWidth > 0 ? motion.buttonOpacity : 0,
          transform: [{ translateX: motion.buttonX }, { translateY: motion.buttonY }, { scale: motion.buttonScale }],
          zIndex: 40,
          elevation: 40,
        }}
      >
        <View {...buttonDrag.panHandlers} onTouchStart={onButtonTouchStart}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show now playing"
            accessibilityHint={tr('Drag to move it to the other corner', 'Faites glisser pour le placer dans l’autre coin', 'اسحبه لنقله إلى الزاوية الأخرى')}
            accessibilityActions={[{
              name: 'move',
              label: otherSide === 'left'
                ? tr('Move to the left corner', 'Placer dans le coin gauche', 'انقله إلى الزاوية اليسرى')
                : tr('Move to the right corner', 'Placer dans le coin droit', 'انقله إلى الزاوية اليمنى'),
            }]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'move') setNowPlayingButtonSide(otherSide);
            }}
            onPress={() => setIsCollapsed(false)}
            style={[styles.collapsedButton, { backgroundColor: buttonColor }]}
          >
            <Icon name="chevron-down" size={18} color={buttonIconColor} style={{ transform: [{ rotate: '180deg' }] }} />
          </Pressable>
        </View>
      </Animated.View>
    </>
  ) : null;

  return (
    <>
      {button}
      {cardMounted ? (
        <Animated.View
          pointerEvents={isCollapsed ? 'none' : 'box-none'}
          onLayout={(event) => {
            const height = Math.max(0, Math.round(event.nativeEvent.layout.height));
            if (height > 0) setExpandedHeight(height);
          }}
          style={{
            position: 'absolute',
            // Clear of the notch and the rounded corners on a phone on its side.
            left: 12 + insets.left,
            right: 12 + insets.right,
            bottom: overlayBottom,
            zIndex: 40,
            elevation: 40,
            opacity: motion.cardOpacity,
            transform: [{ translateY: motion.cardY }],
          }}
        >
          <MiniPlayerCard
            artwork={artwork}
            title={title}
            titleSuffix={titleSuffix}
            subtitle={subtitle}
            liked={miniLiked}
            likeBusy={miniLikeBusy}
            extraButton={modeButton}
            onToggleLike={likeFits && (musicTrackId || learningItemId) ? async () => {
              if (miniLikeBusy) return;
              if (!libraryAuthenticated) {
                Alert.alert(
                  tr('Liked Songs', 'Titres aimés', 'الأغاني المعجبة'),
                  preferences.appLanguage === 'ar'
                    ? 'سجّل الدخول إلى حساب كوبتك فاين لحفظ الأغاني المعجبة.'
                    : `Sign in to your Coptic Vine account to save ${isMusic ? 'Liked Songs' : 'liked learning items'}.`,
                );
                return;
              }
              // Turned at once, and back if the change fails: it waited for the server.
              const nextLiked = !miniLiked;
              setMiniLiked(nextLiked);
              setMiniLikeBusy(true);
              try {
                if (isMusic && musicTrackId) {
                  await musicService.setLiked(musicTrackId, nextLiked);
                } else if (learningItemId) {
                  await learningService.setItemLiked(learningItemKind, learningItemId, nextLiked);
                }
              } catch (cause) {
                setMiniLiked(!nextLiked);
                Alert.alert(
                  tr('Liked Songs', 'Titres aimés', 'الأغاني المعجبة'),
                  cause instanceof Error ? cause.message : `Unable to update ${isMusic ? 'Liked Songs' : 'liked learning items'}.`,
                );
              } finally {
                setMiniLikeBusy(false);
              }
            } : undefined}
            playing={isMusic ? music.playing : learning.playing}
            buffering={isMusic ? music.buffering : learning.buffering}
            accentColor={accentColor}
            onOpen={onOpen}
            onTogglePlayback={onTogglePlayback}
            onNext={onNext}
            onPrevious={onPrevious}
            onHide={hideBar}
            nextLabel={isMusic ? 'Next track' : 'Next lesson'}
          />
        </Animated.View>
      ) : null}
      {playerScreen}
    </>
  );
}

const styles = StyleSheet.create({
  fullPlayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90, elevation: 90 },
  miniVideo: { width: MINI_VIDEO.width, height: MINI_VIDEO.height, borderRadius: 8 },
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 40,
    elevation: 40,
  },
  collapsedButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gold,
    zIndex: 40,
    elevation: 40,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});
