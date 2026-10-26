import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

import { COLORS } from '../../constants/theme';
import { sectionRestoreCandidates, type DocumentRestoreRequest } from '../../utils/sectionRestore';
import { useCopticFontDataUri, useCopticItalicFontDataUri } from '../../utils/useCopticFontDataUri';
import type { AppLanguage } from '../../utils/preferencesStorage';
import type { SermonHighlight } from '../../types/sermonPlanner';
import { buildDocumentHtml, DocumentAction, DocumentSection, VisibleColumns, withRememberedCollapse } from './documentHtml';
import { NIGHT_DOCUMENT_THEME, type DocumentTheme } from '../../constants/documentThemes';
import type { InitialColors } from '../../constants/documentOrnaments';

export type { DocumentAction, DocumentSection, DocumentVerse } from './documentHtml';

export interface DocumentWebViewHandle {
  /** To the section's edge, or, with `verseIndex`, to that verse of it (its index in the hymn's rows) if the page has it. */
  scrollToSection: (id: string, edge?: 'start' | 'end', verseIndex?: number | null) => void;
  scrollToVerse: (id: string) => void;
  scrollToTune: (tune: string) => void;
  /** Pre-set the section the WebView will restore to on its next load (e.g. before triggering a state change that causes a full HTML rebuild). */
  setPreservedSection: (id: string, edge?: 'start' | 'end', verseIndex?: number | null) => void;
  scrollToSermonHighlight: (id: string) => void;
}

interface DocumentWebViewProps {
  sections: DocumentSection[];
  fontSize?: number;
  visibleColumns?: VisibleColumns;
  appLanguage?: AppLanguage;
  selectText?: boolean;
  displayComments?: boolean;
  displaySilentPrayers?: boolean;
  bishopPresent?: boolean;
  copticRecitedPrayers?: boolean;
  copticGospelRite?: boolean;
  /** Forces every verse's person-type indicator hidden — see documentHtml.ts's buildDocumentHtml. */
  suppressAllSpeakerLabels?: boolean;
  onAction?: (action: DocumentAction) => void;
  /** The reader's remembered open/closed choice per section, overriding each one's database default. Deliberately not a dependency of the HTML build below — see the ref there. */
  collapsedSectionIds?: Record<string, boolean>;
  /** Section to scroll to the moment this WebView finishes its first load — e.g. wherever the user was reading in slideshow mode just before switching, or the last remembered position for a brand-new mount. Only consulted once, at mount; changing it on a later render has no effect (use the imperative scrollToSection handle for that). */
  initialSectionId?: string | null;
  /** With initialSectionId: the verse of it (its index in the hymn's rows) to land on, if the page has it. */
  initialVerseIndex?: number | null;
  /** Explicit post-settings/calendar jump. The token forces a jump even to the already selected hymn. */
  restoreRequest?: DocumentRestoreRequest | null;
  /** Extra scrollable space at the bottom for floating app chrome such as the global mini player. */
  bottomContentInset?: number;
  /** Where the text starts under floating reader controls (documentHtml.ts's topContentInset); the app's documents have none today. */
  topContentInset?: number;
  /** Whether the headpiece the document opens with still shows below the floating controls: the title pill's cue. */
  onHeadpieceInViewChange?: (inView: boolean) => void;
  sermonPlannerMode?: boolean;
  /** Whether the page reports a swipe to the right as the reader's way out (documentHtml.ts's swipeExitsInPage): not where iOS's own back swipe leaves. */
  swipeExitsInPage?: boolean;
  sermonHighlights?: SermonHighlight[];
  /** The page the document is read on — see constants/documentThemes.ts. */
  theme?: DocumentTheme;
  /** The colour its ornaments are drawn in (documentOrnamentColor). */
  ornamentColor?: string;
  /** The decorated initials' vine and letter (documentInitialColors). */
  initialColors?: InitialColors;
}

/**
 * Native (iOS/Android) document renderer — see documentHtml.ts for the
 * shared HTML builder. Uses react-native-webview, which doesn't support web;
 * DocumentWebView.web.tsx is the web counterpart (plain iframe).
 */

/**
 * Suppresses the platform's own text-selection menu. react-native-webview
 * documents an empty menuItems array as hiding it, on both iOS and Android.
 * Used where the page draws its own toolbar over the selection instead.
 */
const NO_NATIVE_SELECTION_MENU: [] = [];

