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

/**
 * The part of a native failure that says what went wrong: expo's wrapper
 * ("FunctionCallException: Calling the 'finalizeAsync' function has failed
 * (at …) → Caused by: SQLiteErrorException: Error code 5: database is
 * locked (at …)") comes down to "database is locked".
 */
function rootCause(message: string): string {
  const cause = message.split(/Caused by:/).pop() ?? message;
  return cause
    .replace(/\s*\(at [^)]*\)/g, '')
    .replace(/^\s*(?:[\w.]*(?:Exception|Error):\s*)+/, '')
    .replace(/^Error code \d+:\s*/i, '')
    .trim();
}

/**
 * A download that failed, as the reader should see it: what to do about it,
 * and, where the app has nothing kinder to say, the cause in a few words
 * (`detail`), the native exception it came wrapped in left out.
 */
export function describeDownloadError(message: string | null | undefined, language: AppLanguage = getCurrentAppLanguage()): { title: string; hint: string; detail: string | null } {
  const text = message?.trim() ?? '';
  // The app's own "Connect to the internet…" (assertDownloadNetworkAllowed) says the same as the platforms' phrases.
  if (isLostConnectionMessage(text) || /^Connect to the internet/.test(text)) {
    const offline = describeLoadError('Network request failed', language);
    return { title: offline.title, hint: offline.hint, detail: null };
  }
  // The Download over cellular and Videos over cellular switches are on the Downloads page itself.
  if (/^Downloads are set to Wi-Fi only/.test(text)) {
    return {
      title: tr('Waiting for Wi‑Fi', 'En attente du Wi‑Fi', 'في انتظار الواي فاي', language),
      hint: tr(
        'Downloads are set to Wi‑Fi only. Connect to Wi‑Fi, or turn on Download over cellular on this page.',
        'Les téléchargements sont réglés sur Wi‑Fi uniquement. Connectez-vous au Wi‑Fi, ou activez Télécharger en données cellulaires sur cette page.',
        'التنزيلات مضبوطة على الواي فاي فقط. اتصل بالواي فاي، أو فعّل التنزيل عبر بيانات الجوال في هذه الصفحة.',
        language,
      ),
      detail: null,
    };
  }
  if (/^Video downloads over cellular are turned off/.test(text)) {
    return {
      title: tr('Waiting for Wi‑Fi', 'En attente du Wi‑Fi', 'في انتظار الواي فاي', language),
      hint: tr(
        'Videos download over Wi‑Fi only. Connect to Wi‑Fi, or turn on Videos over cellular on this page.',
        'Les vidéos se téléchargent en Wi‑Fi uniquement. Connectez-vous au Wi‑Fi, ou activez Vidéos en données cellulaires sur cette page.',
        'يُنزَّل الفيديو عبر الواي فاي فقط. اتصل بالواي فاي، أو فعّل الفيديو عبر بيانات الجوال في هذه الصفحة.',
        language,
      ),
      detail: null,
    };
  }
  if (/database or disk is full|SQLITE_FULL|no space left|ENOSPC|not enough (?:free )?space/i.test(text)) {
    return {
      title: tr('Not enough space', 'Espace insuffisant', 'لا توجد مساحة كافية', language),
      hint: tr('Free up some space on this device, then try again.', 'Libérez de l’espace sur cet appareil, puis réessayez.', 'أفرغ بعض المساحة على هذا الجهاز ثم حاول مرة أخرى.', language),
      detail: null,
    };
  }
  return {
    title: tr('The download didn’t finish', 'Le téléchargement n’a pas abouti', 'لم يكتمل التنزيل', language),
    hint: tr('Please try again.', 'Veuillez réessayer.', 'يُرجى المحاولة مرة أخرى.', language),
    detail: text ? rootCause(text) || null : null,
  };
}
