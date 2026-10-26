import OfflineDownloadButton from '@/components/offline/OfflineDownloadButton';
import type { OfflineDownloadHolder, OfflineDownloadRequest } from '@/types/offlineDownloads';

export default function MusicDownloadButton({
  packageKey,
  request,
  label,
  isArabic = false,
  compact = false,
  menuRow = false,
  onAction,
  holders,
  isOwnHolder,
}: {
  packageKey: string;
  request: OfflineDownloadRequest | (() => Promise<OfflineDownloadRequest>);
  label?: string;
  isArabic?: boolean;
  compact?: boolean;
  menuRow?: boolean;
  onAction?: () => void;
  /** The downloads already holding it (OfflineDownloadButton's holders): for a track, and a single. */
  holders?: () => Promise<OfflineDownloadHolder[]>;
  isOwnHolder?: (holder: OfflineDownloadHolder) => boolean;
}) {
  return (
    <OfflineDownloadButton
      packageKey={packageKey}
      request={request}
      theme="music"
      label={label}
      isArabic={isArabic}
      compact={compact}
      menuRow={menuRow}
      onAction={onAction}
      holders={holders}
      isOwnHolder={isOwnHolder}
    />
  );
}
