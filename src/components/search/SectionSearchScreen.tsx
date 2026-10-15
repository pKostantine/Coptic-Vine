'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '@/components/vine/ui/Icon';
import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import { PageGlow, PageGutterProvider, SectionHeading } from '@/components/vine/screens/BookPage';
import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { type LearningQueueItem, useLearningPlayer } from '@/context/LearningPlayerContext';
import { type MusicQueueItem, useMusicPlayer } from '@/context/MusicPlayerContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { useAuth } from '@/context/AuthContext';
import { learningService } from '@/services/learningService';
import { musicService } from '@/services/musicService';
import { unifiedSearchService } from '@/services/unifiedSearchService';
import type { MusicConsumerAsset, MusicConsumerTrack } from '@/types/musicConsumer';
import type { UnifiedSearchKind, UnifiedSearchResult } from '@/types/unifiedSearch';
import { goBack } from '@/utils/navigation';
import { useLayoutMode } from '@/utils/useLayoutMode';

import { tr } from '../../utils/appText';
import SearchResultRow from './SearchResultRow';

type SearchSection = 'music' | 'learning';
type SearchFilter = 'all' | UnifiedSearchKind;

interface SectionSearchScreenProps {
  section: SearchSection;
}

interface SearchGroup {
  kind: UnifiedSearchKind;
  en: string;
  ar: string;
  fr: string;
}

const MUSIC_GROUPS: SearchGroup[] = [
  { kind: 'music_artist', en: 'Artists', ar: 'الفنانون', fr: 'Artistes' },
  { kind: 'music_release', en: 'Albums & Releases', ar: 'الألبومات والإصدارات', fr: 'Albums et parutions' },
  { kind: 'music_track', en: 'Tracks', ar: 'الترانيم', fr: 'Titres' },
];

const LEARNING_GROUPS: SearchGroup[] = [
  { kind: 'learning_cantor', en: 'Cantors', ar: 'المعلمون', fr: 'Chantres' },
  { kind: 'learning_hymn', en: 'Hymns', ar: 'الألحان', fr: 'Hymnes' },
  { kind: 'learning_season', en: 'Seasons', ar: 'المواسم', fr: 'Temps liturgiques' },
  { kind: 'learning_album', en: 'Albums', ar: 'الألبومات', fr: 'Albums' },
  { kind: 'learning_lesson', en: 'Lessons', ar: 'الدروس', fr: 'Leçons' },
];

/**
 * On the iPad and desktop these groups take the right-hand column — the
 * tracks, the lessons — beside the people and releases they belong to
 * (Coptic Vine design, "Artists and releases left, tracks right").
 */
const ASIDE_KINDS: ReadonlySet<UnifiedSearchKind> = new Set(['music_track', 'learning_lesson']);

/** The type filters under the field: All, then one kind of result each. */
function filtersFor(music: boolean): { key: SearchFilter; label: string }[] {
  return music
    ? [
        { key: 'all', label: tr('All', 'Tout', 'الكل') },
        { key: 'music_artist', label: tr('Artists', 'Artistes', 'الفنانون') },
        { key: 'music_release', label: tr('Releases', 'Parutions', 'الإصدارات') },
        { key: 'music_track', label: tr('Tracks', 'Titres', 'الترانيم') },
      ]
    : [
        { key: 'all', label: tr('All', 'Tout', 'الكل') },
        { key: 'learning_cantor', label: tr('Cantors', 'Chantres', 'المعلمون') },
        { key: 'learning_album', label: tr('Albums', 'Albums', 'الألبومات') },
        { key: 'learning_lesson', label: tr('Lessons', 'Leçons', 'الدروس') },
      ];
}

