import { Asset } from 'expo-asset';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

const copticFontModule = require('../../assets/fonts/CopticVine-Regular-v4.1.ttf');
// Coptic set in italic (comments, refrains) has its own face rather than a
// slant the browser or the system fakes.
const copticItalicFontModule = require('../../assets/fonts/CopticVine-Italic-v4.1.ttf');

const cachedDataUris = new Map<unknown, string>();

/**
 * Loads a bundled font and returns it as a base64 data: URI so it can be
 * embedded in a WebView's @font-face — WebView content can't see fonts
 * registered with expo-font in the RN side, and file:// font loading is
 * unreliable across Android/iOS WebView configurations.
 *
 * expo-file-system's readAsStringAsync isn't available on web, so web reads
 * the asset via fetch()+FileReader instead of the native file API.
 */
function useFontDataUri(fontModule: unknown) {
  const [dataUri, setDataUri] = useState<string | null>(() => cachedDataUris.get(fontModule) ?? null);

  useEffect(() => {
    if (cachedDataUris.has(fontModule)) return;
    let cancelled = false;

    (async () => {
      const asset = Asset.fromModule(fontModule as number);
      await asset.downloadAsync();
      if (!asset.localUri) return;

      const uri = Platform.OS === 'web' ? await readAsDataUriWeb(asset.localUri) : await readAsDataUriNative(asset.localUri);
      if (!uri) return;

      cachedDataUris.set(fontModule, uri);
      if (!cancelled) setDataUri(uri);
    })();

    return () => {
      cancelled = true;
    };
  }, [fontModule]);

  return dataUri;
}

/** The Coptic Vine face, as a data: URI for a page's @font-face. */
export function useCopticFontDataUri() {
  return useFontDataUri(copticFontModule);
}

/** Its italic, as a data: URI for the same family's italic @font-face. */
export function useCopticItalicFontDataUri() {
  return useFontDataUri(copticItalicFontModule);
}

async function readAsDataUriNative(localUri: string) {
  const FileSystem = await import('expo-file-system/legacy');
  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' });
  return `data:font/ttf;base64,${base64}`;
}

async function readAsDataUriWeb(localUri: string) {
  const response = await fetch(localUri);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
