import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Href, Stack, useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { PanResponder, type PanResponderGestureState, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DocumentPillBar from '../ui/DocumentPillBar';
import DocumentTopBar from '../ui/DocumentTopBar';
import CalendarSheet from '../ui/CalendarSheet';
import DocumentDateBar from '../ui/DocumentDateBar';
import InterpretationPicker from '../ui/InterpretationPicker';
import { INTERPRETATION_CHOOSER_SECTION_ID, INTERPRETATION_CHOOSER_TITLE, withInterpretationChoices } from '../../../utils/kiahkInterpretations';
import ContentSelectorDrawer from '../ui/ContentSelectorDrawer';
import SermonPlannerDrawer from '../ui/SermonPlannerDrawer';
import LoadFailure from '../ui/LoadFailure';
import LoadingScreen from '../ui/LoadingScreen';
import DocumentSurface, { type SlideJumpRequest } from '../DocumentSurface';
import {
  ANTIPHONARY_GROUPS, findAntiphonaryIntroduction, getActiveAntiphonaryGroup, getVerseTune,
  type AntiphonaryGroup, type AntiphonaryTune,
} from '../antiphonaryNavigation';
import { DocumentAction, DocumentSection, DocumentWebViewHandle } from '../DocumentWebView';
import { AntiphonaryModal, SubdocumentModal } from './DocumentModal';
import { BookSettingsSheet } from './SettingsScreen';
import { documentOrnamentColor } from '../../../constants/documentOrnaments';
import { getDocumentTheme } from '../../../constants/documentThemes';
import { bookmarkKeyFor, HYPERLINK_TARGETS } from '../../../constants/manifest';
import { getDayThemeKey, type SeasonThemeKey } from '../../../constants/seasonAppearance';
import { COLORS } from '../../../constants/theme';
import { useReadingPreferences } from '../../../context/ReadingPreferencesContext';
import { useCalendar } from '../../../context/CalendarContext';
import { useAuth } from '../../../context/AuthContext';
import { useSermonPlanner } from '../../../hooks/useSermonPlanner';
import { useBrowserFullscreen } from '../../../utils/useBrowserFullscreen';
import { useReadingKeepAwake } from '../../../utils/useReadingKeepAwake';
import { findReadingSectionId, parseReadingParam } from '../../../utils/documentReadings';
import { hydrateSupabaseServiceHymn } from '../../../utils/hymnLibrary';
import { getEpistleConditionFlags } from '../../../utils/readingsService';
import { getDayOverview } from '../../../utils/calendarService';
import { withDocumentOrnaments } from '../../../utils/documentOrnaments';
import { getSectionSelectorTitle } from '../sectionSelectorTitle';
import {
  captureDocumentRestore, clearPendingDocumentRestore, forgetDocumentPosition, getLastDocumentPosition,
  getPendingDocumentRestore, markPendingDocumentRestoresDirty, openDocumentPosition, setLastDocumentPosition,
} from '../../../utils/lastDocumentPosition';
import {
  resolveDocumentRestore, type DocumentRestoreRequest, verseIndexFromId, visibleDocumentSectionRefs, type DocumentSectionRef,
} from '../../../utils/sectionRestore';
import { goBack } from '../../../utils/navigation';
import { getServiceWeekdayConditionDate } from '../../../utils/serviceConditionDates';
import { isStylusGestureEvent } from '../../../utils/isStylusGestureEvent';
import { swipeEdge, swipeStartX } from '../../../utils/edgeSwipe';
import { getUserConditionFlags } from '../../../utils/userConditionFlags';
import {
  getSermonPlannerReferences,
  getSermonHighlightVerseReferences,
  isSermonHighlightAnchor,
  isSermonHighlightColor,
} from '../../../utils/sermonPlanner';
import { groupHighlights } from '../../../utils/highlightGroups';

interface ServiceDocumentProps {
  schema: string;
  table: string;
  title: string;
  arabic: string;
  /** The menu entry's French name, where it has one. */
  french?: string;
  /** Extra condition flags forced true for this entry point (e.g. Vespers/Matins on the shared raising_of_incense document). */
  extraContext?: Record<string, boolean>;
  /** Manifest id of the menu entry this document was opened from. Only needed where several entries open the SAME schema/table (Vespers vs Matins), so a bookmark can record which one it was made in — see bookmarkKeyFor. */
  entryId?: string;
  /** Where "back" should land when there's no navigation history to pop (direct deep link, page reload). */
  backHref: Href;
  /** A HYPERLINK_TARGETS key to link on to after the document's own content (e.g. each Holy Week hour's next hour), for documents shared by several entries whose next step differs. */
  appendHyperlinkKey?: string;
  /** The season the document's ornaments always wear, whatever day the calendar is on: Holy Week's own services. Otherwise the season of the day being prayed. */
  ornamentSeason?: SeasonThemeKey;
}

/** Appends a hyperlink button to the next service, labelled with that service's own name, after a hydrated document. The same section shape hymnLibrary builds for an order row whose item_type is Hyperlink. */
/** The documents read for a day, which carry a date bar: the Lectionary's three services and the Sermon Planner. */
const DATE_BAR_TABLES = new Set(['lectionary_vespers', 'lectionary_matins', 'lectionary_liturgy', 'sermon_planner']);

function withAppendedHyperlink(sections: DocumentSection[], hyperlinkKey?: string): DocumentSection[] {
  const destination = hyperlinkKey ? HYPERLINK_TARGETS[hyperlinkKey] : undefined;
  if (!hyperlinkKey || !destination) return sections;
  return [
    ...sections,
    {
      id: `next-${hyperlinkKey}`,
      title: { english: destination.title, arabic: destination.arabic, french: destination.french },
      verses: [],
      isHyperlinkButton: true,
      hyperlinkKey,
      alternateEvery: null,
      forceWhiteVerses: true,
    },
  ];
}

interface SubdocumentModalTarget {
  title: { english: string; arabic: string; french?: string };
  sections: DocumentSection[];
  subdocumentKey?: string;
  collapseMemoryScope: string;
  /** Id of the section holding the open-button this subdocument was reached through — where the reader is put back when it closes. */
  triggerSectionId?: string;
}

interface AntiphonaryModalTarget {
  sections: DocumentSection[];
  collapseMemoryScope: string;
}

/**
 * Generic document reader — ported from HymnDisplayScreen.js. Web ALWAYS
 * keeps the Header (fullscreen toggle + content-list icon), on every device
 * width -- unlike the native app, which shows no header at all and is
 * gesture-only navigation (right-edge swipe-left opens the Content
 * selector, left-edge swipe-right goes back). This is a deliberate
 * difference, not a gap to close: the header is web's only affordance for
 * "how do I get back/open the content list" since a phone browser has no
 * native swipe-back gesture of its own to conflict with. The swipe gestures
 * are native-only: web always uses the visible header and never swipe-exits.
 */
export default function ServiceDocument({ schema, table, title, arabic, french, extraContext, entryId, backHref, appendHyperlinkKey, ornamentSeason: fixedOrnamentSeason }: ServiceDocumentProps) {
  const router = useRouter();
  const { user } = useAuth();
  const {
    preferences,
    isBookmarked,
    toggleBookmark,
    toggleBishopPresent,
    toggleCopticGospelRite,
    toggleSermonPlannerLanguage,
  } = useReadingPreferences();
  const { effectiveDate, vespersEffectiveDate } = useCalendar();
  const isSermonPlanner = schema === 'liturgy' && table === 'sermon_planner';
  // Read for a day, and often for another day than today: the day is changed
  // from a bar across the top (DocumentDateBar) rather than the content list.
  const showDateBar = schema === 'liturgy' && DATE_BAR_TABLES.has(table);
  // The Antiphonary read as a book of its own keeps the Introduction/Adam/Vatos
  // pills it has when a service opens it.
  const isAntiphonary = schema === 'psalmody' && table === 'antiphonary';
  const documentPreferences = useMemo(() => {
    if (!isSermonPlanner) return preferences;
    return {
      ...preferences,
      visibleLanguages: {
        ...preferences.visibleLanguages,
        english: preferences.sermonPlannerVisibleLanguages.english,
        coptic: false,
        copticRecitedPrayers: false,
        arabic: preferences.sermonPlannerVisibleLanguages.arabic,
      },
    };
  }, [isSermonPlanner, preferences]);
  const sermonServiceDate = effectiveDate.toISOString().slice(0, 10);
  const sermonPlanner = useSermonPlanner(
    `${schema}.${table}`,
    sermonServiceDate,
    user?.id,
    isSermonPlanner,
  );
  const weekdayConditionDate = useMemo(
    () =>
      getServiceWeekdayConditionDate({
        schema,
        table,
        extraContext,
        effectiveDate,
        vespersEffectiveDate,
      }),
    [schema, table, extraContext, effectiveDate, vespersEffectiveDate],
  );
  const { isFullscreen, toggle: toggleFullscreen, shouldShow: shouldShowFullscreen } = useBrowserFullscreen();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isMobileDocument = Platform.OS !== 'web';
  // The page the document is read on (constants/documentThemes.ts); the
  // screen around the reader is painted with it too, so the page runs edge
  // to edge.
  const documentTheme = getDocumentTheme(preferences.documentTheme);
  // Qualified by the entry point only where the document is reachable from
  // more than one, so bookmarks for every other document keep their existing
  // ids. Without this, a bookmark made in Vespers and one made in Matins were
  // the same id, and the bookmarks list labelled both with whichever entry it
  // had indexed last.
  // Memoized rather than called bare: bookmarkId feeds memoized values below,
  // and the React Compiler cannot see through a plain call here, so it bails
  // out of preserving those memos entirely.
  const bookmarkId = useMemo(() => bookmarkKeyFor(schema, table, entryId), [schema, table, entryId]);
  // Navigating to Settings and back unmounts this screen (React Navigation
  // doesn't keep off-screen web routes mounted), which would otherwise wipe
  // currentSectionId/selectedSlideSectionId right when "bring me back to
  // where I was" matters most — so the last-known position for this exact
  // document is also kept in a plain module-level store that survives the
  // remount, keyed on whichever forced condition flags select this entry
  // point (e.g. Vespers vs. Matins both open raising_of_incense).
  const documentPositionKey = `${bookmarkId}:${JSON.stringify(extraContext || {})}`;

  // Settings that are really condition flags, raised alongside the date's own.
  //
  // Hand-picked saint hymns ride in under their full child token
  // (`StMark:VOC`); the bare `StMark` is never raised, which is what keeps one
  // chosen hymn from pulling in the saint's whole set while the calendar
  // raising `StMark` on his feast still satisfies all of them (see
  // isConditionAtomSatisfied in conditionEngine.js). Monastery is the one
  // gating the Prayer of the Veil.
  const userConditionFlags = useMemo(
    () => getUserConditionFlags(preferences),
    [preferences.selectedSaintHymns, preferences.inMonastery, preferences.saintPsalies],
  );

  const [hydratedSections, setHydratedSections] = useState<DocumentSection[] | null>(null);
  // The document as the reader has chosen it: the Kiahk Theotokias'
  // interpretations they did not choose taken out, and the button to choose
  // them set in (utils/kiahkInterpretations.ts). A choice made here changes
  // the document at once, with no new hydration.
  const selectedInterpretations = preferences.selectedInterpretations;
  const sections = useMemo(
    () => hydratedSections && withInterpretationChoices<DocumentSection>(
      hydratedSections,
      selectedInterpretations || [],
      () => ({
        id: INTERPRETATION_CHOOSER_SECTION_ID,
        hymnKey: 'selectInterpretations',
        title: { ...INTERPRETATION_CHOOSER_TITLE },
        verses: [],
        isInterpretationChooserButton: true,
      }),
    ),
    [hydratedSections, selectedInterpretations],
  );
  // The season of the day being prayed, which the ornaments on Night and Paper
  // are drawn in; read with the document so it arrives with it.
  const [ornamentSeason, setOrnamentSeason] = useState<SeasonThemeKey | null>(null);
  // An old hydration must not briefly render as though it belongs to a new
  // date/condition set while the replacement document is being fetched.
  const conditionsKey = JSON.stringify([schema, table, effectiveDate, weekdayConditionDate, extraContext, userConditionFlags]);
  const [loadedConditionsKey, setLoadedConditionsKey] = useState<string | null>(null);
  const readySections = loadedConditionsKey === conditionsKey ? sections : null;
  const restoreSettingsSignature = JSON.stringify([
    documentPreferences.visibleLanguages, preferences.fontScale, preferences.orientationMode,
    preferences.selectText, preferences.slideshowMode, preferences.displayComments,
    preferences.displaySilentPrayers, preferences.displayNowPlayingBar,
    preferences.bishopPresent, preferences.copticGospelRite, preferences.inMonastery, preferences.saintPsalies,
    preferences.selectedSaintHymns, preferences.selectedInterpretations, preferences.appLanguage, preferences.documentTheme, effectiveDate, vespersEffectiveDate,
  ]);
  const [readerFocused, setReaderFocused] = useState(true);
  // A liturgy runs for hours: the screen stays on while this is the screen being read.
  useReadingKeepAwake(preferences.keepScreenAwake && readerFocused);
  const [restoreRequest, setRestoreRequest] = useState<DocumentRestoreRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped by Retry on a failed load: a new value re-runs the hydration below.
  const [reloadToken, setReloadToken] = useState(0);
  // In-document toggle button state, rendered wherever GOSPEL_RITE is spliced in.
  const copticGospelRite = preferences.copticGospelRite;
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  // Book Settings open as a sheet over the document, never as a page: the
  // document stays focused and follows each change live, re-anchoring to the
  // hymn the reader is on (see the settings-signature layout effect below).
  const [settingsOpen, setSettingsOpen] = useState(false);
  // The choice of the Kiahk Theotokias' interpretations, opened from its
  // button in the document or its row in the content list.
  const [interpretationsOpen, setInterpretationsOpen] = useState(false);
  const [activeSermonHighlightId, setActiveSermonHighlightId] = useState<string | null>(null);
  // Open: its position is remembered while it stays open -- through Settings,
  // the Calendar, the Seasons, a date or a setting changed -- and forgotten
  // the moment it is left (below), so it next opens at the top.
  useState(() => openDocumentPosition(documentPositionKey));
  // Set while a page this document opened covers it (the Seasons), which may
  // unmount it on the web; cleared when it is in front again. Unmounted any
  // other way, it was left.
  const coveredRef = useRef(false);
  useFocusEffect(useCallback(() => {
    coveredRef.current = false;
  }, []));
  useEffect(() => () => {
    if (!coveredRef.current) forgetDocumentPosition(documentPositionKey);
  }, [documentPositionKey]);
  // Taken off the stack -- even from under the Seasons, left for elsewhere --
  // it was left too.
  const navigation = useNavigation();
  useEffect(
    () => navigation.addListener('beforeRemove', () => forgetDocumentPosition(documentPositionKey)),
    [navigation, documentPositionKey],
  );
  // Seeded from the same module-level store selectedSlideSectionId is (see
  // below): changing a setting can unmount this screen and mount it again,
  // and starting back at null would leave the content selector with nothing
  // highlighted and nowhere to scroll to until the reader got around to
  // reporting its restored position.
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(
    () => getLastDocumentPosition(documentPositionKey) ?? null,
  );
  // Verse-granular position within currentSectionId, reported by the WebView
  // reader's scroll-tracking script — used to re-anchor scroll position
  // after a rotation/window-resize reflows the layout (see the effect below).
  // Slideshow mode doesn't need this: SlideshowContainer already restores
  // its own verse-level position internally whenever it repaginates.
  const [currentVerseId, setCurrentVerseId] = useState<string | null>(null);
  // The same verse as its index in the hymn's own rows, reported by both
  // renderers (the scrolling reader names it `<section>::v<index>`, the
  // slideshow by its item): what every change -- a setting, the calendar, a
  // mode switch -- brings the reader back to. Read through the ref where a
  // snapshot is taken outside a render.
  const [currentVerseIndex, setCurrentVerseIndex] = useState<number | null>(null);
  const currentVerseIndexRef = useRef<number | null>(null);
  // The Antiphonary only: the tune of the verse being read, for its pills.
  const [currentTune, setCurrentTune] = useState<AntiphonaryTune | null>(null);
  const [slideJumpRequest, setSlideJumpRequest] = useState<SlideJumpRequest | null>(null);
  const currentSectionIdRef = useRef(currentSectionId);
  // Seeded synchronously (not via an effect) from the module-level store: a
  // child effect inside SlideshowContainer reports "slide 0" the instant it
  // mounts, which — if this started out undefined and only got set a render
  // later by an effect here — would race ahead and persist that wrong "slide
  // 0" over the real remembered position before this ever got a chance to
  // apply it.
  const [selectedSlideSectionId, setSelectedSlideSectionId] = useState<string | undefined>(() =>
    getLastDocumentPosition(documentPositionKey),
  );
  const [subdocumentModal, setSubdocumentModal] = useState<SubdocumentModalTarget | null>(null);
  const [antiphonaryModal, setAntiphonaryModal] = useState<AntiphonaryModalTarget | null>(null);
  const documentRef = useRef<DocumentWebViewHandle>(null);
  const hasRestoredScrollPositionRef = useRef(false);
  // A freshly (re)mounted WebView's own scroll-tracking script starts
  // reporting "currentSection" as soon as content paints -- for the very
  // first frame or two that's just wherever it naturally loaded (the top),
  // not wherever an explicit scrollToSection restore is about to send it.
  // Whenever a restore is in flight (initial load, a mode switch, the
  // gospel-rite/dimension-change re-anchors), this holds the section it's
  // headed for; handleAction's 'currentSection' case ignores any report that
  // doesn't match it yet, so that premature "still at the top" reading can
  // never overwrite the real remembered position.
  const pendingScrollRestoreSectionIdRef = useRef<string | null>(null);
  // Navigating to Settings/Calendar keeps this screen mounted behind the new
  // one (see the module comment at the top of this file), and the layout
  // shift that transition causes is enough to make the still-live WebView's
  // reading-line tracker briefly misfire -- observed landing on the very
  // last section in the document, as if the reflow had collapsed its scroll
  // range out from under it. Set the moment either navigation is triggered;
  // cleared after a few seconds (long enough for the transition, and its
  // knock-on layout settling, to be over) rather than on any particular
  // "we're back and focused" event, since this screen has no such signal.
  const navigatingAwayRef = useRef(Boolean(getPendingDocumentRestore(documentPositionKey)));
  const lastSettingsSignatureRef = useRef(restoreSettingsSignature);
  const latestSettingsSignatureRef = useRef(restoreSettingsSignature);
  latestSettingsSignatureRef.current = restoreSettingsSignature;
  const latestSectionOrderRef = useRef<DocumentSectionRef[]>([]);
  if (readySections) latestSectionOrderRef.current = readySections.map(section => ({ id: section.id, hymnKey: section.hymnKey ?? null }));
  // Blur is authoritative; never trust background scroll/page callbacks while
  // Settings or Calendar is covering the reader, even on a slow device.
  useFocusEffect(useCallback(() => {
    setReaderFocused(true);
    return () => {
      // Covers alternate routes to Settings/Calendar as well as the in-book
      // selector. Capturing on blur is harmless if no settings change occurs.
      captureDocumentRestore(
        documentPositionKey,
        currentSectionIdRef.current ?? getLastDocumentPosition(documentPositionKey),
        latestSectionOrderRef.current,
        latestSettingsSignatureRef.current,
        currentVerseIndexRef.current,
      );
      navigatingAwayRef.current = true;
      setReaderFocused(false);
    };
  }, [documentPositionKey]));

  // Also handle preference changes made from the in-document controls and
  // automatic live-calendar rollover while this screen itself is focused.
  // This layout effect runs before a new WebView can report a reflowed position.
  //
  // The sections captured are the ones read before the change: a change that
  // re-reads the document has not yet replaced them, but one made here (the
  // interpretations) already has, in the render that changed the signature.
  const previousSectionsRef = useRef<DocumentSection[] | null>(null);
  useLayoutEffect(() => {
    const previousSignature = lastSettingsSignatureRef.current;
    const changed = previousSignature !== restoreSettingsSignature;
    lastSettingsSignatureRef.current = restoreSettingsSignature;
    const before = previousSectionsRef.current ?? sections;
    previousSectionsRef.current = sections;
    if (!changed || !readerFocused || !before) return;
    captureDocumentRestore(
      documentPositionKey,
      currentSectionIdRef.current ?? getLastDocumentPosition(documentPositionKey),
      before.map(section => ({ id: section.id, hymnKey: section.hymnKey ?? null })),
      previousSignature,
      currentVerseIndexRef.current,
    );
    markPendingDocumentRestoresDirty();
  }, [restoreSettingsSignature, readerFocused, sections, documentPositionKey]);

  const bookmarked = isBookmarked(bookmarkId);
  const sermonReferences = useMemo(
    () => isSermonPlanner && readySections ? getSermonPlannerReferences(readySections) : [],
    [isSermonPlanner, readySections],
  );
  const sermonVerseReferences = useMemo(
    () => isSermonPlanner && readySections ? getSermonHighlightVerseReferences(readySections) : {},
    [isSermonPlanner, readySections],
  );
  // ?sub=SUBDOCUMENT_KEY in the URL (written by bookmarks.tsx when navigating
  // to a saved subdocument bookmark) and ?reading=Psalm (lectionaryHref, from
  // a list of the day's readings) — each acted on once, when sections first load.
  const { sub: initialSubdocumentKey, reading: openAtReading } = useLocalSearchParams<{ sub?: string; reading?: string }>();
  // Hyperlinks replace only the source document. The route underneath is still
  // the place from which that source document was opened (its submenu,
  // Bookmarks, and so on), so every exit should pop back to that existing route.
  // The fallback still handles a direct deep link with no history.
  const leaveDocument = useCallback(() => {
    goBack(router, backHref);
  }, [router, backHref]);
  const initialSubOpenedRef = useRef(false);
  const openedAtReadingRef = useRef(false);
  // What the reader's settings show, for the decision made as a document
  // arrives (below): those settings are deliberately not what re-hydrates it.
  const readingVisibilityRef = useRef({ displaySilentPrayers: preferences.displaySilentPrayers, bishopPresent: preferences.bishopPresent, copticGospelRite });
  useEffect(() => {
    readingVisibilityRef.current = { displaySilentPrayers: preferences.displaySilentPrayers, bishopPresent: preferences.bishopPresent, copticGospelRite };
  }, [preferences.displaySilentPrayers, preferences.bishopPresent, copticGospelRite]);

  useEffect(() => {
    let cancelled = false;
    setHydratedSections(null);
    setLoadedConditionsKey(null);
    setError(null);
    hasRestoredScrollPositionRef.current = false;

    // BishopPresent is always hydrated as if a bishop *could* be present —
    // hydrateWithFlags evaluates every condition both ways and tags the
    // result (verse.bishopOnly / verse.priestOnly), so the document already
    // contains both variants. Toggling the Bishop Present preference is then
    // a pure client-side re-render (DocumentSurface/documentHtml.ts filter by
    // it directly) and never needs to re-fetch — that's why it's fixed here
    // instead of reading preferences.bishopPresent, and not in the deps below.
    // CopticGospelRite gets the exact same treatment, but only for GOSPEL_RITE
    // splices specifically (see hydrateWholeTableInlineNested in
    // hymnLibrary.js) — the value passed here is irrelevant since that
    // function always hydrates both states itself, so it's fixed too and
    // the persisted copticGospelRite preference isn't a dep below either.
    //
    // The Liturgy of the Word, Lectionary Liturgy, and Sermon Planner reference
    // the readings schema's Pauline/Catholic Epistle inline splices. These need today's
    // PaulineEpistleRomans/CatholicEpistle1Peter-style condition flags (see
    // getEpistleConditionFlags) to pick the right introduction line, resolved
    // here and merged into extraContext before hydrating.
    const needsEpistleFlags =
      (schema === 'liturgy' && table === 'liturgy_of_the_word') ||
      (schema === 'liturgy' && table === 'lectionary_liturgy') ||
      (schema === 'liturgy' && table === 'sermon_planner');
    const epistleFlagsPromise = needsEpistleFlags ? getEpistleConditionFlags(effectiveDate) : Promise.resolve({});
    const seasonPromise: Promise<SeasonThemeKey | null> = fixedOrnamentSeason
      ? Promise.resolve(fixedOrnamentSeason)
      : getDayOverview(effectiveDate.toISOString().slice(0, 10))
        .then((overview) => getDayThemeKey(overview?.indicatorKey, overview?.activeKeys))
        .catch(() => null);

    Promise.all([
      epistleFlagsPromise.then((epistleFlags) =>
        hydrateSupabaseServiceHymn(
          schema,
          table,
          effectiveDate,
          // Explicit Book Settings choices (including Monastery) take priority
          // over entry-point context, so no route can silently override the toggle.
          { BishopPresent: true, CopticGospelRite: false, ...epistleFlags, ...extraContext, ...userConditionFlags },
          weekdayConditionDate,
        ),
      ),
      seasonPromise,
    ])
      .then(([result, season]) => {
        if (!cancelled) {
          const hydrated = withAppendedHyperlink(result as DocumentSection[], appendHyperlinkKey);
          // A service opens on its own name and closes on the Medallion; the
          // Sermon Planner is a working page, not a service, and stays bare.
          const newSections = isSermonPlanner ? hydrated : withDocumentOrnaments(hydrated, { english: title, arabic, french });
          setOrnamentSeason(season);
          setHydratedSections(newSections);
          setLoadedConditionsKey(conditionsKey);
          // Opened at one of its readings (?reading=Psalm, see lectionaryHref):
          // the document starts at that reading rather than where it was last
          // left. Decided here, with the sections, so the reader mounts already
          // knowing where to land (initialScrollSectionId, selectedSectionId).
          // Once only — a later hydration (the date or a setting changing)
          // leaves the reader where they are — and not when coming back from
          // Settings or the Calendar, which restores their place instead (the
          // pending restore the effect below consumes).
          const readingTarget = openedAtReadingRef.current ? null : parseReadingParam(openAtReading);
          if (readingTarget) {
            openedAtReadingRef.current = true;
            const sectionId = getPendingDocumentRestore(documentPositionKey)
              ? null
              : findReadingSectionId(newSections, readingTarget, readingVisibilityRef.current);
            if (sectionId) {
              // The reader's own first report, from before it lands there,
              // must not overwrite it (see pendingScrollRestoreSectionIdRef).
              pendingScrollRestoreSectionIdRef.current = sectionId;
              setTimeout(() => {
                if (pendingScrollRestoreSectionIdRef.current === sectionId) {
                  pendingScrollRestoreSectionIdRef.current = null;
                }
              }, 4000);
              currentSectionIdRef.current = sectionId;
              setCurrentSectionId(sectionId);
              setSelectedSlideSectionId(sectionId);
              setLastDocumentPosition(documentPositionKey, sectionId);
            }
          }
          // If a subdocument is open, refresh its sections from the new hydration
          // so date/settings changes update the subdocument content without closing it.
          setSubdocumentModal((current) => {
            if (!current?.subdocumentKey) return current;
            const trigger = newSections.find((s) => s.subdocumentKey === current.subdocumentKey && s.subdocumentSections);
            return trigger ? { ...current, sections: trigger.subdocumentSections! } : current;
          });
          // The Antiphonary is the most date-dependent subdocument there is
          // (its whole content is the day's commemoration), and it stays open
          // across a re-hydration now like every other modal, so it has to be
          // refreshed the same way rather than left showing the old day.
          setAntiphonaryModal((current) => {
            if (!current) return current;
            const trigger = newSections.find((s) => s.isAntiphonaryButton && s.subdocumentSections);
            return trigger ? { ...current, sections: trigger.subdocumentSections! } : current;
          });
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Failed to load this service.');
      });

    return () => {
      cancelled = true;
    };
  }, [schema, table, title, arabic, french, isSermonPlanner, fixedOrnamentSeason, effectiveDate, weekdayConditionDate, extraContext, userConditionFlags, conditionsKey, appendHyperlinkKey, reloadToken, openAtReading, documentPositionKey]);

  // A single post-change request is issued only when the new document has
  // hydrated AND the reader has focus again. No intermediate settings toggle
  // can replace the original section/order frozen before entering Settings.
  useEffect(() => {
    if (!readerFocused || !readySections) return;
    const pending = getPendingDocumentRestore(documentPositionKey);
    if (!pending) {
      navigatingAwayRef.current = false;
      return;
    }
    const changed = pending.dirty || (pending.signature !== undefined && pending.signature !== restoreSettingsSignature);
    if (!changed) {
      clearPendingDocumentRestore(documentPositionKey, pending.sequence);
      navigatingAwayRef.current = false;
      return;
    }
    const visibleRefs = visibleDocumentSectionRefs(readySections, {
      displaySilentPrayers: preferences.displaySilentPrayers,
      bishopPresent: preferences.bishopPresent,
      copticGospelRite,
    });
    // The verse the reader was on, in the same hymn (by id, else by hymn
    // key); else that hymn's start; else the end of the nearest earlier hymn
    // still shown. Each renderer falls back from the verse to the hymn's
    // start itself when the change hid that verse.
    const target = resolveDocumentRestore(pending.originalSections, pending.sectionId, visibleRefs, pending.verseIndex);
    if (!target) return; // no visible hymns; keep the snapshot until there are
    const token = `${pending.sequence}:${pending.revision}:${restoreSettingsSignature}`;
    const targetVerseIndex = target.verseIndex ?? null;
    pendingScrollRestoreSectionIdRef.current = target.sectionId;
    currentSectionIdRef.current = target.sectionId;
    setCurrentSectionId(target.sectionId);
    currentVerseIndexRef.current = targetVerseIndex;
    setCurrentVerseIndex(targetVerseIndex);
    setCurrentVerseId(targetVerseIndex != null ? `${target.sectionId}::v${targetVerseIndex}` : null);
    setLastDocumentPosition(documentPositionKey, target.sectionId);
    setSelectedSlideSectionId(target.sectionId);
    setRestoreRequest({ token, target });
    documentRef.current?.setPreservedSection(target.sectionId, target.edge, targetVerseIndex);
    clearPendingDocumentRestore(documentPositionKey, pending.sequence);
    navigatingAwayRef.current = false;
    const clearGuard = setTimeout(() => {
      if (pendingScrollRestoreSectionIdRef.current === target.sectionId) {
        pendingScrollRestoreSectionIdRef.current = null;
      }
    }, 4000);
    return () => clearTimeout(clearGuard);
  }, [readerFocused, readySections, documentPositionKey, preferences, copticGospelRite, restoreSettingsSignature]);

  // Once the replacement renderer mounts (or an already-mounted reader's
  // settings change does not require a full HTML reload), perform the jump
  // imperatively too. Its load handler separately enforces the same target.
  useEffect(() => {
    if (!restoreRequest || preferences.slideshowMode) return;
    documentRef.current?.setPreservedSection(restoreRequest.target.sectionId, restoreRequest.target.edge, restoreRequest.target.verseIndex ?? null);
    documentRef.current?.scrollToSection(restoreRequest.target.sectionId, restoreRequest.target.edge, restoreRequest.target.verseIndex ?? null);
  }, [restoreRequest, preferences.slideshowMode]);

  // The scrolling WebView reader has no equivalent "seed the initial prop"
  // option (scrollToSection is imperative and needs the WebView mounted
  // first), so it still restores via an effect once a freshly (re)hydrated
  // document is ready.
  // The actual scroll-on-first-load itself is handled declaratively by
  // DocumentWebView's own initialSectionId prop (see initialScrollSectionId
  // below) -- it waits for the WebView's real load-complete event rather
  // than guessing a timeout, which an imperative scrollToSection call fired
  // from here never could (this screen has no way to know when the WebView
  // has actually finished loading). This effect only needs to guard against
  // that same freshly-mounted WebView's own natural "just loaded, still at
  // the top" report racing ahead of initialSectionId's correction and
  // overwriting the store before it lands.
  useEffect(() => {
    if (!readySections || hasRestoredScrollPositionRef.current || preferences.slideshowMode) return;
    if (getPendingDocumentRestore(documentPositionKey)) return;
    hasRestoredScrollPositionRef.current = true;

    const lastSectionId = getLastDocumentPosition(documentPositionKey);
    if (!lastSectionId || !readySections.some((s) => s.id === lastSectionId)) return;
    pendingScrollRestoreSectionIdRef.current = lastSectionId;
    const clearGuardTimeoutId = setTimeout(() => {
      if (pendingScrollRestoreSectionIdRef.current === lastSectionId) {
        pendingScrollRestoreSectionIdRef.current = null;
      }
    }, 2000);
    return () => clearTimeout(clearGuardTimeoutId);
  }, [readySections, documentPositionKey, preferences.slideshowMode]);

  useEffect(() => {
    if (!sections || !initialSubdocumentKey || initialSubOpenedRef.current) return;
    initialSubOpenedRef.current = true;
    const triggerSection = sections.find((s) => s.subdocumentKey === initialSubdocumentKey);
    if (triggerSection?.subdocumentSections) {
      setSubdocumentModal({
        title: getSectionSelectorTitle(triggerSection),
        sections: triggerSection.subdocumentSections,
        subdocumentKey: triggerSection.subdocumentKey,
        collapseMemoryScope: `${documentPositionKey}:sub:${triggerSection.id}`,
        triggerSectionId: triggerSection.id,
      });
    }
  }, [sections, initialSubdocumentKey, documentPositionKey]);

  // Rotating the device (or, on web, resizing the window) reflows the
  // WebView's CSS layout at the new width without reloading it — the scroll
  // position (in pixels) stays put, but the content that used to be at that
  // pixel offset has usually moved, so the reader silently lands on the
  // wrong verse. Re-anchor to wherever the user actually was once the
  // reflow has had a moment to settle. Slideshow mode doesn't need this —
  // SlideshowContainer already restores its own verse-level position
  // whenever a dimension change forces it to repaginate.
  const dimensionKeyRef = useRef(`${screenWidth}x${screenHeight}`);
  useEffect(() => {
    const nextKey = `${screenWidth}x${screenHeight}`;
    if (dimensionKeyRef.current === nextKey) return;
    dimensionKeyRef.current = nextKey;
    if (preferences.slideshowMode || getPendingDocumentRestore(documentPositionKey)) return;
    if (!currentVerseId && !currentSectionId) return;

    const timeoutId = setTimeout(() => {
      if (currentVerseId) documentRef.current?.scrollToVerse(currentVerseId);
      else if (currentSectionId) documentRef.current?.scrollToSection(currentSectionId);
    }, 260);
    return () => clearTimeout(timeoutId);
  }, [screenWidth, screenHeight, preferences.slideshowMode, currentVerseId, currentSectionId]);

  // Flipping the Slideshow Mode toggle unmounts one renderer and mounts the
  // other (DocumentSurface.tsx renders either SlideshowContainer or
  // DocumentWebView, never both) — neither one's internal "where was the
  // user" tracking survives that swap on its own. currentSectionId is kept
  // live by both renderers (handleAction's 'currentSection' case for scroll
  // mode, onCurrentSectionChange for slideshow below), so it's always
  // whatever hymn the user was just looking at regardless of which mode
  // reported it — jump the *other* mode there the moment the toggle flips.
  // Only reacts to an actual flip (this ref starts equal to the current
  // value, so it never fires on mount) — same "settings change -> start of
  // the hymn, not the exact spot" behavior as every other settings change,
  // just triggered by this one specific setting.
  const previousSlideshowModeRef = useRef(preferences.slideshowMode);
  useEffect(() => {
    if (previousSlideshowModeRef.current === preferences.slideshowMode) return;
    previousSlideshowModeRef.current = preferences.slideshowMode;
    if (getPendingDocumentRestore(documentPositionKey) || !currentSectionId) return;

    if (preferences.slideshowMode) {
      setSelectedSlideSectionId(currentSectionId);
      // The slide opens at the verse the page was scrolled to, not the hymn's first.
      setSlideJumpRequest((current) => ({ sectionId: currentSectionId, verseIndex: currentVerseIndexRef.current, token: (current?.token ?? 0) + 1 }));
      return;
    }

    // Write the target synchronously, immediately, so the persisted store
    // already has the right answer no matter what happens next -- Settings
    // can be reached from a screen that stays mounted in the background
    // (this effect firing at all is proof of that), so a fresh WebView can
    // mount here before this screen is even navigated back to. The actual
    // scroll happens declaratively, via initialScrollSectionId seeding the
    // new WebView's initialSectionId prop below (see its own doc comment) --
    // that waits for the real load-complete event instead of guessing a
    // timeout. pendingScrollRestoreSectionIdRef blocks handleAction from
    // trusting anything else until this exact section is confirmed, so the
    // WebView's own natural "just loaded, still at the top" report can't
    // beat that correction and overwrite the store with a stray position
    // before this screen is even visible again.
    setLastDocumentPosition(documentPositionKey, currentSectionId);
    pendingScrollRestoreSectionIdRef.current = currentSectionId;
    // The target section might never actually get reported back (e.g. it
    // got hidden by some other setting in the meantime) -- don't leave the
    // guard blocking every future report forever if that happens.
    const clearGuardTimeoutId = setTimeout(() => {
      if (pendingScrollRestoreSectionIdRef.current === currentSectionId) {
        pendingScrollRestoreSectionIdRef.current = null;
      }
    }, 2000);
    return () => clearTimeout(clearGuardTimeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences.slideshowMode]);

  // See navigatingAwayRef's declaration -- used for any navigation that
  // leaves this screen mounted behind the destination (Settings, Seasons).
  const navigateAway = (href: Href) => {
    captureDocumentRestore(
      documentPositionKey,
      currentSectionIdRef.current ?? getLastDocumentPosition(documentPositionKey),
      latestSectionOrderRef.current,
      restoreSettingsSignature,
      currentVerseIndexRef.current,
    );
    navigatingAwayRef.current = true;
    coveredRef.current = true;
    setSelectorOpen(false);
    router.push(href);
  };

  // The calendar opens over the document rather than as a page of its own.
  // Choosing another day re-reads the document for it, so its place is kept
  // first, as when leaving for another page.
  const keepPlaceForAnotherDay = () => {
    captureDocumentRestore(
      documentPositionKey,
      currentSectionIdRef.current ?? getLastDocumentPosition(documentPositionKey),
      latestSectionOrderRef.current,
      restoreSettingsSignature,
      currentVerseIndexRef.current,
    );
  };
  const openCalendar = () => {
    keepPlaceForAnotherDay();
    setSelectorOpen(false);
    setCalendarOpen(true);
  };

  const openSettings = () => {
    setSelectorOpen(false);
    setSettingsOpen(true);
  };

  // A Hyperlink teleports to another service rather than opening anything over
  // this one. Replacing this route keeps the screen below it unchanged, so
  // leaving the destination reveals that existing screen instead of inserting
  // the destination's own submenu above it. Reached from both the document
  // button and the content selector's hyperlink row.
  const openHyperlink = (hyperlinkKey?: string | null, options?: { fromSelector?: boolean }) => {
    const destination = hyperlinkKey ? HYPERLINK_TARGETS[hyperlinkKey] : undefined;
    if (!destination) return;
    // isCoveredByModal counts the content selector as covering this screen,
    // which is right for anything the DOCUMENT initiates while it sits behind
    // something -- but the selector's own hyperlink row IS that something, so
    // gating it on the same flag made the row permanently dead. From the
    // selector, only a subdocument/Antiphonary modal genuinely blocks.
    const blocked = options?.fromSelector
      ? Boolean(subdocumentModal) || Boolean(antiphonaryModal)
      : isCoveredByModal;
    if (blocked) return;
    // replace, not push: a Hyperlink teleports between services rather than
    // opening one over another, so the source document should not stay on the
    // stack holding its hydrated sections in memory.
    navigatingAwayRef.current = true;
    setTimeout(() => {
      navigatingAwayRef.current = false;
    }, 3000);
    router.replace(destination.href as Href);
  };

  const pencilGestureActiveRef = useRef(false);
  const handleAction = (action: DocumentAction) => {
    if (isSermonPlanner && action.type === 'sermonPencilGesture') {
      pencilGestureActiveRef.current = Boolean(action.active);
      return;
    }
    if (isSermonPlanner && action.type === 'createSermonHighlights') {
      // One highlight, a verse at a time, taking in the ones it covers
      // (textHighlights.ts, utils/highlightGroups.ts).
      const leadId = sermonPlanner.createHighlightGroup({
        anchors: (action.anchors || []).filter(isSermonHighlightAnchor),
        color: isSermonHighlightColor(action.color) ? action.color : 'gold',
        style: action.style === 'underline' ? 'underline' : undefined,
        replaces: Array.isArray(action.replaces) ? action.replaces.filter((id): id is string => typeof id === 'string') : [],
      });
      if (leadId) setActiveSermonHighlightId(leadId);
      // Made from the toolbar's Note: the note opens to be written.
      if (leadId && action.openNote) setSelectorOpen(true);
      return;
    }

    if (isSermonPlanner && action.type === 'recolorSermonHighlight' && action.highlightId) {
      sermonPlanner.updateHighlight(action.highlightId, {
        color: isSermonHighlightColor(action.color) ? action.color : 'gold',
        style: action.style === 'underline' ? 'underline' : null,
      });
      return;
    }

    if (isSermonPlanner && action.type === 'removeSermonHighlight' && action.highlightId) {
      sermonPlanner.deleteHighlight(action.highlightId);
      return;
    }

    if (isSermonPlanner && action.type === 'openSermonNote' && action.highlightId) {
      // The note is the whole highlight's, kept on its first segment.
      const group = groupHighlights(sermonPlanner.plan.highlights).find((entry) => entry.segments.some((segment) => segment.id === action.highlightId));
      setActiveSermonHighlightId(group?.lead.id ?? action.highlightId);
      setSelectorOpen(true);
      return;
    }

    if (action.type === 'toggleCopticGospelRite') {
      // The toggle button lives inside the first Gospel Rite section. Pre-set
      // the preserved section to the always-visible section immediately before
      // the entire gospel rite block so the WebView's handleLoad/handleLoadEnd
      // (which fires after the HTML rebuild) scrolls there instead of the top.
      // Find the toggle button's section in the NEW state (after the flip) —
      // both variants are in the raw array; only the one matching the new state
      // will exist in the rebuilt HTML, so that's the one to scroll to.
      captureDocumentRestore(
        documentPositionKey,
        action.sectionId ?? currentSectionIdRef.current,
        latestSectionOrderRef.current,
        restoreSettingsSignature,
      );
      markPendingDocumentRestoresDirty();
      toggleCopticGospelRite();
      return;
    }

    if (!sections) return;

    if (action.type === 'currentSection') {
      // Opening the content-selector drawer (a Modal) sits on top of the
      // WebView without unmounting it, and the layout shift that causes
      // (e.g. the underlying page's scrollbar disappearing) is enough to
      // make its reading-line tracker briefly reassess and report some
      // unrelated section as "current" -- the user isn't actually scrolling
      // the document while a modal covers it, so nothing it reports during
      // that window reflects real reading position. Same idea for
      // navigatingAwayRef, covering the Settings/Calendar transition itself.
      if (selectorOpen || settingsOpen || navigatingAwayRef.current || getPendingDocumentRestore(documentPositionKey)) return;

      const pendingTarget = pendingScrollRestoreSectionIdRef.current;
      if (pendingTarget && action.sectionId !== pendingTarget) {
        // Still mid-restore and this isn't the target yet -- almost
        // certainly the WebView's own natural "just loaded, still at the
        // top" report racing the explicit scroll that's about to correct
        // it. Ignore it rather than let it clobber the real position.
        return;
      }
      pendingScrollRestoreSectionIdRef.current = null;
      if (action.sectionId) {
        currentSectionIdRef.current = action.sectionId;
        setCurrentSectionId(action.sectionId);
        setLastDocumentPosition(documentPositionKey, action.sectionId);
      }
      setCurrentVerseId(action.verseId || null);
      currentVerseIndexRef.current = verseIndexFromId(action.verseId);
      setCurrentVerseIndex(currentVerseIndexRef.current);
      if (isAntiphonary) setCurrentTune(getVerseTune(sections, action.verseId));
      return;
    }

    if (action.type === 'openSelector') {
      if (!isCoveredByModal) setSelectorOpen(true);
      return;
    }

    if (action.type === 'openInterpretations') {
      setSelectorOpen(false);
      setInterpretationsOpen(true);
      return;
    }

    if (action.type === 'swipeBack') {
      if (!isCoveredByModal) leaveDocument();
      return;
    }

    // Checked before the subdocumentSections guard below: a Hyperlink section
    // deliberately carries no prefetched content, so that guard would drop it.
    if (action.type === 'openHyperlink') {
      openHyperlink(sections.find((s) => s.id === action.sectionId)?.hyperlinkKey);
      return;
    }

    const triggerSection = sections.find((s) => s.id === action.sectionId);
    if (!triggerSection?.subdocumentSections) return;

    if (action.type === 'openAntiphonary') {
      setAntiphonaryModal({
        sections: triggerSection.subdocumentSections,
        collapseMemoryScope: `${documentPositionKey}:sub:${triggerSection.id}`,
      });
      return;
    }

    if (action.type === 'openSubdocument') {
      setSubdocumentModal({
        title: getSectionSelectorTitle(triggerSection),
        sections: triggerSection.subdocumentSections,
        subdocumentKey: triggerSection.subdocumentKey,
        collapseMemoryScope: `${documentPositionKey}:sub:${triggerSection.id}`,
        triggerSectionId: triggerSection.id,
      });
    }
  };

  // Opening a subdocument from a bookmark deep link (?sub=...) never scrolled
  // this document anywhere -- the reader had tapped nothing here, so closing
  // the subdocument dropped them at the top of a service they never chose to
  // be at the top of. Land them on the button they came through instead, so
  // "Vespers - Doxologies" closes back onto the Doxologies button. Opening the
  // subdocument by tapping that button is the same jump, just already true.
  const closeSubdocument = () => {
    const triggerSectionId = subdocumentModal?.triggerSectionId;
    setSubdocumentModal(null);
    if (!triggerSectionId) return;

    currentSectionIdRef.current = triggerSectionId;
    setCurrentSectionId(triggerSectionId);
    setLastDocumentPosition(documentPositionKey, triggerSectionId);
    if (preferences.slideshowMode) {
      setSelectedSlideSectionId(triggerSectionId);
      return;
    }
    // Guarded the same way every other programmatic jump here is: the reader
    // reports its own position continuously, and a report still in flight
    // from before this jump would otherwise overwrite it.
    pendingScrollRestoreSectionIdRef.current = triggerSectionId;
    setTimeout(() => {
      if (pendingScrollRestoreSectionIdRef.current === triggerSectionId) {
        pendingScrollRestoreSectionIdRef.current = null;
      }
    }, 2000);
    documentRef.current?.setPreservedSection(triggerSectionId);
    documentRef.current?.scrollToSection(triggerSectionId);
  };

  const requestSlideJump = (target: Omit<SlideJumpRequest, 'token'>) =>
    setSlideJumpRequest((current) => ({ ...target, token: (current?.token ?? 0) + 1 }));

  // From the content selector, or the Antiphonary's Introduction pill. A pill
  // jumps by request in slideshow mode, not by selection, so tapping it again
  // after paging away from it still goes back.
  const jumpToSection = (id: string, { byRequest = false } = {}) => {
    currentSectionIdRef.current = id;
    setCurrentSectionId(id);
    setLastDocumentPosition(documentPositionKey, id);
    if (!preferences.slideshowMode) documentRef.current?.scrollToSection(id);
    else if (byRequest) requestSlideJump({ sectionId: id });
    else setSelectedSlideSectionId(id);
  };

  // As the Antiphonary modal's pills do (selectAntiphonaryGroup in DocumentModal.tsx).
  const selectAntiphonaryGroup = (group: AntiphonaryGroup) => {
    if (!readySections) return;
    if (group === 'adam' || group === 'vatos') {
      if (preferences.slideshowMode) requestSlideJump({ tune: group });
      else documentRef.current?.scrollToTune(group);
      return;
    }
    const introSection = findAntiphonaryIntroduction(readySections);
    if (introSection) jumpToSection(introSection.id, { byRequest: true });
  };
  const activeAntiphonaryGroup = isAntiphonary && readySections
    ? getActiveAntiphonaryGroup(readySections, currentSectionId, currentTune)
    : null;


  // A subdocument/Antiphonary modal (or the content selector) stacks visually
  // on top of this screen but never unmounts it -- so without this guard, a
  // left-edge swipe made while e.g. Doxologies is open can ALSO be seen by
  // this responder (native Modal presentation isn't a guaranteed touch
  // barrier against a screen's own JS PanResponder on every platform) and
  // fire goBack on the document underneath, popping the whole document out
  // from under the subdocument instead of just closing the subdocument.
  // DocumentModal.tsx's own closeSwipePanResponder already correctly scopes
  // itself to close only the topmost modal; this ensures the document
  // BEHIND it never competes for the same gesture while anything covers it.
  const isCoveredByModal = Boolean(subdocumentModal) || Boolean(antiphonaryModal) || selectorOpen || settingsOpen || interpretationsOpen;

  // Where the swipe this screen took began: decided while it is being taken,
  // kept for its release (see swipeStartX).
  const swipeTakenFromXRef = useRef(0);
  // The Antiphonary's pill bar is a dead zone for the edge swipes: a swipe
  // along it scrolls the pills (see DocumentModal.tsx).
  const touchOnPillBarRef = useRef(false);
  const gesturePanResponder = useMemo(
    () => {
      // Only a swipe from the edge goes back or opens the contents
      // (utils/edgeSwipe.ts); one across the page turns it, or does nothing.
      const shouldHandleEdgeSwipe = (event: unknown, gestureState: PanResponderGestureState) => {
        if (isCoveredByModal || isStylusGestureEvent(event) || pencilGestureActiveRef.current || touchOnPillBarRef.current) return false;
        const startX = swipeStartX(gestureState);
        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        const handles = swipeEdge(startX, screenWidth) !== null && isHorizontal && Math.abs(gestureState.dx) > 18;
        if (handles) swipeTakenFromXRef.current = startX;
        return handles;
      };

      return PanResponder.create({
        onMoveShouldSetPanResponderCapture: (event, gestureState) => shouldHandleEdgeSwipe(event, gestureState),
        onMoveShouldSetPanResponder: (event, gestureState) => shouldHandleEdgeSwipe(event, gestureState),
        onPanResponderRelease: (event, gestureState) => {
          if (isCoveredByModal || isStylusGestureEvent(event) || pencilGestureActiveRef.current) return;
          const takenFromX = swipeTakenFromXRef.current;
          const travelled = gestureState.moveX - takenFromX;
          const edge = swipeEdge(takenFromX, screenWidth);
          if (edge === 'right' && travelled <= -36) {
            setSelectorOpen(true);
            return;
          }
          if (edge === 'left' && travelled > 60) {
            leaveDocument();
          }
        },
      });
    },
    [screenWidth, isCoveredByModal, leaveDocument],
  );

  return (
    <SafeAreaView
      edges={Platform.OS === 'web' ? ['left', 'right', 'bottom'] : undefined}
      style={[styles.safeArea, { backgroundColor: documentTheme.colors.page }]}
      {...(isMobileDocument ? gesturePanResponder.panHandlers : {})}
      // The capture phase every native view registers (BaseViewConfig);
      // React Native's types leave it out.
      {...({
        onTouchStartCapture: () => {
          touchOnPillBarRef.current = false;
        },
      } as object)}
    >
      {/* The native stack's own default edge-swipe-to-go-back gesture isn't
          scoped to whether a subdocument modal is currently covering this
          screen — swiping the left edge would pop this whole document out
          from underneath an open subdocument instead of just closing it.
          This screen already implements its own equivalent gesture above
          (gesturePanResponder), so the native one is both redundant and the
          source of that bug — disabled here in favor of it. */}
      <Stack.Screen options={{ gestureEnabled: false }} />
      <Head>
        <title>{`Coptic Vine ${title}`}</title>
      </Head>
      {!isMobileDocument ? (
        <DocumentTopBar
          title={{ english: title, arabic, french }}
          onBack={() => leaveDocument()}
          backAccessibilityLabel="Leave document"
          leadingIcon={shouldShowFullscreen ? (isFullscreen ? 'close-fullscreen' : 'open-in-full') : undefined}
          onLeadingPress={shouldShowFullscreen ? toggleFullscreen : undefined}
          leadingAccessibilityLabel={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
          trailingIcon={isSermonPlanner ? 'document-text-outline' : 'list-outline'}
          trailingAccessibilityLabel={isSermonPlanner ? 'Open sermon notes' : 'Open content list'}
          onTrailingPress={() => setSelectorOpen(true)}
        />
      ) : null}
      {showDateBar && !error ? (
        <DocumentDateBar
          arabic={preferences.appLanguage === 'ar'}
          theme={documentTheme}
          onBeforeChange={keepPlaceForAnotherDay}
          onOpenCalendar={openCalendar}
        />
      ) : null}
      {error ? (
        // The native reader draws no header, so the failure itself has to offer the way back.
        <LoadFailure
          error={error}
          onRetry={() => setReloadToken((token) => token + 1)}
          onBack={isMobileDocument ? leaveDocument : undefined}
        />
      ) : !readySections ? (
        <LoadingScreen />
      ) : (
        <>
          {isAntiphonary ? (
            <DocumentPillBar
              pills={ANTIPHONARY_GROUPS}
              activeKey={activeAntiphonaryGroup}
              onSelect={(key) => selectAntiphonaryGroup(key as AntiphonaryGroup)}
              theme={documentTheme}
              onTouchStart={() => {
                touchOnPillBarRef.current = true;
              }}
            />
          ) : null}
          <View style={styles.documentFrame}>
          <DocumentSurface
            ref={documentRef}
            sections={readySections}
            preferences={documentPreferences}
            restoreRequest={restoreRequest}
            collapseMemoryScope={documentPositionKey}
            onAction={handleAction}
            selectedSectionId={selectedSlideSectionId}
            jumpRequest={slideJumpRequest}
            onCurrentSectionChange={(id, tune, verseIndex) => {
              // Only SlideshowContainer ever calls this — a report arriving
              // while slideshowMode is actually false can only be a stale
              // callback from an instance that's already mid-unmount (e.g.
              // right as the mode toggle flips the other way), not a real
              // position update; trusting it would silently overwrite the
              // correct remembered position with garbage.
              if (!preferences.slideshowMode || navigatingAwayRef.current || getPendingDocumentRestore(documentPositionKey)) return;
              if (pendingScrollRestoreSectionIdRef.current && pendingScrollRestoreSectionIdRef.current !== id) return;
              pendingScrollRestoreSectionIdRef.current = null;
              currentSectionIdRef.current = id;
              setCurrentSectionId(id);
              currentVerseIndexRef.current = verseIndex;
              setCurrentVerseIndex(verseIndex);
              setCurrentVerseId(verseIndex != null ? `${id}::v${verseIndex}` : null);
              setLastDocumentPosition(documentPositionKey, id);
              setCurrentTune(tune);
            }}
            onOpenSelector={() => setSelectorOpen(true)}
            copticGospelRite={copticGospelRite}
            suppressAllSpeakerLabels={schema === 'agpeya'}
            initialScrollSectionId={restoreRequest?.target.sectionId ?? currentSectionId ?? getLastDocumentPosition(documentPositionKey)}
            initialScrollVerseIndex={restoreRequest ? restoreRequest.target.verseIndex ?? null : currentVerseIndex}
            onCollapseToggle={setSelectedSlideSectionId}
            keyboardNavigationEnabled={!isCoveredByModal}
            sermonPlannerMode={isSermonPlanner}
            sermonHighlights={sermonPlanner.plan.highlights}
            ornamentColor={documentOrnamentColor(documentTheme, ornamentSeason)}
          />
          </View>
          {isSermonPlanner ? (
            <SermonPlannerDrawer
              visible={selectorOpen}
              references={sermonReferences}
              highlights={sermonPlanner.plan.highlights}
              verseReferences={sermonVerseReferences}
              generalNotes={sermonPlanner.plan.generalNotes}
              activeHighlightId={activeSermonHighlightId}
              syncStatus={sermonPlanner.syncStatus}
              signedIn={Boolean(user)}
              visibleLanguages={preferences.sermonPlannerVisibleLanguages}
              onToggleLanguage={toggleSermonPlannerLanguage}
              onClose={() => setSelectorOpen(false)}
              onSelectReference={(reference) => documentRef.current?.scrollToVerse(reference.verseId)}
              onJumpToHighlight={(highlight) => documentRef.current?.scrollToSermonHighlight(highlight.id)}
              onChangeGeneralNotes={sermonPlanner.setGeneralNotes}
              onChangeHighlightNote={(id, note) => sermonPlanner.updateHighlight(id, { note })}
              onChangeHighlightColor={sermonPlanner.setHighlightColor}
              onDeleteHighlight={(id) => {
                sermonPlanner.deleteHighlight(id);
                if (activeSermonHighlightId === id) setActiveSermonHighlightId(null);
              }}
              bookmarked={bookmarked}
              onToggleBookmark={() => toggleBookmark(bookmarkId)}
              onOpenCalendar={openCalendar}
              onOpenSettings={openSettings}
              theme={documentTheme}
            />
          ) : (
          <ContentSelectorDrawer
            visible={selectorOpen}
            sections={readySections}
            currentSectionId={currentSectionId}
            onClose={() => setSelectorOpen(false)}
            onSelectSection={(id) => jumpToSection(id)}
            onOpenHyperlink={(hyperlinkKey) => openHyperlink(hyperlinkKey, { fromSelector: true })}
            onOpenInterpretations={() => setInterpretationsOpen(true)}
            bookmarked={bookmarked}
            onToggleBookmark={() => toggleBookmark(bookmarkId)}
            onOpenCalendar={openCalendar}
            onOpenSettings={openSettings}
            bishopPresent={preferences.bishopPresent}
            onToggleBishopPresent={() => {
              captureDocumentRestore(
                documentPositionKey,
                currentSectionIdRef.current,
                readySections.map(section => section.id),
                restoreSettingsSignature,
              );
              markPendingDocumentRestoresDirty();
              toggleBishopPresent();
            }}
            displaySilentPrayers={preferences.displaySilentPrayers}
            copticGospelRite={copticGospelRite}
            appLanguage={preferences.appLanguage}
            theme={documentTheme}
          />
          )}
        </>
      )}
      {/* Deliberately outside the branch above. Changing the date clears
          `sections` while this document re-hydrates, and these modals used to
          go with it -- taking their own state along, including which overlay
          screen was open. So picking a date in the calendar destroyed the
          calendar and dropped the reader back into the subdocument. They hold
          their own prefetched sections and never needed the parent's, so they
          now ride out the reload (still showing content, not a spinner) and
          are refreshed in place by the hydration effect above. */}
      <SubdocumentModal
        visible={Boolean(subdocumentModal)}
        title={subdocumentModal?.title ?? null}
        sections={subdocumentModal?.sections ?? null}
        subdocumentKey={subdocumentModal?.subdocumentKey}
        collapseMemoryScope={subdocumentModal?.collapseMemoryScope ?? `${documentPositionKey}:sub:unknown`}
        parentBookmarkId={bookmarkId}
        onClose={closeSubdocument}
      />
      <AntiphonaryModal
        visible={Boolean(antiphonaryModal)}
        sections={antiphonaryModal?.sections ?? null}
        collapseMemoryScope={antiphonaryModal?.collapseMemoryScope ?? `${documentPositionKey}:sub:antiphonary`}
        onClose={() => setAntiphonaryModal(null)}
      />
      <CalendarSheet inline visible={calendarOpen} onClose={() => setCalendarOpen(false)} onOpenSeasons={() => navigateAway('/season-selector')} />
      <BookSettingsSheet inDocument visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <InterpretationPicker inline visible={interpretationsOpen} onClose={() => setInterpretationsOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.black },
  documentFrame: { flex: 1, position: 'relative' },
});
