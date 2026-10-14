'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { type ErrorBoundaryProps, router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import NoticeScreen from '../ui/NoticeScreen';
import { tr } from '../../../utils/appText';
import { getCurrentAppLanguage } from '../../../utils/preferencesStorage';

/**
 * What the app shows when a page throws while rendering. It is exported from
 * the root layout as its ErrorBoundary, and Expo Router draws it in place of
 * the whole layout — providers, sidebar and all — so it brings its own safe
 * area and reads the App Language from the module store rather than a
 * context that is no longer mounted above it.
 */
export default function AppErrorScreen({ error, retry }: ErrorBoundaryProps) {
  const arabic = getCurrentAppLanguage() === 'ar';
  return (
    <SafeAreaProvider>
      <NoticeScreen
        arabic={arabic}
        title={tr('Something went wrong', 'Une erreur s’est produite', 'حدث خطأ ما')}
        body={tr(
          'Coptic Vine ran into a problem showing this page. Trying again usually puts it right.',
          'Coptic Vine a rencontré un problème en affichant cette page. Réessayer suffit généralement.',
          'واجه كوبتك فاين مشكلة أثناء عرض هذه الصفحة. غالبًا ما تُحل بالمحاولة مرة أخرى.',
        )}
        detail={error.message}
        actions={[
          { label: tr('Try again', 'Réessayer', 'حاول مرة أخرى'), onPress: () => void retry(), primary: true },
          {
            label: tr('Go to Home', 'Aller à l’accueil', 'الذهاب إلى الرئيسية'),
            onPress: () => {
              // Leave the page that failed before rendering again, or the
              // retry would simply reproduce it.
              router.replace('/');
              void retry();
            },
          },
        ]}
      />
    </SafeAreaProvider>
  );
}
