import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "FlexMatches",
  slug: "flexmatches",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "flexmatchesmobile",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,

  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.flexmatches.app",
    buildNumber: "24",
    infoPlist: {
      UIBackgroundModes: ["remote-notification"],
      NSCameraUsageDescription: "FlexMatches needs camera access to take profile photos.",
      NSPhotoLibraryUsageDescription: "FlexMatches needs photo library access to select profile photos.",
      NSPhotoLibraryAddUsageDescription: "FlexMatches needs permission to save photos to your library.",
      NSLocationWhenInUseUsageDescription: "FlexMatches uses your location to show nearby training partners and sports venues.",
      ITSAppUsesNonExemptEncryption: false,
    },
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",  NSPrivacyAccessedAPITypeReasons: ["CA92.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",  NSPrivacyAccessedAPITypeReasons: ["C617.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime", NSPrivacyAccessedAPITypeReasons: ["35F9.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace",      NSPrivacyAccessedAPITypeReasons: ["E174.1"] },
      ],
      NSPrivacyCollectedDataTypes: [
        { NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeEmailAddress",    NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
        { NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePhotosorVideos",  NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
        { NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePreciseLocation", NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
        { NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeFitness",         NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
      ],
      NSPrivacyTracking: false,
    },
  },

  android: {
    package: "com.flexmatches.app",
    versionCode: 7,
    adaptiveIcon: {
      backgroundColor: "#FF6B00",
      foregroundImage: "./assets/images/android-icon-foreground.png",
    },
    googleServicesFile: "./google-services.json",
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    permissions: [
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.CAMERA",
      "android.permission.READ_MEDIA_IMAGES",
    ],
    // Strip permissions that expo-image-picker (and other libs) pull in
    // by default but we don't actually use. We launch ImagePicker with
    // mediaTypes: ["images"] only — no audio capture, no video. Without
    // this block, Google Play Console asks "why microphone?" at review.
    blockedPermissions: [
      "android.permission.RECORD_AUDIO",
    ],
    // Google Maps API key — injected into AndroidManifest.xml at build time.
    // Enable "Maps SDK for Android" on this key in Google Cloud Console.
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
      },
    },
    // Android App Links — let "Open with FlexMatches" handle these URLs
    // tapped in browser/SMS. autoVerify=true requires a matching
    // assetlinks.json hosted at https://flexmatches.com/.well-known/
    // assetlinks.json (see apps/web/public/.well-known/assetlinks.json).
    // The web fallback still works for users without the app installed.
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          { scheme: "https", host: "flexmatches.com", pathPrefix: "/register" },
          { scheme: "https", host: "www.flexmatches.com", pathPrefix: "/register" },
          { scheme: "https", host: "flexmatches.com", pathPrefix: "/reset-password" },
          { scheme: "https", host: "www.flexmatches.com", pathPrefix: "/reset-password" },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },

  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },

  plugins: [
    "expo-router",
    [
      "expo-image-picker",
      {
        photosPermission: "FlexMatches needs photo library access to select profile photos.",
        cameraPermission: "FlexMatches needs camera access to take profile photos.",
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: { backgroundColor: "#000000" },
      },
    ],
    "expo-secure-store",
    [
      "expo-notifications",
      {
        icon: "./assets/images/icon.png",
        color: "#FF4500",
        sounds: [],
        iosDisplayInForeground: true,
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "FlexMatches uses your location to show nearby training partners and sports venues.",
      },
    ],
    [
      "@sentry/react-native/expo",
      {
        organization: process.env.SENTRY_ORG ?? "flexmatches",
        project: process.env.SENTRY_PROJECT ?? "flexmatches-mobile",
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
    reactCompiler: false,
  },

  extra: {
    router: {},
    eas: {
      projectId: "4e957dd8-fd32-4678-9b74-4232d65e658d",
    },
  },

  owner: "erdinc1983",
  runtimeVersion: { policy: "appVersion" },
  updates: {
    url: "https://u.expo.dev/4e957dd8-fd32-4678-9b74-4232d65e658d",
  },
});
