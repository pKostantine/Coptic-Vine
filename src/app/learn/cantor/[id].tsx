'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import LearningMiniPlayer from '@/components/learning/LearningMiniPlayer';
import ReleaseTile from '@/components/music/ReleaseTile';
import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { PageGutterProvider, SectionHeading } from '@/components/vine/screens/BookPage';
import Icon from '@/components/vine/ui/Icon';
import LoadFailure from '@/components/vine/ui/LoadFailure';
import { BuddedCross } from '@/components/vine/ui/Ornaments';
import PersonHero from '@/components/vine/ui/PersonHero';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { learningService } from '@/services/learningService';
import type { LearningCantorDetail } from '@/types/learningPlatform';
import { goBack } from '@/utils/navigation';
import { useContentWidth, useLayoutMode } from '@/utils/useLayoutMode';

import { tr } from '../../../utils/appText';

/**
 * A cantor (Coptic Vine design, "Cantor"): their photo glowing out of the
 * page and their name, then their learning albums and lesson sets as covers.
 */
export default function LearningCantorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { preferences } = useReadingPreferences();
  const locale = preferences.appLanguage === 'ar' ? 'ar' : 'en';
  const arabic = locale === 'ar';
  const layout = useLayoutMode();
  const width = useContentWidth();
  const wide = layout !== 'phone';
  const cantorId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [cantor, setCantor] = useState<LearningCantorDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!cantorId) return;
    let active = true;
    learningService.getCantor(cantorId, locale)
      .then((payload) => {
        if (!active) return;
        setError(null);
        setCantor(payload);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load cantor.'); });
    return () => { active = false; };
  }, [cantorId, locale, attempt]);

  const gutter = wide ? 0 : 16;
  const available = width - (wide ? 72 : 32);
  const columns = wide ? Math.max(3, Math.floor((available + 12) / 172)) : 2;
  const tileWidth = Math.floor((available - 12 * (columns - 1)) / columns);
  const chevron = <Icon name={arabic ? 'chevron-back' : 'chevron-forward'} size={18} color={COLORS.gold} />;

  const empty = (text: string) => (
    <View style={[styles.empty, { marginHorizontal: gutter }, arabic && styles.rowReverse]}>
      <View style={styles.emptyCross}><BuddedCross size={22} /></View>
      <Text style={[styles.emptyText, arabic && styles.arabic]}>{text}</Text>
    </View>
  );

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <Head><title>{cantor ? `${cantor.displayName} — ${tr('Learn & Study', 'Apprendre', 'تعلّم وادرس')}` : tr('Cantor — Learn & Study', 'Chantre — Apprendre', 'معلّم — تعلّم وادرس')}</title></Head>
      {!cantor ? (
        <View style={styles.pending}>
          <Pressable accessibilityRole="button" accessibilityLabel={tr('Go back', 'Retour', 'رجوع')} onPress={() => goBack(router, '/learn')} style={({ pressed }) => [styles.pendingBack, pressed && styles.pressed]}>
            <Icon name={arabic ? 'chevron-forward' : 'chevron-back'} size={20} color={COLORS.gold} />
          </Pressable>
          {error ? (
            <LoadFailure error={error} layout="inline" onRetry={() => { setError(null); setAttempt((count) => count + 1); }} />
          ) : (
            <ActivityIndicator color={COLORS.gold} style={styles.loader} />
          )}
        </View>
      ) : (
        <NowPlayingAwareScrollView contentContainerStyle={[styles.content, wide && styles.contentWide]} showsVerticalScrollIndicator={false}>
          <PageGutterProvider gutter={gutter}>
            <PersonHero
              name={cantor.displayName}
              kicker={tr('Cantor', 'Chantre', 'معلّم')}
              imageUri={learningService.resolveAsset(cantor.profileImageAsset)}
              bio={cantor.biography}
              compact
              arabic={arabic}
              wide={wide}
              onBack={() => goBack(router, '/learn')}
              backLabel={tr('Go back', 'Retour', 'رجوع')}
            />

            <SectionHeading title={tr('Learning Albums', 'Albums d’apprentissage', 'ألبومات التعلّم')} arabic={arabic} />
            <Text style={[styles.sub, { paddingHorizontal: gutter }, arabic && styles.arabic]}>
              {tr('Ordered recordings for listening and review', 'Enregistrements ordonnés pour l’écoute et la révision', 'تسجيلات مرتبة للاستماع والمراجعة')}
            </Text>
            {cantor.albums.length ? (
              <View style={[styles.grid, { paddingHorizontal: gutter }, arabic && styles.rowReverse]}>
                {cantor.albums.map((album) => (
                  <ReleaseTile
                    key={album.id}
                    id={album.id}
                    title={album.title}
                    subtitle={tr('Learning album', 'Album d’apprentissage', 'ألبوم تعلّم')}
                    artworkUri={learningService.resolveAsset(album.coverAsset)}
                    width={tileWidth}
                    arabic={arabic}
                    wrapTitle
                    onPress={() => router.push({ pathname: '/learn/album/[id]', params: { id: album.id } })}
                    trailing={chevron}
                  />
                ))}
              </View>
            ) : empty(tr('No published learning albums yet.', 'Aucun album d’apprentissage publié pour l’instant.', 'لا توجد ألبومات منشورة بعد.'))}

            <SectionHeading title={tr('Lesson Sets', 'Séries de leçons', 'مجموعات الدروس')} arabic={arabic} />
            <Text style={[styles.sub, { paddingHorizontal: gutter }, arabic && styles.arabic]}>
              {tr('Step-by-step study for individual hymns', 'Étude pas à pas de chaque hymne', 'دروس خطوة بخطوة لكل لحن')}
            </Text>
            {cantor.lessonSets.length ? (
              <View style={[styles.grid, { paddingHorizontal: gutter }, arabic && styles.rowReverse]}>
                {cantor.lessonSets.map((lessonSet) => (
                  <ReleaseTile
                    key={lessonSet.id}
                    id={lessonSet.id}
                    title={lessonSet.title}
                    subtitle={tr('Hymn course', 'Cours d’hymne', 'منهج لحن')}
                    artworkUri={learningService.resolveAsset(lessonSet.coverAsset ?? null)}
                    width={tileWidth}
                    arabic={arabic}
                    wrapTitle
                    onPress={() => router.push({ pathname: '/learn/lesson-set/[id]', params: { id: lessonSet.id } })}
                    trailing={chevron}
                  />
                ))}
              </View>
            ) : empty(tr('No published lesson sets yet.', 'Aucune série de leçons publiée pour l’instant.', 'لا توجد مجموعات دروس منشورة بعد.'))}
          </PageGutterProvider>
        </NowPlayingAwareScrollView>
      )}
      <LearningMiniPlayer />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.black },
  content: { paddingBottom: 32 },
  contentWide: { paddingHorizontal: 36, paddingTop: 20 },
  pending: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  pendingBack: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  loader: { marginTop: 48 },
  pressed: { opacity: 0.7 },
  rowReverse: { flexDirection: 'row-reverse' },
  sub: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13.5, lineHeight: 19, marginBottom: 12, marginTop: -4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  empty: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: 16, flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  emptyCross: { opacity: 0.5 },
  emptyText: { color: COLORS.muted, flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 14 },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'right', writingDirection: 'rtl' },
});
