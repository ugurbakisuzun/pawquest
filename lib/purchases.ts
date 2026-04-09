import Purchases, {
  type CustomerInfo,
  LOG_LEVEL,
  type PurchasesOffering,
  type PurchasesPackage,
} from "react-native-purchases";

// ─── Config ──────────────────────────────────────────────────────────────────
//
// Set EXPO_PUBLIC_REVENUECAT_KEY in .env (or via `eas env:create`). When the
// key is missing or doesn't match a recognised SDK key format, the wrapper
// stays in stub mode and the whole app behaves as "free" without crashing.
//
// react-native-purchases accepts platform-specific public SDK keys with one
// of these prefixes — anything else (REST API keys, secret keys, test keys
// for server-side use) is rejected by the native SDK and crashes the app on
// startup. Validate up front and skip configure() if the prefix is unknown.
//
const REVENUECAT_KEY = process.env.EXPO_PUBLIC_REVENUECAT_KEY ?? "";
const VALID_KEY_PREFIXES = ["appl_", "goog_", "amzn_", "mac_"];

// Identifiers configured in RevenueCat dashboard
export const PRO_ENTITLEMENT = "pro";
export const PRO_OFFERING = "default";

// ─── Internal state ──────────────────────────────────────────────────────────

let initialized = false;

// ─── Init ────────────────────────────────────────────────────────────────────

function hasValidKeyFormat(key: string): boolean {
  if (!key) return false;
  return VALID_KEY_PREFIXES.some((p) => key.startsWith(p));
}

export function isPurchasesConfigured(): boolean {
  return hasValidKeyFormat(REVENUECAT_KEY);
}

export async function initPurchases(userId?: string | null): Promise<void> {
  if (initialized) {
    if (userId) await loginUser(userId);
    return;
  }
  if (!REVENUECAT_KEY) {
    // No key set — stay in stub mode silently.
    return;
  }
  if (!hasValidKeyFormat(REVENUECAT_KEY)) {
    // Key is set but doesn't look like a mobile SDK key. The native module
    // would crash the app on startup if we passed it through. Skip and warn.
    console.warn(
      "[purchases] EXPO_PUBLIC_REVENUECAT_KEY does not match a known SDK key prefix " +
        VALID_KEY_PREFIXES.join("/") +
        ". Staying in stub mode. (got: " + REVENUECAT_KEY.slice(0, 5) + "...)",
    );
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
