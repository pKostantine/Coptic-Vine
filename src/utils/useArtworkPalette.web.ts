import { useEffect, useState } from 'react';

import { type ArtworkPalette, paletteFromPixels } from '@/utils/artworkPalette';

// A cover is read at this size: enough pixels to find its colours, few
// enough to cost nothing.
const SAMPLE = 48;
const palettes = new Map<string, ArtworkPalette | null>();
const reading = new Map<string, Promise<ArtworkPalette | null>>();

/** The cover's colours, read once per cover from a small canvas copy of it. */
function readPalette(uri: string): Promise<ArtworkPalette | null> {
  if (palettes.has(uri)) return Promise.resolve(palettes.get(uri) ?? null);
  let promise = reading.get(uri);
  if (!promise) {
    promise = new Promise<ArtworkPalette | null>((resolve) => {
      const image = new window.Image();
      // The media resolver allows any origin, so the pixels can be read.
      image.crossOrigin = 'anonymous';
      image.decoding = 'async';
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = SAMPLE;
          canvas.height = SAMPLE;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          if (!context) {
            resolve(null);
            return;
          }
          context.drawImage(image, 0, 0, SAMPLE, SAMPLE);
          resolve(paletteFromPixels(context.getImageData(0, 0, SAMPLE, SAMPLE).data));
        } catch {
          // An image the page may not read (no CORS): the blurred cover stays.
          resolve(null);
        }
      };
      image.onerror = () => resolve(null);
      image.src = uri;
    }).then((palette) => {
      palettes.set(uri, palette);
      reading.delete(uri);
      return palette;
    });
    reading.set(uri, promise);
  }
  return promise;
}

/**
 * The colours of the cover at `uri`, once read. While the next cover is
 * being read the last one's stay, so the player never flashes to grey.
 */
export function useArtworkPalette(uri: string | null): ArtworkPalette | null {
  const [palette, setPalette] = useState<ArtworkPalette | null>(() => (uri ? palettes.get(uri) ?? null : null));
  useEffect(() => {
    if (!uri) return;
    let active = true;
    void readPalette(uri).then((next) => {
      if (active && next) setPalette(next);
    });
    return () => { active = false; };
  }, [uri]);
  return palette;
}
