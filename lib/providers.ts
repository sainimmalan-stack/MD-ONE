/** Boundaries for real integrations. Production must supply real implementations.
 * No simulated success is allowed behind one of these interfaces. */
export interface IdentityProvider {
  sendOtp(phone: string): Promise<{ challengeId: string }>;
  verifyOtp(challengeId: string, code: string): Promise<{ subject: string }>;
}
export interface PaymentProvider {
  createPayment(
    orderId: string,
    amountPaise: number,
  ): Promise<{ providerId: string; checkoutUrl: string }>;
  refund(
    providerId: string,
    amountPaise: number,
    key: string,
  ): Promise<{ refundId: string }>;
  verifyWebhook(
    raw: Uint8Array,
    signature: string,
  ): Promise<{
    id: string;
    kind: "captured" | "refunded";
    orderId: string;
    amountPaise: number;
  }>;
}
export interface MalwareScanner {
  scan(content: Uint8Array, mime: string): Promise<"clean" | "infected">;
}
export interface NotificationProvider {
  send(
    userId: string,
    template: "order_update" | "emi_due" | "event_reminder",
    opaqueRef: string,
  ): Promise<void>;
}
export interface MapProvider {
  estimate(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ): Promise<{ kilometers: number; minutes: number }>;
}
export class ProviderNotConfigured extends Error {
  constructor(name: string) {
    super(`${name} is not configured. No external action was performed.`);
    this.name = "ProviderNotConfigured";
  }
}
export const productionProviders = {
  identity: null as IdentityProvider | null,
  payments: null as PaymentProvider | null,
  scanner: null as MalwareScanner | null,
  notifications: null as NotificationProvider | null,
  maps: null as MapProvider | null,
};
export function requireProvider<T>(provider: T | null, name: string): T {
  if (provider === null) throw new ProviderNotConfigured(name);
  return provider;
}
