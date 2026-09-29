import assert from "node:assert/strict";

process.env.PAYLOAD_SECRET ||= "local-delivery-test-secret-with-sufficient-length";

const { interpolateDeliveryTemplate, normalizePhone } = await import("../lib/delivery/types");
const {
  buildProtectedDeliveryTemplate,
  extractEditableDeliveryMessage,
  sanitizeEditableDeliveryMessage,
  validateEditableDeliveryMessage,
} = await import("../lib/delivery/template");
const {
  digestDeliveryToken,
  issueDonorVideoToken,
  issueStreamToken,
  verifyDeliveryToken,
} = await import("../lib/delivery/tokens");
const { mapEvolutionDeliveryStatus } = await import("../lib/delivery/evolution");
const { getDeliveryVideoStorage } = await import("../lib/delivery/storage");
const { createDeliveryUploadGrant, verifyDeliveryUploadGrant } =
  await import("../lib/delivery/upload-auth");
const { uploadGrantLifetimeSeconds, validateGroupGate } =
  await import("../lib/delivery/group-code-upload-session");
const { normalizeDeliveryAccessCode } = await import("../lib/delivery/access-api");

assert.equal(normalizeDeliveryAccessCode("0427"), "0427");
assert.equal(normalizeDeliveryAccessCode("ABCD-2345"), "ABCD2345");
assert.equal(normalizeDeliveryAccessCode("427"), null);
assert.equal(normalizeDeliveryAccessCode("12A4"), null);

assert.equal(normalizePhone("0532 123 45 67"), "905321234567");
assert.equal(normalizePhone("+90 (532) 123-4567"), "905321234567");
assert.equal(normalizePhone("123"), null);
assert.equal(
  interpolateDeliveryTemplate(
    "Sayın {ad}, {grup_kodu}: {video_linki}",
    { ad: "Ali Veli", grup_kodu: "MD-2026-0001", video_linki: "https://video.example/1" },
  ),
  "Sayın Ali Veli, MD-2026-0001: https://video.example/1",
);
assert.equal(
  interpolateDeliveryTemplate("Dear {{name}}, {{videoUrl}}", {
    name: "Ali Veli",
    videoUrl: "https://video.example/1",
  }),
  "Dear Ali Veli, https://video.example/1",
);
assert.equal(
  interpolateDeliveryTemplate("Bilinmeyen {alan}", {}),
  "Bilinmeyen {alan}",
);
const protectedTemplate = buildProtectedDeliveryTemplate(
  "Videonuz hazır. {sahte_alan} Allah kabul etsin.",
);
assert.equal(protectedTemplate.includes("{sahte_alan}"), false);
assert.equal(protectedTemplate.includes("{ad}"), true);
assert.equal(protectedTemplate.includes("{kampanya}"), true);
assert.equal(protectedTemplate.includes("{grup_kodu}"), true);
assert.equal(protectedTemplate.includes("{video_linki}"), true);
assert.equal(protectedTemplate.includes("{erisim_kodu}"), true);
assert.equal(
  extractEditableDeliveryMessage(protectedTemplate),
  "Videonuz hazır.  Allah kabul etsin.",
);
assert.equal(sanitizeEditableDeliveryMessage("A".repeat(700)).length, 600);
assert.throws(
  () => validateEditableDeliveryMessage("Alternatif link: https://evil.example"),
  /bağlantı eklenemez/i,
);
assert.equal(
  validateEditableDeliveryMessage("Allah hayrınızı kabul etsin."),
  "Allah hayrınızı kabul etsin.",
);

const donor = issueDonorVideoToken({
  messageId: 12,
  videoId: 34,
  expiresAt: new Date(Date.now() + 60_000),
});
assert.equal(verifyDeliveryToken(donor.token, "donor")?.videoId, "34");
assert.equal(verifyDeliveryToken(`${donor.token}x`, "donor"), null);
assert.equal(digestDeliveryToken(donor.token), donor.digest);

const stream = issueStreamToken({ messageId: "12", videoId: "34" }, 60);
assert.equal(verifyDeliveryToken(stream, "stream")?.messageId, "12");
assert.equal(verifyDeliveryToken(stream, "donor"), null);

const uploadGrant = createDeliveryUploadGrant({ videoId: "1", groupId: "2", userId: "3" }, 60);
assert.equal(verifyDeliveryUploadGrant(uploadGrant)?.groupId, "2");
assert.equal(verifyDeliveryUploadGrant(`${uploadGrant}x`), null);

assert.equal(
  validateGroupGate({
    operationType: "slaughter_video",
    dispatchState: "idle",
    capacity: 1,
    confirmedCount: 1,
    status: "ready_for_slaughter",
  }),
  null,
);
assert.match(
  validateGroupGate({
    operationType: "slaughter_video",
    dispatchState: "idle",
    capacity: 2,
    confirmedCount: 1,
    status: "collecting",
  }) || "",
  /tamamen dolmadan/i,
);
assert.equal(
  uploadGrantLifetimeSeconds(
    "2026-07-31T10:10:00.000Z",
    Date.parse("2026-07-31T10:00:00.000Z"),
  ),
  600,
);
assert.equal(
  uploadGrantLifetimeSeconds(
    "2026-07-31T10:09:42.900Z",
    Date.parse("2026-07-31T10:00:00.000Z"),
  ),
  582,
);

assert.equal(mapEvolutionDeliveryStatus("READ"), "read");
assert.equal(mapEvolutionDeliveryStatus("DELIVERY_ACK"), "delivered");
assert.equal(mapEvolutionDeliveryStatus("failed"), "failed");
assert.equal(mapEvolutionDeliveryStatus("unknown"), null);

assert.throws(() => getDeliveryVideoStorage().resolve("raw", "../secret"));
assert.match(getDeliveryVideoStorage().resolve("raw", "video-1.mp4"), /video-1\.mp4$/);

console.log("Delivery unit checks passed.");
