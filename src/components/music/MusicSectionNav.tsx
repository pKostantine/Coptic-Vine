'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import SegmentNav from '@/components/vine/ui/SegmentNav';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';

import { tr } from '../../utils/appText';
export type MusicSection = 'home' | 'search' | 'library';

const ROUTES: Record<MusicSection, '/music' | '/music/search' | '/music/library'> = {
  home: '/music',
  search: '/music/search',
  library: '/music/library',
};

/** Music's sections — Home, Search, Library — on the gold pill (Coptic Vine design, "Music"). */
export default function MusicSectionNav({ active, flush = false }: { active: MusicSection; flush?: boolean }) {
  const router = useRouter();
  const { preferences } = useReadingPreferences();
  const arabic = preferences.appLanguage === 'ar';
  const items = [
    { key: 'home' as const, label: tr('Home', 'Accueil', 'الرئيسية') },
    { key: 'search' as const, label: tr('Search', 'Rechercher', 'بحث') },
    { key: 'library' as const, label: tr('Library', 'Bibliothèque', 'المكتبة') },
  ];

  // The sections replace one another rather than stack, so Search is told
  // which one it was opened from: its Back returns there, not out of Music.
  const select = (key: MusicSection) => {
    if (key === active) return;
    router.replace(key === 'search' ? { pathname: ROUTES.search, params: { from: active } } : ROUTES[key]);
  };

  return (
    <View style={[styles.row, flush && styles.flush]}>
      <SegmentNav items={items} active={active} arabic={arabic} onSelect={select} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16 },
  flush: { paddingHorizontal: 0 },
});
