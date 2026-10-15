'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import MusicMiniPlayer from '@/components/music/MusicMiniPlayer';
import ReleaseTile from '@/components/music/ReleaseTile';
import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { PageGutterProvider, SectionHeading } from '@/components/vine/screens/BookPage';
import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import BrandIcon from '@/components/vine/ui/BrandIcon';
import Icon from '@/components/vine/ui/Icon';
import LoadFailure from '@/components/vine/ui/LoadFailure';
import PersonHero from '@/components/vine/ui/PersonHero';
import ShareMetadata from '@/components/vine/ui/ShareMetadata';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { usePlayRelease } from '@/hooks/usePlayRelease';
import { useReleaseLikes } from '@/hooks/useReleaseLikes';
import { musicService } from '@/services/musicService';
import type { MusicArtistLink, MusicConsumerArtist, MusicConsumerAsset, MusicConsumerReleaseSummary } from '@/types/musicConsumer';
import { goBack } from '@/utils/navigation';
import { publicShareUrl, publicUrl } from '@/utils/publicUrl';
import { shareLink } from '@/utils/shareLink';
import { useContentWidth, useLayoutMode } from '@/utils/useLayoutMode';

import { tr } from '../../../utils/appText';

/** Each platform's name, for the link's label and its spoken name. */
const LINK_NAMES: Record<string, string> = {
  website: 'Website',
  linktree: 'Linktree',
  youtube: 'YouTube',
  soundcloud: 'SoundCloud',
  spotify: 'Spotify',
  apple_music: 'Apple Music',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  x: 'X',
  bandcamp: 'Bandcamp',
};

function linkName(link: MusicArtistLink): string {
  return link.label || LINK_NAMES[link.platform] || link.platform.replace(/^custom:/, '');
}

/** "2026 · Album" */
function releaseLine(release: MusicConsumerReleaseSummary): string {
  const kind = release.releaseType === 'album' ? tr('Album', 'Album', 'ألبوم') : release.releaseType === 'ep' ? 'EP' : tr('Single', 'Single', 'أغنية');
  return [release.releaseDate?.slice(0, 4), kind].filter(Boolean).join(' · ');
}

/** The iPad's and desktop's releases: covers about 200pt wide, 22pt apart, as on the Music tab. */
const GRID_GAP = 22;

/**
 * An artist (Coptic Vine design, "Artist"): their photo glowing out of the
 * page, their name and bio, Follow and Share, the places they publish, then
 * their releases as covers, each with a heart, over the tab bar. The iPad and
 * desktop set the photo beside the name.
 */
