'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import Head from 'expo-router/head';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BibleWebView, { BibleWebViewHandle } from '@/components/vine/BibleWebView';
import { BibleDisplayVerse, BibleLanguageKey, buildBibleChapterHtml } from '@/components/vine/bibleDocumentHtml';
import BibleVersePanel from '@/components/vine/ui/BibleVersePanel';
import BleedPage from '@/components/vine/ui/BleedPage';
import DocumentStatusBar from '@/components/vine/ui/DocumentStatusBar';
import FloatingReaderControls from '@/components/vine/ui/FloatingReaderControls';
import { floatingControlsLayout } from '@/components/vine/ui/floatingControls';
import LoadFailure from '@/components/vine/ui/LoadFailure';
import LoadingScreen from '@/components/vine/ui/LoadingScreen';
import { getDocumentTheme, type DocumentTheme } from '@/constants/documentThemes';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useBottomChrome, useReportDocumentTheme } from '@/context/BottomChromeContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { useBibleHighlights } from '@/hooks/useBibleHighlights';
import {
    BibleBook,
    getBibleBook,
    getBibleChapterHeaderTitle,
    getBibleChapterReferences,
    getBibleChapterKeys,
    getDisplayedChapterVerses,
    getDisplayedPsalmPreface,
    PsalmNumbering,
} from '@/utils/bibleService';
import { goBack } from '@/utils/navigation';
import { writeRichClipboard } from '@/utils/richClipboard';
import { swipeEdge, swipeStartX } from '@/utils/edgeSwipe';
import { fontScaleToPx, type AppLanguage } from '@/utils/preferencesStorage';
import { useBrowserFullscreen } from '@/utils/useBrowserFullscreen';
import { useReadingKeepAwake } from '@/utils/useReadingKeepAwake';
import { useCopticFontDataUri, useCopticItalicFontDataUri } from '@/utils/useCopticFontDataUri';
import { MOBILE_WEB_BREAKPOINT } from '@/utils/useIsMobileWeb';
import { isStylusGestureEvent } from '@/utils/isStylusGestureEvent';
import { isBibleHighlightAnchor, isBibleHighlightColor } from '@/utils/bibleHighlights';
import { BookSettingsSheet } from '@/components/vine/screens/SettingsScreen';

type LoadedBibleVerses = { requestKey: string; verses: BibleDisplayVerse[] };

const PSALMS_BOOK_KEY = 'psalms';

const SELECTOR_TEXT: Record<AppLanguage, {
  previousChapter: string;
  nextChapter: string;
  openSelector: string;
  closeSelector: string;
  bookmarkChapter: string;
  openBibleSettings: string;
  copy: string;
  removeHighlight: string;
}> = {
  en: {
    previousChapter: 'Previous chapter',
    nextChapter: 'Next chapter',
    openSelector: 'Open verse selector',
    closeSelector: 'Close verse selector',
    bookmarkChapter: 'Bookmark chapter',
    openBibleSettings: 'Open Bible settings',
    copy: 'Copy',
    removeHighlight: 'Remove',
  },
  ar: {
    previousChapter: 'الإصحاح السابق',
    nextChapter: 'الإصحاح التالي',
    openSelector: 'فتح محدد الآيات',
    closeSelector: 'إغلاق محدد الآيات',
    bookmarkChapter: 'حفظ الإصحاح',
    openBibleSettings: 'فتح إعدادات الكتاب المقدس',
    copy: 'نسخ',
    removeHighlight: 'إزالة',
  },
  fr: {
    previousChapter: 'Chapitre précédent',
    nextChapter: 'Chapitre suivant',
    openSelector: 'Ouvrir la liste des versets',
    closeSelector: 'Fermer la liste des versets',
    bookmarkChapter: 'Ajouter le chapitre aux favoris',
    openBibleSettings: 'Ouvrir les réglages de la Bible',
    copy: 'Copier',
    removeHighlight: 'Retirer',
  },
};

