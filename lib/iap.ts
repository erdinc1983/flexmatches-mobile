/**
 * iOS In-App Purchase helpers (react-native-iap)
 *
 * Only active on iOS — Android uses Stripe web checkout.
 * Requires EAS Build — does NOT work in Expo Go.
 *
 * Product IDs must be configured in App Store Connect:
 *   com.flexmatches.app.pro_monthly  ($7.99/mo)
 *   com.flexmatches.app.pro_yearly   ($59.88/yr = $4.99/mo)
 */

import { Platform } from "react-native";
import {
  initConnection,
  endConnection,
  getSubscriptions,
  requestSubscription,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type Subscription,
  type SubscriptionPurchase,
  type PurchaseError,
} from "react-native-iap";
import { supabase } from "./supabase";

export const IAP_SKUS = {
  monthly: "com.flexmatches.app.pro_monthly",
  yearly:  "com.flexmatches.app.pro_yearly",
} as const;

export type IAPSku = typeof IAP_SKUS[keyof typeof IAP_SKUS];

/** Call once when the Pro screen mounts on iOS. */
export async function initIAP(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  try {
    await initConnection();
    return true;
  } catch {
    return false;
  }
}

/** Call when the Pro screen unmounts to free the native connection. */
export async function closeIAP(): Promise<void> {
  if (Platform.OS !== "ios") return;
  try { await endConnection(); } catch { /* ignore */ }
}

/** Fetch subscription product info from the App Store. */
export async function fetchIAPProducts(): Promise<Subscription[]> {
  try {
    return await getSubscriptions({ skus: Object.values(IAP_SKUS) });
  } catch {
    return [];
  }
}

/** Trigger the native Apple purchase sheet for the given SKU. */
export async function purchaseIAP(sku: IAPSku): Promise<void> {
  await requestSubscription({ sku, andDangerouslyFinishTransactionAutomaticallyIOS: false });
}

/**
 * Send the receipt to the verify-iap Edge Function.
 * On success, the Edge Function sets is_pro = true for the current user.
 */
export async function verifyAndActivatePro(
  receipt: string,
  productId: string,
): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const res = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/verify-iap`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ receipt, productId }),
      }
    );
    const data = await res.json();
    return res.ok && data.success === true;
  } catch {
    return false;
  }
}

export { purchaseUpdatedListener, purchaseErrorListener, finishTransaction };
export type { Subscription, SubscriptionPurchase, PurchaseError };
