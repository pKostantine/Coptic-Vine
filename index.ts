// The spiritual canon's notification buttons (Mark as done, Remind me in an
// hour) are wired up before anything else loads: Android runs their
// background task with no screen, when Expo Router's routes — where the rest
// of the app lives — are never loaded. Then the app itself.
import './src/services/canonNotificationActions';
import 'expo-router/entry';
