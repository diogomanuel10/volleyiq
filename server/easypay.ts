/**
 * EasyPay payment service.
 * Docs: https://docs.easypay.pt/
 * Supports: MB WAY, Multibanco reference, credit card.
 */

const EASYPAY_BASE = process.env.EASYPAY_SANDBOX === "true"
  ? "https://api.test.easypay.pt/2.0"
  : "https://api.prod.easypay.pt/2.0";

const ACCOUNT_ID = process.env.EASYPAY_ACCOUNT_ID ?? "";
const API_KEY = process.env.EASYPAY_API_KEY ?? "";

function headers() {
  return {
    "Content-Type": "application/json",
    AccountId: ACCOUNT_ID,
    ApiKey: API_KEY,
  };
}

export type PaymentMethod = "mb_way" | "multibanco" | "cc" | "dd";

export interface CreatePaymentParams {
  value: number;
  description: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  method: PaymentMethod;
  // URL to redirect / notify after payment
  notifyUrl: string;
  // Opaque reference we pass through — we store teamId + plan here
  externalId: string;
}

export interface EasyPayPayment {
  id: string;
  method: PaymentMethod;
  status: string;
  // MB WAY: redirect_url not applicable; Multibanco: entity + reference; CC: redirect_url
  redirectUrl?: string;
  entity?: string;      // Multibanco entidade
  reference?: string;   // Multibanco referência
  expiresAt?: string;
}

export async function createSinglePayment(
  params: CreatePaymentParams,
): Promise<EasyPayPayment> {
  const body: Record<string, unknown> = {
    type: "sale",
    capture: {
      descriptive: params.description,
    },
    customer: {
      name: params.customerName,
      email: params.customerEmail,
      ...(params.customerPhone ? { phone: params.customerPhone } : {}),
    },
    value: params.value,
    key: params.externalId,
    notification_url: params.notifyUrl,
  };

  if (params.method === "mb_way") {
    body.method = "mbw";
    body.mbway_alias = params.customerPhone;
  } else if (params.method === "multibanco") {
    body.method = "mb";
  } else if (params.method === "cc") {
    body.method = "cc";
  } else if (params.method === "dd") {
    body.method = "dd";
  }

  const res = await fetch(`${EASYPAY_BASE}/single`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`EasyPay createSinglePayment failed: ${res.status} ${err}`);
  }

  const data = await res.json() as Record<string, any>;

  return {
    id: data.id,
    method: params.method,
    status: data.status ?? "pending",
    redirectUrl: data.payment?.url,
    entity: data.payment?.entity,
    reference: data.payment?.reference,
    expiresAt: data.payment?.expiration_time,
  };
}

/**
 * Parses and validates an incoming EasyPay webhook notification.
 * EasyPay sends a POST with { status, id, type, key, value, ... }
 */
export interface WebhookPayload {
  id: string;
  key: string;       // our externalId (teamId:plan:period)
  status: string;    // "success" | "failed" | "pending" | "refunded"
  type: string;      // "capture" | ...
  value: number;
}

export function parseWebhook(body: Record<string, unknown>): WebhookPayload | null {
  if (!body?.id || !body?.key) return null;
  return {
    id: String(body.id),
    key: String(body.key),
    status: String(body.status ?? ""),
    type: String(body.type ?? ""),
    value: Number(body.value ?? 0),
  };
}

export function isConfigured(): boolean {
  return Boolean(ACCOUNT_ID && API_KEY);
}

// Plan prices in EUR
export const PLAN_PRICES: Record<string, { monthly: number; annual: number }> = {
  individual: { monthly: 19, annual: 16 },
  pro: { monthly: 49, annual: 41 },
  club: { monthly: 119, annual: 101 },
};
