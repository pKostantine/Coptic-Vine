/** The search functions the app calls, by "schema.name" (src/rpc/index.ts). */
import type { Args, Rpc } from '../index.ts';
import { searchMediaCatalog, searchSectionCatalog } from './catalog.ts';

const n = (a: Args, name: string) => a[name] as string | null;
const limit = (a: Args) => a.p_limit as number | null;

export const searchRpcs: Record<string, Rpc> = {
  'public.search_media_catalog': (c, a) => searchMediaCatalog(c, n(a, 'p_query'), n(a, 'p_locale'), n(a, 'p_scope'), limit(a)),
  'public.search_section_catalog': (c, a) => searchSectionCatalog(c, n(a, 'p_query'), n(a, 'p_locale'), n(a, 'p_section'), limit(a)),
};
