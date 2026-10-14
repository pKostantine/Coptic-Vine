import { useLocalSearchParams } from 'expo-router';

import NotFoundScreen from '@/components/vine/screens/NotFoundScreen';
import ServiceDocument from '@/components/vine/screens/ServiceDocument';
import { SERVICES_BY_CATEGORY } from '@/constants/manifest';

export default function LectionaryDocument() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const service = SERVICES_BY_CATEGORY.lectionary.find((s) => s.id === serviceId);

  if (!service) return <NotFoundScreen backHref="/lectionary" />;

  return (
    <ServiceDocument
      schema={service.schema}
      table={service.table}
      title={service.title}
      arabic={service.arabic}
      french={service.french}
      extraContext={service.extraContext}
      entryId={service.id}
      backHref="/lectionary"
    />
  );
}
