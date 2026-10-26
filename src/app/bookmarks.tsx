'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { isBibleBookmark } from '@/components/vine/screens/BibleBookmarks';
import { PageGlow } from '@/components/vine/screens/BookPage';
import BleedPage from '@/components/vine/ui/BleedPage';
import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import Icon from '@/components/vine/ui/Icon';
import { BuddedCross } from '@/components/vine/ui/Ornaments';
import SubPageHeader from '@/components/vine/ui/SubPageHeader';
import SwipeToRemove from '@/components/vine/ui/SwipeToRemove';
import {
  bookmarkKeyFor,
  CATEGORIES,
  DIVINE_LITURGY_SERVICES,
  HOLY_WEEK_DAYS,
  HOLY_WEEK_HOURS,
  holyWeekHourHref,
  LITURGY_GROUPS,
  RAISING_OF_INCENSE_OPTIONS,
  SERVICES_BY_CATEGORY,
  type CategoryId,
} from '@/constants/manifest';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { appText, type AppText } from '@/utils/appText';
import { goBack } from '@/utils/navigation';
import { useLayoutMode } from '@/utils/useLayoutMode';

import { tr } from '../utils/appText';

const MAX_FONT_SCALE = 1.3;

interface BookmarkEntry {
  id: string;
  /** The book it is in, which it is listed under. */
  book: CategoryId;
  title: AppText;
  /** The line under its name: where in the book it is ("Tuesday", "Raising of Incense"). */
  detail: AppText | null;
  href: string;
  /** Its place in its book's menu, so a book's bookmarks keep the book's own order. */
  order: number;
}

const text = (english: string, arabic: string, french?: string): AppText => ({ english, arabic, french: french || english });

function buildBookmarkIndex(): Record<string, BookmarkEntry> {
  const index: Record<string, BookmarkEntry> = {};
  let order = 0;

  // Keyed by bookmarkKeyFor, which appends the entry id only where several
  // entries open the same schema/table. Vespers and Matins are both
  // liturgy.raising_of_incense, so before this they wrote the SAME key and
  // whichever was registered last (Matins) silently claimed every bookmark
  // made in either — including subdocument ones, which build on the parent id.
  const register = (schema: string, table: string, entryId: string, entry: Omit<BookmarkEntry, 'id' | 'order'>) => {
    const key = bookmarkKeyFor(schema, table, entryId);
    order += 1;
    index[key] = { ...entry, id: key, order };
    // Bookmarks saved before the key gained its entry-id suffix are genuinely
    // ambiguous — nothing recorded which entry they were made from. Rather
    // than drop them from the list, the bare key stays resolvable, pointing at
    // the first entry that claims it.
    const bare = `${schema}:${table}`;
    if (key !== bare && !index[bare]) index[bare] = { ...entry, id: bare, order };
  };

  for (const category of CATEGORIES) {
    if (category.kind === 'direct' && category.schema && category.table) {
      register(category.schema, category.table, category.id, {
        book: category.id,
        title: text(category.title, category.arabic, category.french),
        detail: null,
        href: `/${category.id}`,
      });
    }
  }

  for (const [categoryId, services] of Object.entries(SERVICES_BY_CATEGORY)) {
    for (const service of services) {
      register(service.schema, service.table, service.id, {
        book: categoryId as CategoryId,
        title: text(service.title, service.arabic, service.french),
        detail: null,
        href: `/${categoryId}/${service.id}`,
      });
    }
  }

  const [raisingOfIncense, divineLiturgy] = LITURGY_GROUPS;
  for (const option of RAISING_OF_INCENSE_OPTIONS) {
    register(option.schema, option.table, option.id, {
      book: 'liturgy',
      title: text(option.title, option.arabic, option.french),
      detail: text(raisingOfIncense.title, raisingOfIncense.arabic, raisingOfIncense.french),
      href: `/liturgy/raising-of-incense/${option.id}`,
    });
  }

  for (const service of DIVINE_LITURGY_SERVICES) {
    register(service.schema, service.table, service.id, {
      book: 'liturgy',
      title: text(service.title, service.arabic, service.french),
      detail: text(divineLiturgy.title, divineLiturgy.arabic, divineLiturgy.french),
      href: `/liturgy/divine-liturgy/${service.id}`,
    });
  }

  // An hour by its own name, under the day it is prayed on ("Third Hour", "Tuesday").
  for (const hour of HOLY_WEEK_HOURS) {
    const day = HOLY_WEEK_DAYS.find((candidate) => candidate.id === hour.dayId);
    const ownName = day && day.hours.length > 1;
    register(hour.schema, hour.table, hour.id, {
      book: 'holy-week',
      title: ownName ? text(hour.shortTitle, hour.shortArabic, hour.shortFrench) : text(hour.title, hour.arabic, hour.french),
      detail: ownName ? text(day.title, day.arabic, day.french) : null,
      href: holyWeekHourHref(hour),
    });
  }

  return index;
}

