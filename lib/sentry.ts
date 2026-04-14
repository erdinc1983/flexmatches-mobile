import * as Sentry from "@sentry/react-native";

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";

export function initSentry() {
  if (!DSN) return; // no-op if DSN not set yet

  Sentry.init({
    dsn: DSN,

    // 10% of transactions sampled for perf; 100% of errors captured
    tracesSampleRate: 0.1,

    // Don't capture in dev (Expo Go / metro)
    enabled: !__DEV__,

    // Strip PII before sending
    beforeSend(event) {
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      return event;
    },

    integrations: [
      Sentry.mobileReplayIntegration({
        maskAllText: false,
        maskAllImages: false,
      }),
    ],
  });
}

export { Sentry };
