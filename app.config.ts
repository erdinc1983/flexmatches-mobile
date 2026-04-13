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
    // Google Maps API key — injected into AndroidManifest.xml at build time.
    // Enable "Maps SDK for Android" on this key in Google Cloud Console.
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
      },
    },
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