function musicTrackItem(result: Extract<UnifiedSearchResult, { kind: 'music_track' }>): MusicQueueItem {
  const track: MusicConsumerTrack = {
    id: result.entityId,
    title: result.title,
    subtitle: result.subtitle,
    durationMs: result.metadata.durationMs,
    releaseId: result.metadata.releaseId,
    mediaAsset: result.metadata.mediaAsset,
    artists: result.metadata.artists,
  };
  return {
    track,
    releaseId: result.metadata.releaseId,
    releaseTitle: result.metadata.releaseTitle,
    coverAsset: result.metadata.coverAsset,
  };
}

/**
 * Music's and Learn & Study's search (Coptic Vine design, "Search"): the
 * field with Back beside it and the type filters under it, then the results
 * in groups — each a heading drawn out into a vine over rows on cards, the
 * search's words in gold. On the iPad and desktop the filters sit beside the
 * field and the tracks or lessons take a column of their own.
 */
export default function SectionSearchScreen({ section }: SectionSearchScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = useLayoutMode();
  const wide = layout !== 'phone';
  const { user } = useAuth();
  const inputRef = useRef<TextInput>(null);
  const { preferences } = useReadingPreferences();
  const locale = preferences.appLanguage === 'ar' ? 'ar' : 'en';
  const isArabic = locale === 'ar';
  const music = section === 'music';
  const fallback: '/music' | '/learn' = music ? '/music' : '/learn';
  const musicPlayer = useMusicPlayer();
  const learningPlayer = useLearningPlayer();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchFilter>('all');
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<UnifiedSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [likedTrackIds, setLikedTrackIds] = useState<Set<string>>(new Set());
  const [followedArtistIds, setFollowedArtistIds] = useState<Set<string>>(new Set());
  const [libraryAuthenticated, setLibraryAuthenticated] = useState(false);
  const [savedLessonIds, setSavedLessonIds] = useState<Set<string>>(new Set());
  const [learningAuthenticated, setLearningAuthenticated] = useState(false);
  const [artistFallbackArt, setArtistFallbackArt] = useState<Record<string, MusicConsumerAsset | null>>({});

  // Your library marks the results: the tracks you like, the artists you follow.
  useEffect(() => {
    if (!music) return;
    let active = true;
    musicService.getLibrary(locale)
      .then((library) => {
        if (!active) return;
        setLibraryAuthenticated(library.authenticated);
        setLikedTrackIds(new Set(library.likedTracks.map((track) => track.id)));
        setFollowedArtistIds(new Set(library.followedArtists.map((artist) => artist.id)));
      })
      .catch(() => {
        if (!active) return;
        setLibraryAuthenticated(false);
        setLikedTrackIds(new Set());
        setFollowedArtistIds(new Set());
      });
    return () => { active = false; };
  }, [locale, music, user?.id]);

  // My Learning marks the lessons already saved to one of its lists.
  useEffect(() => {
    if (music) return;
    let active = true;
    learningService.getItemLibrary(locale)
      .then((library) => {
        if (!active) return;
        setLearningAuthenticated(library.authenticated);
        setSavedLessonIds(new Set(library.items.filter((item) => item.itemKind === 'lesson').map((item) => item.itemId)));
      })
      .catch(() => {
        if (!active) return;
        setLearningAuthenticated(false);
        setSavedLessonIds(new Set());
      });
    return () => { active = false; };
  }, [locale, music, user?.id]);

  useEffect(() => {
    const value = query.trim();
    if (!value) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      unifiedSearchService.search(value, locale, section, 48)
        .then((payload) => {
          if (active) setResults(payload.results);
        })
        .catch((cause) => {
          if (!active) return;
          setResults([]);
          setError(cause instanceof Error ? cause.message : 'Unable to search.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 180);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [locale, query, section]);

  // Some artists intentionally have no profile image. For search, use the
  // artwork of their latest published release as a useful visual fallback.
  useEffect(() => {
    if (!music) return;
    const missing = results.filter(
      (result): result is Extract<UnifiedSearchResult, { kind: 'music_artist' }> => (
        result.kind === 'music_artist'
        && !result.metadata.profileImageAsset
        && !(result.entityId in artistFallbackArt)
      ),
    );
    if (!missing.length) return;

    let active = true;
    void Promise.all(missing.map(async (result) => {
      try {
        return [result.entityId, await musicService.getArtistSearchArt(result.entityId)] as const;
      } catch {
        return [result.entityId, null] as const;
      }
    })).then((pairs) => {
      if (!active) return;
      setArtistFallbackArt((current) => ({ ...current, ...Object.fromEntries(pairs) }));
    });

    return () => { active = false; };
  }, [artistFallbackArt, music, results]);

  const grouped = useMemo(() => {
    const groups = music ? MUSIC_GROUPS : LEARNING_GROUPS;
    return groups
      .filter((group) => filter === 'all' || group.kind === filter)
      .map((group) => ({
        ...group,
        results: results.filter((result) => result.kind === group.kind),
      }))
      .filter((group) => group.results.length > 0);
  }, [filter, music, results]);

  const changeQuery = (value: string) => {
    setQuery(value);
    setError(null);
  };

  const toggleTrackLike = async (trackId: string) => {
    if (!libraryAuthenticated) {
      Alert.alert(
        tr('Liked Songs', 'Titres aimés', 'الأغاني المعجبة'),
        tr('Sign in to your Coptic Vine account to save Liked Songs.', 'Connectez-vous à votre compte Coptic Vine pour enregistrer vos titres aimés.', 'سجّل الدخول إلى حساب كوبتك فاين لحفظ الأغاني المعجبة.'),
      );
      return;
    }

    const liked = likedTrackIds.has(trackId);
    try {
      await musicService.setLiked(trackId, !liked);
      setLikedTrackIds((current) => {
        const next = new Set(current);
        if (liked) next.delete(trackId); else next.add(trackId);
        return next;
      });
    } catch (cause) {
      Alert.alert(
        tr('Liked Songs', 'Titres aimés', 'الأغاني المعجبة'),
        cause instanceof Error ? cause.message : 'Unable to update Liked Songs.',
      );
    }
  };

  /** A lesson's bookmark: into My Learning's Will Learn list. */
  const saveLesson = async (lessonId: string) => {
    if (!learningAuthenticated) {
      Alert.alert(
        tr('Sign in required', 'Connexion requise', 'تسجيل الدخول مطلوب'),
        tr('Sign in to save learning progress and playlists.', 'Connectez-vous pour enregistrer votre progression et vos playlists.', 'سجّل الدخول لحفظ تقدّمك وقوائم التعلّم.'),
      );
      return;
    }
    if (savedLessonIds.has(lessonId)) return;
    try {
      await learningService.setItemProgress('lesson', lessonId, 'will_learn');
      setSavedLessonIds((current) => new Set(current).add(lessonId));
    } catch (cause) {
      Alert.alert(
        tr('My Learning', 'Mon apprentissage', 'تعلّمي'),
        cause instanceof Error ? cause.message : 'Unable to update My Learning.',
      );
    }
  };

  const openResult = (result: UnifiedSearchResult) => {
    switch (result.kind) {
      case 'music_artist':
        router.push({ pathname: '/music/artist/[id]', params: { id: result.entityId } });
        return;
      case 'music_release':
        router.push({ pathname: '/music/release/[id]', params: { id: result.entityId } });
        return;
      case 'music_track': {
        if (musicPlayer.currentItem?.track.id === result.entityId) {
          musicPlayer.togglePlayback();
          return;
        }
        musicPlayer.playItem(musicTrackItem(result));
        return;
      }
      case 'learning_cantor':
        router.push({ pathname: '/learn/cantor/[id]', params: { id: result.entityId } });
        return;
      case 'learning_season':
        router.push({ pathname: '/learn/season/[id]', params: { id: result.entityId } });
        return;
      case 'learning_hymn':
        router.push({ pathname: '/learn/hymn/[id]', params: { id: result.entityId } });
        return;
      case 'learning_album':
        router.push({ pathname: '/learn/album/[id]', params: { id: result.entityId } });
        return;
      case 'learning_lesson': {
        if (result.metadata.mediaType === 'video') {
          router.push({
            pathname: '/learn/lesson/[id]',
            params: { id: result.entityId, setId: result.metadata.lessonSetId },
          });
          return;
        }
        if (learningPlayer.currentItem?.id === result.entityId) {
          learningPlayer.togglePlayback();
          return;
        }
        const item: LearningQueueItem = {
          kind: 'lesson',
          id: result.entityId,
          title: result.title,
          subtitle: result.body,
          durationMs: result.metadata.durationMs,
          mediaAsset: result.metadata.mediaAsset,
          containerId: result.metadata.lessonSetId,
          containerTitle: result.metadata.lessonSetTitle,
          cantorName: result.metadata.cantorName,
          coverAsset: result.metadata.coverAsset,
          hymnId: result.metadata.hymnId,
        };
        learningPlayer.playItem(item);
      }
    }
  };

  const hasQuery = Boolean(query.trim());
  const filters = filtersFor(music);
  const searchLabel = music
    ? tr('Search Music', 'Rechercher de la musique', 'بحث في الترانيم')
    : tr('Search Learn & Study', 'Rechercher dans Apprendre', 'بحث في التعلّم');

  const renderGroup = (group: SearchGroup & { results: UnifiedSearchResult[] }) => (
    <View key={group.kind}>
      <SectionHeading title={tr(group.en, group.fr, group.ar)} arabic={isArabic} />
      <View style={[styles.rows, !wide && styles.rowsPhone]}>
        {group.results.map((result) => (
          <SearchResultRow
            key={result.kind + ':' + result.entityId}
            result={result}
            query={query}
            arabic={isArabic}
            active={
              result.kind === 'music_track'
                ? musicPlayer.currentItem?.track.id === result.entityId
                : result.kind === 'learning_lesson'
                  ? learningPlayer.currentItem?.id === result.entityId
                  : false
            }
            following={result.kind === 'music_artist' && followedArtistIds.has(result.entityId)}
            fallbackArt={artistFallbackArt[result.entityId] ?? null}
            saved={
              result.kind === 'music_track'
                ? likedTrackIds.has(result.entityId)
                : result.kind === 'learning_lesson' && savedLessonIds.has(result.entityId)
            }
            queueItem={result.kind === 'music_track' ? musicTrackItem(result) : undefined}
            onPress={() => openResult(result)}
            onTitlePress={result.kind === 'music_track'
              ? () => router.push({ pathname: '/music/track/[id]', params: { id: result.entityId } })
              : undefined}
            onToggleSaved={result.kind === 'music_track'
              ? () => void toggleTrackLike(result.entityId)
              : result.kind === 'learning_lesson'
                ? () => void saveLesson(result.entityId)
                : undefined}
          />
        ))}
      </View>
    </View>
  );

  const mainGroups = grouped.filter((group) => !ASIDE_KINDS.has(group.kind));
  const asideGroups = grouped.filter((group) => ASIDE_KINDS.has(group.kind));

  const field = (
    <View style={[styles.field, focused && styles.fieldFocused, isArabic && styles.rowReverse]}>
      <Icon name="search-outline" size={19} color={COLORS.gold} />
      <TextInput
        ref={inputRef}
        accessibilityLabel={searchLabel}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        clearButtonMode="never"
        onBlur={() => setFocused(false)}
        onChangeText={changeQuery}
        onFocus={() => setFocused(true)}
        placeholder={music
          ? tr('Artists, albums and tracks', 'Artistes, albums et titres', 'فنان أو ألبوم أو ترنيمة')
          : tr('Cantors, hymns, albums and lessons', 'Chantres, hymnes, albums et leçons', 'معلّم أو لحن أو ألبوم أو درس')}
        placeholderTextColor={`${COLORS.muted}8C`}
        returnKeyType="search"
        selectionColor={COLORS.gold}
        style={[styles.input, Platform.OS === 'web' && styles.inputWeb, isArabic && styles.arabic]}
        value={query}
      />
      {query ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('Clear search', 'Effacer la recherche', 'مسح البحث')}
          hitSlop={8}
          onPress={() => {
            changeQuery('');
            inputRef.current?.focus();
          }}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Icon name="close-circle" size={19} color={COLORS.muted} />
        </Pressable>
      ) : null}
    </View>
  );

  const chipButtons = filters.map((entry) => {
    const selected = entry.key === filter;
    return (
      <Pressable
        key={entry.key}
        accessibilityRole="radio"
        aria-checked={selected}
        onPress={() => setFilter(entry.key)}
        style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && styles.pressed]}
      >
        <Text style={[styles.chipText, selected && styles.chipTextOn, isArabic && styles.arabicFont]} maxFontSizeMultiplier={1.3}>
          {entry.label}
        </Text>
      </Pressable>
    );
  });

  // On a phone the filters scroll sideways if a language's names run long;
  // beside the iPad's and desktop's field they always fit.
  const chips = wide ? (
    <View accessibilityRole="radiogroup" style={[styles.chips, isArabic && styles.rowReverse]}>{chipButtons}</View>
  ) : (
    <ScrollView
      horizontal
      accessibilityRole="radiogroup"
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.chips, styles.chipsPhone, isArabic && styles.rowReverse]}
    >
      {chipButtons}
    </ScrollView>
  );

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <Head>
        <title>{music ? 'Search Music' : 'Search Learn & Study'}</title>
      </Head>
      {/* The glow stays put behind the field while the results scroll under it. */}
      <PageGlow kind="green" tall={wide} />

      {wide ? (
        <View style={[styles.topWide, { paddingTop: insets.top + 28 }, isArabic && styles.rowReverse]}>
          {field}
          {chips}
        </View>
      ) : (
        <View style={{ paddingTop: insets.top + 4 }}>
          <View style={[styles.bar, isArabic && styles.rowReverse]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tr('Back', 'Retour', 'رجوع')}
              hitSlop={4}
              onPress={() => goBack(router, fallback)}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <Icon name={isArabic ? 'chevron-forward' : 'chevron-back'} size={20} color={COLORS.gold} />
            </Pressable>
            {field}
          </View>
          {chips}
        </View>
      )}

      <NowPlayingAwareScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.content, wide && styles.contentWide]}
        showsVerticalScrollIndicator={false}
      >
        <PageGutterProvider gutter={wide ? 0 : 16}>
          {!hasQuery ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Icon name="search" size={30} color={COLORS.gold} />
              </View>
              <Text style={[styles.emptyTitle, isArabic && styles.arabicFont]} maxFontSizeMultiplier={1.3}>
                {music
                  ? tr('Search Music', 'Rechercher de la musique', 'ابحث في الترانيم')
                  : tr('Search Learn & Study', 'Rechercher dans Apprendre', 'ابحث في التعلّم')}
              </Text>
              <Text style={[styles.emptyBody, isArabic && styles.arabicFont]} maxFontSizeMultiplier={1.3}>
                {music
                  ? tr('Find an artist, album, EP, single or track.', 'Trouvez un artiste, un album, un EP, un single ou un titre.', 'ابحث عن فنان أو ألبوم أو ترنيمة.')
                  : tr('Find a cantor, hymn, season, album or lesson.', 'Trouvez un chantre, une hymne, un temps liturgique, un album ou une leçon.', 'ابحث عن معلّم أو لحن أو ألبوم أو درس.')}
              </Text>
            </View>
          ) : null}

          {loading ? <ActivityIndicator color={COLORS.gold} style={styles.loader} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {hasQuery && !loading && !error && grouped.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, isArabic && styles.arabicFont]} maxFontSizeMultiplier={1.3}>
                {tr('No results', 'Aucun résultat', 'لا توجد نتائج')}
              </Text>
              <Text style={[styles.emptyBody, isArabic && styles.arabicFont]} maxFontSizeMultiplier={1.3}>
                {results.length
                  ? tr('Nothing of this kind matches. Try All.', 'Rien de ce type ne correspond. Essayez Tout.', 'لا توجد نتائج من هذا النوع. جرّب الكل.')
                  : tr('Try another spelling or a shorter search.', 'Essayez une autre orthographe ou une recherche plus courte.', 'جرّب تهجئة مختلفة أو كلمة أقصر.')}
              </Text>
            </View>
          ) : null}

          {!loading && grouped.length ? (
            wide && mainGroups.length && asideGroups.length ? (
              <View style={[styles.columns, isArabic && styles.rowReverse]}>
                <View style={styles.column}>{mainGroups.map(renderGroup)}</View>
                <View style={styles.column}>{asideGroups.map(renderGroup)}</View>
              </View>
            ) : grouped.map(renderGroup)
          ) : null}
        </PageGutterProvider>
      </NowPlayingAwareScrollView>

      <BottomTabBar active={music ? 'music' : 'learn'} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.black },
  rowReverse: { flexDirection: 'row-reverse' },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'right', writingDirection: 'rtl' },
  arabicFont: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
  pressed: { opacity: 0.65 },

  // The phone's top: Back beside the field, 16 in from the edges.
  bar: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  backButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  // The iPad's and desktop's top: the field, the filters beside it.
  topWide: { alignItems: 'center', flexDirection: 'row', gap: 18, paddingHorizontal: 36 },
  field: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    // A 2pt ring that turns gold while you type; transparent until then so the field never shifts.
    borderColor: 'transparent',
    borderRadius: 14,
    borderWidth: 2,
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    height: 46,
    minWidth: 0,
    paddingLeft: 12,
    paddingRight: 10,
  },
  fieldFocused: { borderColor: COLORS.gold },
  input: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    color: COLORS.white,
    flex: 1,
    fontFamily: TYPOGRAPHY.body,
    fontSize: 16,
    height: 42,
    minWidth: 0,
    paddingVertical: 0,
  },
  // The browser's own focus outline gives way to the field's gold ring.
  inputWeb: {
    outlineStyle: 'none',
    outlineWidth: 0,
    boxShadow: 'none',
  } as object,

  chips: { flexDirection: 'row', gap: 8 },
  chipsPhone: { paddingHorizontal: 16, paddingTop: 14 },
  chip: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.07)', borderRadius: 99, height: 34, justifyContent: 'center', paddingHorizontal: 15 },
  chipOn: { backgroundColor: COLORS.gold },
  chipText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '600' },
  chipTextOn: { color: COLORS.greenDeep },

  content: { paddingBottom: 28 },
  contentWide: { paddingHorizontal: 36 },
  loader: { marginTop: 28 },
  error: { color: COLORS.priest, fontFamily: TYPOGRAPHY.body, padding: 32, textAlign: 'center' },

  emptyState: { alignItems: 'center', paddingHorizontal: 40, paddingTop: 78 },
  emptyIcon: { alignItems: 'center', backgroundColor: COLORS.goldSoft, borderRadius: 36, height: 72, justifyContent: 'center', width: 72 },
  emptyTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 22, fontWeight: '700', marginTop: 18, textAlign: 'center' },
  emptyBody: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14, lineHeight: 20, marginTop: 6, maxWidth: 440, textAlign: 'center' },

  columns: { alignItems: 'flex-start', flexDirection: 'row', gap: 28 },
  column: { flex: 1, minWidth: 0 },
  rows: { gap: 6 },
  rowsPhone: { marginHorizontal: 16 },
});