const BOOKMARK_INDEX = buildBookmarkIndex();

/** "COPTIC_PROPHECY" → "Coptic Prophecy": a subdocument's name, from its key. */
function subdocumentName(key: string): string {
  return key.split('_').map((word) => word.charAt(0) + word.slice(1).toLowerCase()).join(' ');
}

/** A detail line from its parts, joined as "Wednesday · Sixth Hour" in each language. */
function joinText(parts: (AppText | null)[]): AppText | null {
  const kept = parts.filter((part): part is AppText => part !== null);
  if (!kept.length) return null;
  const join = (language: keyof AppText) => kept.map((part) => part[language] || part.english || '').filter(Boolean).join(' · ');
  return { english: join('english'), arabic: join('arabic'), french: join('french') };
}

/** A bookmark as the list shows it: a document, or a subdocument inside one ("${parent}:sub:${KEY}"). */
function resolveBookmark(id: string): BookmarkEntry | null {
  const subMatch = id.match(/^(.+):sub:([^:]+)$/);
  if (!subMatch) return BOOKMARK_INDEX[id] || null;
  const [, parentId, subdocumentKey] = subMatch;
  const parent = BOOKMARK_INDEX[parentId];
  if (!parent) return null;
  const name = subdocumentName(subdocumentKey);
  return {
    id,
    book: parent.book,
    title: { english: name, arabic: name, french: name },
    detail: joinText([parent.detail, parent.title]),
    href: `${parent.href}?sub=${subdocumentKey}`,
    // Right after the document it is in.
    order: parent.order + 0.5,
  };
}

/**
 * Bookmarks (Coptic Vine design, "Bookmarks"), from the bookmark button in a
 * book's Contents: grouped by book, in the library's order, each under its
 * book's cross with how many it holds. A bookmark is swiped left to remove
 * it. Bible chapters keep their own bookmarks, in the Bible.
 */
