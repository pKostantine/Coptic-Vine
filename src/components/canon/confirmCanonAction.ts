import { Alert, Platform } from 'react-native';

import { tr } from '@/utils/appText';

/**
 * Asks before something that can't be taken back (a link turned off, a
 * support person removed): the browser's own confirm on the web, an alert on
 * a phone with the action in red.
 */
export function confirmCanonAction({ question, detail, action }: { question: string; detail: string; action: string }, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if ((globalThis as { confirm?: (message: string) => boolean }).confirm?.(`${question}\n${detail}`)) onConfirm();
    return;
  }
  Alert.alert(question, detail, [
    { text: tr('Cancel', 'Annuler', 'إلغاء'), style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}
