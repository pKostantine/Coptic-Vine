import { memo } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ENGLISH_INITIAL_VIEWBOX } from '../../../constants/englishInitialArt';
import type { EnglishInitialMetrics } from '../openingInitials';

/**
 * A hymn's English opening initial on a slide (openingInitials.ts): its first
 * letter, an Old English capital with a rising vine, in a square from line 1's
 * capitals to line 2's baseline, its vine and letter in the initials' colours
 * as the Coptic's are. It takes line 1's room beside it; JustifiedText sets
 * line 2 a little further in when the gap steps.
 */
export const EnglishInitial = memo(function EnglishInitial({ letter, metrics, vineColor, letterColor }: {
  letter: string;
  metrics: EnglishInitialMetrics;
  vineColor: string;
  letterColor: string;
}) {
  return (
    <View accessible accessibilityLabel={letter} style={{ height: metrics.height, width: metrics.firstRoom }}>
      <Svg
        width={metrics.size}
        height={metrics.size}
        viewBox={ENGLISH_INITIAL_VIEWBOX}
        style={{ left: 0, position: 'absolute', top: metrics.top }}
      >
        <Path d={metrics.art.vine} fill={vineColor} />
        <Path d={metrics.art.letter} fill={letterColor} />
      </Svg>
    </View>
  );
});
