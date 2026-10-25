'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import LearningArtwork from '@/components/learning/LearningArtwork';
import LearningItemActionsMenu from '@/components/learning/LearningItemActionsMenu';
import LearningSectionNav from '@/components/learning/LearningSectionNav';
import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { PageGlow, PageGutterProvider, SectionHeading } from '@/components/vine/screens/BookPage';
import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import Icon from '@/components/vine/ui/Icon';
import TabHeader from '@/components/vine/ui/TabHeader';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { type LearningQueueItem, useLearningPlayer } from '@/context/LearningPlayerContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { usePlayLessons } from '@/hooks/usePlayLessons';
import { learningService } from '@/services/learningService';
import type {
  LearningItemLibraryPayload,
  LearningLibraryItem,
  LearningPlaylistLibraryPayload,
  LearningProgressState,
} from '@/types/learningPlatform';
import { useLayoutMode } from '@/utils/useLayoutMode';
import { useSidePadding } from '@/utils/useSidePadding';

import { tr } from '../../utils/appText';
const EMPTY_LIBRARY: LearningItemLibraryPayload = { authenticated: false, likedItemIds: [], items: [] };
const EMPTY_PLAYLISTS: LearningPlaylistLibraryPayload = { authenticated: false, playlists: [] };

const STATE_ORDER: LearningProgressState[] = ['will_learn', 'learning', 'finished'];
const MAX_FONT_SCALE = 1.3;

function toQueueItem(item: LearningLibraryItem): LearningQueueItem {
  return {
    kind: item.itemKind === 'album_recording' ? 'recording' : 'lesson',
    id: item.itemId,
    title: item.title,
    subtitle: item.subtitle,
    durationMs: item.durationMs,
    mediaAsset: item.mediaAsset,
    audioAsset: item.audioAsset ?? null,
    mediaType: item.mediaType,
    containerId: item.containerId,
    containerTitle: item.containerTitle,
    cantorName: item.cantorName,
    coverAsset: item.coverAsset,
    hymnId: item.hymnId,
  };
}

/**
 * My Learning (Coptic Vine design, "My Learning"): the three lists as tabs
 * with their counts, each recording or lesson on a card with the way to move
 * it forward, then the custom playlists. The iPad and desktop set the lists
 * (the wider column) beside the playlists, under a line across both.
 */
