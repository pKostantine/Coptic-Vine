'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { type Href, usePathname, useRouter } from 'expo-router';
import Head from 'expo-router/head';

import NoticeScreen, { type NoticeAction } from '../ui/NoticeScreen';
import { useReadingPreferences } from '../../../context/ReadingPreferencesContext';
import { tr } from '../../../utils/appText';
import { goBack } from '../../../utils/navigation';

interface NotFoundScreenProps {
  /** Where "Go back" lands when there is no history to pop — the menu a bad service link would have come from. */
  backHref?: Href;
}

/**
 * The page for an address that leads nowhere: a mistyped link, a service id
 * the manifest no longer has, a route from an older version of the app. The
 * website falls back to the app for every unknown path, so this is what a
 * visitor with a bad link sees, in place of the router's own unstyled notice.
 */
export default function NotFoundScreen({ backHref }: NotFoundScreenProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { preferences } = useReadingPreferences();
  const arabic = preferences.appLanguage === 'ar';
  const title = tr('Page not found', 'Page introuvable', 'الصفحة غير موجودة');

  const actions: NoticeAction[] = [
    { label: tr('Go to Home', 'Aller à l’accueil', 'الذهاب إلى الرئيسية'), onPress: () => router.replace('/'), primary: true },
  ];
  // A second way out only where it leads somewhere Home does not.
  if (backHref || router.canGoBack()) {
    actions.push({ label: tr('Go back', 'Retour', 'رجوع'), onPress: () => goBack(router, backHref ?? '/') });
  }

  return (
    <>
      <Head>
        <title>{`${title} — Coptic Vine`}</title>
      </Head>
      <NoticeScreen
        arabic={arabic}
        title={title}
        body={tr(
          'This link doesn’t lead anywhere in Coptic Vine. It may have moved, or the address may be mistyped.',
          'Ce lien ne mène nulle part dans Coptic Vine. Il a peut-être changé, ou l’adresse contient une erreur.',
          'هذا الرابط لا يؤدي إلى أي صفحة في كوبتك فاين. ربما تغيّر مكانها، أو أن العنوان مكتوب بشكل خاطئ.',
        )}
        detail={pathname}
        actions={actions}
      />
    </>
  );
}
