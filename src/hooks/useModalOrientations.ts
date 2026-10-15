import { createContext, useContext } from 'react';

import { useReadingPreferences } from '../context/ReadingPreferencesContext';
import { MODAL_SUPPORTED_ORIENTATIONS } from '../utils/modalOrientations';
import { READING_DEVICE_CLASS, type OrientationMode } from '../utils/preferencesStorage';

/**
 * Set by a reading screen (a service, a Bible chapter), which turns with
 * Book Settings' Orientation even on a phone -- where every other screen
 * stays upright (utils/screenOrientation.ts).
 */
export const ReaderScreenContext = createContext(false);

type ModalOrientations = typeof MODAL_SUPPORTED_ORIENTATIONS;

const LANDSCAPE: ModalOrientations = ['landscape', 'landscape-left', 'landscape-right'];
const PORTRAIT: ModalOrientations = ['portrait'];

/** The orientations a Modal may take under the Book Settings' orientation choice. */
export function modalOrientationsFor(mode: OrientationMode): ModalOrientations {
  if (mode === 'portrait') return PORTRAIT;
  // Both landscapes, not the one the screens are locked to: React Native's
  // left/right and the screens' left/right are named from opposite sides, and
  // a Modal that shares no orientation with the window it opens over is a
  // crash on iOS.
  if (mode === 'landscape' || mode === 'reverseLandscape') return LANDSCAPE;
  return MODAL_SUPPORTED_ORIENTATIONS;
}

/**
 * What every Modal passes as supportedOrientations. Left out, iOS presents a
 * Modal portrait-only, and an iPad held in landscape aborts the app opening
 * it ("no common orientation"); given everything, a Modal turns with the
 * device even when the app is locked to one way. This keeps each one to the
 * orientation lock the screens beneath it follow (see AppStack in _layout).
 */
export function useModalOrientations(onReaderScreen = false): ModalOrientations {
  const { preferences } = useReadingPreferences();
  // A reading screen says so itself where it asks above its own provider.
  const reader = useContext(ReaderScreenContext) || onReaderScreen;
  // Over a phone's upright pages a sheet stays upright too, rather than
  // turning on its own over a page that doesn't.
  if (READING_DEVICE_CLASS === 'phone' && !reader) return PORTRAIT;
  return modalOrientationsFor(preferences.orientationMode);
}