export default function LearningLibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = useLayoutMode();
  const { preferences } = useReadingPreferences();
  const { currentItem } = useLearningPlayer();
  const playLessons = usePlayLessons();
  const locale = preferences.appLanguage === 'ar' ? 'ar' : 'en';
  const arabic = locale === 'ar';
  const wide = layout !== 'phone';
  // The page and its glow run to both edges; its content keeps clear of the notch.
  const sidePadding = useSidePadding(wide ? 36 : 0);
  const [library, setLibrary] = useState(EMPTY_LIBRARY);
  const [playlistLibrary, setPlaylistLibrary] = useState(EMPTY_PLAYLISTS);
  const [activeState, setActiveState] = useState<LearningProgressState>('will_learn');
  const [playlistName, setPlaylistName] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (active: { current: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const [nextLibrary, nextPlaylists] = await Promise.all([
        learningService.getItemLibrary(locale),
        learningService.getPlaylists(locale),
      ]);
      if (!active.current) return;
      setLibrary(nextLibrary);
      setPlaylistLibrary(nextPlaylists);
    } catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : 'Unable to load My Learning.');
    } finally {
      if (active.current) setLoading(false);
    }
  }, [locale]);

  useFocusEffect(useCallback(() => {
    const active = { current: true };
    void load(active);
    return () => { active.current = false; };
  }, [load]));

  const stateItems = useMemo(
    () => library.items.filter((item) => item.state === activeState),
    [activeState, library.items],
  );
  // Every item of the list, video lessons too: they play on the one queue.
  const audioQueue = useMemo(() => stateItems.map(toQueueItem), [stateItems]);

  const labels: Record<LearningProgressState, { title: string; empty: string }> = {
    will_learn: { title: tr('Will Learn', 'À apprendre', 'سأتعلم'), empty: tr('Add a recording or lesson you want to learn.', 'Ajoutez un enregistrement ou une leçon à apprendre.', 'أضف درساً أو تسجيلاً تريد تعلّمه.') },
    learning: { title: tr('Learning', 'En cours', 'أتعلّم'), empty: tr('Start an item from your Will Learn list.', 'Commencez un élément de votre liste À apprendre.', 'ابدأ عنصراً من قائمة «سأتعلم».') },
    finished: { title: tr('Finished', 'Terminé', 'أكملت'), empty: tr('Completed lessons and recordings will appear here.', 'Les leçons et enregistrements terminés apparaîtront ici.', 'ستظهر الدروس التي أكملتها هنا.') },
  };

  // A lesson with a picture, watched as video, opens the full player on it (usePlayLessons).
  const openItem = (item: LearningLibraryItem) => {
    const index = audioQueue.findIndex((entry) => entry.id === item.itemId);
    if (index >= 0) playLessons(audioQueue, index);
  };

  const moveItem = async (item: LearningLibraryItem, nextState: LearningProgressState) => {
    if (movingId || item.state === nextState) return;
    const previousItems = library.items;
    setMovingId(item.itemId);
    setError(null);
    setLibrary((current) => ({
      ...current,
      items: current.items.map((entry) => entry.itemId === item.itemId ? { ...entry, state: nextState } : entry),
    }));
    try {
      await learningService.setItemProgress(item.itemKind, item.itemId, nextState);
    } catch (cause) {
      setLibrary((current) => ({ ...current, items: previousItems }));
      const message = cause instanceof Error ? cause.message : 'Unable to update this learning item.';
      setError(message);
      Alert.alert(tr('Could not update list', 'Impossible de mettre à jour la liste', 'تعذّر تحديث القائمة'), message);
    } finally {
      setMovingId(null);
    }
  };

  const createPlaylist = async () => {
    const name = playlistName.trim();
    if (!name || creating) return;
    if (!playlistLibrary.authenticated) {
      Alert.alert(
        tr('Sign in required', 'Connexion requise', 'تسجيل الدخول مطلوب'),
        tr('Sign in to create custom learning playlists.', 'Connectez-vous pour créer des playlists d’apprentissage.', 'سجّل الدخول لإنشاء قوائم تعلّم مخصّصة.'),
      );
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const created = await learningService.createPlaylist(name);
      setPlaylistLibrary((current) => ({ ...current, playlists: [created, ...current.playlists] }));
      setPlaylistName('');
      Keyboard.dismiss();
      router.push({ pathname: '/learn/playlist/[id]', params: { id: created.id } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create playlist.');
    } finally {
      setCreating(false);
    }
  };

  const authenticated = library.authenticated || playlistLibrary.authenticated;
  const gutter = wide ? 0 : 16;
  const inGutter = { paddingHorizontal: gutter };

  // Across the page, over both columns on the iPad and desktop.
  const intro = (
    <>
      <View style={[styles.introRow, inGutter]}>
        <Text style={[styles.intro, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {tr('Move each recording or lesson forward as you learn it.', 'Faites avancer chaque enregistrement ou leçon à mesure que vous l’apprenez.', 'نظّم ما ستتعلّمه، وما تدرسه الآن، وما أكملته.')}
        </Text>
        {audioQueue.length ? (
          <Pressable accessibilityRole="button" accessibilityLabel={tr('Play this list', 'Lire cette liste', 'تشغيل هذه القائمة')} style={({ pressed }) => [styles.playAll, pressed && styles.pressed]} onPress={() => playLessons(audioQueue, 0)}>
            <Icon name="play" size={16} color={COLORS.greenDeep} />
          </Pressable>
        ) : null}
      </View>

      {loading ? <ActivityIndicator color={COLORS.gold} style={styles.loader} /> : null}
      {error ? <Text style={[styles.error, inGutter]}>{error}</Text> : null}

      {!loading && !authenticated ? (
        <View style={[styles.authCard, { marginHorizontal: gutter }]}>
          <Icon name="person-circle-outline" size={30} color={COLORS.gold} />
          <View style={styles.authCopy}>
            <Text style={[styles.authTitle, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('Keep your learning across devices', 'Gardez votre apprentissage sur tous vos appareils', 'احفظ تعلّمك على كل أجهزتك')}</Text>
            <Text style={[styles.authBody, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {tr('All lessons remain available. Sign in to save progress and playlists.', 'Toutes les leçons restent accessibles. Connectez-vous pour enregistrer votre progression et vos playlists.', 'المحتوى متاح للجميع. سجّل الدخول لحفظ القوائم والتقدّم.')}
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={tr('Open account', 'Ouvrir le compte', 'افتح الحساب')} style={({ pressed }) => [styles.authButton, pressed && styles.pressed]} onPress={() => router.push('/account')}>
            <Icon name="chevron-forward" size={18} color={COLORS.greenDeep} />
          </Pressable>
        </View>
      ) : null}
    </>
  );

  const lists = (
    <>
      <View accessibilityRole="tablist" style={[styles.tabs, wide && styles.tabsFlush, { marginHorizontal: gutter }]}>
        {STATE_ORDER.map((state) => {
          const count = library.items.filter((item) => item.state === state).length;
          const active = state === activeState;
          return (
            <Pressable
              key={state}
              accessibilityRole="tab"
              aria-selected={active}
              onPress={() => setActiveState(state)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive, arabic && styles.arabicTight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{labels[state].title}</Text>
              <View style={[styles.tabCount, active && styles.tabCountActive]}>
                <Text style={[styles.tabCountText, active && styles.tabCountTextActive]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{count}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.items, inGutter]}>
        {stateItems.map((item) => {
          const stateIndex = STATE_ORDER.indexOf(item.state);
          const busy = movingId === item.itemId;
          const isPlaying = currentItem?.id === item.itemId;
          const audioItem = audioQueue.find((entry) => entry.id === item.itemId);
          const forward = stateIndex < STATE_ORDER.length - 1
            ? { state: STATE_ORDER[stateIndex + 1], label: stateIndex === 0 ? tr('Start', 'Commencer', 'ابدأ') : tr('Finish', 'Terminer', 'أكملت'), icon: stateIndex === 0 ? 'chevron-forward' as const : 'checkmark' as const }
            : null;
          const back = stateIndex > 0
            ? { state: STATE_ORDER[stateIndex - 1], label: stateIndex === 2 ? tr('Revisit', 'Revoir', 'أعد التعلّم') : tr('Later', 'Plus tard', 'لاحقاً') }
            : null;
          return (
            <View key={item.itemKind + ':' + item.itemId} style={styles.itemCard}>
              <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
              <View style={styles.itemTop}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${item.title}, ${item.cantorName}`} style={({ pressed }) => [styles.itemMain, pressed && styles.pressed]} onPress={() => openItem(item)}>
                <View style={styles.thumb}>
                  <LearningArtwork asset={item.coverAsset} size={68} radius={14} label={item.containerTitle} />
                  <View style={styles.thumbBadge}>
                    <Icon name={isPlaying ? 'pause' : 'play'} size={13} color={COLORS.greenDeep} />
                  </View>
                </View>
                <View style={styles.itemCopy}>
                  <Text numberOfLines={2} style={[styles.itemTitle, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{item.title}</Text>
                  <Text numberOfLines={1} style={[styles.itemMeta, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{item.cantorName}</Text>
                </View>
              </Pressable>
              {/* Beside the card's own tap target, never inside it: a button in a button is invalid on web. */}
              {audioItem ? <LearningItemActionsMenu item={audioItem} isArabic={arabic} size={34} /> : null}
              </View>
              <View style={styles.itemFoot}>
                <View style={styles.tag}>
                  <View style={styles.tagDot} />
                  <Text numberOfLines={1} style={[styles.tagText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{item.containerTitle}</Text>
                </View>
                <View style={styles.moves}>
                  {back ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${back.label}: ${item.title}`}
                      disabled={busy}
                      onPress={() => void moveItem(item, back.state)}
                      style={({ pressed }) => [styles.moveQuiet, pressed && styles.pressed]}
                    >
                      <Text style={[styles.moveQuietText, arabic && styles.arabicTight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{back.label}</Text>
                    </Pressable>
                  ) : null}
                  {forward ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${forward.label}: ${item.title}`}
                      disabled={busy}
                      onPress={() => void moveItem(item, forward.state)}
                      style={({ pressed }) => [styles.move, busy && styles.disabled, pressed && styles.pressed]}
                    >
                      <Text style={[styles.moveText, arabic && styles.arabicTight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{forward.label}</Text>
                      <Icon name={forward.icon} size={15} color={COLORS.greenDeep} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          );
        })}
        {!loading && !stateItems.length ? (
          <View style={styles.emptyState}>
            <Icon name="school-outline" size={30} color={COLORS.gold} />
            <Text style={[styles.emptyTitle, arabic && styles.arabicCentered]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{labels[activeState].empty}</Text>
            {!authenticated ? (
              <Pressable accessibilityRole="button" onPress={() => router.push('/account')} style={({ pressed }) => pressed && styles.pressed}>
                <Text style={styles.emptyAction}>{tr('Sign in', 'Se connecter', 'تسجيل الدخول')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </>
  );

  const playlists = (
    <>
      <SectionHeading size="page"
        title={tr('Custom Playlists', 'Playlists personnelles', 'قوائم مخصّصة')}
        arabic={arabic}
        trailing={(
          <View style={styles.count}>
            <Text style={styles.countText} maxFontSizeMultiplier={MAX_FONT_SCALE}>{playlistLibrary.playlists.length}</Text>
          </View>
        )}
      />
      <Text style={[styles.sectionBody, inGutter, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {tr('Group any lessons and recordings your way.', 'Regroupez leçons et enregistrements à votre façon.', 'اجمع الدروس والتسجيلات في قوائمك الخاصة.')}
      </Text>
      <View style={[styles.createRow, inGutter]}>
        <TextInput
          accessibilityLabel={tr('New playlist name', 'Nom de la nouvelle playlist', 'اسم قائمة جديدة')}
          editable={!creating}
          onChangeText={setPlaylistName}
          onSubmitEditing={() => void createPlaylist()}
          placeholder={tr('New playlist name', 'Nom de la nouvelle playlist', 'اسم قائمة جديدة')}
          placeholderTextColor="rgba(205, 216, 203, 0.55)"
          returnKeyType="done"
          style={[styles.createInput, arabic && styles.arabic]}
          value={playlistName}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('Create playlist', 'Créer la playlist', 'إنشاء القائمة')}
          disabled={!playlistName.trim() || creating}
          onPress={() => void createPlaylist()}
          style={({ pressed }) => [styles.createButton, (!playlistName.trim() || creating) && styles.disabled, pressed && styles.pressed]}
        >
          {creating ? <ActivityIndicator color={COLORS.greenDeep} /> : <Icon name="add" size={24} color={COLORS.greenDeep} />}
        </Pressable>
      </View>
      <View style={[styles.playlists, inGutter]}>
        {playlistLibrary.playlists.map((playlist) => (
          <Pressable
            accessibilityRole="button"
            key={playlist.id}
            style={({ pressed }) => [styles.playlistRow, pressed && styles.pressed]}
            onPress={() => router.push({ pathname: '/learn/playlist/[id]', params: { id: playlist.id } })}
          >
            <View style={styles.playlistIcon}><Icon name="list-outline" size={22} color={COLORS.gold} /></View>
            <View style={styles.playlistCopy}>
              <Text numberOfLines={1} style={[styles.playlistName, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{playlist.name}</Text>
              <Text style={[styles.playlistMeta, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {playlist.itemCount === 1 ? tr('1 item', '1 élément', 'عنصر واحد') : tr(`${playlist.itemCount} items`, `${playlist.itemCount} éléments`, `${playlist.itemCount} عناصر`)}
              </Text>
            </View>
            <Icon name="chevron-forward" size={17} color={COLORS.gold} />
          </Pressable>
        ))}
      </View>
    </>
  );

  return (
    <SafeAreaView edges={[]} style={styles.safeArea}>
      <Head><title>{tr('My Learning - Coptic Vine', 'Mon apprentissage - Coptic Vine', 'تعلّمي - كوبتك فاين')}</title></Head>
      <NowPlayingAwareScrollView
        // Keyed by layout: a turn of the phone mounts the page afresh rather than
        // restyling its views in place, which iOS laid out wrongly (a column of zero width).
        key={layout}
        contentContainerStyle={[styles.content, wide && [styles.contentWide, { paddingTop: insets.top + 28 }], sidePadding]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <PageGlow kind="green" tall={wide} />
        <PageGutterProvider gutter={gutter}>
          <TabHeader title={tr('Learn & Study', 'Apprendre', 'تعلّم وادرس')} arabic={arabic} wide={wide} nav={<LearningSectionNav active="library" flush={wide} />} />
          {intro}
          {wide ? (
            <View style={styles.columns}>
              <View style={styles.listsColumn}>{lists}</View>
              {/* The playlists' heading level with the tabs: no section margin over it at the top of its column. */}
              <View style={[styles.column, styles.columnHeadFlush]}>{playlists}</View>
            </View>
          ) : (
            <>
              {lists}
              {playlists}
            </>
          )}
        </PageGutterProvider>
      </NowPlayingAwareScrollView>
      <BottomTabBar active="learn" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.black },
  content: { paddingBottom: 28 },
  contentWide: { paddingHorizontal: 36 },
  columns: { alignItems: 'flex-start', flexDirection: 'row', gap: 28, marginTop: 22 },
  // The lists take the wider share, 1.25 to the playlists' 1.
  listsColumn: { flex: 1.25, minWidth: 0 },
  column: { flex: 1, minWidth: 0 },
  // Cancels SectionHeading's own top margin.
  columnHeadFlush: { marginTop: -28 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.42 },
  loader: { marginVertical: 24 },
  error: { color: COLORS.priest, fontFamily: TYPOGRAPHY.body, fontSize: 13, marginTop: 12 },

  introRow: { alignItems: 'center', flexDirection: 'row', gap: 12, marginTop: 18 },
  intro: { color: COLORS.muted, flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 14, lineHeight: 20 },
  playAll: { alignItems: 'center', backgroundColor: COLORS.gold, borderRadius: 19, height: 38, justifyContent: 'center', width: 38 },

  authCard: { alignItems: 'center', backgroundColor: COLORS.surface, borderColor: COLORS.goldLine, borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 12, marginTop: 16, padding: 14 },
  authCopy: { flex: 1, minWidth: 0 },
  authTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '700' },
  authBody: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12, lineHeight: 17, marginTop: 3 },
  authButton: { alignItems: 'center', backgroundColor: COLORS.gold, borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },

  tabs: { borderBottomColor: 'rgba(255, 255, 255, 0.08)', borderBottomWidth: 1, flexDirection: 'row', gap: 22, marginTop: 18 },
  tabsFlush: { marginTop: 0 },
  tab: { alignItems: 'center', borderBottomColor: 'transparent', borderBottomWidth: 2, flexDirection: 'row', gap: 7, marginBottom: -1, paddingBottom: 12 },
  tabActive: { borderBottomColor: COLORS.gold },
  tabLabel: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '600' },
  tabLabelActive: { color: COLORS.gold },
  tabCount: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 99, height: 22, justifyContent: 'center', minWidth: 22, paddingHorizontal: 6 },
  tabCountActive: { backgroundColor: COLORS.gold },
  tabCountText: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 12, fontWeight: '700' },
  tabCountTextActive: { color: COLORS.greenDeep },

  items: { gap: 10, marginTop: 14 },
  itemCard: { backgroundColor: COLORS.surface, borderRadius: 20, overflow: 'hidden', padding: 12 },
  itemTop: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  itemMain: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 14, minWidth: 0 },
  thumb: { position: 'relative' },
  // The 28pt gold disc overhangs the cover by 6pt, its ring by 3 more.
  thumbBadge: {
    alignItems: 'center',
    backgroundColor: COLORS.gold,
    borderColor: '#0E2416',
    borderRadius: 17,
    borderWidth: 3,
    bottom: -9,
    height: 34,
    justifyContent: 'center',
    position: 'absolute',
    right: -9,
    width: 34,
  },
  itemCopy: { flex: 1, minWidth: 0 },
  itemTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 16, fontWeight: '700', lineHeight: 21 },
  itemMeta: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 13, marginTop: 3 },
  itemFoot: { alignItems: 'center', borderTopColor: 'rgba(255, 255, 255, 0.07)', borderTopWidth: 1, flexDirection: 'row', gap: 10, justifyContent: 'space-between', marginTop: 12, paddingTop: 12 },
  tag: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.07)', borderRadius: 99, flexDirection: 'row', flexShrink: 1, gap: 7, height: 26, paddingHorizontal: 11 },
  tagDot: { backgroundColor: COLORS.gold, borderRadius: 4, height: 7, width: 7 },
  tagText: { color: COLORS.white, flexShrink: 1, fontFamily: TYPOGRAPHY.body, fontSize: 12, fontWeight: '600' },
  moves: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  move: { alignItems: 'center', backgroundColor: COLORS.gold, borderRadius: 99, flexDirection: 'row', gap: 2, height: 34, paddingLeft: 15, paddingRight: 10 },
  moveText: { color: COLORS.greenDeep, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '700' },
  moveQuiet: { alignItems: 'center', borderColor: 'rgba(255, 255, 255, 0.18)', borderRadius: 99, borderWidth: 1, height: 34, justifyContent: 'center', paddingHorizontal: 13 },
  moveQuietText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, fontWeight: '600' },
  emptyState: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: 16, gap: 10, paddingHorizontal: 16, paddingVertical: 24 },
  emptyTitle: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14, lineHeight: 20, maxWidth: 360, textAlign: 'center' },
  emptyAction: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '700' },

  count: { alignItems: 'center', backgroundColor: COLORS.goldSoft, borderRadius: 99, height: 26, justifyContent: 'center', minWidth: 26, paddingHorizontal: 8 },
  countText: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 13, fontWeight: '700' },
  sectionBody: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13.5, lineHeight: 19, marginBottom: 12, marginTop: -4 },
  createRow: { flexDirection: 'row', gap: 8 },
  createInput: { backgroundColor: COLORS.surface, borderRadius: 16, color: COLORS.white, flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 15, height: 50, minWidth: 0, paddingHorizontal: 16 },
  createButton: { alignItems: 'center', backgroundColor: COLORS.gold, borderRadius: 16, height: 50, justifyContent: 'center', width: 50 },
  playlists: { gap: 8, marginTop: 12 },
  playlistRow: { alignItems: 'center', backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 14, minHeight: 64, paddingHorizontal: 14, paddingVertical: 10 },
  playlistIcon: { alignItems: 'center', backgroundColor: COLORS.goldSoft, borderRadius: 12, height: 44, justifyContent: 'center', width: 44 },
  playlistCopy: { flex: 1, minWidth: 0 },
  playlistName: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '700' },
  playlistMeta: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12, marginTop: 3 },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  arabicCentered: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
  arabicTight: { fontFamily: TYPOGRAPHY.arabic },
});
