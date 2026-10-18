'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import LearningArtwork from '@/components/learning/LearningArtwork';
import LearningBackHeader from '@/components/learning/LearningBackHeader';
import LearningDownloadButton from '@/components/learning/LearningDownloadButton';
import LearningItemActionsMenu from '@/components/learning/LearningItemActionsMenu';
import LearningMediaRow from '@/components/learning/LearningMediaRow';
import Icon from '@/components/vine/ui/Icon';
import { COLORS, RADII, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { learningAlbumQueue, useLearningPlayer } from '@/context/LearningPlayerContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { useLearningItemLikes } from '@/hooks/useLearningItemLikes';
import { learningService } from '@/services/learningService';
import {
  learningAlbumDownloadRequest,
  learningRecordingDownloadRequest,
} from '@/services/offlineDownloadRequests';
import type { LearningAlbumDetail } from '@/types/learningPlatform';
import { publicUrl } from '@/utils/publicUrl';
import { shareLink } from '@/utils/shareLink';

import { tr } from '../../../utils/appText';

/**
 * A learning album, laid out as a Music album is (music/release/[id].tsx):
 * the cover, the title and cantor, one line of what it holds, Play, Share and
 * Download, then its recordings as an album's songs — each with the one More
 * menu that holds Add to playlist, Download, the queue and Share.
 */
export default function LearningAlbumScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { preferences } = useReadingPreferences();
  const locale = preferences.appLanguage === 'ar' ? 'ar' : 'en';
  const isArabic = locale === 'ar';
  const albumId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [album, setAlbum] = useState<LearningAlbumDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { currentItem, playQueue } = useLearningPlayer();
  const likes = useLearningItemLikes(locale);
  const queue = useMemo(() => album ? learningAlbumQueue(album) : [], [album]);
  const downloadRequest = useMemo(() => album ? learningAlbumDownloadRequest(album, locale) : null, [album, locale]);

  useEffect(() => {
    if (!albumId) return;
    let active = true;
    learningService.getAlbum(albumId, locale)
      .then((payload) => {
        if (!active) return;
        setError(null);
        setAlbum(payload);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load learning album.'); });
    return () => { active = false; };
  }, [albumId, locale]);

  const shareAlbum = async () => {
    if (!album) return;
    await shareLink({
      title: album.title,
      text: `${album.title} - ${album.cantor.displayName}`,
      url: publicUrl(`/learn/album/${album.id}`),
    });
  };

  const recordingCount = album?.recordings.length ?? 0;
  const recordingsLabel = tr(
    `${recordingCount} recording${recordingCount === 1 ? '' : 's'}`,
    `${recordingCount} enregistrement${recordingCount === 1 ? '' : 's'}`,
    `${recordingCount} تسجيل`,
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <Head><title>{album ? album.title + ' — Learn & Study' : 'Learning Album'}</title></Head>
      <LearningBackHeader title={tr('Learning Album', 'Album d’apprentissage', 'ألبوم تعلّم')} isArabic={isArabic} />
      {!album && !error ? <ActivityIndicator color={COLORS.learning} style={styles.loader} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {album ? (
        <NowPlayingAwareScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <LearningArtwork asset={album.coverAsset} size={220} label={album.title} />
            <View style={styles.heroInfo}>
              <Text style={[styles.title, isArabic && styles.arabicCentered]}>{album.title}</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/learn/cantor/[id]', params: { id: album.cantor.id } })}>
                <Text style={[styles.cantor, isArabic && styles.arabicCentered]}>{album.cantor.displayName}</Text>
              </Pressable>
              <Text style={[styles.albumMeta, isArabic && styles.arabicCentered]}>
                {album.season ? (
                  <>
                    <Text
                      accessibilityRole="link"
                      style={styles.season}
                      onPress={() => router.push({ pathname: '/learn/season/[id]', params: { id: album.season!.id } })}
                    >
                      {album.season.title}
                    </Text>
                    {' • '}
                  </>
                ) : null}
                {album.originalReleaseDate ? `${album.originalReleaseDate.slice(0, 4)} • ` : ''}
                {recordingsLabel}
              </Text>
              {album.description ? <Text style={[styles.description, isArabic && styles.arabicCentered]}>{album.description}</Text> : null}
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" disabled={!queue.length} style={[styles.playAll, !queue.length && styles.disabled]} onPress={() => queue.length && playQueue(queue, 0)}>
                  <Icon name="play" size={16} color={COLORS.learningDeep} />
                  <Text style={styles.playAllText}>{tr('Play', 'Lire', 'تشغيل')}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" style={styles.actionButton} onPress={() => void shareAlbum()}>
                  <Icon name="share-outline" size={19} color={COLORS.learningBright} />
                  <Text style={styles.actionButtonText}>{tr('Share', 'Partager', 'مشاركة')}</Text>
                </Pressable>
                {downloadRequest ? (
                  <LearningDownloadButton
                    packageKey={downloadRequest.packageKey}
                    request={downloadRequest}
                    isArabic={isArabic}
                  />
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.mediaList}>
            {album.recordings.map((recording, index) => (
              <LearningMediaRow
                key={recording.id}
                title={recording.title}
                subtitle={recording.subtitle || album.cantor.displayName}
                durationMs={recording.durationMs}
                index={index}
                active={currentItem?.id === recording.id}
                isArabic={isArabic}
                onPress={() => playQueue(queue, index)}
                liked={likes.isLiked(recording.id)}
                onToggleLike={() => likes.toggle('album_recording', recording.id)}
                trailing={(
                  <LearningItemActionsMenu
                    item={queue[index]}
                    isArabic={isArabic}
                    size={32}
                    download={learningRecordingDownloadRequest(album, recording, locale)}
                  />
                )}
              />
            ))}
            {!album.recordings.length ? <Text style={styles.empty}>{tr('No published recordings.', 'Aucun enregistrement publié.', 'لا توجد تسجيلات منشورة.')}</Text> : null}
          </View>
        </NowPlayingAwareScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.black },
  loader: { marginTop: SPACING.xl },
  error: { color: COLORS.priest, fontFamily: TYPOGRAPHY.body, textAlign: 'center', margin: SPACING.xl },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl },
  hero: { alignItems: 'center', paddingTop: SPACING.sm },
  heroInfo: { width: '100%', maxWidth: 680, alignItems: 'center', marginTop: SPACING.lg },
  title: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 28, fontWeight: '700', textAlign: 'center' },
  cantor: { color: COLORS.learningBright, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '700', textAlign: 'center', marginTop: SPACING.sm },
  albumMeta: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, textAlign: 'center', marginTop: SPACING.sm },
  season: { color: COLORS.goldBright, fontWeight: '700' },
  description: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: SPACING.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, marginTop: SPACING.lg },
  playAll: { flexDirection: 'row', gap: 8, minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl, borderRadius: RADII.pill, backgroundColor: COLORS.learning },
  playAllText: { color: COLORS.learningDeep, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '800' },
  actionButton: { minHeight: 46, paddingHorizontal: SPACING.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: RADII.pill, borderWidth: 1, borderColor: COLORS.learningLine, backgroundColor: COLORS.surface },
  actionButtonText: { color: COLORS.learningBright, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  mediaList: { marginTop: SPACING.lg, overflow: 'hidden', borderRadius: RADII.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  empty: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, textAlign: 'center', padding: SPACING.lg },
  arabicCentered: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
});