/**
 */
const DocumentWebView = forwardRef<DocumentWebViewHandle, DocumentWebViewProps>(
  (
    {
      sections,
      fontSize = 18,
      visibleColumns,
      appLanguage = 'en',
      selectText = false,
      displayComments = false,
      displaySilentPrayers = false,
      bishopPresent = false,
      copticRecitedPrayers = true,
      copticGospelRite = false,
      suppressAllSpeakerLabels = false,
      onAction,
      initialSectionId,
      initialVerseIndex,
      restoreRequest,
      bottomContentInset = 0,
      topContentInset = 0,
      onHeadpieceInViewChange,
      collapsedSectionIds,
      sermonPlannerMode = false,
      swipeExitsInPage = true,
      sermonHighlights = [],
      theme = NIGHT_DOCUMENT_THEME,
      ornamentColor,
      initialColors,
    },
    ref,
  ) => {
    const copticFontDataUri = useCopticFontDataUri();
    const copticItalicFontDataUri = useCopticItalicFontDataUri();
    const webviewRef = useRef<WebView>(null);
    // Whatever section the "currentSection" scroll-tracking script (see
    // documentHtml.ts) most recently reported. A settings change (font size,
    // a language toggle, comments/silent-prayers, Bishop Present) rebuilds
    // the whole HTML document, which reloads the WebView and resets scroll
    // to the top — restoring to this section's START on load is what brings
    // the user back to where they were instead. Deliberately section-
    // granular, not the exact verse — matches slideshow mode's own
    // settings-change restore. Seeded from initialSectionId (not null) so a
    // freshly mounted WebView (e.g. switching from slideshow mode, or a
    // brand-new document load) already knows where to land on its very
    // first load, rather than only being able to correct itself starting
    // from its *second* reload onward.
    const preservedSectionIdRef = useRef<string | null>(initialSectionId ?? null);
    const preservedEdgeRef = useRef<'start' | 'end'>('start');
    // The verse at the top of the reader's page, named as the page names it
    // (`<section id>::v<index>`): where a reload puts them back, when the
    // page still has it; else the section's edge above.
    const verseIdOf = (sectionId: string | null | undefined, verseIndex: number | null | undefined) =>
      sectionId && Number.isFinite(verseIndex as number) ? `${sectionId}::v${verseIndex}` : null;
    const preservedVerseIdRef = useRef<string | null>(verseIdOf(initialSectionId, initialVerseIndex));
    const pendingRestoreSectionIdRef = useRef<string | null>(null);
    const lastRestoreTokenRef = useRef<string | null>(null);
    // A freshly (re)loaded page reports where it is the moment it first
    // paints -- the top -- and that report can arrive before onLoadEnd. It
    // would replace the section the reader was on, so the restore on load
    // took them to the top instead: in a subdocument, a jump that "went there
    // and then shot back up". Nothing the page reports counts until its
    // restore has been sent.
    const loadingRef = useRef(true);
    // The last report made while loading, kept rather than dropped: the page
    // reports once and then only on scroll, so a document that loads where
    // it should never says where it is again.
    const reportDuringLoadRef = useRef<DocumentAction | null>(null);
    // A jump's own target, recorded the moment it's asked for, and the brief
    // window in which reports of anywhere else are only the scroll catching
    // up (or a reload's first paint) rather than where the reader is.
    const jumpGuardRef = useRef<{ sectionId: string; until: number } | null>(null);
    const guardJump = (sectionId: string) => {
      jumpGuardRef.current = { sectionId, until: Date.now() + 1500 };
    };
    // Assign before the rebuilt HTML/iframe is committed, never after a
    // transient "at the top" position report can overwrite the target.
    if (restoreRequest && lastRestoreTokenRef.current !== restoreRequest.token) {
      lastRestoreTokenRef.current = restoreRequest.token;
      preservedSectionIdRef.current = restoreRequest.target.sectionId;
      preservedEdgeRef.current = restoreRequest.target.edge;
      preservedVerseIdRef.current = verseIdOf(restoreRequest.target.sectionId, restoreRequest.target.verseIndex);
      pendingRestoreSectionIdRef.current = restoreRequest.target.sectionId;
    }

    useImperativeHandle(ref, () => ({
      scrollToSection: (id: string, edge: 'start' | 'end' = 'start', verseIndex: number | null = null) => {
        preservedSectionIdRef.current = id;
        preservedEdgeRef.current = edge;
        preservedVerseIdRef.current = verseIdOf(id, verseIndex);
        guardJump(id);
        webviewRef.current?.injectJavaScript(
          `window.scrollToSection(${JSON.stringify([{ sectionId: id, edge, verseId: preservedVerseIdRef.current || undefined }])}); true;`,
        );
      },
      scrollToVerse: (id: string) => {
        webviewRef.current?.injectJavaScript(`window.scrollToVerse(${JSON.stringify(id)}); true;`);
      },
      scrollToTune: (tune: string) => {
        webviewRef.current?.injectJavaScript(`window.scrollToTune(${JSON.stringify(tune)}); true;`);
      },
      setPreservedSection: (id: string, edge: 'start' | 'end' = 'start', verseIndex: number | null = null) => {
        preservedSectionIdRef.current = id;
        preservedEdgeRef.current = edge;
        preservedVerseIdRef.current = verseIdOf(id, verseIndex);
        pendingRestoreSectionIdRef.current = id;
      },
      scrollToSermonHighlight: (id: string) => {
        webviewRef.current?.injectJavaScript(`window.scrollToSermonHighlight && window.scrollToSermonHighlight(${JSON.stringify(id)}); true;`);
      },
    }));

    const syncSermonHighlights = () => {
      if (!sermonPlannerMode) return;
      webviewRef.current?.injectJavaScript(
        `window.setSermonHighlights && window.setSermonHighlights(${JSON.stringify(sermonHighlights)}); true;`,
      );
    };

    useEffect(() => {
      syncSermonHighlights();
      // The serialized highlight payload is the actual renderer dependency.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sermonPlannerMode, JSON.stringify(sermonHighlights)]);

    const handleAction = (action: DocumentAction) => {
      if (action?.type === 'headpieceInView') {
        onHeadpieceInViewChange?.(Boolean(action.inView));
        return;
      }
      if (action?.type === 'currentSection' && action.sectionId) {
        if (loadingRef.current) {
          reportDuringLoadRef.current = action;
          return;
        }
        const guard = jumpGuardRef.current;
          if (guard) {
          if (guard.sectionId !== action.sectionId && Date.now() < guard.until) return;
          jumpGuardRef.current = null;
        }
        if (pendingRestoreSectionIdRef.current && pendingRestoreSectionIdRef.current !== action.sectionId) return;
        pendingRestoreSectionIdRef.current = null;
        preservedSectionIdRef.current = action.sectionId;
        preservedEdgeRef.current = 'start';
        preservedVerseIdRef.current = action.verseId || null;
      }
      // Remember the title that was actually tapped before the collapse
      // state rebuilds this HTML, so the reload stays anchored there.
      if (action?.type === 'toggleCollapse' && action.sectionId) {
        preservedSectionIdRef.current = action.sectionId;
      }
      onAction?.(action);
    };

    const handleMessage = (event: WebViewMessageEvent) => {
      let action: DocumentAction;
      try {
        action = JSON.parse(event.nativeEvent.data);
      } catch {
        // Malformed message from the HTML content — ignore.
        return;
      }
      handleAction(action);
    };

    // The Now Playing bar's clearance is applied to the loaded page, never
    // built into it: the bar appears, collapses and re-measures while a
    // document is open (a subdocument even mounts its own copy), and
    // rebuilding for that reloaded the document and dropped the reader's place.
    const applyBottomInset = () => {
      webviewRef.current?.injectJavaScript(
        `(function () { var page = document.querySelector('.document'); if (page) page.style.paddingBottom = ${JSON.stringify(`${Math.max(0, Math.round(bottomContentInset))}px`)}; })(); true;`,
      );
    };

    useEffect(() => {
      applyBottomInset();
      // Only the value matters; the injector itself is rebuilt every render.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bottomContentInset]);

    const handleLoadEnd = () => {
      applyBottomInset();
      // The whole chain, not just the remembered section: this load is
      // usually a settings change rebuilding the document, and that setting
      // may be what hid the section being restored to. See
      // sectionRestoreCandidates.
      const candidates = sectionRestoreCandidates(sections.map((section) => section.id), preservedSectionIdRef.current)
        .map((sectionId, index) => ({
          sectionId,
          edge: index ? 'end' : preservedEdgeRef.current,
          // The reader's own verse first, for their own section only.
          verseId: index ? undefined : preservedVerseIdRef.current || undefined,
        }));
      if (candidates.length) {
        webviewRef.current?.injectJavaScript(
          `if (window.scrollToSection) { window.scrollToSection(${JSON.stringify(candidates)}); } true;`,
        );
        guardJump(candidates[0].sectionId);
      }
      loadingRef.current = false;
      // Let the kept report through now -- the jump guard above still turns
      // it away unless it is where the restore is headed.
      const keptReport = reportDuringLoadRef.current;
      reportDuringLoadRef.current = null;
      if (keptReport) handleAction(keptReport);
      syncSermonHighlights();
    };

    useEffect(() => {
      if (!restoreRequest) return;
      const { sectionId, edge, verseIndex } = restoreRequest.target;
      webviewRef.current?.injectJavaScript(
        `if (window.scrollToSection) { window.scrollToSection(${JSON.stringify([{ sectionId, edge, verseId: verseIdOf(sectionId, verseIndex) || undefined }])}); } true;`,
      );
    }, [restoreRequest?.token]);

    // Collapse state is deliberately NOT a dependency of this build, and is
    // read from a ref rather than captured by it. The reader opens and closes
    // a section in its own DOM the instant the button is tapped (see the
    // collapse-button handler in documentHtml) and reports it up only so the
    // choice is remembered -- rebuilding the HTML for that would reload this
    // whole document and throw the reader's place away, for a change that has
    // already visibly happened. Reading the ref at build time still gets every
    // choice made since whenever something real does force a rebuild (a font
    // size, a language, a new date), so nothing is silently lost either.
    const collapsedSectionIdsRef = useRef(collapsedSectionIds);
    useEffect(() => {
      collapsedSectionIdsRef.current = collapsedSectionIds;
    }, [collapsedSectionIds]);

    const html = useMemo(
      () =>
        copticFontDataUri && copticItalicFontDataUri
          ? buildDocumentHtml(withRememberedCollapse(sections, collapsedSectionIdsRef.current ?? {}), {
              copticFontDataUri,
              copticItalicFontDataUri,
              fontSize,
              visibleColumns,
              appLanguage,
              selectText,
              displayComments,
              displaySilentPrayers,
              bishopPresent,
              copticRecitedPrayers,
              copticGospelRite,
              suppressAllSpeakerLabels,
              // Applied after load instead — see applyBottomInset.
              bottomContentInset: 0,
              topContentInset,
              sermonPlannerMode,
              theme,
              ornamentColor,
              initialColors,
              nativeSwipeNavigation: true,
              swipeExitsInPage,
            })
          : null,
      [
        sections,
        copticFontDataUri,
        copticItalicFontDataUri,
        fontSize,
        visibleColumns,
        appLanguage,
        selectText,
        displayComments,
        displaySilentPrayers,
        bishopPresent,
        copticRecitedPrayers,
        copticGospelRite,
        suppressAllSpeakerLabels,
        topContentInset,
        sermonPlannerMode,
        swipeExitsInPage,
        theme,
        ornamentColor,
        initialColors,
      ],
    );

    // Declared before the early return below so the hook order is fixed; the
    // empty-string case is never rendered.
    const source = useMemo(() => ({ html: html ?? '' }), [html]);

    if (!html) {
      return (
        <View style={[styles.loading, { backgroundColor: theme.colors.page }]}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      );
    }

    return (
      <WebView
        ref={webviewRef}
        originWhitelist={['*']}
        // Memoized alongside the html string: a bare object literal here is a
        // new source on every render, and the point of the build above is that
        // a re-render caused by a collapse toggle changes nothing to reload.
        source={source}
        style={[styles.webview, { backgroundColor: theme.colors.page }]}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        javaScriptEnabled
        textInteractionEnabled={selectText || sermonPlannerMode}
        // Only the Sermon Planner draws its own toolbar. A plain document with
        // Select text on keeps the platform's menu, which is the only way to
        // copy from it.
        {...(sermonPlannerMode ? { menuItems: NO_NATIVE_SELECTION_MENU } : null)}
        onMessage={handleMessage}
        onLoadStart={() => {
          loadingRef.current = true;
          reportDuringLoadRef.current = null;
        }}
        onLoadEnd={handleLoadEnd}
      />
    );
  },
);

DocumentWebView.displayName = 'DocumentWebView';

export default DocumentWebView;

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.black,
  },
  webview: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
});
