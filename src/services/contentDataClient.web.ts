// Web is intentionally a pure online client on every viewport size, reading from
// the content Worker (contentSource.ts), as native does.
export { contentApi as contentDataClient } from '@/services/contentSource';

/** Web never installs offline books. */
export async function isContentSchemaInstalled(_schemaName: string): Promise<boolean> {
  return false;
}
