'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';

import LearningArtwork from '@/components/learning/LearningArtwork';
import LearningDownloadButton from '@/components/learning/LearningDownloadButton';
import { LearningPlaylistPanel } from '@/components/learning/LearningPlaylistPicker';
import ActionsSheet, { ActionRow, ActionsMenuTrigger } from '@/components/playback/ActionsSheet';
import { type LearningQueueItem, useLearningPlayer } from '@/context/LearningPlayerContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import type { OfflineDownloadRequest } from '@/types/offlineDownloads';
import { publicUrl } from '@/utils/publicUrl';
import { shareLink } from '@/utils/shareLink';

import { tr } from '../../utils/appText';

interface LearningItemActionsMenuProps {
  item: LearningQueueItem;
  /** Kept for the rows that pass it: the sheet sets Arabic by the text itself. */
  isArabic?: boolean;
  size?: number;
  /**
   * The item's offline package, where the page listing it can build one: the
   * menu then offers Download, as a song's does (not on the web).
   */
  download?: OfflineDownloadRequest | null;
  /**
   * Called just before an action leaves for another page (Sign in), so a
   * full-screen player it was opened from can put itself away first.
   */
  onNavigate?: () => void;
  /** Draws the button that opens the menu, in place of the row's "⋯". */
  renderTrigger?: (open: () => void) => ReactNode;
}

/**
 * A recording's or lesson's More menu: Add to playlist — where it stands in
 * My Learning, and the reader's own playlists, in the same sheet — Download
 * where the page gives its package, then, for an item other than the one
 * playing, queue it next or last (into the one queue Music shares, so it can
 * follow a song), and share it.
 */
export default function LearningItemActionsMenu({ item, size = 36, download, onNavigate, renderTrigger }: LearningItemActionsMenuProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [choosingPlaylist, setChoosingPlaylist] = useState(false);
  const { addNext, addToEnd, currentItem } = useLearningPlayer();
  const { preferences } = useReadingPreferences();
  const locale = preferences.appLanguage === 'ar' ? 'ar' : 'en';
  // From the player, queueing what is playing would only play it again.
  const playingNow = currentItem?.kind === item.kind && currentItem.id === item.id;

  const open = () => {
    setChoosingPlaylist(false);
    setVisible(true);
  };
  const close = () => setVisible(false);

  const share = async () => {
    close();
    const path = item.kind === 'recording'
      ? `/learn/album/${item.containerId}`
      : `/learn/lesson-set/${item.containerId}`;
    await shareLink({
      title: item.title,
      text: `${item.title} - ${item.cantorName}`,
      url: publicUrl(path),
    });
  };

  const addToPlaylistLabel = tr('Add to playlist', 'Ajouter à une playlist', 'إضافة إلى قائمة');

  return (
    <>
      {renderTrigger
        ? renderTrigger(open)
        : <ActionsMenuTrigger label={tr('Lesson options', 'Options de la leçon', 'خيارات الدرس')} size={size} onPress={open} />}
      <ActionsSheet
        visible={visible}
        onClose={close}
        closeLabel={tr('Close lesson options', 'Fermer les options de la leçon', 'إغلاق خيارات الدرس')}
        artwork={<LearningArtwork asset={item.coverAsset} size={52} radius={10} label={item.containerTitle} />}
        title={item.title}
        subtitle={choosingPlaylist ? addToPlaylistLabel : `${item.cantorName} · ${item.containerTitle}`}
        rows={!choosingPlaylist}
      >
        {choosingPlaylist ? (
          <LearningPlaylistPanel
            itemKind={item.kind === 'recording' ? 'album_recording' : 'lesson'}
            itemId={item.id}
            locale={locale}
            onSignIn={() => {
              close();
              onNavigate?.();
              router.push('/account');
            }}
          />
        ) : (
          <>
            <ActionRow
              icon="add-circle-outline"
              label={addToPlaylistLabel}
              onPress={() => setChoosingPlaylist(true)}
            />
            {download ? (
              <LearningDownloadButton
                packageKey={download.packageKey}
                request={download}
                menuRow
                onAction={close}
              />
            ) : null}
            {!playingNow ? (
              <>
                <ActionRow
                  icon="play-skip-forward"
                  label={tr('Add next', 'Lire ensuite', 'تشغيل تالياً')}
                  onPress={() => { addNext(item); close(); }}
                />
                <ActionRow
                  icon="list-outline"
                  label={tr('Add to end of queue', 'Ajouter à la fin de la file', 'إضافة إلى نهاية قائمة الانتظار')}
                  onPress={() => { addToEnd(item); close(); }}
                />
              </>
            ) : null}
            <ActionRow
              icon="share-outline"
              label={tr('Share', 'Partager', 'مشاركة')}
              onPress={() => void share()}
            />
          </>
        )}
      </ActionsSheet>
    </>
  );
}
