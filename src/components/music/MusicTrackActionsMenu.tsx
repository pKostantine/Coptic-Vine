'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { type Href, usePathname, useRouter } from 'expo-router';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import MusicArtwork from '@/components/music/MusicArtwork';
import MusicDownloadButton from '@/components/music/MusicDownloadButton';
import { MusicPlaylistPanel } from '@/components/music/MusicPlaylistPicker';
import { SheetRow } from '@/components/playback/ActionSheetFrame';
import ActionsSheet, { ActionRow, ActionsMenuTrigger } from '@/components/playback/ActionsSheet';
import { type MusicQueueItem, useMusicPlayer } from '@/context/MusicPlayerContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { isTracksOwnHolder, trackDownloadRequest, trackHolders } from '@/components/music/trackDownload';
import { musicTrackDownloadRequest } from '@/services/offlineDownloadRequests';
import { musicTrackArtists } from '@/utils/musicCredits';
import { publicShareUrl } from '@/utils/publicUrl';
import { shareLink } from '@/utils/shareLink';

import { tr } from '../../utils/appText';

interface MusicTrackActionsMenuProps {
  item: MusicQueueItem;
  /** Kept for the rows that pass it: the sheet sets Arabic by the text itself. */
  isArabic?: boolean;
  size?: number;
  /**
   * Called just before an action leaves for another page (Go to album, Go to
   * artists, Sign in), so a full-screen player it was opened from can put
   * itself away first instead of covering the page it leads to.
   */
  onNavigate?: () => void;
  /** Draws the button that opens the menu, in place of the row's "⋯". */
  renderTrigger?: (open: () => void) => ReactNode;
}

type Page = 'menu' | 'playlists' | 'artists';

/**
 * A track's More menu (Coptic Vine Player design, "More menu"): Add to
 * playlist, Download, Share, Go to album, Go to artists — and, for a track
 * other than the one playing, Add next and Add to end of queue. Add to
 * playlist and a choice between several artists open in the same sheet.
 */
