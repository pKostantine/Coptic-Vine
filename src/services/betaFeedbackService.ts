import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { api } from '@/utils/api';
import { describeDevice, type FeedbackItem, type FeedbackKind, type FeedbackStatus } from '@/utils/betaFeedback';

/**
 * The beta's feedback, kept by cv-api (workers/api/src/rpc/feedback.ts) and
 * public: anyone reads the whole list and files one, signed in or not; an
 * admin sets each one's status. Temporary, for the beta.
 */

function fail(error: { message?: string } | null, what: string): never {
  throw new Error(error?.message || `Couldn't ${what}.`);
}

/** This device and the app's version, as filed with each report. */
export function thisDevice(): string {
  return describeDevice({
    os: Platform.OS,
    version: Platform.OS === 'web' ? null : Platform.Version,
    appVersion: Constants.expoConfig?.version ?? null,
    userAgent: Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.userAgent : null,
  });
}

/** Everything reported, the latest first, and whether the reader may set statuses (an admin). */
export async function listBetaFeedback(): Promise<{ items: FeedbackItem[]; canManage: boolean }> {
  const { data, error } = await api.rpc('list_beta_feedback');
  if (error || !data) fail(error, 'load the feedback');
  return data as { items: FeedbackItem[]; canManage: boolean };
}

export async function submitBetaFeedback(report: { kind: FeedbackKind; title: string; details: string; area: string; name: string }): Promise<FeedbackItem> {
  const { data, error } = await api.rpc('submit_beta_feedback', {
    p_kind: report.kind,
    p_title: report.title,
    p_details: report.details || null,
    p_area: report.area || null,
    p_device: thisDevice(),
    p_name: report.name || null,
  });
  if (error || !data) fail(error, 'send it');
  return data as FeedbackItem;
}

export async function setBetaFeedbackStatus(id: string, status: FeedbackStatus, note: string): Promise<FeedbackItem> {
  const { data, error } = await api.rpc('admin_update_beta_feedback', { p_id: id, p_status: status, p_note: note || null });
  if (error || !data) fail(error, 'change it');
  return data as FeedbackItem;
}

export async function deleteBetaFeedback(id: string): Promise<void> {
  const { error } = await api.rpc('admin_delete_beta_feedback', { p_id: id });
  if (error) fail(error, 'delete it');
}
