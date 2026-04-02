/**
 * iOS In-App Purchase helpers — STUBBED (app is free, IAP inactive)
 *
 * react-native-iap removed from dependencies (caused Folly/NitroModules build failure).
 * When IAP is re-enabled, install react-native-purchases (RevenueCat) instead.
 *
 * Product IDs (for future use):
 *   com.flexmatches.app.pro_monthly  ($7.99/mo)
 *   com.flexmatches.app.pro_yearly   ($59.88/yr = $4.99/mo)
 */

export const IAP_SKUS = {
  monthly: "com.flexmatches.app.pro_monthly",
  yearly:  "com.flexmatches.app.pro_yearly",
} as const;

export type IAPSku = typeof IAP_SKUS[keyof typeof IAP_SKUS];

export async function initIAP(): Promise<boolean> { return false; }
export async function closeIAP(): Promise<void> {}
export async function fetchIAPProducts(): Promise<unknown[]> { return []; }
export async function purchaseIAP(_sku: IAPSku): Promise<void> {}
export async function verifyAndActivatePro(_receipt: string, _productId: string): Promise<boolean> { return false; }

// Stub listener types so pro.tsx compiles without changes
export type Subscription = unknown;
export type SubscriptionPurchase = { transactionReceipt?: string; productId: string };
export type PurchaseError = { code: string; message?: string };

export function purchaseUpdatedListener(_cb: (p: SubscriptionPurchase) => void) {
  return { remove: () => {} };
}
export function purchaseErrorListener(_cb: (e: PurchaseError) => void) {
  return { remove: () => {} };
}
export async function finishTransaction(_opts: unknown): Promise<void> {}
