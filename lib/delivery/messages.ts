import "server-only";

import { createHash, randomUUID } from "node:crypto";

import type { Payload } from "payload";

import { issueDonorVideoToken } from "@/lib/delivery/tokens";
import {
  interpolateDeliveryTemplate,
  normalizePhone,
  relationId,
} from "@/lib/delivery/types";
import { ensureLocalEnvLoaded } from "@/lib/env";

type AnyDoc = Record<string, any> & { id: string | number };
type DeliveryPayload = {
  find(args: Record<string, unknown>): Promise<{ docs: AnyDoc[] }>;
  findByID(args: Record<string, unknown>): Promise<AnyDoc>;
  create(args: Record<string, unknown>): Promise<AnyDoc>;
  update(args: Record<string, unknown>): Promise<AnyDoc>;
};

const cms = (payload: Payload) => payload as unknown as DeliveryPayload;

function phoneHash(phone: string) {
  return createHash("sha256").update(phone).digest("hex");
}

function publicBaseUrl() {
  ensureLocalEnvLoaded();
  const value =
    process.env.NEXT_PUBLIC_BASE_URL?.trim() || "http://localhost:3000";
  return value.replace(/\/$/, "");
}

function recipientFrom(member: AnyDoc) {
  const participant =
    typeof member.participant === "object" && member.participant
      ? member.participant
      : null;
  const donation =
    typeof member.donation === "object" && member.donation
      ? member.donation
      : null;
  const consent =
    Boolean(participant?.isPayer) ||
    (participant?.communicationConsent ??
      participant?.whatsappConsent ??
      participant?.contactConsent ??
      true);
  if (!consent) return null;
  const phone = normalizePhone(
    participant?.effectivePhone ||
      participant?.phone ||
      member.recipientPhone ||
      donation?.phone,
  );
  if (!phone) return null;
  return {
    phone,
    name: String(
      participant?.name ||
        participant?.fullName ||
        donation?.donorName ||
        "Bağışçımız",
    ),
    donationId: relationId(member.donation),
    participantId: relationId(member.participant),
    memberId: String(member.id),
  };
}

function groupCampaignTitle(group: AnyDoc) {
  const campaign =
    typeof group.campaign === "object" && group.campaign
      ? group.campaign
      : null;
  const title = campaign?.title ?? group.campaignTitle;
  if (typeof title === "string") return title;
  if (title && typeof title === "object") {
    return String(title.tr || title.en || title.ar || "Bağışınız");
  }
  return "Bağışınız";
}

