import Purchases, {
  type CustomerInfo,
  LOG_LEVEL,
  type PurchasesOffering,
  type PurchasesPackage,
} from "react-native-purchases";

// ─── Config ──────────────────────────────────────────────────────────────────
//
// RevenueCat V2 uses a single project-level SDK API key for both iOS and
// Android. Set it in .env as EXPO_PUBLIC_REVENUECAT_KEY. When unset, the
// SDK stays in stub mode and the app behaves as "free" everywhere.
//
const REVENUECAT_KEY = process.env.EXPO_PUBLIC_REVENUECAT_KEY ?? "";

// Identifiers configured in RevenueCat dashboard
export const PRO_ENTITLEMENT = "pro";
export const PRO_OFFERING = "default";

// ─── Internal state ──────────────────────────────────────────────────────────

let initialized = false;

// ─── Init ────────────────────────────────────────────────────────────────────

export function isPurchasesConfigured(): boolean {
  return Boolean(REVENUECAT_KEY);
}

export async function initPurchases(userId?: string | null): Promise<void> {
  if (initialized) {
    if (userId) await loginUser(userId);
    return;
  }
  if (!isPurchasesConfigured()) {
    // No RC key yet — stay in stub mode. All entitlement checks return false.
    return;
  }
  try {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.INFO);
    Purchases.configure({ apiKey: REVENUECAT_KEY, appUserID: userId ?? undefined });
    initialized = true;
  } catch (err) {
    console.error("[purchases] init failed:", err);
  }
}

export async function loginUser(userId: string): Promise<void> {
  if (!initialized) return;
  try {
    await Purchases.logIn(userId);
  } catch (err) {
    console.error("[purchases] logIn failed:", err);
  }
}

export async function logoutUser(): Promise<void> {
  if (!initialized) return;
  try {
    await Purchases.logOut();
  } catch (err) {
    console.error("[purchases] logOut failed:", err);
  }
}

// ─── Entitlements ────────────────────────────────────────────────────────────

export async function fetchCustomerInfo(): Promise<CustomerInfo | null> {
  if (!initialized) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (err) {
    console.error("[purchases] getCustomerInfo failed:", err);
    return null;
  }
}

export function hasProEntitlement(info: CustomerInfo | null): boolean {
  if (!info) return false;
  return Boolean(info.entitlements.active[PRO_ENTITLEMENT]);
}

// ─── Offerings ───────────────────────────────────────────────────────────────

export async function fetchOffering(): Promise<PurchasesOffering | null> {
  if (!initialized) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.all[PRO_OFFERING] ?? offerings.current ?? null;
  } catch (err) {
    console.error("[purchases] getOfferings failed:", err);
    return null;
  }
}

// ─── Purchase + Restore ──────────────────────────────────────────────────────

export type PurchaseResult =
  | { ok: true; isPro: boolean }
  | { ok: false; cancelled: boolean; error?: string };

export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseResult> {
  if (!initialized) return { ok: false, cancelled: false, error: "Purchases not configured" };
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { ok: true, isPro: hasProEntitlement(customerInfo) };
  } catch (err: any) {
    const cancelled = Boolean(err?.userCancelled);
    return { ok: false, cancelled, error: err?.message };
  }
}

export async function restorePurchases(): Promise<PurchaseResult> {
  if (!initialized) return { ok: false, cancelled: false, error: "Purchases not configured" };
  try {
    const customerInfo = await Purchases.restorePurchases();
    return { ok: true, isPro: hasProEntitlement(customerInfo) };
  } catch (err: any) {
    return { ok: false, cancelled: false, error: err?.message };
  }
}

// Opens the platform's native subscription management UI
// (App Store on iOS, Google Play on Android). Required by Apple's
// guidelines for any app with in-app subscriptions.
export async function showManageSubscriptions(): Promise<{ ok: boolean; error?: string }> {
  if (!initialized) return { ok: false, error: "Purchases not configured" };
  try {
    await Purchases.showManageSubscriptions();
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message };
  }
}