export default function MusicArtistScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id: string }>();
  const artistId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { preferences } = useReadingPreferences();
  const locale = preferences.appLanguage === 'ar' ? 'ar' : 'en';
  const arabic = locale === 'ar';
  const layout = useLayoutMode();
  const width = useContentWidth();
  const wide = layout !== 'phone';
  const { play, isPlaying } = usePlayRelease(locale);
  // Likes come from the listener's library, which also says whether they can follow.
  const likes = useReleaseLikes(locale);
  const libraryAuthenticated = likes.authenticated;
  const [artist, setArtist] = useState<MusicConsumerArtist | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [followed, setFollowed] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [shareArtwork, setShareArtwork] = useState<MusicConsumerAsset | null>(null);
  const [shareArtworkLoaded, setShareArtworkLoaded] = useState(false);

  useEffect(() => {
    if (!artistId) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- route changes reset the visible entity before async loading
    setError(null);
    setArtist(null);
    setShareArtwork(null);
    setShareArtworkLoaded(false);
    musicService.getArtist(artistId, locale)
      .then((payload) => { if (active) setArtist(payload); })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load artist.');
      });
    return () => { active = false; };
  }, [artistId, locale, attempt]);

  useEffect(() => {
    if (!artistId) return;
    let active = true;
    musicService.getArtistFollowed(artistId)
      .then((isFollowed) => { if (active) setFollowed(isFollowed); })
      .catch(() => { if (active) setFollowed(false); });
    return () => { active = false; };
  }, [artistId, user?.id]);

  useEffect(() => {
    if (!artist || artist.profileImageAsset || shareArtworkLoaded) return;
    let active = true;
    musicService.getArtistSearchArt(artist.id)
      .then((asset) => { if (active) setShareArtwork(asset); })
      .catch(() => { if (active) setShareArtwork(null); })
      .finally(() => { if (active) setShareArtworkLoaded(true); });
    return () => { active = false; };
  }, [artist, shareArtworkLoaded]);

  const toggleFollow = async () => {
    if (!artist || followBusy) return;
    if (!libraryAuthenticated) {
      Alert.alert(
        tr('Follow artist', 'Suivre l’artiste', 'متابعة الفنان'),
        tr('Sign in to your Coptic Vine account to follow artists.', 'Connectez-vous à votre compte Coptic Vine pour suivre des artistes.', 'سجّل الدخول إلى حساب كوبتك فاين لمتابعة الفنانين.'),
      );
      return;
    }
    setFollowBusy(true);
    try {
      const next = !followed;
      await musicService.setArtistFollowed(artist.id, next);
      setFollowed(next);
    } catch (cause) {
      Alert.alert(
        tr('Follow artist', 'Suivre l’artiste', 'متابعة الفنان'),
        cause instanceof Error ? cause.message : 'Unable to update this artist.',
      );
    } finally {
      setFollowBusy(false);
    }
  };

  const shareImageAsset = artist?.profileImageAsset ?? shareArtwork;

  const shareArtist = async () => {
    if (!artist) return;
    await shareLink({
      title: artist.displayName,
      text: artist.biography || artist.displayName,
      url: publicShareUrl(`/share/music/artist/${artist.id}`, shareImageAsset?.id),
    });
  };

  const openLink = (link: MusicArtistLink) => {
    Linking.openURL(link.url).catch(() => {
      Alert.alert(linkName(link), tr('This link could not be opened.', 'Ce lien n’a pas pu être ouvert.', 'تعذّر فتح هذا الرابط.'));
    });
  };

  const shareImageUrl = musicService.resolveAsset(shareImageAsset);
  // The artist's own payload carries the links (get_published_music_artist).
  const artistLinks = artist?.socialLinks ?? [];
  // The iPad's and desktop's 36pt margins are the sections' gutter, the hero's glow running past them to the edges.
  const gutter = wide ? 36 : 16;
  const available = width - (wide ? 72 : 32);
  const gap = wide ? GRID_GAP : 12;
  const columns = wide ? Math.max(3, Math.floor((available + GRID_GAP) / (200 + GRID_GAP))) : 2;
  const tileWidth = Math.floor((available - gap * (columns - 1)) / columns);

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <Head><title>{artist ? `${artist.displayName} — Coptic Vine` : tr('Artist — Coptic Vine', 'Artiste — Coptic Vine', 'فنان — كوبتك فاين')}</title></Head>
      {artist ? (
        <ShareMetadata
          title={artist.displayName}
          description={artist.biography || 'Listen on Coptic Vine'}
          canonicalUrl={publicUrl(`/music/artist/${artist.id}`)}
          imageUrl={shareImageUrl}
          type="profile"
        />
      ) : null}

      {!artist ? (
        <View style={styles.pending}>
          <Pressable accessibilityRole="button" accessibilityLabel={tr('Go back', 'Retour', 'رجوع')} onPress={() => goBack(router, '/music')} style={({ pressed }) => [styles.pendingBack, pressed && styles.pressed]}>
            <Icon name={arabic ? 'chevron-forward' : 'chevron-back'} size={20} color={COLORS.gold} />
          </Pressable>
          {error ? (
            <LoadFailure error={error} layout="inline" onRetry={() => setAttempt((count) => count + 1)} />
          ) : (
            <ActivityIndicator color={COLORS.gold} style={styles.loader} />
          )}
        </View>
      ) : (
        <NowPlayingAwareScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <PageGutterProvider gutter={gutter}>
            <PersonHero
              name={artist.displayName}
              kicker={tr('Artist', 'Artiste', 'فنان')}
              imageUri={musicService.resolveAsset(artist.profileImageAsset)}
              bio={artist.biography}
              arabic={arabic}
              wide={wide}
              onBack={() => goBack(router, '/music')}
              backLabel={tr('Go back', 'Retour', 'رجوع')}
            >
              <View style={[styles.actions, wide && styles.actionsWide, arabic && styles.rowReverse]}>
                <Pressable
                  accessibilityRole="button"
                  aria-selected={followed}
                  accessibilityLabel={followed ? tr('Unfollow artist', 'Ne plus suivre l’artiste', 'إلغاء متابعة الفنان') : tr('Follow artist', 'Suivre l’artiste', 'متابعة الفنان')}
                  disabled={followBusy}
                  onPress={() => void toggleFollow()}
                  style={({ pressed }) => [styles.follow, !followed && styles.followOff, arabic && styles.rowReverse, followBusy && styles.disabled, pressed && styles.pressed]}
                >
                  {followBusy ? <ActivityIndicator size="small" color={followed ? COLORS.greenDeep : COLORS.gold} /> : followed ? <Icon name="checkmark" size={17} color={COLORS.greenDeep} /> : <Icon name="add" size={17} color={COLORS.gold} />}
                  <Text style={[styles.followText, !followed && styles.followTextOff, arabic && styles.arabic]} maxFontSizeMultiplier={1.3}>
                    {followed ? tr('Following', 'Suivi', 'متابَع') : tr('Follow', 'Suivre', 'متابعة')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tr('Share artist', 'Partager l’artiste', 'مشاركة الفنان')}
                  onPress={() => void shareArtist()}
                  style={({ pressed }) => [styles.share, pressed && styles.pressed]}
                >
                  <Icon name="share-outline" size={18} color={COLORS.white} />
                </Pressable>
              </View>
              {artistLinks.length ? (
                <View style={[styles.links, wide && styles.linksWide, wide && (arabic ? styles.linksEnd : styles.linksStart), arabic && styles.rowReverse]}>
                  {artistLinks.map((link) => (
                    <Pressable
                      key={link.id ?? `${link.platform}:${link.url}`}
                      accessibilityRole="link"
                      accessibilityLabel={linkName(link)}
                      onPress={() => openLink(link)}
                      style={({ pressed }) => [styles.link, wide && styles.linkWide, pressed && styles.linkPressed]}
                    >
                      <BrandIcon name={link.platform} size={wide ? 19 : 16} color={COLORS.gold} />
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </PersonHero>

            <SectionHeading size="page" title={tr('Releases', 'Parutions', 'الإصدارات')} arabic={arabic} />
            {artist.releases.length ? (
              <View style={[styles.grid, { gap, paddingHorizontal: gutter }, arabic && styles.rowReverse]}>
                {artist.releases.map((release) => {
                  const liked = likes.isLiked(release.id);
                  return (
                    <ReleaseTile
                      key={release.id}
                      id={release.id}
                      title={release.title}
                      subtitle={releaseLine(release)}
                      artworkUri={musicService.resolveAsset(release.coverAsset)}
                      width={tileWidth}
                      arabic={arabic}
                      wrapTitle
                      large={wide}
                      onPress={() => router.push(`/music/release/${release.id}`)}
                      onPlay={() => play(release)}
                      playing={isPlaying(release.id)}
                      playLabel={`${isPlaying(release.id) ? tr('Pause', 'Pause', 'إيقاف مؤقت') : tr('Play', 'Lire', 'تشغيل')}: ${release.title}`}
                      liked={liked}
                      onToggleLike={() => likes.toggle(release.id)}
                      likeLabel={`${liked ? tr('Unlike release', 'Retirer des favoris', 'إزالة الإعجاب') : tr('Like release', 'Ajouter aux favoris', 'إعجاب')}: ${release.title}`}
                    />
                  );
                })}
              </View>
            ) : (
              <View style={[styles.empty, { marginHorizontal: gutter }]}>
                <Text style={[styles.emptyText, arabic && styles.arabic]}>{tr('No published releases yet.', 'Aucune parution publiée pour l’instant.', 'لا توجد إصدارات منشورة بعد.')}</Text>
              </View>
            )}
          </PageGutterProvider>
        </NowPlayingAwareScrollView>
      )}

      <MusicMiniPlayer />
      <BottomTabBar active="music" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.black },
  content: { paddingBottom: 32 },
  pending: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  pendingBack: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  loader: { marginTop: 48 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.6 },
  rowReverse: { flexDirection: 'row-reverse' },
  actions: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 16 },
  actionsWide: { marginTop: 20 },
  follow: { alignItems: 'center', backgroundColor: COLORS.gold, borderColor: COLORS.gold, borderRadius: 99, borderWidth: 1, flexDirection: 'row', gap: 6, height: 40, paddingLeft: 14, paddingRight: 18 },
  followOff: { backgroundColor: 'transparent', borderColor: COLORS.goldLine },
  followText: { color: COLORS.greenDeep, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '700' },
  followTextOff: { color: COLORS.gold },
  share: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.12)', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  // A phone keeps the links to one row of small rounds; the iPad and desktop set them larger.
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 16 },
  linksWide: { gap: 10 },
  linksStart: { justifyContent: 'flex-start' },
  linksEnd: { justifyContent: 'flex-end' },
  link: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.34)', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  linkWide: { borderRadius: 22, height: 44, width: 44 },
  linkPressed: { backgroundColor: 'rgba(227, 181, 59, 0.2)' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  empty: { backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14 },
  emptyText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14 },
  arabic: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
});
