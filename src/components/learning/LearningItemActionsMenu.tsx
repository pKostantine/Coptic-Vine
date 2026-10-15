'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useState } from 'react';

import LearningArtwork from '@/components/learning/LearningArtwork';
import ActionsSheet, { ActionRow, ActionsMenuTrigger } from '@/components/playback/ActionsSheet';
import { COLORS } from '@/constants/theme';
import { type LearningQueueItem, useLearningPlayer } from '@/context/LearningPlayerContext';
import { publicUrl } from '@/utils/publicUrl';
import { shareLink } from '@/utils/shareLink';

import { tr } from '../../utils/appText';
interface LearningItemActionsMenuProps {
  item: LearningQueueItem;
  isArabic?: boolean;
  size?: number;
}

/**
 * A recording's or lesson's actions: queue it next or last — into the one
 * queue Music shares, so it can follow a song — and share it.
 */
export default function LearningItemActionsMenu({ item, isArabic = false, size = 36 }: LearningItemActionsMenuProps) {
  const [visible, setVisible] = useState(false);
  const { addNext, addToEnd } = useLearningPlayer();
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

  return (
    <>
      <ActionsMenuTrigger label={tr('Lesson options', 'Options de la leçon', 'خيارات الدرس')} size={size} onPress={() => setVisible(true)} />
      <ActionsSheet
        visible={visible}
        onClose={close}
        closeLabel="Close lesson options"
        artwork={<LearningArtwork asset={item.coverAsset} size={52} radius={6} label={item.containerTitle} />}
        title={item.title}
        subtitle={`${item.cantorName} · ${item.containerTitle}`}
        isArabic={isArabic}
      >
        <ActionRow
          icon="play-skip-forward"
          label={tr('Add next', 'Lire ensuite', 'تشغيل تالياً')}
          accentColor={COLORS.learningBright}
          onPress={() => { addNext(item); close(); }}
        />
        <ActionRow
          icon="list-outline"
          label={tr('Add to end of queue', 'Ajouter à la fin de la file', 'إضافة إلى نهاية قائمة الانتظار')}
          accentColor={COLORS.learningBright}
          onPress={() => { addToEnd(item); close(); }}
        />
        <ActionRow
          icon="share-outline"
          label={tr('Share', 'Partager', 'مشاركة')}
          accentColor={COLORS.learningBright}
          onPress={() => void share()}
        />
      </ActionsSheet>
    </>
  );
}
