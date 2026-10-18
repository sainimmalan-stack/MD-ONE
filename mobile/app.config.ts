import type { ExpoConfig } from "expo/config";
const config: ExpoConfig = {
  name: "MD One",
  slug: "mdp-living",
  version: "0.1.0",
  scheme: "mdpliving",
  orientation: "portrait",
  userInterfaceStyle: "dark",
  ios: {
    bundleIdentifier: "in.mydreamprojects.living",
    supportsTablet: true,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: { package: "in.mydreamprojects.living" },
  plugins: [
    "expo-secure-store",
    [
      "expo-image-picker",
      {
        photosPermission:
          "Choose a picture for your MDP profile or a community moment.",
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
  ],
  extra: { mode: "demo" },
  updates: { enabled: false },
};
export default config;
