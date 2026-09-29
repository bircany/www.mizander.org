import "server-only";

import { createHmac } from "node:crypto";

import { ensureLocalEnvLoaded } from "@/lib/env";

export type DeliveryAccessMetadata = {
  groupCode: string;
  campaignName: string;
  expiresAt: string;
  serverNow: string;
  sensitiveContent: boolean;
  available: boolean;
};

export type DeliveryAccessAuthorization = {
  streamUrl: string;
  downloadUrl: string;
  expiresAt: string;
  serverNow: string;
  sensitiveContent: boolean;
};

export class DeliveryAccessApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "DeliveryAccessApiError";
  }
}

function configuration() {
  ensureLocalEnvLoaded();
  const apiUrl = process.env.DELIVERY_VIDEO_API_URL?.trim();
  if (!apiUrl) throw new Error("DELIVERY_VIDEO_API_URL yapılandırılmamış.");
  const internalSecret = process.env.DELIVERY_VIDEO_API_INTERNAL_SECRET?.trim();
  if (!internalSecret) {
    throw new Error("DELIVERY_VIDEO_API_INTERNAL_SECRET yapılandırılmamış.");
  }
  const apiBase = new URL(apiUrl);
  const publicBase = new URL(
    process.env.DELIVERY_VIDEO_PUBLIC_URL?.trim() || apiBase.toString(),
  );
  return {
    apiBase: apiBase.toString().replace(/\/$/, ""),
    publicBase,
    internalSecret,
  };
}

export function normalizeDeliveryLinkToken(value: unknown) {
  const token = typeof value === "string" ? value.trim() : "";
  return /^[A-Za-z0-9_-]{32,160}$/.test(token) ? token : null;
}

export function normalizeDeliveryAccessCode(value: unknown) {
  const code =
    typeof value === "string"
      ? value.trim().toLocaleUpperCase("en-US").replace(/[\s-]/g, "")
      : "";
  return /^(?:\d{4}|[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8})$/.test(code)
    ? code
    : null;
}

function text(value: unknown, fallback: string, maxLength = 160) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function isoDate(value: unknown) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    return null;
  return new Date(value).toISOString();
}

function safeMediaUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const { publicBase } = configuration();
  let url: URL;
  try {
    url = new URL(value, publicBase);
  } catch {
    return null;
  }
  if (url.origin !== publicBase.origin) return null;
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:")
    return null;
  if (!["https:", "http:"].includes(url.protocol)) return null;
  return url.toString();
}

export async function deliveryVideoApiRequest(
  path: string,
  init: RequestInit,
  client?: { ipAddress?: string | null; userAgent?: string | null },
) {
  const { apiBase, internalSecret } = configuration();
  const rawBody = typeof init.body === "string" ? init.body : "";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", internalSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    body: rawBody || undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
    headers: {
      accept: "application/json",
      ...(rawBody ? { "content-type": "application/json" } : {}),
      "x-mizan-timestamp": timestamp,
      "x-mizan-signature": `v1=${signature}`,
      ...(client?.ipAddress ? { "x-mizan-client-ip": client.ipAddress } : {}),
      ...(client?.userAgent
        ? { "x-mizan-client-user-agent": client.userAgent.slice(0, 300) }
        : {}),
      ...init.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!response.ok) {
    const retryAfterHeader = Number(response.headers.get("retry-after"));
    throw new DeliveryAccessApiError(
      text(body.error || body.message, "Video erişimi doğrulanamadı.", 300),
      response.status,
      Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
        ? retryAfterHeader
        : undefined,
    );
  }
  return {
    body,
    serverNow:
      isoDate(body.serverNow) ||
      isoDate(response.headers.get("date")) ||
      new Date().toISOString(),
  };
}

export async function getDeliveryAccessMetadata(linkToken: string) {
  const normalized = normalizeDeliveryLinkToken(linkToken);
  if (!normalized)
    throw new DeliveryAccessApiError("Video bağlantısı geçersiz.", 404);
  const { body, serverNow } = await deliveryVideoApiRequest(
    `/v1/groups/${encodeURIComponent(normalized)}`,
    { method: "GET" },
  );
  const expiresAt = isoDate(body.expiresAt);
  if (!expiresAt)
    throw new DeliveryAccessApiError("Video saklama süresi bulunamadı.", 502);
  return {
    groupCode: text(body.groupCode, "Mizan"),
    campaignName: text(
      body.campaignName || body.campaign,
      "Mizan bağış videosu",
    ),
    expiresAt,
    serverNow,
    sensitiveContent: body.sensitiveContent === true,
    available:
      body.available !== false && Date.parse(expiresAt) > Date.parse(serverNow),
  } satisfies DeliveryAccessMetadata;
}

export async function verifyDeliveryAccess(
  linkToken: string,
  accessCode: string,
  client?: { ipAddress?: string | null; userAgent?: string | null },
) {
  const normalizedToken = normalizeDeliveryLinkToken(linkToken);
  const normalizedCode = normalizeDeliveryAccessCode(accessCode);
  if (!normalizedToken || !normalizedCode) {
    throw new DeliveryAccessApiError(
      "Bağlantı veya erişim PIN'i geçersiz.",
      400,
    );
  }
  const { body, serverNow } = await deliveryVideoApiRequest(
    "/v1/access/verify",
    {
      method: "POST",
      body: JSON.stringify({
        linkToken: normalizedToken,
        accessCode: normalizedCode,
      }),
    },
    client,
  );
  const expiresAt = isoDate(body.expiresAt);
  const streamUrl = safeMediaUrl(body.streamUrl);
  const downloadUrl = safeMediaUrl(body.downloadUrl);
  if (!expiresAt || !streamUrl || !downloadUrl) {
    throw new DeliveryAccessApiError(
      "Video servisi eksik erişim yanıtı döndürdü.",
      502,
    );
  }
  return {
    streamUrl,
    downloadUrl,
    expiresAt,
    serverNow,
    sensitiveContent: body.sensitiveContent === true,
  } satisfies DeliveryAccessAuthorization;
}
