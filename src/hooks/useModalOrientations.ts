import { useReadingPreferences } from '../context/ReadingPreferencesContext';
import { MODAL_SUPPORTED_ORIENTATIONS } from '../utils/modalOrientations';
import type { OrientationMode } from '../utils/preferencesStorage';

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
export function useModalOrientations(): ModalOrientations {
  const { preferences } = useReadingPreferences();
  return modalOrientationsFor(preferences.orientationMode);
}
