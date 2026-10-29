import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';

import ServiceDocument from '@/components/vine/screens/ServiceDocument';
import { useLiturgicalClock } from '@/context/LiturgicalClockContext';
import { loadSynaxariumEntryDocument } from '@/utils/synaxariumEntryDocument';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A saint's Synaxarium entry as a document of its own, from Home's
 * Commemorated Saints (utils/synaxariumEntryDocument.ts): read in the reader
 * every book opens in, for the day the saint is commemorated on
 * (?day=YYYY-MM-DD), or today's.
 */
export default function SynaxariumEntryDocument() {
  const { entryKey, day } = useLocalSearchParams<{ entryKey: string; day?: string }>();
  const { liturgicalIso } = useLiturgicalClock();
  // Read once, as it opens: the day it was opened for, as one Date between
  // renders, so the document is read for it once.
  const [isoDate] = useState(() => (typeof day === 'string' && ISO_DATE.test(day) ? day : liturgicalIso));
  const [conditionDate] = useState(() => new Date(`${isoDate}T00:00:00Z`));
  const key = typeof entryKey === 'string' ? entryKey : '';
  const loadDocument = useCallback(() => loadSynaxariumEntryDocument(key, isoDate), [key, isoDate]);

  return (
    <ServiceDocument
      schema="synaxarium"
      table={key}
      // Its name, until the saint's own is read.
      title="Synaxarium"
      arabic="السنكسار"
      french="Synaxaire"
      backHref="/"
      conditionDate={conditionDate}
      loadDocument={loadDocument}
    />
  );
}
