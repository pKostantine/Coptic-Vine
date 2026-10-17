import { useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import type { DocumentTheme } from '../../../constants/documentThemes';

/**
 * A document's page runs up under the status bar. On a light page (Paper,
 * Sepia) the clock and battery turn dark so they can still be read: a status
 * bar of its own, mounted only while the document is the screen showing, so
 * the app's light one comes back the moment another screen is. A component
 * rather than StatusBar.setStyle, because the drawers mount status bars of
 * their own and closing one re-applies whatever is mounted beneath it.
 */
export default function DocumentStatusBar({ theme }: { theme: DocumentTheme }) {
  const focused = useIsFocused();
  return focused && !theme.dark ? <StatusBar style="dark" /> : null;
}
