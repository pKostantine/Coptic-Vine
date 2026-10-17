import { NativeModule, requireOptionalNativeModule } from 'expo';

type TrackControlsEvents = {
  onNextTrack: () => void;
  onPreviousTrack: () => void;
};

declare class TrackControlsModule extends NativeModule<TrackControlsEvents> {
  setTrackControls(canGoNext: boolean, canGoPrevious: boolean): void;
}

/** The app's own module (modules/track-controls): iOS only, and only in builds made since it was added. */
const native = requireOptionalNativeModule<TrackControlsModule>('TrackControls');

/**
 * Whether the lock screen can show next and previous track buttons. A build
 * without the module, Android and the web keep expo-audio's 10-second skips.
 */
export const hasTrackControls = native != null;

/** Which of the lock screen's track buttons can be pressed; both off when nothing is playing. */
export function setTrackControls(canGoNext: boolean, canGoPrevious: boolean): void {
  native?.setTrackControls(canGoNext, canGoPrevious);
}

/** Calls back when the lock screen's (or Control Center's, or headphones') next or previous track button is pressed. */
export function addTrackControlListener(event: keyof TrackControlsEvents, listener: () => void): { remove(): void } | null {
  return native?.addListener(event, listener) ?? null;
}
