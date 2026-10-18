import OfflineDownloadButton from '@/components/offline/OfflineDownloadButton';
import type { OfflineDownloadRequest } from '@/types/offlineDownloads';

export default function LearningDownloadButton({
  packageKey,
  request,
  label,
  isArabic = false,
  compact = false,
  menuRow = false,
  onAction,
}: {
  packageKey?: string;
  request?: OfflineDownloadRequest | (() => Promise<OfflineDownloadRequest>);
  label?: string;
  isArabic?: boolean;
  compact?: boolean;
  /** Drawn as a row of a More menu, as a song's Download is. */
  menuRow?: boolean;
  onAction?: () => void;
}) {
  // Collection/detail screens provide the complete offline package. The
  // now-playing surface predates Phase 13 and does not carry enough collection
  // metadata to safely build one, so it simply omits the control there.
  if (!packageKey || !request) return null;

  return (
    <OfflineDownloadButton
      packageKey={packageKey}
      request={request}
      theme="learning"
      label={label}
      isArabic={isArabic}
      compact={compact}
      menuRow={menuRow}
      onAction={onAction}
    />
  );
}
