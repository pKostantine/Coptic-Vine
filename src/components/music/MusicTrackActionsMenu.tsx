'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import MusicArtwork from '@/components/music/MusicArtwork';
import MusicDownloadButton from '@/components/music/MusicDownloadButton';
import MusicPlaylistPicker from '@/components/music/MusicPlaylistPicker';
import ActionsSheet, { ActionRow, ActionsMenuTrigger } from '@/components/playback/ActionsSheet';
import { type MusicQueueItem, useMusicPlayer } from '@/context/MusicPlayerContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { musicService } from '@/services/musicService';
import { musicTrackDownloadRequest } from '@/services/offlineDownloadRequests';
import { publicShareUrl } from '@/utils/publicUrl';
import { shareLink } from '@/utils/shareLink';

import { tr } from '../../utils/appText';
interface MusicTrackActionsMenuProps {
  item: MusicQueueItem;
  isArabic?: boolean;
  size?: number;
}

/** A track's actions: download, playlist, queue it next or last, share. */
export default function MusicTrackActionsMenu({
  item,
  isArabic = false,
  size = 36,
}: MusicTrackActionsMenuProps) {
  const [visible, setVisible] = useState(false);
  const { addNext, addToEnd } = useMusicPlayer();
  const { preferences } = useReadingPreferences();
  const locale = preferences.appLanguage === 'ar' ? 'ar' : 'en';
  const downloadRequest = useMemo(() => musicTrackDownloadRequest({
    track: item.track,
    locale,
    releaseTitle: item.releaseTitle,
    coverAsset: item.coverAsset,
  }), [item.coverAsset, item.releaseTitle, item.track, locale]);

  const close = () => setVisible(false);

  const prepareDownload = useCallback(async () => {
    let lyrics = null;
    try {
      lyrics = await musicService.getLyrics(item.track.id, locale);
    } catch {
      // Lyrics are useful offline metadata, but the audio download can proceed without them.
    }
    return musicTrackDownloadRequest({
      track: item.track,
      locale,
      releaseTitle: item.releaseTitle,
      coverAsset: item.coverAsset,
      lyrics,
    });
  }, [item.coverAsset, item.releaseTitle, item.track, locale]);

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

  return (
    <>
      <ActionsMenuTrigger label={tr('Track options', 'Options du titre', 'خيارات المقطع')} size={size} onPress={() => setVisible(true)} />
      <ActionsSheet
        visible={visible}
        onClose={close}
        closeLabel="Close track options"
        artwork={<MusicArtwork asset={item.coverAsset} size={52} radius={6} label={item.releaseTitle ?? item.track.title} />}
        title={item.track.title}
        subtitle={item.releaseTitle}
        isArabic={isArabic}
      >
        {Platform.OS !== 'web' ? (
          <MusicDownloadButton
            packageKey={downloadRequest.packageKey}
            request={prepareDownload}
            isArabic={isArabic}
            menuRow
            onAction={close}
          />
        ) : null}
        <MusicPlaylistPicker
          trackId={item.track.id}
          label={tr('Add to playlist', 'Ajouter à une playlist', 'إضافة إلى قائمة تشغيل')}
          menuRow
          onDismiss={close}
        />
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
        <ActionRow
          icon="share-outline"
          label={tr('Share', 'Partager', 'مشاركة')}
          onPress={() => void shareTrack()}
        />
      </ActionsSheet>
    </>
  );
}
