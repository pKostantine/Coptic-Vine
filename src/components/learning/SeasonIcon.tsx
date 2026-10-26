import { useMemo } from 'react';
import { SvgXml } from 'react-native-svg';

import { SEASON_ICONS, seasonIconFor } from '@/constants/seasonIcons';

/**
 * A season's icon (Coptic Vine design, "Season icons") at a size and colour.
 * The colour is written into the drawing rather than left to `currentColor`,
 * so it reads the same on the web and on a phone.
 */
export default function SeasonIcon({ slug, size, color }: { slug: string; size: number; color: string }) {
  const xml = useMemo(() => SEASON_ICONS[seasonIconFor(slug)].replaceAll('currentColor', color), [slug, color]);
  return <SvgXml xml={xml} width={size} height={size} />;
}
