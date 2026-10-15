'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
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
import type { OfflineDownloadProgress, OfflineDownloadRequest } from '@/types/offlineDownloads';

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
}: OfflineDownloadButtonProps) {
  const revision = useSyncExternalStore(
    downloadManager.subscribe,
    downloadManager.getRevision,
    downloadManager.getRevision,
  );
  const [progress, setProgress] = useState<OfflineDownloadProgress | null>(null);
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
        const value = await downloadManager.getProgress(packageKey);
        if (!active) return;

        setStorageAvailable(true);
        setProgress(value);

        if (value?.status === 'complete') {
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
  }, [packageKey, prepare]);

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
        Alert.alert(
          tr('Remove download?', 'Supprimer le téléchargement ?', 'إزالة التنزيل؟'),
          tr('The saved offline copy will be removed from this device.', 'La copie hors ligne enregistrée sera supprimée de cet appareil.', 'سيتم حذف النسخة المحفوظة من هذا الجهاز.'),
          [
            { text: tr('Cancel', 'Annuler', 'إلغاء'), style: 'cancel' },
            {
              text: tr('Remove', 'Retirer', 'إزالة'),
              style: 'destructive',
              onPress: () => {
                void downloadManager.remove(packageKey);
              },
            },
          ],
        );
        onAction?.();
        return;
      }

      if (progress?.status === 'downloading' || progress?.status === 'queued') {
        await downloadManager.pause(packageKey);
        onAction?.();
        return;
      }

      if (progress?.status === 'paused') {
        await downloadManager.resume(packageKey);
        onAction?.();
        return;
      }

      if (progress?.status === 'failed' || progress?.status === 'cancelled') {
        await downloadManager.retry(packageKey);
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
  }, [busy, isArabic, onAction, packageKey, prepare, progress, updateAvailable]);

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
    const menuDetail = updateAvailable
      ? (tr('A newer version is available', 'Une version plus récente est disponible', 'يتوفر إصدار أحدث'))
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
