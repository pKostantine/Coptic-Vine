import { useLocalSearchParams } from 'expo-router';

import HolyWeekDay from '@/components/vine/screens/HolyWeekDay';
import NotFoundScreen from '@/components/vine/screens/NotFoundScreen';
import { HOLY_WEEK_DAYS } from '@/constants/manifest';

/** A single day or eve: just its own hours. */
export default function HolyWeekDayScreen() {
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const day = HOLY_WEEK_DAYS.find((entry) => entry.id === dayId);

  if (!day) return <NotFoundScreen backHref="/holy-week" />;

  return <HolyWeekDay day={day} />;
}