export default function BookmarksScreen() {
  const router = useRouter();
  const { bookmarks, preferences, toggleBookmark } = useReadingPreferences();
  const arabic = preferences.appLanguage === 'ar';
  const wide = useLayoutMode() !== 'phone';
  const title = tr('Bookmarks', 'Signets', 'العلامات');

  const groups = useMemo(() => {
    const entries = bookmarks
      .filter((id) => !isBibleBookmark(id))
      .map(resolveBookmark)
      .filter((entry): entry is BookmarkEntry => entry !== null);
    return CATEGORIES
      .map((category) => ({
        category,
        entries: entries.filter((entry) => entry.book === category.id).sort((a, b) => a.order - b.order || appText(a.title).localeCompare(appText(b.title))),
      }))
      .filter((group) => group.entries.length);
  }, [bookmarks]);

  return (
    <BleedPage background={<PageGlow kind="green" tall={wide} />} footer={<BottomTabBar active="books" />}>
      <Head>
        <title>{`${title} — Coptic Vine`}</title>
      </Head>
      <SubPageHeader title={title} arabic={arabic} onBack={() => goBack(router, '/books')} backLabel={tr('Back', 'Retour', 'رجوع')} />
      {groups.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyMark}>
            <Icon name="bookmark-outline" size={30} color={COLORS.gold} />
          </View>
          <Text style={[styles.emptyTitle, arabic && styles.arabicCentered]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('No bookmarks yet', 'Aucun signet pour l’instant', 'لا توجد علامات بعد')}</Text>
          <Text style={[styles.emptyText, arabic && styles.arabicCentered]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {tr(
              'In any book, open Contents and tap the bookmark to save your place.',
              'Dans n’importe quel livre, ouvrez la table des matières et touchez le signet pour garder votre place.',
              'في أي كتاب، افتح المحتويات واضغط على العلامة لتحفظ مكانك.',
            )}
          </Text>
        </View>
      ) : (
        <NowPlayingAwareScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.column}>
            {groups.map(({ category, entries }) => (
              <View key={category.id} style={styles.group}>
                <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
                <View style={styles.groupHead}>
                  <View style={styles.bookMark}>
                    <BuddedCross size={22} />
                  </View>
                  <Text style={[styles.bookTitle, arabic && styles.arabic]} numberOfLines={1} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {appText({ english: category.title, arabic: category.arabic, french: category.french })}
                  </Text>
                  <Text style={styles.count} maxFontSizeMultiplier={MAX_FONT_SCALE}>{entries.length}</Text>
                </View>
                {entries.map((entry) => {
                  const name = appText(entry.title);
                  const detail = entry.detail ? appText(entry.detail) : '';
                  const removeLabel = tr('Remove', 'Retirer', 'إزالة');
                  return (
                    <View key={entry.id}>
                      <View style={styles.separator} />
                      <SwipeToRemove label={removeLabel} onRemove={() => toggleBookmark(entry.id)}>
                        {(guard) => (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={detail ? `${name}, ${detail}` : name}
                            accessibilityActions={[{ name: 'delete', label: tr(`Remove ${name} from bookmarks`, `Retirer ${name} des signets`, `إزالة ${name} من العلامات`) }]}
                            onAccessibilityAction={(event) => { if (event.nativeEvent.actionName === 'delete') toggleBookmark(entry.id); }}
                            onPress={guard(() => router.push(entry.href as never))}
                            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                          >
                            <View style={styles.rowText}>
                              <Text style={[styles.rowTitle, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{name}</Text>
                              {detail ? <Text style={[styles.rowDetail, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{detail}</Text> : null}
                            </View>
                            <Icon name="chevron-forward" size={18} color={COLORS.gold} />
                          </Pressable>
                        )}
                      </SwipeToRemove>
                    </View>
                  );
                })}
              </View>
            ))}
            <Text style={[styles.hint, arabic && styles.arabicCentered]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {Platform.OS === 'web'
                ? tr('Swipe or drag a bookmark to the left to remove it.', 'Faites glisser un signet vers la gauche pour le retirer.', 'اسحب العلامة إلى اليسار لإزالتها.')
                : tr('Swipe left on a bookmark to remove it.', 'Balayez un signet vers la gauche pour le retirer.', 'اسحب العلامة إلى اليسار لإزالتها.')}
            </Text>
          </View>
        </NowPlayingAwareScrollView>
      )}
    </BleedPage>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32, paddingHorizontal: 16 },
  column: { alignSelf: 'center', gap: 12, maxWidth: 640, width: '100%' },
  group: { borderRadius: 22, overflow: 'hidden', paddingVertical: 6 },
  groupHead: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  bookMark: {
    alignItems: 'center',
    backgroundColor: COLORS.goldSoft,
    borderColor: 'rgba(227, 181, 59, 0.35)',
    borderRadius: 19,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  bookTitle: { color: COLORS.white, flex: 1, fontFamily: TYPOGRAPHY.title, fontSize: 18, fontWeight: '700' },
  count: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13 },
  separator: { backgroundColor: 'rgba(255, 255, 255, 0.07)', height: 1, marginHorizontal: 16 },
  // The row runs to the card's edges, so a swiped one slides under the card's edge rather than its margin.
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 62, paddingHorizontal: 16, paddingVertical: 13 },
  pressed: { opacity: 0.7 },
  rowText: { flex: 1, gap: 2, minWidth: 0 },
  rowTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 16, fontWeight: '600' },
  rowDetail: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13 },
  hint: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, paddingTop: 4, textAlign: 'center' },
  empty: { alignItems: 'center', flex: 1, gap: 10, justifyContent: 'center', paddingBottom: 60, paddingHorizontal: 32 },
  emptyMark: {
    alignItems: 'center',
    backgroundColor: COLORS.goldSoft,
    borderColor: 'rgba(227, 181, 59, 0.35)',
    borderRadius: 39,
    borderWidth: 1,
    height: 78,
    justifyContent: 'center',
    marginBottom: 12,
    width: 78,
  },
  emptyTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 23, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 15, lineHeight: 22.5, maxWidth: 300, textAlign: 'center' },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  arabicCentered: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
});
