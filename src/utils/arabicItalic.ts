import { Platform, type TextStyle } from 'react-native';

/**
 * Arabic set in italic, slanted as Chrome slants it.
 *
 * Arabic faces have no italic. Chrome (Skia) fakes one by skewing the
 * upright glyphs a quarter of their height -- about 14 degrees -- but iOS
 * draws Arabic asked for in italic upright, so the comments, refrains and
 * silent prayers lost the slant that sets them apart. On iOS and Android the
 * text is drawn upright and given that skew; the web keeps the browser's own.
 */
export const ARABIC_ITALIC_SKEW = '-14deg';

export function arabicItalicStyle(): TextStyle {
  return Platform.OS === 'web'
    ? { fontStyle: 'italic' }
    : { fontStyle: 'normal', transform: [{ skewX: ARABIC_ITALIC_SKEW }] };
}

/** The font style to lay Arabic out in: upright where it is slanted by a skew instead. */
export function arabicFontStyle(italic: boolean): 'italic' | 'normal' {
  return italic && Platform.OS === 'web' ? 'italic' : 'normal';
}
