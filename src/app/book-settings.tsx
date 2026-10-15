import { Redirect } from 'expo-router';

/** Book Settings are a sheet, never a page of their own: a /book-settings link opens them over Books. */
export default function BookSettingsRoute() {
  return <Redirect href={{ pathname: '/books', params: { settings: 'open' } }} />;
}
