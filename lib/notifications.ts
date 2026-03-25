/**
 * Local notification utility for in-app message alerts.
 *
 * Shows a banner with sound when a new message arrives while the app is open.
 * For background / killed app push notifications, a server-side push token
 * flow would be needed (future work).
 */

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Show banners + play sound while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner:  true,
    shouldShowList:    true,
    shouldPlaySound:   true,
    shouldSetBadge:    false,
  }),
});

let _permissionGranted: boolean | null = null;

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if (_permissionGranted !== null) return _permissionGranted;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") {
      _permissionGranted = true;
      return true;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    _permissionGranted = status === "granted";
    return _permissionGranted;
  } catch {
    _permissionGranted = false;
    return false;
  }
}

/**
 * Show an immediate local notification for a new chat message.
 * Safe to call without checking permissions first — handled internally.
 */
export async function notifyNewMessage(
  senderName: string,
  preview: string,
): Promise<void> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: senderName,
        body:  preview.length > 80 ? preview.slice(0, 77) + "…" : preview,
        sound: true,
      },
      trigger: null, // immediate
    });
  } catch { /* ignore on platforms that don't support notifications */ }
}
