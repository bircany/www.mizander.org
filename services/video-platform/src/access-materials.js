import { createHmac, randomInt } from "node:crypto";

import { transaction } from "./db.js";
import { HttpError } from "./errors.js";
import { hashAccessCode } from "./security/access-code.js";
import { encryptAccessCode } from "./security/access-code-crypto.js";
import { sha256 } from "./security/hashes.js";

function randomAccessCode() {
  return String(randomInt(0, 10_000)).padStart(4, "0");
}

export function derivePublicLinkToken(groupId, secret) {
  return createHmac("sha256", secret)
    .update(`mizan-group-link:v1:${String(groupId)}`)
    .digest("base64url");
}

export function publicVideoUrl(groupId, config) {
  return `${config.landingBaseUrl}/video/${derivePublicLinkToken(groupId, config.publicLinkSecret)}`;
}

export async function initializeAccessMaterials(groupId, config) {
  if (!/^\d+$/.test(String(groupId))) throw new HttpError(400, "invalid_group_id", "Grup kimliği geçersiz.");
  return transaction(async (client) => {
    const selected = await client.query(
      `select id, public_link_token_hash, access_code_hash, access_code_ciphertext,
              access_code_rotation_count
       from operation_groups
       where id::text = $1
       for update`,
      [String(groupId)],
    );
    const group = selected.rows[0];
    if (!group) throw new HttpError(404, "group_not_found", "Operasyon grubu bulunamadı.");
    const linkToken = derivePublicLinkToken(group.id, config.publicLinkSecret);
    let accessCodeHash = group.access_code_hash;
    let accessCodeCiphertext = group.access_code_ciphertext;
    let initializedCode = false;
    if (!accessCodeHash || !accessCodeCiphertext) {
      const accessCode = randomAccessCode();
      accessCodeHash = await hashAccessCode(accessCode);
      accessCodeCiphertext = encryptAccessCode(accessCode, config.key);
      initializedCode = true;
    }
    await client.query(
      `update operation_groups
       set public_link_token_hash = coalesce(public_link_token_hash, $2),
           access_code_hash = $3,
           access_code_ciphertext = $4,
           access_code_rotated_at = case when $5 then now() else access_code_rotated_at end,
           updated_at = now()
       where id = $1`,
      [group.id, sha256(linkToken), accessCodeHash, accessCodeCiphertext, initializedCode],
    );
    return {
      groupId: group.id,
      publicLinkReady: true,
      accessCodeReady: true,
      accessCodeRotationCount: Number(group.access_code_rotation_count || 0),
      initializedCode,
    };
  });
}

export async function rotateAccessCode(groupId, actorId, config) {
  if (!/^\d+$/.test(String(groupId)) || !/^\d+$/.test(String(actorId))) {
    throw new HttpError(400, "invalid_rotation_request", "Kod yenileme bilgisi geçersiz.");
  }
  return transaction(async (client) => {
    const selected = await client.query(
      `select id, dispatch_state, access_code_rotation_count
       from operation_groups
       where id::text = $1
       for update`,
      [String(groupId)],
    );
    const group = selected.rows[0];
    if (!group) throw new HttpError(404, "group_not_found", "Operasyon grubu bulunamadı.");
    if (["countdown", "queued", "sending"].includes(group.dispatch_state)) {
      throw new HttpError(409, "dispatch_in_progress", "Gönderim sürerken erişim kodu yenilenemez.");
    }
    const accessCode = randomAccessCode();
    const accessCodeHash = await hashAccessCode(accessCode);
    const accessCodeCiphertext = encryptAccessCode(accessCode, config.key);
    const updated = await client.query(
      `update operation_groups
       set access_code_hash = $2,
           access_code_ciphertext = $3,
           access_code_rotation_count = access_code_rotation_count + 1,
           access_code_rotated_at = now(),
           access_code_rotated_by_id = $4,
           test_message_invalidated_at = now(),
           updated_at = now()
       where id = $1
       returning id, access_code_rotation_count`,
      [group.id, accessCodeHash, accessCodeCiphertext, Number(actorId)],
    );
    return {
      groupId: updated.rows[0].id,
      accessCodeRotationCount: updated.rows[0].access_code_rotation_count,
      draftsRequired: true,
    };
  });
}
