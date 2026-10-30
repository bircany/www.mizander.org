import { NextResponse } from "next/server";
import { hasSameOrigin } from "@/lib/security/request-origin";

import { getAdminSession } from "@/lib/auth/session";
import { deliveryVideoMime } from "@/lib/delivery/upload-metadata";
import {
  DELIVERY_UPLOAD_ALLOWED_MIME,
  type DeliveryUploadRole,
} from "@/lib/delivery/upload-auth";
import { reserveDeliveryUploadSession } from "@/lib/delivery/group-code-upload-session";
import {
  getDeliveryVideoLimits,
  getTusdConfiguration,
} from "@/lib/delivery/storage";

export const dynamic = "force-dynamic";

function requestIp(request: Request) {
  return (
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

function json(
  body: Record<string, unknown>,
  status = 200,
  retryAfterSeconds?: number,
) {
  const headers = new Headers({ "cache-control": "private, no-store" });
  if (retryAfterSeconds) headers.set("retry-after", String(retryAfterSeconds));
  return NextResponse.json(body, { status, headers });
}

export async function POST(request: Request) {
  const user = await getAdminSession();
  const role = String(user?.role || "") as DeliveryUploadRole;
  if (!user?.id || !["admin", "field_operator"].includes(role)) {
    return json({ ok: false, error: "Video yükleme yetkiniz yok." }, 403);
  }

  try {
    if(!hasSameOrigin(request)) {
      return json({ok:false,error:"İstek kaynağı doğrulanamadı."},403);
    }
    const body = await request.json() as {
      groupId?: unknown;
      groupCode?: unknown;
      fileName?: unknown;
      mimeType?: unknown;
      sizeBytes?: unknown;
      dispatchAt?: unknown;
      expectedConfirmedCount?: unknown;
    };
    const groupId = Number(body.groupId);
    const repeatedGroupCode =
      typeof body.groupCode === "string" ? body.groupCode.trim() : "";
    const fileName =
      typeof body.fileName === "string" ? body.fileName.trim() : "";
    const requestedMime =
      typeof body.mimeType === "string" ? body.mimeType.trim().toLowerCase() : "";
    const mimeType = deliveryVideoMime(fileName, requestedMime);
    const sizeBytes = Number(body.sizeBytes);
    const dispatchAt = body.dispatchAt === null ? null : body.dispatchAt;
    const expectedConfirmedCount = Number(body.expectedConfirmedCount);
    const { maxBytes } = getDeliveryVideoLimits();

    if (
      !Number.isInteger(groupId) ||
      groupId <= 0 ||
      !repeatedGroupCode ||
      !fileName ||
      /[\\/\u0000-\u001f\u007f]/.test(fileName) ||
      !mimeType ||
      !Number.isSafeInteger(sizeBytes) ||
      sizeBytes <= 0 ||
      sizeBytes > maxBytes
    ) {
      return json({
        ok: false,
        error:
          "Grup kodu ile MP4, MOV veya WebM biçiminde en fazla 2 GB video zorunludur.",
      }, 400);
    }
    if (body.dispatchAt !== undefined) {
      if (role !== "admin") return json({ ok: false, error: "Gönderimi yalnızca yönetici başlatabilir." }, 403);
      if (
        (dispatchAt !== null && (
          typeof dispatchAt !== "string" ||
          !Number.isFinite(Date.parse(dispatchAt)) ||
          Date.parse(dispatchAt) <= Date.now() ||
          Date.parse(dispatchAt) > Date.now() + 90 * 86_400_000
        )) ||
        !Number.isSafeInteger(expectedConfirmedCount) ||
        expectedConfirmedCount < 1
      ) return json({ ok: false, error: "Gönderim zamanı veya bağışçı sayısı geçersiz." }, 400);
    }

    // Check the upload destination before reserving a video or cancelling pending messages.
    // A missing local tusd URL must not leave a reservation behind.
    let uploadEndpoint: string;
    try {
      uploadEndpoint = getTusdConfiguration().endpoint;
    } catch (error) {
      console.error("Delivery upload destination is unavailable:", error instanceof Error ? error.message : "unknown error");
      return json({
        ok: false,
        code: "UPLOAD_SERVICE_NOT_CONFIGURED",
        error: process.env.NODE_ENV === "production"
          ? "Video yükleme servisi şu anda kullanılamıyor. Lütfen daha sonra yeniden deneyin."
          : "Video yükleme servisi bu yerel ortamda bağlı değil. Test video servisi yapılandırılmadan gerçek yükleme yapılamaz.",
      }, 503);
    }

    const reservation = await reserveDeliveryUploadSession({
      groupId,
      repeatedGroupCode,
      fileName,
      mimeType,
      sizeBytes,
      maxBytes,
      ...(body.dispatchAt !== undefined ? {
        dispatchAt: dispatchAt as string | null,
        expectedConfirmedCount,
      } : {}),
      user: {
        id: String(user.id),
        email: typeof user.email === "string" ? user.email : null,
        role,
      },
      ipAddress: requestIp(request),
    });
    if (!reservation.ok) {
      return json(
        { ok: false, error: reservation.error },
        reservation.status,
        reservation.retryAfterSeconds,
      );
    }

    return json({
      ok: true,
      videoId: reservation.videoId,
      uploadId: reservation.uploadId,
      version: reservation.version,
      tokenExpiresAt: reservation.expiresAt,
      endpoint: `${uploadEndpoint}/`,
      metadata: {
        token: reservation.grant,
      },
      limits: {
        maxBytes,
        maxSeconds: getDeliveryVideoLimits().maxSeconds,
        allowedMime: DELIVERY_UPLOAD_ALLOWED_MIME,
      },
    });
  } catch (error) {
    console.error("Delivery upload session could not be created:", error);
    return json({
      ok: false,
      error: "Video yükleme oturumu şu anda oluşturulamıyor.",
    }, 500);
  }
}
