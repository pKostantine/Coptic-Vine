import { memo, useMemo } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { COPTIC_INITIAL_VIEWBOX, COPTIC_INITIAL_VINE_PIECES, COPTIC_INITIALS } from '../../../constants/copticInitialArt';
import { copticInitialMetrics, copticLockupGap } from '../copticInitial';

function initialXml(letter: string, vineColor: string, letterColor: string): string {
  // Coloured here rather than through SvgXml's color prop, as the ornaments
  // are (DocumentOrnaments.tsx), so every platform's renderer agrees.
  const art = COPTIC_INITIALS[letter];
  const vine = art.vine.map((piece) => `<path d="${COPTIC_INITIAL_VINE_PIECES[piece]}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${COPTIC_INITIAL_VIEWBOX}"><g fill="${vineColor}">${vine}</g><path fill="${letterColor}" d="${art.letter}"/></svg>`;
}

/**
 * A titled hymn's decorated initial on a slide (copticInitial.ts), as the
 * scrolling reader sets it: the letter in the ornaments' colour and its vine
 * in the titles' gold, two lines tall beside the lines it opens; beside a
 * paragraph of one line, two lines tall still with the line centred beside
 * it, set tight to the letter (the lockup); one line tall only on a centred
 * line. JustifiedText takes its room out of those lines and sets it beside
 * them.
 */
export const CopticInitial = memo(function CopticInitial({ letter, mode, lineHeight, vineColor, letterColor }: {
  letter: string;
  mode: 'one' | 'two' | 'lockup';
  /** The Coptic line it stands beside. */
  lineHeight: number;
  vineColor: string;
  letterColor: string;
}) {
  const metrics = copticInitialMetrics(lineHeight);
  const tall = mode === 'two' || mode === 'lockup';
  const box = tall ? metrics.two : metrics.one;
  // The lockup's line starts just past the box (copticLockupGap), where the two-line one tucks line 1 in.
  const marginRight = mode === 'lockup' ? copticLockupGap(letter, lineHeight) : box.right;
  const xml = useMemo(() => initialXml(letter, vineColor, letterColor), [letter, vineColor, letterColor]);
  return (
    <View
      accessible
      accessibilityLabel={letter}
      style={{ height: box.height, marginLeft: box.left, marginRight, marginTop: tall ? metrics.two.top : 0, width: box.width }}
    >
      <SvgXml xml={xml} width={box.width} height={box.height} />
    </View>
  );
});
