'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useId, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, SPACING, TYPOGRAPHY } from '../../../constants/theme';
import { useBottomChrome } from '../../../context/BottomChromeContext';
import { useReadingPreferences } from '../../../context/ReadingPreferencesContext';
import { tr } from '../../../utils/appText';
import { useIsCompactLandscape } from '../../../utils/useIsCompactLandscape';
import { useLayoutMode } from '../../../utils/useLayoutMode';
import Icon from './Icon';

interface BottomTabBarProps {
  /** Top-level Coptic Vine section. Switching tabs uses replace(), so the peer sections
   * never build a back-button stack on top of one another. */
  active: 'home' | 'books' | 'music' | 'learn' | 'account' | null;
}

export default function BottomTabBar({ active }: BottomTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { preferences } = useReadingPreferences();
  const isCompactLandscape = useIsCompactLandscape();
  // The iPad sets the tabs as a centred row; a desktop browser has the sidebar instead.
  const layout = useLayoutMode();
  const tablet = layout === 'tablet';
  const isArabic = preferences.appLanguage === 'ar';
  // The same five names the desktop sidebar shows (SideBar.tsx).
  const labels = {
    home: tr('Home', 'Accueil', 'الرئيسية'),
    books: tr('Books', 'Livres', 'الكتب'),
    music: tr('Music', 'Musique', 'الترانيم'),
    learn: tr('Learn', 'Apprendre', 'التعلّم'),
    account: tr('Account', 'Compte', 'الحساب'),
  };
  const labelStyle = [styles.tabLabel, isCompactLandscape && styles.tabLabelLandscape, tablet && styles.tabLabelTablet, isArabic && styles.tabLabelArabic];
  const tabStyle = [styles.tab, isCompactLandscape && styles.tabLandscape, tablet && styles.tabTablet];
  const iconSize = isCompactLandscape ? 22 : tablet ? 24 : 27;

  // Tell floating UI (the now-playing bar) where this bar's top edge is, so it
  // can sit just above it. Only while focused: screens lower in a stack keep
  // their tab bar mounted underneath the screen being shown.
  const { reportTabBar } = useBottomChrome();
  const reportId = useId();
  const barHeight = useRef(0);
  const focused = useRef(false);
  const reportHeight = useCallback((height: number) => {
    const nextHeight = Math.max(0, Math.round(height));
    barHeight.current = nextHeight;
    if (focused.current && nextHeight > 0) {
      reportTabBar(reportId, nextHeight);
    }
  }, [reportId, reportTabBar]);

  // On the desktop there is no bar for floating UI to sit above.
  useEffect(() => {
    if (layout !== 'desktop') return;
    barHeight.current = 0;
    reportTabBar(reportId, null);
  }, [layout, reportId, reportTabBar]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    if (barHeight.current > 0) {
      reportTabBar(reportId, barHeight.current);
    }
    return () => {
      focused.current = false;
      reportTabBar(reportId, null);
    };
  }, [reportId, reportTabBar]));

  if (layout === 'desktop') return null;

  return (
    <View
      style={styles.shell}
      onLayout={(event) => reportHeight(event.nativeEvent.layout.height)}
    >
      {/* The bar's green runs on under the iPhone's home indicator, with the
          tabs themselves above it. No screen with the tab bar insets its
          own bottom edge, so this is the only place it is made room for. */}
      <View accessibilityRole="tablist" style={[styles.bar, tablet && styles.barTablet, { paddingBottom: insets.bottom + (tablet ? 14 : 0) }]}>
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: active === 'home' }} accessibilityLabel={labels.home} style={tabStyle} onPress={() => router.replace('/')}>
        <Icon name="home-outline" size={iconSize} color={active === 'home' ? COLORS.gold : COLORS.muted} />
        <Text numberOfLines={1} style={[labelStyle, active === 'home' && styles.tabLabelActive]}>{labels.home}</Text>
      </Pressable>

      <Pressable accessibilityRole="tab" accessibilityState={{ selected: active === 'books' }} accessibilityLabel={labels.books} style={tabStyle} onPress={() => router.replace('/books')}>
        <Icon name="library-outline" size={iconSize} color={active === 'books' ? COLORS.gold : COLORS.muted} />
        <Text numberOfLines={1} style={[labelStyle, active === 'books' && styles.tabLabelActive]}>{labels.books}</Text>
      </Pressable>

      <Pressable accessibilityRole="tab" accessibilityState={{ selected: active === 'music' }} accessibilityLabel={labels.music} style={tabStyle} onPress={() => router.replace('/music')}>
        <Icon name="musical-notes" size={iconSize} color={active === 'music' ? COLORS.gold : COLORS.muted} />
        <Text numberOfLines={1} style={[labelStyle, active === 'music' && styles.tabLabelActive]}>{labels.music}</Text>
      </Pressable>

      <Pressable accessibilityRole="tab" accessibilityState={{ selected: active === 'learn' }} accessibilityLabel={labels.learn} style={tabStyle} onPress={() => router.replace('/learn')}>
        <Icon name="school-outline" size={iconSize} color={active === 'learn' ? COLORS.gold : COLORS.muted} />
        <Text numberOfLines={1} style={[labelStyle, active === 'learn' && styles.tabLabelActive]}>{labels.learn}</Text>
      </Pressable>

      <Pressable accessibilityRole="tab" accessibilityState={{ selected: active === 'account' }} accessibilityLabel={labels.account} style={tabStyle} onPress={() => router.replace('/account')}>
        <Icon name="person-circle-outline" size={iconSize} color={active === 'account' ? COLORS.gold : COLORS.muted} />
        <Text numberOfLines={1} style={[labelStyle, active === 'account' && styles.tabLabelActive]}>{labels.account}</Text>
      </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The tab bar sits on the deep green under a gold hairline (Coptic Vine, "TabBar").
  shell: { backgroundColor: COLORS.greenDeep },
  bar: {
    backgroundColor: COLORS.greenDeep,
    borderTopColor: COLORS.goldLine,
    borderTopWidth: 1,
    flexDirection: 'row',
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    paddingHorizontal: 0,
    paddingVertical: 10,
    position: 'relative',
  },
  // The iPad's tabs: a centred row of 80pt items, 56pt apart.
  barTablet: { gap: 56, justifyContent: 'center', paddingBottom: 14, paddingTop: 6 },
  tabTablet: { borderRadius: 16, flexBasis: 80, flexGrow: 0, flexShrink: 0, gap: 4, paddingVertical: 8, width: 80 },
  tabLabelTablet: { fontSize: 11.5 },
  tabLandscape: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
  },
  tabLabel: {
    color: COLORS.muted,
    fontFamily: TYPOGRAPHY.title,
    fontSize: 12,
    fontWeight: '700',
  },
  tabLabelLandscape: {
    fontSize: 14,
    flexShrink: 1,
  },
  tabLabelArabic: {
    fontFamily: TYPOGRAPHY.arabic,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  tabLabelActive: {
    color: COLORS.gold,
  },
});