function getAvailableLanguages(verses: BibleDisplayVerse[], bookKey: string | null | undefined): BibleLanguageKey[] {
  const isPsalms = bookKey === PSALMS_BOOK_KEY;
  const languages: BibleLanguageKey[] = ['english'];
  // The NKJV covers only the Old Testament protocanon — nothing in the New
  // Testament, the deuterocanon, or the LXX-only chapters — so let the loaded
  // rows decide whether to offer it rather than gating on testament/book.
  if (verses.some((verse) => String(verse.englishNkjv || '').trim())) languages.push('englishNkjv');
  if (isPsalms && verses.some((verse) => String(verse.englishFromCoptic || '').trim())) languages.push('englishFromCoptic');
  // French beside the English, before the Coptic and Arabic — the same order
  // as the documents.
  if (verses.some((verse) => String(verse.french || '').trim())) languages.push('french');
  if (verses.some((verse) => String(verse.coptic || '').trim())) languages.push('coptic');
  if (verses.some((verse) => String(verse.greek || '').trim())) languages.push('greek');
  languages.push('arabic');
  if (isPsalms && verses.some((verse) => String(verse.arabicFromCoptic || '').trim())) languages.push('arabicFromCoptic');
  return languages;
}

export default function BibleChapterDocument() {
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // The chapter's controls float over its page on every platform: it is the
  // only place that names the book and chapter open.
  const floatingLayout = floatingControlsLayout({
    width: screenWidth,
    height: screenHeight,
    insets,
    wideWeb: Platform.OS === 'web' && screenWidth >= MOBILE_WEB_BREAKPOINT,
    native: Platform.OS !== 'web',
  });
  const { nowPlayingInset } = useBottomChrome();
  // Width-aware, not just Platform.OS -- a narrow mobile-web browser should
  // get the same headerless, gesture-nav UI as the native app, same as
  // ServiceDocument.tsx/lectionary/index.tsx.
  const { bookKey, chapter, numbering: numberingParam, verse: verseParam } = useLocalSearchParams<{
    bookKey: string;
    chapter: string;
    numbering?: PsalmNumbering;
    verse?: string;
  }>();
  const psalmNumbering: PsalmNumbering = numberingParam === 'masoretic' ? 'masoretic' : 'septuagint';
  const { preferences, isBookmarked, toggleBookmark, setBibleVisibleLanguages } = useReadingPreferences();
  const { user } = useAuth();
  const bibleHighlights = useBibleHighlights(bookKey, user?.id);
  // True while an Apple Pencil stroke is highlighting, so it never turns into an edge swipe.
  const [pencilGestureActive, setPencilGestureActive] = useState(false);
  const { isFullscreen, toggle: toggleFullscreen, shouldShow: shouldShowFullscreen } = useBrowserFullscreen();
  const copticFontDataUri = useCopticFontDataUri();
  const copticItalicFontDataUri = useCopticItalicFontDataUri();
  const bibleWebViewRef = useRef<BibleWebViewHandle>(null);

  const [book, setBook] = useState<BibleBook | null>(null);
  const [loadedVerses, setLoadedVerses] = useState<LoadedBibleVerses | null>(null);
  const [chapterKeys, setChapterKeys] = useState<number[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped by Retry on a failed load: a new value re-runs both loads below.
  const [reloadToken, setReloadToken] = useState(0);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  // The verse the reader was at when the Verses panel opened: outlined in it, and scrolled to.
  const [selectorVerse, setSelectorVerse] = useState<string | null>(null);
  // Book Settings open as a sheet over the chapter, never as a page. The
  // chapter stays focused and re-anchors to the reader's verse after each
  // change (the settings-signature layout effect below); its own scroll
  // reports are ignored while the sheet covers it.
  const [bookSettingsOpen, setBookSettingsOpen] = useState(false);
  const bookSettingsOpenRef = useRef(false);
  const showBookSettings = useCallback((open: boolean) => {
    bookSettingsOpenRef.current = open;
    setBookSettingsOpen(open);
  }, []);
  // A verse arrived at from a search hit or a shared link. Held in state as
  // well as in the URL so that leaving this chapter drops it -- otherwise the
  // next chapter would jump to whatever verse number the link happened to name.
  const [targetVerse, setTargetVerse] = useState<string | null>(verseParam || null);
  // The live verse is reported by both scroll and slideshow HTML. Freeze it
  // before a language/display change, not after the new HTML has reflowed.
  const currentVerseRef = useRef<string | null>(verseParam || null);
  const [restoreVerse, setRestoreVerse] = useState<string | null>(null);
  const restoreGuardRef = useRef<string | null>(null);
  const chapterIdentityRef = useRef(`${bookKey}:${chapter}:${psalmNumbering}`);
  const settingsSignature = JSON.stringify([
    preferences.bibleVisibleLanguages, preferences.fontScale, preferences.slideshowMode,
    preferences.selectText, preferences.appLanguage,
  ]);
  const settingsSignatureRef = useRef(settingsSignature);
  const latestSettingsSignatureRef = useRef(settingsSignature);
  latestSettingsSignatureRef.current = settingsSignature;
  const focusedRef = useRef(true);
  // The ref serves the scroll reports; this state drives the screen staying on.
  const [readerFocused, setReaderFocused] = useState(true);
  useReadingKeepAwake(preferences.keepScreenAwake && readerFocused);
  const blurredSnapshotRef = useRef<{ verse: string | null; signature: string } | null>(null);
  // Language buttons live INSIDE the verse selector. Keep its opening verse
  // fixed across every chapter HTML replacement until the selector closes.
  const selectorAnchorRef = useRef<string | null>(null);
  const selectorOpenRef = useRef(false);
  const openVerseSelector = useCallback(() => {
    selectorAnchorRef.current = currentVerseRef.current;
    selectorOpenRef.current = true;
    setSelectorVerse(currentVerseRef.current);
    setIsSelectorOpen(true);
  }, []);
  const closeVerseSelector = useCallback(() => {
    selectorOpenRef.current = false;
    selectorAnchorRef.current = null;
    setIsSelectorOpen(false);
  }, []);

  // This chapter can stay mounted underneath another page. Never let a
  // background iframe/WebView scroll report replace the frozen verse.
  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    setReaderFocused(true);
    const snapshot = blurredSnapshotRef.current;
    blurredSnapshotRef.current = null;
    if (snapshot && snapshot.signature !== latestSettingsSignatureRef.current && snapshot.verse) {
      currentVerseRef.current = snapshot.verse;
      restoreGuardRef.current = snapshot.verse;
      setRestoreVerse(snapshot.verse);
    }
    settingsSignatureRef.current = latestSettingsSignatureRef.current;
    return () => {
      blurredSnapshotRef.current = {
        verse: currentVerseRef.current,
        signature: latestSettingsSignatureRef.current,
      };
      focusedRef.current = false;
      setReaderFocused(false);
    };
  }, [bookKey, chapter, psalmNumbering]));

  useLayoutEffect(() => {
    if (chapterIdentityRef.current !== `${bookKey}:${chapter}:${psalmNumbering}`) {
      chapterIdentityRef.current = `${bookKey}:${chapter}:${psalmNumbering}`;
      currentVerseRef.current = verseParam || null;
      selectorAnchorRef.current = null;
      selectorOpenRef.current = false;
      restoreGuardRef.current = null;
      setRestoreVerse(null);
      settingsSignatureRef.current = settingsSignature;
      return;
    }
    if (settingsSignatureRef.current === settingsSignature) return;
    settingsSignatureRef.current = settingsSignature;
    if (!focusedRef.current || !currentVerseRef.current) return;
    restoreGuardRef.current = currentVerseRef.current;
    setRestoreVerse(currentVerseRef.current);
  }, [settingsSignature, bookKey, chapter, psalmNumbering, verseParam]);
  const enabledLanguages = preferences.bibleVisibleLanguages;

  useEffect(() => {
    if (!bookKey) return;
    getBibleBook(bookKey).then(setBook).catch((err) => setError(err.message));
    getBibleChapterKeys(bookKey, psalmNumbering).then(setChapterKeys).catch((err) => setError(err.message));
  }, [bookKey, psalmNumbering, reloadToken]);

  useEffect(() => {
    if (!bookKey || !chapter) return;
    let cancelled = false;
    const requestKey = `${bookKey}:${chapter}:${psalmNumbering}`;
    getDisplayedChapterVerses(bookKey, Number(chapter), psalmNumbering)
      .then((nextVerses) => {
        if (!cancelled) setLoadedVerses({ requestKey, verses: nextVerses });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [bookKey, chapter, psalmNumbering, reloadToken]);

  const verseRequestKey = bookKey && chapter ? `${bookKey}:${chapter}:${psalmNumbering}` : '';
  const verses = loadedVerses?.requestKey === verseRequestKey ? loadedVerses.verses : null;
  const availableLanguages = useMemo(() => getAvailableLanguages(verses || [], bookKey), [verses, bookKey]);
  const visibleLanguageKeys = useMemo(() => availableLanguages.filter((language) => enabledLanguages[language]), [availableLanguages, enabledLanguages]);
  const effectiveLanguageKeys = useMemo(
    () => (visibleLanguageKeys.length ? visibleLanguageKeys : [availableLanguages[0] || 'english']),
    [availableLanguages, visibleLanguageKeys],
  );
  const fontSize = fontScaleToPx(preferences.fontScale);
  // The page the chapter is read on (constants/documentThemes.ts). The verse
  // selector is drawn in its colours too, so it opens as part of the page.
  const theme = getDocumentTheme(preferences.documentTheme);
  // The now-playing button floating over the chapter wears its colours.
  useReportDocumentTheme(theme);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const currentChapterNumber = Number(chapter);
  const headerTitleEnglish = getBibleChapterHeaderTitle(book, null, null, bookKey, currentChapterNumber, 'en');
  const headerTitleArabic = getBibleChapterHeaderTitle(book, null, null, bookKey, currentChapterNumber, 'ar');
  const headerTitleFrench = getBibleChapterHeaderTitle(book, null, null, bookKey, currentChapterNumber, 'fr');
  const copyReference = useMemo(() => getBibleChapterReferences(book, bookKey, currentChapterNumber), [book, bookKey, currentChapterNumber]);
  const preface = book?.bookKey === 'psalms' ? getDisplayedPsalmPreface() : null;
  const selectorText = SELECTOR_TEXT[preferences.appLanguage];
  // Reading the chapter, text can always be selected — to highlight or copy
  // it, as in the Sermon Planner; slideshow pages stay untouchable.
  const effectiveSelectText = !preferences.slideshowMode;

  const chapterIndex = chapterKeys ? chapterKeys.indexOf(currentChapterNumber) : -1;
  const previousChapter = chapterIndex > 0 ? chapterKeys![chapterIndex - 1] : null;
  const nextChapter = chapterIndex >= 0 && chapterKeys && chapterIndex < chapterKeys.length - 1 ? chapterKeys[chapterIndex + 1] : null;
  const chapterListLoaded = chapterKeys !== null;
  const chapterCount = chapterKeys?.length || 0;

  const readerId = JSON.stringify([verseRequestKey, effectiveLanguageKeys, fontSize, effectiveSelectText, preferences.slideshowMode, restoreVerse, targetVerse, theme.id]);
  const chapterHtml = useMemo(() => {
    if (!verses || !copticFontDataUri || !copticItalicFontDataUri) return null;
    return buildBibleChapterHtml({
      verses,
      languageKeys: effectiveLanguageKeys,
      fontSize,
      copticFontDataUri,
      copticItalicFontDataUri,
      selectText: effectiveSelectText,
      isSlideshow: preferences.slideshowMode,
      nativeSwipeNavigation: Platform.OS !== 'web',
      preface,
      initialVerse: targetVerse,
      restoreVerse,
      readerId,
      // Now Playing is an overlay in slideshow mode. It must never shorten
      // the page or change where Bible verses split.
      bottomContentInset: preferences.slideshowMode ? 0 : nowPlayingInset,
      // The reading view runs up under the controls; a slideshow is laid out below them (verseScreen's padding).
      topContentInset: preferences.slideshowMode ? 0 : floatingLayout.contentTop,
      highlighting: effectiveSelectText,
      highlightLabels: { copy: selectorText.copy, remove: selectorText.removeHighlight },
      copyReference,
      theme,
    });
  }, [verses, effectiveLanguageKeys, fontSize, copticFontDataUri, copticItalicFontDataUri, effectiveSelectText, preferences.slideshowMode, preface, targetVerse, restoreVerse, readerId, nowPlayingInset, selectorText, copyReference, theme, floatingLayout.contentTop]);

  const bookmarkId = `bible:${book?.testament || ''}:${bookKey}:${chapter}`;
  const bookmarked = isBookmarked(bookmarkId);

  const goToChapter = useCallback(
    (targetChapter: number | null) => {
      if (targetChapter === null) return;
      closeVerseSelector();
      setTargetVerse(null);
      currentVerseRef.current = null;
      restoreGuardRef.current = null;
      setRestoreVerse(null);
      router.setParams({ chapter: String(targetChapter), verse: '' });
    },
    [router, closeVerseSelector],
  );

  function selectVerse(verse: number | string) {
    closeVerseSelector();
    currentVerseRef.current = String(verse);
    restoreGuardRef.current = null;
    setRestoreVerse(String(verse));
    bibleWebViewRef.current?.selectVerse(verse);
  }

  function toggleLanguage(language: BibleLanguageKey) {
    const next = { ...enabledLanguages, [language]: !enabledLanguages[language] };
    const activeCount = availableLanguages.filter((item) => next[item]).length;
    if (activeCount) {
      // A language toggle must use the ORIGINAL verse from opening this
      // selector, not a transient scroll report from the reloading chapter.
      const anchor = selectorAnchorRef.current || currentVerseRef.current;
      if (anchor) {
        selectorAnchorRef.current = anchor;
        currentVerseRef.current = anchor;
        restoreGuardRef.current = anchor;
        setRestoreVerse(anchor);
      }
      setBibleVisibleLanguages(next);
    }
  }

  const goBackALevel = useCallback(() => {
    const chapterGridFallback: Href = bookKey
      ? {
          pathname: '/bible/[bookKey]',
          params: { bookKey },
        }
      : '/bible';
    const testamentFallback: Href = book?.testament
      ? {
          pathname: '/bible/[bookKey]',
          params: { bookKey: book.testament },
        }
      : '/bible';

    const fallbackHref: Href = !chapterListLoaded ? '/bible' : chapterCount === 1 ? testamentFallback : chapterGridFallback;
    goBack(router, fallbackHref);
  }, [router, bookKey, book, chapterListLoaded, chapterCount]);

  // Only a swipe from the very edge goes back or opens the verses
  // (utils/edgeSwipe.ts), measured from where it began.
  const swipeTakenFromXRef = useRef(0);
  const gesturePanResponder = useMemo(() => {
    // eslint-disable-next-line react-hooks/refs -- refs are read in gesture callbacks, not during render
    return PanResponder.create({
      onMoveShouldSetPanResponder: (event, gestureState) => {
        if (isStylusGestureEvent(event) || pencilGestureActive || bookSettingsOpen) return false;
        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2;
        if (!isHorizontal) return false;
        const startX = swipeStartX(gestureState);
        const edge = swipeEdge(startX, screenWidth);
        const isBackSwipe = edge === 'left' && gestureState.dx > 24;
        const isSelectorSwipe = !isSelectorOpen && edge === 'right' && gestureState.dx < -24;
        if (isBackSwipe || isSelectorSwipe) swipeTakenFromXRef.current = startX;
        return isBackSwipe || isSelectorSwipe;
      },
      onPanResponderRelease: (event, gestureState) => {
        if (isStylusGestureEvent(event) || pencilGestureActive) return;
        const takenFromX = swipeTakenFromXRef.current;
        const travelled = gestureState.moveX - takenFromX;
        const edge = swipeEdge(takenFromX, screenWidth);
        if (edge === 'left' && travelled > 60) {
          goBackALevel();
        } else if (!isSelectorOpen && edge === 'right' && travelled < -36) {
          openVerseSelector();
        }
      },
    });
  }, [goBackALevel, openVerseSelector, screenWidth, isSelectorOpen, pencilGestureActive, bookSettingsOpen]);

  return (
    <BleedPage
      edges={['bottom']}
      style={[styles.safeArea, { backgroundColor: theme.colors.page }]}
      header={(
        // Floating over the page, in the app as on the web: the chapter's
        // controls are the only place that says which book and chapter is
        // open. Its title opens the verse list, as the list button does; the
        // capsules keep clear of the notch.
        <FloatingReaderControls
          theme={theme}
          reader="bible"
          layout={floatingLayout}
          onBack={goBackALevel}
          title={{ english: headerTitleEnglish, arabic: headerTitleArabic, french: headerTitleFrench }}
          onTitlePress={openVerseSelector}
          titleAccessibilityLabel={selectorText.openSelector}
          actions={[
            ...(shouldShowFullscreen && Platform.OS === 'web' && screenWidth >= MOBILE_WEB_BREAKPOINT
              ? [{
                icon: isFullscreen ? 'close-fullscreen' as const : 'open-in-full' as const,
                accessibilityLabel: isFullscreen ? 'Exit full screen' : 'Enter full screen',
                onPress: toggleFullscreen,
              }]
              : []),
            { icon: 'list-outline' as const, accessibilityLabel: selectorText.openSelector, onPress: openVerseSelector },
          ]}
        />
      )}
      {...(Platform.OS !== 'web' ? gesturePanResponder.panHandlers : {})}
    >
      {/* The page runs up under the status bar; on a light one its clock and battery turn dark. */}
      <DocumentStatusBar theme={theme} hidden={floatingLayout.hideStatusBar} />
      <Head>
        <title>{`Coptic Vine ${headerTitleEnglish || 'Bible'}`}</title>
      </Head>
      {error ? (
        <LoadFailure
          error={error}
          onRetry={() => {
            setError(null);
            setReloadToken((token) => token + 1);
          }}
        />
      ) : !chapterHtml ? (
        <LoadingScreen belowHeader />
      ) : (
        <View style={[styles.verseScreen, preferences.slideshowMode && { paddingTop: floatingLayout.contentTop }]}>
          <BibleWebView
            ref={bibleWebViewRef}
            html={chapterHtml}
            backgroundColor={theme.colors.page}
            scrollEnabled={!preferences.slideshowMode}
            restoreVerse={restoreVerse}
            selectText={effectiveSelectText}
            highlights={bibleHighlights.highlights}
            onAction={(action) => {
              if (action.type === 'biblePencilGesture') {
                setPencilGestureActive(Boolean(action.active));
                return;
              }
              if (action.type === 'createBibleHighlights' || action.type === 'recolorBibleHighlight' || action.type === 'removeBibleHighlight') {
                // Only from the chapter on screen now, never a page it replaced.
                if (action.readerId !== readerId) return;
                const color = isBibleHighlightColor(action.color) ? action.color : 'gold';
                const style = action.style === 'underline' ? 'underline' : undefined;
                if (action.type === 'createBibleHighlights') {
                  // One highlight, a verse at a time, taking in the ones it covers.
                  bibleHighlights.createHighlightGroup({
                    anchors: (action.anchors || []).filter(isBibleHighlightAnchor),
                    color,
                    style,
                    replaces: Array.isArray(action.replaces) ? action.replaces.filter((id): id is string => typeof id === 'string') : [],
                  });
                } else if (action.highlightId && action.type === 'recolorBibleHighlight') {
                  bibleHighlights.setHighlightColor(action.highlightId, color, style ?? null);
                } else if (action.highlightId) {
                  bibleHighlights.deleteHighlight(action.highlightId);
                }
                return;
              }
              if (action.type === 'copyBibleText') {
                // The page's own copy command was refused; the app's
                // clipboard does it instead.
                if (action.text) void writeRichClipboard(action.text, action.html);
                return;
              }
              if (action.type === 'currentVerse' && action.verse) {
                if (action.readerId !== readerId || !focusedRef.current || selectorOpenRef.current || bookSettingsOpenRef.current) return;
                if (restoreGuardRef.current && restoreGuardRef.current !== action.verse) return;
                restoreGuardRef.current = null;
                currentVerseRef.current = action.verse;
              } else if (action.type === 'openSelector') openVerseSelector();
              else if (action.type === 'previousLevel') goBackALevel();
            }}
          />

          <BibleVersePanel
            visible={isSelectorOpen}
            onClose={closeVerseSelector}
            theme={theme}
            appLanguage={preferences.appLanguage}
            text={selectorText}
            title={{ english: headerTitleEnglish, arabic: headerTitleArabic, french: headerTitleFrench }}
            bookKey={bookKey}
            chapterNumber={currentChapterNumber}
            chapterCount={chapterCount}
            previousChapter={previousChapter}
            nextChapter={nextChapter}
            onGoToChapter={goToChapter}
            psalmNumbering={psalmNumbering}
            verses={verses || []}
            availableLanguages={availableLanguages}
            enabledLanguages={enabledLanguages}
            onToggleLanguage={toggleLanguage}
            currentVerse={selectorVerse}
            highlights={bibleHighlights.highlights}
            onSelectVerse={selectVerse}
            bookmarked={bookmarked}
            onToggleBookmark={() => toggleBookmark(bookmarkId)}
            onOpenSettings={() => {
              const anchor = selectorAnchorRef.current || currentVerseRef.current;
              closeVerseSelector();
              if (anchor) currentVerseRef.current = anchor;
              showBookSettings(true);
            }}
          />
        </View>
      )}
      <BookSettingsSheet inDocument visible={bookSettingsOpen} onClose={() => showBookSettings(false)} />
    </BleedPage>
  );
}

function createStyles(theme: DocumentTheme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.colors.page },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    loading: { fontFamily: TYPOGRAPHY.body, color: COLORS.muted, fontSize: 17 },
    error: { fontFamily: TYPOGRAPHY.body, color: COLORS.priest, fontSize: 17 },
    verseScreen: { flex: 1 },
  });
}
