import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * A page's side padding with the safe area added: a phone on its side keeps
 * its content clear of the notch and the rounded corners while the page
 * itself -- its glow, its background -- runs to both edges.
 */
export function useSidePadding(base = 0): { paddingLeft: number; paddingRight: number } {
  const insets = useSafeAreaInsets();
  return { paddingLeft: base + insets.left, paddingRight: base + insets.right };
}
