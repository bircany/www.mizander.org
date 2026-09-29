import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
export const accessCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const accessPinPattern = /^\d{4}$/;

export function normalizeAccessCode(value) {
  return String(value ?? "").trim().toUpperCase().replace(/[\s-]/g, "");
}

export function isValidAccessCodeShape(value) {
  const normalized = normalizeAccessCode(value);
  return accessPinPattern.test(normalized) || (
    normalized.length === 8 &&
    [...normalized].every((character) => accessCodeAlphabet.includes(character))
  );
}

export async function hashAccessCode(code, salt = randomBytes(16)) {
  const normalized = normalizeAccessCode(code);
  if (!isValidAccessCodeShape(normalized)) throw new Error("Invalid access code format");
  const N = 16_384;
  const r = 8;
  const p = 1;
  const digest = await scrypt(normalized, salt, 32, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64url")}$${digest.toString("base64url")}`;
}

export async function verifyAccessCode(code, encoded) {
  const normalized = normalizeAccessCode(code);
  if (!isValidAccessCodeShape(normalized)) return false;
  const [algorithm, nValue, rValue, pValue, saltValue, digestValue] = String(encoded || "").split("$");
  if (algorithm !== "scrypt") return false;
  const N = Number(nValue);
  const r = Number(rValue);
  const p = Number(pValue);
  if (N !== 16_384 || r !== 8 || p !== 1 || !saltValue || !digestValue) return false;
  const expected = Buffer.from(digestValue, "base64url");
  const actual = await scrypt(normalized, Buffer.from(saltValue, "base64url"), expected.length, {
    N,
    r,
    p,
    maxmem: 64 * 1024 * 1024,
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
