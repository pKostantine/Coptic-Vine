import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { COLORS } from '../../../constants/theme';

interface BleedPageProps extends Omit<ViewProps, 'children'> {
  /** Drawn behind everything, edge to edge: the page's glow. */
  background?: ReactNode;
  /** Across the top, edge to edge (AppHeader, which keeps its own buttons clear of the notch). */
  header?: ReactNode;
  /** Across the foot, edge to edge (the tab bar, which does the same). */
  footer?: ReactNode;
  /** Safe-area edges the content keeps clear of besides the sides: the foot on a page with no tab bar. */
  edges?: Edge[];
  children: ReactNode;
}

/**
 * A page whose glow, green header and tab bar run to both edges of the screen
 * while its content stays inside the safe area. On a phone held on its side
 * the notch and the rounded corners take the sides; a page wrapped whole in a
 * SafeAreaView drew black bands beside its glow and header there.
 */
export default function BleedPage({ background, header, footer, edges = [], style, children, ...rest }: BleedPageProps) {
  return (
    <View {...rest} style={[styles.page, style]}>
      {background}
      {header}
      <SafeAreaView edges={['left', 'right', ...edges]} style={styles.body}>
        {children}
      </SafeAreaView>
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: COLORS.black, flex: 1 },
  body: { flex: 1 },
});
