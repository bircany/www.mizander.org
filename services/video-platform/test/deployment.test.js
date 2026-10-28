import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const composeUrl = new URL("../../../deploy/video/compose.yaml", import.meta.url);
const videoRepositoryUrl = new URL("../src/video-repository.js", import.meta.url);
const messageRepositoryUrl = new URL("../src/message-repository.js", import.meta.url);
const accessServiceUrl = new URL("../src/access-service.js", import.meta.url);
const deliveryControlServiceUrl = new URL("../src/delivery-control-service.js", import.meta.url);
const retentionUrl = new URL("../src/retention.js", import.meta.url);

test("tusd CORS rule survives Coolify Compose deployment", async () => {
  const compose = await readFile(composeUrl, "utf8");

  assert.match(
    compose,
    /-cors-allow-origin=https:\/\/\(www\[\.\]\)\?mizander\[\.\]\(org\|com\[\.\]tr\)/,
  );
  assert.doesNotMatch(compose, /TUSD_CORS_ALLOW_ORIGIN/);
});

test("video worker has a second database connection for repository updates", async () => {
  const compose = await readFile(composeUrl, "utf8");
  const worker = compose.match(/  video-worker:\r?\n([\s\S]*?)\r?\n  message-worker:/)?.[1];

  assert.ok(worker, "video-worker service must exist");
  assert.match(worker, /DATABASE_POOL_MAX:\s*"2"/);
});

test("message worker has a second database connection for access-code upgrades", async () => {
  const compose = await readFile(composeUrl, "utf8");
  const worker = compose.match(/  message-worker:\r?\n([\s\S]*?)\r?\n  retention-worker:/)?.[1];

  assert.ok(worker, "message-worker service must exist");
  assert.match(worker, /DATABASE_POOL_MAX:\s*"2"/);
});

test("video failure metadata casts variadic JSON parameters explicitly", async () => {
  const repository = await readFile(videoRepositoryUrl, "utf8");

  assert.match(repository, /'lastFailureCode', \$7::text/);
  assert.match(repository, /last_error_code = \$7::text/);
});

test("message worker enforces test delivery only when policy requires it", async () => {
  const repository = await readFile(messageRepositoryUrl, "utf8");

  assert.match(repository, /if \(!message\.is_test && requireTestBeforeDispatch && message\.system_payload_snapshot\?\.autoDispatch !== true\)/);
});

test("message worker skips messages that have exhausted the database retry budget", async () => {
  const repository = await readFile(messageRepositoryUrl, "utf8");

  assert.match(repository, /where m\.status = 'queued'\s+and m\.attempt_count < 4/);
});

test("delivery access falls back to the active video expiry for legacy groups", async () => {
  const accessSource = await readFile(accessServiceUrl, "utf8");
  const controlSource = await readFile(deliveryControlServiceUrl, "utf8");

  assert.match(accessSource, /coalesce\(g\.expires_at, v\.expires_at\) as expires_at/);
  assert.match(accessSource, /coalesce\(g\.expires_at, v\.expires_at\) > now\(\)/);
  assert.match(controlSource, /expires_at = coalesce\(\$3::timestamptz, now\(\) \+ interval '3 months'\)/);
});

test("rejected videos are recoverable and cannot be dispatched", async () => {
  const control = await readFile(deliveryControlServiceUrl, "utf8");
  const retention = await readFile(retentionUrl, "utf8");

  assert.match(control, /last_error_code = 'CONTENT_REJECTED'/);
  assert.match(control, /group\.active_video_status !== "ready"/);
  assert.match(control, /group\.active_video_review_status !== "approved"/);
  assert.match(retention, /export async function deleteRejectedFiles/);
  assert.match(retention, /status = 'rejected'[\s\S]*interval '7 days'/);
  assert.match(retention, /rejectedDeleted: await deleteRejectedFiles/);
});

test("admin cleanup is executed by the writable retention worker", async () => {
  const compose = await readFile(composeUrl, "utf8");
  const inventory = await readFile(new URL("../src/video-inventory.js", import.meta.url), "utf8");
  const retention = await readFile(retentionUrl, "utf8");
  const api = compose.match(/  video-api:\r?\n([\s\S]*?)\r?\n  tusd:/)?.[1];
  const retentionWorker = compose.match(/  retention-worker:\r?\n([\s\S]*?)\r?\nvolumes:/)?.[1];

  assert.match(api, /video_ready:\/var\/lib\/mizan\/ready:ro/);
  assert.match(retentionWorker, /video_ready:\/var\/lib\/mizan\/ready/);
  assert.doesNotMatch(inventory, /unlink|removeStoredFile/);
  assert.match(inventory, /adminCleanupRequestedAt/);
  assert.match(retention, /export async function deleteAdminRequestedFiles/);
  assert.match(retention, /adminRequestedDeleted: await deleteAdminRequestedFiles/);
});
