import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { HEADPIECES, MEDALLION, type HeadpieceOrnament } from '../../../constants/documentOrnaments';
import type { OrnamentArt } from '../../../constants/ornamentArt';
import { fitHeadpieceTitle, HEADPIECE_LINE_HEIGHT, HEADPIECE_MIN_SCALE } from '../../../utils/headpieceFit';

function ornamentXml(art: OrnamentArt, color: string): string {
  // Drawn in currentColor; set to the colour here rather than through
  // SvgXml's color prop, so every platform's renderer agrees.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${art.width} ${art.height}">${art.body.split('currentColor').join(color)}</svg>`;
}

export function headpieceSize(kind: HeadpieceOrnament, availableWidth: number) {
  const art = HEADPIECES[kind].art;
  // The full width of the page, its height following the art's proportions.
  const width = Math.max(1, availableWidth);
  return { width, height: (width * art.height) / art.width };
}

export function medallionSize(availableWidth: number): number {
  return Math.round(Math.min(Math.max(availableWidth * 0.28, 96), 150));
}

/**
 * A title set inside its headpiece (Coptic Vine Ornaments 1) for the
 * slideshow, as the reader sets it: the frame across the slide and the title
 * in its open space, sized with the frame but never below a phone's reading
 * size, and shrunk to fit should a long name need it.
 */
export const Headpiece = memo(function Headpiece({ kind, availableWidth, color, text, arabic }: {
  kind: HeadpieceOrnament;
  availableWidth: number;
  color: string;
  text: string;
  arabic: boolean;
}) {
  const frame = HEADPIECES[kind];
  const { width, height } = headpieceSize(kind, availableWidth);
  const xml = useMemo(() => ornamentXml(frame.art, color), [frame.art, color]);
  const { left, right, top, bottom } = frame.text;
  // Sized to fit before it is drawn (utils/headpieceFit.ts), the same on every
  // platform: a browser does nothing with adjustsFontSizeToFit, and cut a long
  // name short; the phones' own shrinking stays, should the estimate be short.
  const box = { width: (width * (100 - left - right)) / 100, height: (height * (100 - top - bottom)) / 100 };
  const fit = fitHeadpieceTitle(text, box, Math.max(frame.minFontSize, (width * frame.fontSize) / 100), arabic);
  const fontSize = fit.fontSize;
  const lines = Math.max(fit.lines, Math.floor(box.height / (fontSize * HEADPIECE_LINE_HEIGHT)), 1);
  return (
    <View style={{ height, width }} accessibilityRole="header" accessibilityLabel={text}>
      <SvgXml xml={xml} width={width} height={height} />
      <View pointerEvents="none" style={[styles.text, { bottom: `${bottom}%`, left: `${left}%`, right: `${right}%`, top: `${top}%` }]}>
        <Text
          selectable={false}
          adjustsFontSizeToFit
          minimumFontScale={HEADPIECE_MIN_SCALE}
          numberOfLines={lines}
          style={[
            styles.title,
            arabic && styles.titleArabic,
            { color, fontSize, letterSpacing: arabic ? 0 : fontSize * 0.05, lineHeight: Math.round(fontSize * HEADPIECE_LINE_HEIGHT) },
          ]}
        >
          {arabic ? text : text.toLocaleUpperCase()}
        </Text>
      </View>
    </View>
  );
});

/** The cross roundel that closes a service. */
export const Medallion = memo(function Medallion({ size, color }: { size: number; color: string }) {
  const xml = useMemo(() => ornamentXml(MEDALLION, color), [color]);
  return <SvgXml xml={xml} width={size} height={size} />;
});

const styles = StyleSheet.create({
  text: { alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  title: { fontFamily: 'Georgia', fontWeight: '400', textAlign: 'center' },
  titleArabic: { fontFamily: 'Arial', writingDirection: 'rtl' },
});
