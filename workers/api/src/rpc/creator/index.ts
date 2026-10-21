/** The creator editor's functions (CV-Artists, and CV-Admin's editor), by "schema.name" (src/rpc/index.ts). */
import type { Args, Rpc } from '../index.ts';
import {
  findReusableUploadedMediaIntent, getCreatorArtistProfile, getCreatorCatalogOptions, getCreatorCreditOptions, getCreatorDashboard, getCreatorRelease,
  getCreatorReleases, getCreatorSubmissionItems, getCreatorWorkspaces, getSubmissionEditor, searchCreatorContributors,
} from './reads.ts';

const s = (a: Args, name: string) => a[name] as string;
const n = (a: Args, name: string) => a[name] as string | null;
const num = (a: Args, name: string) => a[name] as number | null;

export const creatorRpcs: Record<string, Rpc> = {
  'public.get_creator_workspaces': (c) => getCreatorWorkspaces(c),
  'public.get_creator_dashboard': (c, a) => getCreatorDashboard(c, s(a, 'p_creator_account_id')),
  'public.get_creator_catalog_options': (c) => getCreatorCatalogOptions(c),
  'public.get_creator_credit_options': (c, a) => getCreatorCreditOptions(c, s(a, 'p_creator_account_id')),
  'public.get_creator_artist_profile': (c, a) => getCreatorArtistProfile(c, s(a, 'p_creator_account_id')),
  'public.get_creator_releases': (c, a) => getCreatorReleases(c, s(a, 'p_creator_account_id')),
  'public.get_creator_release': (c, a) => getCreatorRelease(c, s(a, 'p_release_id')),
  'public.get_creator_submission_items': (c, a) => getCreatorSubmissionItems(c, s(a, 'p_submission_id')),
  'public.get_submission_editor': (c, a) => getSubmissionEditor(c, s(a, 'p_submission_id')),
  'public.search_creator_contributors': (c, a) => searchCreatorContributors(c, s(a, 'p_creator_account_id'), n(a, 'p_query'), n(a, 'p_kind'), num(a, 'p_limit')),
  'public.find_reusable_uploaded_media_intent': (c, a) => findReusableUploadedMediaIntent(c, s(a, 'p_creator_account_id'), n(a, 'p_original_filename'), num(a, 'p_content_length'), n(a, 'p_media_type')),
};
