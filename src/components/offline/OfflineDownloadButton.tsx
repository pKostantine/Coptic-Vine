'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
} from 'react-native';

import { SheetRow } from '@/components/playback/ActionSheetFrame';
import type { IconName } from '@/components/vine/ui/Icon';
import { COLORS, RADII, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { downloadManager } from '@/services/downloadManager';
import type { OfflineDownloadHolder, OfflineDownloadProgress, OfflineDownloadRequest } from '@/types/offlineDownloads';
import { downloadEntityOf, quotedList, removalOf } from '@/utils/downloadHolders';

import { tr } from '../../utils/appText';
type DownloadTheme = 'music' | 'learning';

export interface OfflineDownloadButtonProps {
  packageKey: string;
  request: OfflineDownloadRequest | (() => Promise<OfflineDownloadRequest>);
  theme: DownloadTheme;
  isArabic?: boolean;
  compact?: boolean;
  menuRow?: boolean;
  label?: string;
  style?: ViewStyle;
  onAction?: () => void;
  /**
   * For an item another download can save too -- a track, by its release, a
   * playlist or Liked Songs (utils/downloadHolders.ts): the downloads already
   * holding it. The button shows the first and acts on it, so an item already
   * saved, or on its way, is never downloaded again; and removing it takes
   * every one of them, the ones not its own named first.
   */
  holders?: () => Promise<OfflineDownloadHolder[]>;
  /** Of the holders, those that are the item's own download. */
  isOwnHolder?: (holder: OfflineDownloadHolder) => boolean;
}

/**
 * The downloads of the item a key names, in any App Language: by default an
 * item's holders, so one downloaded in another language is never downloaded
 * again, and all of them are its own.
 */
function sameItemDownloads(packageKey: string) {
  const entity = downloadEntityOf(packageKey);
  return {
    holders: () => (entity ? downloadManager.downloadsOf(entity.entityType, entity.entityId) : Promise.resolve([])),
    isOwn: (holder: OfflineDownloadHolder) => !entity || (holder.entityType === entity.entityType && holder.entityId === entity.entityId),
  };
}

function percentage(progress: number): string {
  return `${Math.max(0, Math.min(100, Math.round(progress * 100)))}%`;
}

export default function OfflineDownloadButton(props: OfflineDownloadButtonProps) {
  if (Platform.OS === 'web') return null;
  return <NativeOfflineDownloadButton {...props} />;
}

function NativeOfflineDownloadButton({
  packageKey,
  request,
  theme,
  isArabic = false,
  compact = false,
  menuRow = false,
  label,
  style,
  onAction,
  holders: givenHolders,
  isOwnHolder: givenIsOwnHolder,
}: OfflineDownloadButtonProps) {
  const sameItem = useMemo(() => sameItemDownloads(packageKey), [packageKey]);
  const holders = givenHolders ?? sameItem.holders;
  const isOwnHolder = givenIsOwnHolder ?? sameItem.isOwn;
  const revision = useSyncExternalStore(
    downloadManager.subscribe,
    downloadManager.getRevision,
    downloadManager.getRevision,
  );
  const [progress, setProgress] = useState<OfflineDownloadProgress | null>(null);
  // The download the button shows and acts on: the item's own, or the one
  // already holding it; and all that hold it, for removing it.
  const [target, setTarget] = useState(packageKey);
  const [held, setHeld] = useState<OfflineDownloadHolder[]>([]);
  const [busy, setBusy] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);

  const prepare = useCallback(
    async () => typeof request === 'function' ? request() : request,
    [request],
  );

  const refresh = useCallback(() => {
    let active = true;

    void (async () => {
      try {
        const holding = await holders();
        const shown = holding[0]?.packageKey ?? packageKey;
        const value = await downloadManager.getProgress(shown);
        if (!active) return;

        setStorageAvailable(true);
        setTarget(shown);
        setHeld(holding);
        setProgress(value);

        // Only the item's own download is brought up to date from here.
        if (value?.status === 'complete' && shown === packageKey) {
          try {
            setUpdateAvailable(await downloadManager.checkForUpdate(await prepare()));
          } catch {
            if (active) setUpdateAvailable(false);
          }
        } else {
          setUpdateAvailable(false);
        }
      } catch {
        // Offline storage is optional UI. A damaged/unavailable local database
        // must never take down Music, Learn & Study, or an authenticated
        // Library screen while download state is being restored.
        if (!active) return;
        setProgress(null);
        setUpdateAvailable(false);
        setStorageAvailable(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [holders, packageKey, prepare]);

  useEffect(() => refresh(), [refresh, revision]);

  const action = useCallback(async () => {
    if (busy) return;
    setBusy(true);

    try {
      if (progress?.status === 'complete' && updateAvailable) {
        await downloadManager.update(await prepare());
        setUpdateAvailable(false);
        onAction?.();
        return;
      }

      if (progress?.status === 'complete') {
        // Every download holding it goes, or it would still be saved; any
        // that aren't its own are named.
        const { packageKeys, others } = held.length ? removalOf(held, isOwnHolder) : { packageKeys: [target], others: [] };
        Alert.alert(
          tr('Remove download?', 'Supprimer le téléchargement ?', 'إزالة التنزيل؟'),
          others.length
            ? tr(
              `It is saved with ${quotedList(others, 'en')}: ${others.length === 1 ? 'that download goes' : 'those downloads go'} from this device too.`,
              `Il est enregistré avec ${quotedList(others, 'fr')} : ${others.length === 1 ? 'ce téléchargement sera aussi supprimé' : 'ces téléchargements seront aussi supprimés'} de cet appareil.`,
              `محفوظ مع ${quotedList(others, 'ar')}، وسيُحذف ${others.length === 1 ? 'هذا التنزيل' : 'هذه التنزيلات'} أيضًا من هذا الجهاز.`,
            )
            : tr('The saved offline copy will be removed from this device.', 'La copie hors ligne enregistrée sera supprimée de cet appareil.', 'سيتم حذف النسخة المحفوظة من هذا الجهاز.'),
          [
            { text: tr('Cancel', 'Annuler', 'إلغاء'), style: 'cancel' },
            {
              text: tr('Remove', 'Retirer', 'إزالة'),
              style: 'destructive',
              onPress: () => {
                void (async () => {
                  for (const key of packageKeys) await downloadManager.remove(key);
                })();
              },
            },
          ],
        );
        onAction?.();
        return;
      }

      if (progress?.status === 'downloading' || progress?.status === 'queued') {
        await downloadManager.pause(target);
        onAction?.();
        return;
      }

      if (progress?.status === 'paused') {
        await downloadManager.resume(target);
        onAction?.();
        return;
      }

      if (progress?.status === 'failed' || progress?.status === 'cancelled') {
        await downloadManager.retry(target);
        onAction?.();
        return;
      }

      await downloadManager.enqueue(await prepare());
      setStorageAvailable(true);
      onAction?.();
    } catch (cause) {
      Alert.alert(
        tr('Download unavailable', 'Téléchargement indisponible', 'تعذر التنزيل'),
        cause instanceof Error
          ? cause.message
          : (tr('Unable to start this download.', 'Impossible de lancer ce téléchargement.', 'تعذر بدء التنزيل.')),
      );
    } finally {
      setBusy(false);
    }
  }, [busy, held, isOwnHolder, onAction, prepare, progress, target, updateAvailable]);

  if (!storageAvailable) return null;

  const active = progress?.status === 'downloading' || progress?.status === 'queued';
  const failed = progress?.status === 'failed' || progress?.status === 'cancelled';
  const text = progress?.status === 'complete'
    ? (updateAvailable ? (tr('Update', 'Mettre à jour', 'تحديث')) : (tr('Downloaded', 'Téléchargé', 'تم التنزيل')))
    : active
      ? `${tr('Downloading', 'Téléchargement', 'تنزيل')} ${percentage(progress?.progress ?? 0)}`
      : progress?.status === 'paused'
        ? (tr('Resume', 'Reprendre', 'متوقف مؤقتًا'))
        : failed
          ? (tr('Retry', 'Réessayer', 'إعادة المحاولة'))
          : label ?? (tr('Download', 'Télécharger', 'تنزيل'));

  const accent = theme === 'learning' ? COLORS.learningBright : COLORS.goldBright;
  const soft = theme === 'learning' ? COLORS.learningSoft : COLORS.goldSoft;
  const line = theme === 'learning' ? COLORS.learningLine : COLORS.goldLine;

  if (menuRow) {
    const removing = progress?.status === 'complete' && !updateAvailable;
    const menuText = removing
      ? (tr('Remove download', 'Supprimer le téléchargement', 'إزالة التنزيل'))
      : text;
    // A fresh download is just "Download", as the More menu draws it; the
    // line under the label only explains a download already under way.
    // Saved, or on its way, with another download: which one.
    const sharedWith = held[0] && !isOwnHolder(held[0]) ? held[0].title : null;
    const menuDetail = updateAvailable
      ? (tr('A newer version is available', 'Une version plus récente est disponible', 'يتوفر إصدار أحدث'))
      : removing && sharedWith
        ? tr(`Saved with ${quotedList([sharedWith], 'en')}`, `Enregistré avec ${quotedList([sharedWith], 'fr')}`, `محفوظ مع ${quotedList([sharedWith], 'ar')}`)
      : removing
        ? (tr('Delete the offline copy from this device', 'Supprimer la copie hors ligne de cet appareil', 'حذف النسخة المحفوظة من هذا الجهاز'))
        : active
          ? (tr('Tap to pause', 'Touchez pour mettre en pause', 'اضغط للإيقاف المؤقت'))
          : progress?.status === 'paused'
            ? (tr('Continue this download', 'Poursuivre ce téléchargement', 'متابعة التنزيل'))
            : failed
              ? (tr('Try downloading again', 'Réessayer le téléchargement', 'حاول التنزيل مرة أخرى'))
              : null;
    const menuIcon: IconName = updateAvailable
      ? 'repeat'
      : removing
        ? 'trash-outline'
        : active
          ? 'pause'
          : progress?.status === 'paused'
            ? 'play'
            : failed
              ? 'repeat'
              : 'arrow-down-circle-outline';

    return (
      <SheetRow
        icon={menuIcon}
        label={menuText}
        detail={menuDetail}
        accessibilityLabel={menuText}
        accessibilityHint={active ? (tr('Tap to pause', 'Touchez pour mettre en pause', 'اضغط للإيقاف المؤقت')) : undefined}
        chip={removing ? 'grey' : 'gold'}
        iconColor={removing ? '#FF8A8A' : theme === 'learning' ? COLORS.learningBright : COLORS.gold}
        tone={removing ? 'danger' : 'plain'}
        trailing="chevron"
        busy={busy}
        onPress={() => void action()}
      />
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityHint={active ? (tr('Tap to pause', 'Touchez pour mettre en pause', 'اضغط للإيقاف المؤقت')) : undefined}
      disabled={busy}
      onPress={action}
      style={[
        styles.button,
        compact && styles.compact,
        { backgroundColor: soft, borderColor: line },
        busy && styles.disabled,
        style,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={accent} /> : null}
      <Text style={[styles.text, { color: accent }, isArabic && styles.arabic]}>
        {updateAvailable
          ? '↻  '
          : progress?.status === 'complete'
            ? '✓  '
            : active
              ? 'Ⅱ  '
              : progress?.status === 'paused'
                ? '▶  '
                : '↓  '}
        {text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADII.pill,
    borderWidth: 1,
  },
  compact: { minHeight: 36, paddingHorizontal: SPACING.md },
  disabled: { opacity: 0.65 },
  text: { fontFamily: TYPOGRAPHY.body, fontSize: 13, fontWeight: '800' },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
});