export default function MusicTrackActionsMenu({
  item,
  size = 36,
  onNavigate,
  renderTrigger,
}: MusicTrackActionsMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [page, setPage] = useState<Page>('menu');
  const { addNext, addToEnd, currentItem } = useMusicPlayer();
  const { preferences } = useReadingPreferences();
  const locale = preferences.appLanguage === 'ar' ? 'ar' : 'en';
  const downloadRequest = useMemo(() => musicTrackDownloadRequest({
    track: item.track,
    locale,
    releaseTitle: item.releaseTitle,
    coverAsset: item.coverAsset,
  }), [item.coverAsset, item.releaseTitle, item.track, locale]);

  const releaseId = item.releaseId ?? item.track.releaseId ?? null;
  const releasePath = releaseId ? `/music/release/${releaseId}` : null;
  const artists = musicTrackArtists(item.track);
  // Queueing the track that is playing would only play it again: from the
  // player, the menu keeps to the design's five rows.
  const playingNow = currentItem?.track.id === item.track.id;

  const open = () => {
    setPage('menu');
    setVisible(true);
  };
  const close = () => setVisible(false);

  /**
   * Leaves the sheet, and the player under it, for another page — or only
   * the player, when the page it was opened over is that page already.
   */
  const leaveFor = (href: Href) => {
    close();
    onNavigate?.();
    if (href !== pathname) router.push(href);
  };

  // The track is downloaded once, whatever saved it (trackDownload.ts): the
  // menu shows the download holding it, and one not yet held is made as its
  // single's when the single is this track alone.
  const prepareDownload = useCallback(() => trackDownloadRequest(item, locale), [item, locale]);
  const holders = useMemo(() => trackHolders(item.track.id), [item.track.id]);
  const isOwnHolder = useMemo(() => isTracksOwnHolder(item.track.id), [item.track.id]);

  const shareTrack = async () => {
    close();
    await shareLink({
      title: item.track.title,
      text: item.releaseTitle
        ? `${item.track.title} — ${item.releaseTitle}`
        : item.track.title,
      url: publicShareUrl(
        `/share/music/track/${item.track.id}`,
        item.coverAsset?.id,
      ),
    });
  };

  const addTrackNext = () => {
    addNext(item);
    close();
  };

  const addTrackToEnd = () => {
    addToEnd(item);
    close();
  };

  // One artist is opened straight away; several are offered to choose from.
  const goToArtists = () => {
    if (artists.length === 1) leaveFor(`/music/artist/${artists[0].id}`);
    else setPage('artists');
  };

  const addToPlaylistLabel = tr('Add to playlist', 'Ajouter à une playlist', 'إضافة إلى قائمة تشغيل');
  const goToArtistsLabel = artists.length === 1
    ? tr('Go to artist', 'Voir l’artiste', 'الانتقال إلى الفنان')
    : tr('Go to artists', 'Voir les artistes', 'الانتقال إلى الفنانين');

  let kicker = item.releaseTitle ?? null;
  if (page === 'playlists') kicker = addToPlaylistLabel;
  if (page === 'artists') kicker = goToArtistsLabel;

  return (
    <>
      {renderTrigger
        ? renderTrigger(open)
        : <ActionsMenuTrigger label={tr('Track options', 'Options du titre', 'خيارات المقطع')} size={size} onPress={open} />}
      <ActionsSheet
        visible={visible}
        onClose={close}
        closeLabel={tr('Close track options', 'Fermer les options du titre', 'إغلاق خيارات المقطع')}
        artwork={<MusicArtwork asset={item.coverAsset} size={52} radius={10} label={item.releaseTitle ?? item.track.title} />}
        title={item.track.title}
        subtitle={kicker}
        rows={page !== 'playlists'}
      >
        {page === 'playlists' ? (
          <MusicPlaylistPanel
            trackId={item.track.id}
            onSignIn={() => leaveFor('/account')}
          />
        ) : page === 'artists' ? (
          artists.map((artist) => (
            <SheetRow
              key={artist.id}
              icon="person-circle-outline"
              label={artist.displayName}
              detail={artist.role === 'primary'
                ? tr('Primary artist', 'Artiste principal', 'فنان رئيسي')
                : artist.role === 'featured' ? tr('Featured artist', 'Artiste invité', 'فنان مشارك') : null}
              trailing="chevron"
              onPress={() => leaveFor(`/music/artist/${artist.id}`)}
            />
          ))
        ) : (
          <>
            <ActionRow
              icon="add-circle-outline"
              label={addToPlaylistLabel}
              onPress={() => setPage('playlists')}
            />
            {Platform.OS !== 'web' ? (
              <MusicDownloadButton
                packageKey={downloadRequest.packageKey}
                request={prepareDownload}
                holders={holders}
                isOwnHolder={isOwnHolder}
                menuRow
                onAction={close}
              />
            ) : null}
            {!playingNow ? (
              <>
                <ActionRow
                  icon="play-skip-forward"
                  label={tr('Add next', 'Lire ensuite', 'تشغيل تالياً')}
                  onPress={addTrackNext}
                />
                <ActionRow
                  icon="list-outline"
                  label={tr('Add to end of queue', 'Ajouter à la fin de la file', 'إضافة إلى نهاية قائمة الانتظار')}
                  onPress={addTrackToEnd}
                />
              </>
            ) : null}
            <ActionRow
              icon="share-outline"
              label={tr('Share', 'Partager', 'مشاركة')}
              onPress={() => void shareTrack()}
            />
            {/* Not on a row of the album's own page, where it would lead nowhere;
                from a player over that page, it puts the player away. */}
            {releasePath && (pathname !== releasePath || onNavigate) ? (
              <ActionRow
                icon="disc-outline"
                label={tr('Go to album', 'Voir l’album', 'الانتقال إلى الألبوم')}
                onPress={() => leaveFor(releasePath as Href)}
              />
            ) : null}
            {artists.length ? (
              <ActionRow
                icon="people-outline"
                label={goToArtistsLabel}
                onPress={goToArtists}
              />
            ) : null}
          </>
        )}
      </ActionsSheet>
    </>
  );
}
