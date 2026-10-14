import { tr } from './appText';
import type { AppLanguage } from './preferencesStorage';
import { getCurrentAppLanguage } from './preferencesStorage';

export interface LoadErrorDescription {
  title: string;
  hint: string;
  /** The failure's own words, where they add anything to the hint; null for a plain lost connection. */
  detail: string | null;
}

/**
 * What each platform's fetch says when the network is unreachable. None of
 * these means anything to a reader; "You're offline" does. Matched as whole
 * phrases rather than the word "offline", which the app's own messages use
 * for other things (an offline book missing a function, say).
 */
const LOST_CONNECTION = [
  /network request failed/i, // React Native
  /failed to fetch/i, // Chromium
  /load failed/i, // WebKit
  /networkerror when attempting to fetch/i, // Firefox
  /fetch failed/i, // Node's undici
  /ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION/i,
  /ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT/i,
  /the internet connection appears to be offline/i, // iOS
  /unable to resolve host/i, // Android
];

/** Whether a failure's message is one of the platforms' ways of saying the network is unreachable. */
export function isLostConnectionMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  return LOST_CONNECTION.some((pattern) => pattern.test(message));
}

/**
 * A load failure as the reader should see it: a title saying what kind of
 * thing went wrong, a hint saying what to do, and the message itself only
 * where it still says something the hint does not.
 */
export function describeLoadError(message: string | null | undefined, language: AppLanguage = getCurrentAppLanguage()): LoadErrorDescription {
  if (isLostConnectionMessage(message)) {
    return {
      title: tr('You’re offline', 'Vous êtes hors ligne', 'أنت غير متصل بالإنترنت', language),
      hint: tr(
        'Check your connection and try again.',
        'Vérifiez votre connexion et réessayez.',
        'تحقّق من اتصالك ثم حاول مرة أخرى.',
        language,
      ),
      detail: null,
    };
  }
  return {
    title: tr('Couldn’t load this', 'Chargement impossible', 'تعذّر التحميل'),
    hint: tr(
      'Something went wrong on the way. Trying again usually puts it right.',
      'Un problème est survenu en cours de route. Réessayer suffit généralement.',
      'حدث خطأ ما أثناء التحميل. غالبًا ما تُحل المشكلة بالمحاولة مرة أخرى.',
      language,
    ),
    detail: message?.trim() || null,
  };
}
