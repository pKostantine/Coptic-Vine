import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS, TYPOGRAPHY } from '../../../constants/theme';
import PageTitle from './PageTitle';

const MAX_FONT_SCALE = 1.2;

interface TabHeaderProps {
  title: string;
  arabic: boolean;
  /** The iPad and desktop: the title larger, the sections beside it. */
  wide: boolean;
  /** The tab's sections on the gold pill (MusicSectionNav, LearningSectionNav), set flush. */
  nav?: ReactNode;
}

/**
 * The head of a tab's page (Coptic Vine design, "Music", "Learn", "Account"):
 * on a phone its title over the section pill; on the iPad and desktop the
 * title larger, with the pill at the far end of the same row.
 */
export default function TabHeader({ title, arabic, wide, nav }: TabHeaderProps) {
  if (!wide) {
    return (
      <>
        <PageTitle title={title} arabic={arabic} />
        {nav}
      </>
    );
  }
  return (
    <View style={styles.row}>
      <Text style={[styles.title, arabic && styles.arabic]} numberOfLines={1} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {title}
      </Text>
      {nav ? <View style={styles.nav}>{nav}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: 24, justifyContent: 'space-between' },
  title: { color: COLORS.white, flexShrink: 1, fontFamily: TYPOGRAPHY.title, fontSize: 38, fontWeight: '700', lineHeight: 42 },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  // The pill keeps the design's 450pt (440 inside its padding and border) where there is room, and gives way on a narrow iPad.
  nav: { flexShrink: 1, minWidth: 300, width: 450 },
});
