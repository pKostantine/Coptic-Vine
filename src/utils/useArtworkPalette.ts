import type { ArtworkPalette } from '@/utils/artworkPalette';

/**
 * The cover's colours, for tinting the player. On iOS and Android the player
 * keeps its blurred cover: reading the pixels there would mean decoding the
 * whole image on the JavaScript thread. (The web reads them: .web.ts.)
 */
export function useArtworkPalette(_uri: string | null): ArtworkPalette | null {
  return null;
}
