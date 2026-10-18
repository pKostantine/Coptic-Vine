# Coptic Vine Notification Dispatcher

Cloudflare Worker for Coptic Vine native push and standards-based Web Push.

## Required Worker secrets

Set these with Wrangler before deployment:

- `SUPABASE_SERVICE_ROLE_KEY`
- `NOTIFICATION_WORKER_SECRET`
- `WEB_PUSH_VAPID_PRIVATE_KEY`
- `WEB_PUSH_VAPID_PUBLIC_KEY`
- `WEB_PUSH_VAPID_SUBJECT` (for example `mailto:admin@coptichymnscentre.com`)
- `EXPO_ACCESS_TOKEN` only if Expo Push enhanced security is enabled

`SUPABASE_URL` is a non-secret Worker variable in `wrangler.jsonc`.

The same VAPID public key must be supplied to the Coptic Vine web build as
`EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY`. Never expose the VAPID private key to
the app or website.

## Deploy

```bash
npx wrangler deploy -c workers/notification-dispatcher/wrangler.jsonc
```

The cron runs once per minute. Native delivery claims batches of up to 100,
sends them through Expo Push, then checks Expo delivery receipts after the
database's 15-minute receipt delay. Web Push claims a conservative batch of 40
and sends encrypted VAPID-authenticated notifications directly to each browser
push service.

Do not put Apple, Firebase, Expo, Supabase service-role, VAPID private, or WNS
secrets in the repository.

## Before a notification reaches a phone

The dispatcher sends through Expo Push, which needs the app's own credentials:

- **iPhone and iPad:** the build must carry the Push Notifications entitlement
  (`aps-environment`). The `expo-notifications` plugin in `app.json` adds it
  when the native project is generated — run `npx expo prebuild -p ios` (the
  `ios/` folder is not in git) before building. Expo also needs the app's APNs
  key: `eas credentials -p ios` → Push Notifications.
- **Android:** Expo Push goes through Firebase Cloud Messaging. Add the
  Firebase project's `google-services.json` (`android.googleServicesFile` in
  `app.json`) and upload its FCM V1 service-account key to Expo
  (`eas credentials -p android`).

CV Admin's Notifications page says when deliveries are waiting and nothing is
sending them: that is this Worker not running.
