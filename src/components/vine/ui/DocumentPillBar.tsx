import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NIGHT_DOCUMENT_THEME, withAlpha, type DocumentTheme } from '../../../constants/documentThemes';
import { RADII, SPACING } from '../../../constants/theme';

export interface DocumentPill {
  key: string;
  label: string;
}

interface DocumentPillBarProps {
  pills: DocumentPill[];
  /** The pill for wherever the reader is: lit gold, and brought to the middle of the row. */
  activeKey: string | null;
  onSelect: (key: string) => void;
  /** The page the bar sits on — see constants/documentThemes.ts. */
  theme?: DocumentTheme;
}

/**
 * The row of pills across the top of a subdocument -- one per hymn, so the
 * Doxologies get one per saint -- or across the Antiphonary (Introduction,
 * Adam, Vatos). Ported from the old app's modalSelector (HymnDisplayScreen.js).
 *
 * The pill for the hymn being read is lit as the content selector lights its
 * row, and is centered whenever the reader moves on to another. Only then: a
 * row the reader has scrolled along themselves stays where they left it until
 * the next hymn comes.
 */
export default function DocumentPillBar({ pills, activeKey, onSelect, theme = NIGHT_DOCUMENT_THEME }: DocumentPillBarProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [barWidth, setBarWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [pillLayouts, setPillLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const centeredKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeKey || centeredKeyRef.current === activeKey) return;
    const layout = pillLayouts[activeKey];
    if (!layout || !barWidth || !contentWidth) return;
    // The first centering is where the row opens, so it does not slide there.
    const animated = centeredKeyRef.current !== null;
    centeredKeyRef.current = activeKey;
    const maxX = Math.max(contentWidth - barWidth, 0);
    const x = Math.min(Math.max(layout.x + layout.width / 2 - barWidth / 2, 0), maxX);
    scrollRef.current?.scrollTo({ x, animated });
  }, [activeKey, pillLayouts, barWidth, contentWidth]);

  return (
    <View style={[styles.bar, { backgroundColor: theme.colors.strip, borderBottomColor: theme.colors.border }]} onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        onContentSizeChange={(width) => setContentWidth(width)}
      >
        {pills.map((pill) => (
          <Pressable
            key={pill.key}
            // A real button, announced as the selected one where the reader
            // is. The slideshow leaves a focused button only Space and Enter,
            // so the arrow keys and a clicker still turn the page after a pill
            // is tapped (isKeyKeptByFocusedControl in slideshowLayout.js).
            accessibilityRole="button"
            accessibilityState={{ selected: pill.key === activeKey }}
            style={[
              styles.pill,
              pill.key === activeKey
                ? { backgroundColor: theme.colors.stripActive, borderColor: withAlpha(theme.colors.accent, 0.72) }
                : { borderColor: theme.colors.border },
            ]}
            onLayout={(event) => {
              const { x, width } = event.nativeEvent.layout;
              setPillLayouts((current) =>
                current[pill.key]?.x === x && current[pill.key]?.width === width ? current : { ...current, [pill.key]: { x, width } },
              );
            }}
            onPress={() => onSelect(pill.key)}
          >
            <Text numberOfLines={1} style={[styles.pillText, { color: theme.colors.text }]}>{pill.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderBottomWidth: 1,
    maxHeight: 58,
  },
  content: {
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  pill: {
    borderRadius: RADII.md,
    borderWidth: 1,
    flexShrink: 0,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: SPACING.md,
  },
  // The lit pill is the content selector's own "you are here"
  // (selectorItemActive in ContentSelectorDrawer.tsx), in the page's colours.
  pillText: {
    flexShrink: 0,
    fontSize: 14,
    fontWeight: '800',
  },
});
