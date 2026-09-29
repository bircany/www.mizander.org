import assert from "node:assert/strict";
import test from "node:test";

import { derivePublicLinkToken } from "../src/access-materials.js";
import { deliveryPolicyConfig } from "../src/config.js";
import { stableStringify } from "../src/message-fingerprint.js";
import { renderDeliveryMessage } from "../src/message-renderer.js";
import { encryptAccessCode } from "../src/security/access-code-crypto.js";

test("delivery test policy is optional by default and explicitly configurable", () => {
  const previous = process.env.REQUIRE_DELIVERY_TEST;
  try {
    delete process.env.REQUIRE_DELIVERY_TEST;
    assert.equal(deliveryPolicyConfig().requireTestBeforeDispatch, false);
    process.env.REQUIRE_DELIVERY_TEST = "true";
    assert.equal(deliveryPolicyConfig().requireTestBeforeDispatch, true);
    process.env.REQUIRE_DELIVERY_TEST = "false";
    assert.equal(deliveryPolicyConfig().requireTestBeforeDispatch, false);
  } finally {
    if (previous === undefined) delete process.env.REQUIRE_DELIVERY_TEST;
    else process.env.REQUIRE_DELIVERY_TEST = previous;
  }
});

test("stable JSON makes fingerprint input independent of object key order", () => {
  assert.equal(
    stableStringify({ b: 2, a: { z: 1, y: 2 } }),
    stableStringify({ a: { y: 2, z: 1 }, b: 2 }),
  );
});

test("group link token is deterministic but not the group id", () => {
  const secret = "z".repeat(32);
  const token = derivePublicLinkToken(42, secret);
  assert.equal(token, derivePublicLinkToken("42", secret));
  assert.equal(token.length, 43);
  assert.equal(token.includes("42"), false);
});

test("worker renders immutable link, group and decrypted access code", () => {
  const key = Buffer.alloc(32, 3);
  const text = renderDeliveryMessage({
    group_id: 42,
    video_id: 8,
    message_type: "normal",
    body_snapshot: "Videonuz hazırdır.",
    message_snapshot: {
      schemaVersion: 1,
      recipientNames: ["Ayşe", "Mehmet", "Ayşe"],
      campaignName: "2026 Kurban",
    },
    system_payload_snapshot: {
      schemaVersion: 1,
      groupId: 42,
      videoId: 8,
      messageType: "normal",
    },
  }, {
    id: 42,
    code: "MD-2026-0001",
    access_code_ciphertext: encryptAccessCode("0427", key),
  }, {
    key,
    publicLinkSecret: "l".repeat(32),
    landingBaseUrl: "https://www.mizander.com.tr",
  });
  assert.match(text, /Ayşe, Mehmet/);
  assert.match(text, /MD-2026-0001/);
  assert.match(text, /0427/);
  assert.match(text, /https:\/\/www\.mizander\.com\.tr\/video\/[A-Za-z0-9_-]{43}/);
});

test("worker does not duplicate template greeting, campaign or group lines", () => {
  const key = Buffer.alloc(32, 4);
  const text = renderDeliveryMessage({
    group_id: 42,
    video_id: 8,
    message_type: "normal",
    body_snapshot: [
      "Sayın Mustafa Emir Kincal,",
      "",
      "Bağışınıza ait videonuz hazırlanmıştır.",
      "",
      "Kampanya: Test",
      "Grup kodu: MD-2026-0002",
    ].join("\n"),
    message_snapshot: {
      schemaVersion: 1,
      recipientNames: ["Mustafa Emir Kincal"],
      campaignName: "Test",
    },
    system_payload_snapshot: {
      schemaVersion: 1,
      groupId: 42,
      videoId: 8,
      messageType: "normal",
    },
  }, {
    id: 42,
    code: "MD-2026-0002",
    access_code_ciphertext: encryptAccessCode("RJ2HLCDK", key),
  }, {
    key,
    publicLinkSecret: "l".repeat(32),
    landingBaseUrl: "https://www.mizander.com.tr",
  });

  assert.equal(text.match(/Sayın Mustafa Emir Kincal/g)?.length, 1);
  assert.equal(text.match(/Kampanya: Test/g)?.length, 1);
  assert.equal(text.match(/Grup kodu: MD-2026-0002/g)?.length, 1);
  assert.match(text, /Video bağlantısı: https:\/\/www\.mizander\.com\.tr\/video\//);
});
