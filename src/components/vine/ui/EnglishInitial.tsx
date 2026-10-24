import { memo } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { EnglishInitialMetrics } from '../openingInitials';

/**
 * A hymn's English opening initial on a slide (openingInitials.ts): its first
 * letter, an Old English capital, its capitals from line 1's to line 2's
 * baseline and as wide as its own letter, in the initials' letter colour as
 * the Coptic's letter is. It takes line 1's room beside it; JustifiedText sets
 * line 2 a little further in when the gap steps.
 */
export const EnglishInitial = memo(function EnglishInitial({ letter, metrics, color }: {
  letter: string;
  metrics: EnglishInitialMetrics;
  color: string;
}) {
  return (
    <View accessible accessibilityLabel={letter} style={{ height: metrics.height, width: metrics.firstRoom }}>
      <Svg
        width={metrics.width}
        height={metrics.drawingHeight}
        viewBox={metrics.art.viewBox}
        style={{ left: 0, position: 'absolute', top: metrics.top }}
      >
        <Path d={metrics.art.letter} fill={color} />
      </Svg>
    </View>
  );
});
