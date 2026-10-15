import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

import { COLORS } from '../../constants/theme';
import type { BibleHighlight } from '../../types/bibleHighlights';

export interface BibleWebViewHandle {
  selectVerse: (verse: number | string) => void;
}

export interface BibleWebViewAction {
  type:
    | 'openSelector'
    | 'previousLevel'
    | 'currentVerse'
    | 'createBibleHighlights'
    | 'recolorBibleHighlight'
    | 'removeBibleHighlight'
    | 'biblePencilGesture'
    | 'copyBibleText';
  verse?: string;
  readerId?: string;
  anchors?: unknown[];
  color?: string;
  highlightId?: string;
  active?: boolean;
  text?: string;
  html?: string;
}

interface BibleWebViewProps {
  html: string;
  restoreVerse?: string | null;
  scrollEnabled?: boolean;
  selectText?: boolean;
  /** The book's highlights, drawn over whichever of their verses this chapter shows. */
  highlights?: BibleHighlight[];
  onAction?: (action: BibleWebViewAction) => void;
  /** The page the chapter is read on (constants/documentThemes.ts), painted behind the HTML as it loads. */
  backgroundColor?: string;
}

/**
 * Suppresses the platform's own text-selection menu. react-native-webview
 * documents an empty menuItems array as hiding it, on both iOS and Android.
 * Used where the page draws its own toolbar over the selection instead.
 */
const NO_NATIVE_SELECTION_MENU: [] = [];

/** Native (iOS/Android) Bible chapter renderer — see bibleDocumentHtml.ts for the shared HTML builder. BibleWebView.web.tsx is the web counterpart (plain iframe). */
const BibleWebView = forwardRef<BibleWebViewHandle, BibleWebViewProps>(({ html, restoreVerse, scrollEnabled = true, selectText = false, highlights, onAction, backgroundColor = COLORS.black }, ref) => {
  const webviewRef = useRef<WebView>(null);
  const restoreVerseRef = useRef(restoreVerse);
  restoreVerseRef.current = restoreVerse;
  const highlightsJson = JSON.stringify(highlights || []);
  const highlightsJsonRef = useRef(highlightsJson);
  highlightsJsonRef.current = highlightsJson;
  const drawHighlights = () => {
    webviewRef.current?.injectJavaScript(`window.setSermonHighlights && window.setSermonHighlights(${highlightsJsonRef.current}); true;`);
  };

  useEffect(() => {
    drawHighlights();
  }, [highlightsJson]);

  useImperativeHandle(ref, () => ({
    selectVerse: (verse: number | string) => {
      webviewRef.current?.injectJavaScript(`window.selectBibleVerse && window.selectBibleVerse(${JSON.stringify(String(verse))}); true;`);
    },
  }));

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      onAction?.(JSON.parse(event.nativeEvent.data));
    } catch {
      // Malformed message from the HTML content — ignore.
    }
  };

  return (
    <WebView
      ref={webviewRef}
      originWhitelist={['*']}
      source={{ html }}
      style={[styles.webview, { backgroundColor }]}
      scrollEnabled={scrollEnabled}
      bounces={false}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={scrollEnabled}
      javaScriptEnabled
      textInteractionEnabled={selectText}
      // Selectable text and the highlight toolbar are the same condition here
      // (chapter.tsx passes `highlighting: effectiveSelectText`), so wherever
      // the reader can select, the page already offers its own menu.
      {...(selectText ? { menuItems: NO_NATIVE_SELECTION_MENU } : null)}
      onMessage={handleMessage}
      onLoadEnd={() => {
        drawHighlights();
        const verse = restoreVerseRef.current;
        if (verse) webviewRef.current?.injectJavaScript(`window.selectBibleVerse && window.selectBibleVerse(${JSON.stringify(verse)}); true;`);
      }}
    />
  );
});

BibleWebView.displayName = 'BibleWebView';

export default BibleWebView;

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
});
