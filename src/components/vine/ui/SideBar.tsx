'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { Image, Pressable, type PressableStateCallbackType, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, TYPOGRAPHY } from '../../../constants/theme';
import { useReadingPreferences } from '../../../context/ReadingPreferencesContext';
import { useLiturgicalNow } from '../../../hooks/useLiturgicalNow';
import { tr } from '../../../utils/appText';
import { useOpenSection, type SectionHref } from '../../../utils/navigation';
import { formatCopticDayMonth, formatCopticYear, formatDayMonthDate } from '../../../utils/localeFormat';
import { SIDEBAR_WIDTH } from '../../../utils/useLayoutMode';
import Icon, { type IconName } from './Icon';

export type AppSection = 'home' | 'books' | 'music' | 'learn' | 'account';

const SECTIONS: { key: AppSection; href: SectionHref; icon: IconName; label: { english: string; french: string; arabic: string } }[] = [
  { key: 'home', href: '/', icon: 'home-outline', label: { english: 'Home', french: 'Accueil', arabic: 'الرئيسية' } },
  { key: 'books', href: '/books', icon: 'library-outline', label: { english: 'Books', french: 'Livres', arabic: 'الكتب' } },
  { key: 'music', href: '/music', icon: 'musical-notes', label: { english: 'Music', french: 'Musique', arabic: 'الترانيم' } },
  { key: 'learn', href: '/learn', icon: 'school-outline', label: { english: 'Learn', french: 'Apprendre', arabic: 'التعلّم' } },
  { key: 'account', href: '/account', icon: 'person-circle-outline', label: { english: 'Account', french: 'Compte', arabic: 'الحساب' } },
];

/**
 * react-native-web reports the pointer hovering over a Pressable in its style
 * callback's state; React Native's own types stop at `pressed`. The sidebar
 * only ever renders on a desktop browser, so the field is there to read.
 */
function isHovered(state: PressableStateCallbackType): boolean {
  return Boolean((state as PressableStateCallbackType & { hovered?: boolean }).hovered);
}

/** Which section a page belongs to, for the item the sidebar marks. */
export function sectionForPath(pathname: string): AppSection {
  // The Synaxarium and Beta Feedback are reached from Home's cards.
  if (pathname === '/' || pathname.startsWith('/synaxarium') || pathname.startsWith('/feedback')) return 'home';
  if (pathname.startsWith('/music')) return 'music';
  if (pathname.startsWith('/learn')) return 'learn';
  if (['/account', '/settings', '/app-settings', '/downloads'].some((root) => pathname.startsWith(root))) return 'account';
  return 'books';
}

/**
 * The desktop's left sidebar (Coptic Vine design system, "Layout and
 * spacing"): the seal and wordmark, the five sections — the current one in
 * gold on a gold wash — and today's date in both calendars at its foot, the
 * Coptic one the liturgical day's, which begins the evening before. It
 * takes the place of the bottom tab bar, and like it, opens a section afresh
 * (utils/navigation.ts, useOpenSection) rather than stacking it.
 */
export default function SideBar({ pathname }: { pathname: string }) {
  const openSection = useOpenSection();
  const insets = useSafeAreaInsets();
  const { preferences } = useReadingPreferences();
  const arabic = preferences.appLanguage === 'ar';
  const active = sectionForPath(pathname);
  // Rolls over with the page left open: the Coptic date on the eve, the civil one at midnight.
  const { today, coptic: copticToday } = useLiturgicalNow();

  return (
    <View style={[styles.side, { paddingTop: insets.top + 24 }]}>
      <View style={styles.brand}>
        <Image source={require('../../../../assets/images/coptic-vine-seal-screen.png')} style={styles.seal} accessibilityIgnoresInvertColors />
        <Text style={styles.wordmark} numberOfLines={1}>Coptic Vine</Text>
      </View>

      {SECTIONS.map((section) => {
        const on = section.key === active;
        const accent = COLORS.gold;
        const label = tr(section.label.english, section.label.french, section.label.arabic);
        return (
          <Pressable
            key={section.key}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={label}
            onPress={() => openSection(section.href)}
            style={(state) => [
              styles.item,
              on && { backgroundColor: COLORS.goldSoft },
              !on && (isHovered(state) || state.pressed) && styles.itemHover,
            ]}
          >
            <Icon name={section.icon} size={21} color={on ? accent : COLORS.muted} />
            <Text style={[styles.itemLabel, on && { color: COLORS.gold }, arabic && styles.arabic]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}

      <View style={[styles.foot, { paddingBottom: insets.bottom }]}>
        <Text style={[styles.footText, arabic && styles.arabic]}>{formatDayMonthDate(today, arabic)}</Text>
        {copticToday ? (
          <Text style={[styles.footText, styles.footCoptic, arabic && styles.arabic]}>
            {`${formatCopticDayMonth(copticToday.monthName, copticToday.day, arabic)}${arabic ? ' ' : ', '}${formatCopticYear(copticToday.year, arabic)}`}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  side: { backgroundColor: COLORS.greenDeep, gap: 4, paddingBottom: 24, paddingHorizontal: 16, width: SIDEBAR_WIDTH },
  brand: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingBottom: 22, paddingHorizontal: 8 },
  seal: { borderRadius: 22, height: 44, width: 44 },
  wordmark: { color: COLORS.white, flexShrink: 1, fontFamily: TYPOGRAPHY.title, fontSize: 21, fontWeight: '700' },
  item: { alignItems: 'center', borderRadius: 14, flexDirection: 'row', gap: 12, height: 46, paddingHorizontal: 14 },
  itemHover: { backgroundColor: 'rgba(255, 255, 255, 0.04)' },
  itemLabel: { color: COLORS.muted, flexShrink: 1, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '600' },
  foot: { marginTop: 'auto', paddingHorizontal: 8 },
  footText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, lineHeight: 19.5 },
  footCoptic: { color: COLORS.goldBright, fontWeight: '600' },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
});
