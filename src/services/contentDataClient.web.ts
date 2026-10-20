// Web is intentionally a pure online client on every viewport size, reading from
// wherever EXPO_PUBLIC_CONTENT_SOURCE says (contentSource.ts), as native does.
export { contentApi as contentDataClient } from '@/services/contentSource';

/** Web never installs offline books. */
export async function isContentSchemaInstalled(_schemaName: string): Promise<boolean> {
  return false;
}