export async function prepareDeliveryDrafts(
  payload: Payload,
  groupId: string | number,
  options: { correction?: boolean } = {},
) {
  const api = cms(payload);
  const group = await api.findByID({
    collection: "operation-groups",
    id: groupId,
    depth: 1,
    overrideAccess: true,
  });
  const videos = await api.find({
    collection: "operation-videos",
    where: {
      and: [{ group: { equals: groupId } }, { status: { equals: "ready" } }],
    },
    sort: "-version",
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const video = videos.docs[0];
  if (!video) throw new Error("Taslak olusturmak icin hazir video bulunamadi.");

  const members = await api.find({
    collection: "operation-group-members",
    where: {
      and: [
        { group: { equals: groupId } },
        { status: { equals: "confirmed" } },
      ],
    },
    limit: 10_000,
    depth: 2,
    overrideAccess: true,
  });

  const unique = new Map<string, ReturnType<typeof recipientFrom>>();
  for (const member of members.docs) {
    const recipient = recipientFrom(member);
    if (recipient && !unique.has(recipient.phone))
      unique.set(recipient.phone, recipient);
  }

  const template = String(
    group.messageTemplate ||
      "Sayın {{name}}, {{groupCode}} kodlu bağışınıza ait video hazırlandı: {{videoUrl}}",
  );
  const campaignName = groupCampaignTitle(group);
  let created = 0;
  for (const recipient of unique.values()) {
    if (!recipient) continue;
    const hash = phoneHash(recipient.phone);
    const idempotencyKey = createHash("sha256")
      .update(`${group.id}:${video.id}:${hash}`)
      .digest("hex");
    const existing = await api.find({
      collection: "delivery-messages",
      where: { idempotencyKey: { equals: idempotencyKey } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    if (existing.docs[0]) continue;

    const expiresAt = new Date(Date.now() + 365 * 86_400_000);
    const access = issueDonorVideoToken({
      messageId: idempotencyKey,
      videoId: video.id,
      expiresAt,
    });
    const videoUrl = `${publicBaseUrl()}/api/delivery/videos/${encodeURIComponent(access.token)}`;
    await api.create({
      collection: "delivery-messages",
      data: {
        group: group.id,
        video: video.id,
        donation: recipient.donationId || undefined,
        participant: recipient.participantId || undefined,
        member: recipient.memberId,
        channel: "whatsapp",
        recipientPhone: recipient.phone,
        recipientPhoneHash: hash,
        body: `${options.correction ? "Düzeltme videosu: " : ""}${interpolateDeliveryTemplate(
          template,
          {
            name: recipient.name,
            ad: recipient.name,
            campaign: campaignName,
            kampanya: campaignName,
            groupCode: String(group.code || ""),
            grup_kodu: String(group.code || ""),
            videoUrl,
            video_linki: videoUrl,
          },
        )}`,
        idempotencyKey,
        status: "draft",
        attemptCount: 0,
        accessTokenDigest: access.digest,
        expiresAt: access.expiresAt.toISOString(),
      },
      overrideAccess: true,
    });
    created += 1;
  }
  return { created, recipients: unique.size, videoId: video.id };
}

export async function queueDeliveryDrafts(
  payload: Payload,
  groupId: string | number,
  delaySeconds = 5,
) {
  const api = cms(payload);
  const group = await api.findByID({
    collection: "operation-groups",
    id: groupId,
    depth: 0,
    overrideAccess: true,
  });
  if (group.dispatchState === "running")
    throw new Error("Bu grubun gönderimi zaten sürüyor.");
  const drafts = await api.find({
    collection: "delivery-messages",
    where: {
      and: [
        { group: { equals: groupId } },
        { status: { in: ["draft", "paused", "failed"] } },
      ],
    },
    sort: "id",
    limit: 10_000,
    depth: 0,
    overrideAccess: true,
  });
  if (!drafts.docs.length) {
    throw new Error(
      "Gönderilecek taslak mesaj bulunamadı. Video işlendi mi ve alıcı telefonu var mı kontrol edin.",
    );
  }
  const batchId = randomUUID();
  const startAt = Date.now() + 5_000;
  for (const [index, message] of drafts.docs.entries()) {
    await api.update({
      collection: "delivery-messages",
      id: message.id,
      data: {
        status: "queued",
        dispatchBatchId: batchId,
        scheduledAt: new Date(
          startAt + index * Math.max(1, delaySeconds) * 1000,
        ).toISOString(),
        lockedAt: null,
        lockedBy: null,
        lastError: null,
      },
      overrideAccess: true,
    });
  }
  await api.update({
    collection: "operation-groups",
    id: groupId,
    data: {
      dispatchState: "countdown",
      dispatchLockedAt: null,
      dispatchLockedBy: null,
    },
    overrideAccess: true,
  });
  return {
    batchId,
    queued: drafts.docs.length,
    cancelUntil: new Date(startAt).toISOString(),
  };
}

export async function pauseDeliveryGroup(
  payload: Payload,
  groupId: string | number,
) {
  const api = cms(payload);
  const queued = await api.find({
    collection: "delivery-messages",
    where: {
      and: [{ group: { equals: groupId } }, { status: { equals: "queued" } }],
    },
    limit: 10_000,
    depth: 0,
    overrideAccess: true,
  });
  for (const message of queued.docs) {
    await api.update({
      collection: "delivery-messages",
      id: message.id,
      data: { status: "paused", lockedAt: null, lockedBy: null },
      overrideAccess: true,
    });
  }
  await api.update({
    collection: "operation-groups",
    id: groupId,
    data: { dispatchState: "paused" },
    overrideAccess: true,
  });
  return queued.docs.length;
}

export async function resumeDeliveryGroup(
  payload: Payload,
  groupId: string | number,
  delaySeconds = 5,
) {
  return queueDeliveryDrafts(payload, groupId, delaySeconds);
}

export async function cancelDeliveryGroup(
  payload: Payload,
  groupId: string | number,
) {
  const api = cms(payload);
  const pending = await api.find({
    collection: "delivery-messages",
    where: {
      and: [
        { group: { equals: groupId } },
        { status: { in: ["draft", "queued", "paused", "failed"] } },
      ],
    },
    limit: 10_000,
    depth: 0,
    overrideAccess: true,
  });
  for (const message of pending.docs) {
    await api.update({
      collection: "delivery-messages",
      id: message.id,
      data: { status: "cancelled", lockedAt: null, lockedBy: null },
      overrideAccess: true,
    });
  }
  await api.update({
    collection: "operation-groups",
    id: groupId,
    data: {
      dispatchState: "cancelled",
      dispatchLockedAt: null,
      dispatchLockedBy: null,
    },
    overrideAccess: true,
  });
  return pending.docs.length;
}

export async function retryDeliveryMessage(
  payload: Payload,
  messageId: string | number,
) {
  const api = cms(payload);
  const message = await api.findByID({
    collection: "delivery-messages",
    id: messageId,
    depth: 0,
    overrideAccess: true,
  });
  if (message.status !== "failed")
    throw new Error("Yalnızca başarısız mesaj yeniden denenebilir.");
  await api.update({
    collection: "delivery-messages",
    id: message.id,
    data: {
      status: "queued",
      attemptCount: 0,
      scheduledAt: new Date().toISOString(),
      failedAt: null,
      lockedAt: null,
      lockedBy: null,
      lastError: null,
      lastErrorCode: null,
      retryClass: "none",
      nextRetryAt: null,
    },
    overrideAccess: true,
  });
  const groupId = relationId(message.group);
  await api.update({
    collection: "operation-groups",
    id: groupId,
    data: { dispatchState: "sending" },
    overrideAccess: true,
  });
}

export async function markDeliveryFailure(
  payload: Payload,
  messageId: string | number,
  error: unknown,
  maxAttempts = 5,
) {
  const api = cms(payload);
  const message = await api.findByID({
    collection: "delivery-messages",
    id: messageId,
    depth: 0,
    overrideAccess: true,
  });
  const attempts = Number(message.attemptCount || 0) + 1;
  const terminal = attempts >= maxAttempts;
  await api.update({
    collection: "delivery-messages",
    id: message.id,
    data: {
      status: terminal ? "failed" : "queued",
      attemptCount: attempts,
      scheduledAt: terminal
        ? message.scheduledAt
        : new Date(
            Date.now() + Math.min(3600, 30 * 2 ** attempts) * 1000,
          ).toISOString(),
      failedAt: terminal ? new Date().toISOString() : null,
      lockedAt: null,
      lockedBy: null,
      lastError:
        error instanceof Error
          ? error.message.slice(0, 1000)
          : "Mesaj gönderim hatası.",
    },
    overrideAccess: true,
  });
  if (terminal) {
    const groupId = relationId(message.group);
    await api.update({
      collection: "operation-groups",
      id: groupId,
      data: {
        dispatchState: "failed",
        dispatchLockedAt: null,
        dispatchLockedBy: null,
      },
      overrideAccess: true,
    });
  }
}
