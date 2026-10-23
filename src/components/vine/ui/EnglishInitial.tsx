import { memo } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { EnglishInitialMetrics } from '../openingInitials';

/**
 * A hymn's English opening initial on a slide (openingInitials.ts): its first
 * letter two lines tall in Corinthia, in the season's letter colour, stroked
 * in that colour over its shadow, as the scrolling reader draws it. It takes
 * line 1's room beside it; JustifiedText sets line 2 a little further in.
 */
export const EnglishInitial = memo(function EnglishInitial({ letter, metrics, color }: {
  letter: string;
  metrics: EnglishInitialMetrics;
  color: string;
}) {
  const { drawing, glyph } = metrics;
  return (
    <View accessible accessibilityLabel={letter} style={{ height: metrics.height, width: metrics.firstRoom }}>
      <Svg
        width={drawing.width}
        height={drawing.height}
        viewBox={drawing.viewBox}
        style={{ left: drawing.left, position: 'absolute', top: drawing.top }}
      >
        <Path d={glyph.path} fill="rgba(0, 0, 0, 0.6)" transform={`translate(${metrics.shadowOffset} ${metrics.shadowOffset})`} />
        <Path d={glyph.path} fill={color} stroke={color} strokeWidth={metrics.strokeWidth} strokeLinejoin="round" />
      </Svg>
    </View>
  );
});
