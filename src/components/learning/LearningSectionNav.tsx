'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import SegmentNav from '@/components/vine/ui/SegmentNav';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';

import { tr } from '../../utils/appText';
export type LearningSection = 'home' | 'search' | 'library';

const ROUTES: Record<LearningSection, '/learn' | '/learn/search' | '/learn/library'> = {
  home: '/learn',
  search: '/learn/search',
  library: '/learn/library',
};

/** Learn & Study's sections — Discover, Search, My Learning — on the gold pill (Coptic Vine design, "Learn"). */
export default function LearningSectionNav({ active, flush = false }: { active: LearningSection; flush?: boolean }) {
  const router = useRouter();
  const { preferences } = useReadingPreferences();
  const arabic = preferences.appLanguage === 'ar';
  const items = [
    { key: 'home' as const, label: tr('Discover', 'Découvrir', 'اكتشف') },
    { key: 'search' as const, label: tr('Search', 'Rechercher', 'بحث') },
    { key: 'library' as const, label: tr('My Learning', 'Mon apprentissage', 'تعلّمي') },
  ];

  return (
    <View style={[styles.row, flush && styles.flush]}>
      <SegmentNav items={items} active={active} arabic={arabic} onSelect={(key) => { if (key !== active) router.replace(ROUTES[key]); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16 },
  flush: { paddingHorizontal: 0 },
});
