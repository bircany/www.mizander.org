import assert from "node:assert/strict";
import { build } from "esbuild";
const state = {
  role: "admin",
  calls: 0,
  assigned: null as string | null,
  status: "video_pending",
  dispatchState: "idle",
  code: "MD-2026-0001",
  codeFailures: 0,
  codeLockedUntil: null as string | null,
  sql: [] as string[],
  detailQueries: [] as Record<string, unknown>[],
  uploadDestinationAvailable: true,
};
(globalThis as unknown as { videoSecurity: typeof state }).videoSecurity =
  state;
const mocks: Record<string, string> = {
  "server-only": "",
  "next/server":
    "export const NextResponse={json:(body,options={})=>Response.json(body,options)};",
  "@/lib/auth/session":
    "export async function getAdminSession(){return {id:1,role:globalThis.videoSecurity.role,email:'test@example.invalid'}}",
  "@/lib/delivery/storage":
    "export function getDeliveryVideoLimits(){return {maxBytes:2147483648,maxSeconds:600}};export function getTusdConfiguration(){if(!globalThis.videoSecurity.uploadDestinationAvailable)throw new Error('missing test upload URL');return {endpoint:'https://test.invalid/uploads'}}",
  "@/lib/delivery/upload-auth":
    "export const DELIVERY_UPLOAD_ALLOWED_MIME=['video/mp4','video/quicktime','video/webm'];export function createDeliveryUploadGrant(){return 'fixture-grant'}",
  "@/lib/database": `export async function withDatabaseTransaction(fn){return fn({query:async(sql)=>{const s=globalThis.videoSecurity;s.calls++;
    s.sql.push(sql);
    if(sql.includes('for update of g'))return {rows:[{groupId:'1',code:s.code,assignedOperatorId:s.assigned,status:s.status,dispatchState:s.dispatchState,operationType:'standard_video',capacity:6,confirmedCount:6,codeFailures:s.codeFailures,codeLockedUntil:s.codeLockedUntil}]};
    if(sql.includes('count(*)'))return {rows:[{count:0}]};
    if(sql.includes('as "expiresAt"'))return {rows:[{expiresAt:new Date(Date.now()+599000)}]};
    if(sql.includes('insert into public.operation_videos'))return {rows:[{id:'11'}]};
    return {rows:[]};}})};`,
};
async function bundle(path: string) {
  const result = await build({
    entryPoints: [path],
    bundle: true,
    write: false,
    platform: "node",
    format: "esm",
    plugins: [
      {
        name: "isolated",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (a) =>
            mocks[a.path] !== undefined
              ? { path: a.path, namespace: "mock" }
              : undefined,
          );
          b.onLoad({ filter: /.*/, namespace: "mock" }, (a) => ({
            contents: mocks[a.path],
            loader: "js",
          }));
        },
      },
    ],
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`
  );
}
const { POST } = await bundle("app/api/delivery/uploads/session/route.ts");
async function request(
  overrides: Record<string, unknown> = {},
  origin = "https://fixture.invalid",
) {
  return POST(
    new Request("https://fixture.invalid/api/delivery/uploads/session", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({
        groupId: 1,
        groupCode: state.code,
        fileName: "test.mp4",
        mimeType: "video/mp4",
        sizeBytes: 1000,
        ...overrides,
      }),
    }),
  );
}
for (const role of ["", "donor", "unknown"]) {
  state.role = role;
  state.calls = 0;
  assert.equal((await request()).status, 403);
  assert.equal(state.calls, 0);
}
for (const role of ["admin", "field_operator"]) {
  state.role = role;
  for (const assigned of [null, "1", "999"]) {
    state.assigned = assigned;
    assert.equal((await request()).status, 200);
  }
}
state.uploadDestinationAvailable = false;
state.calls = 0;
assert.equal((await request()).status, 503);
assert.equal(state.calls, 0, "missing upload service must not reserve a video");
state.uploadDestinationAvailable = true;
assert.ok(
  state.sql.some(
    (sql) =>
      sql.includes("update public.delivery_messages") &&
      sql.includes("status = 'cancelled'"),
  ),
);
state.calls = 0;
assert.equal((await request({}, "https://evil.invalid")).status, 403);
assert.equal(state.calls, 0);
for (const body of [
  { fileName: "test.exe" },
  { sizeBytes: 2147483649 },
  { sizeBytes: 0 },
  { mimeType: "text/html" },
  { groupId: -1 },
  { fileName: "../a.mp4" },
])
  assert.equal((await request(body)).status, 400);
assert.equal(state.calls, 0);
assert.equal((await request({ groupCode: "WRONG" })).status, 400);
state.codeLockedUntil = new Date(Date.now() + 60000).toISOString();
assert.equal((await request()).status, 423);
state.codeLockedUntil = null;
state.dispatchState = "sending";
assert.equal((await request()).status, 409);
state.dispatchState = "idle";
// Existing actual-send endpoint still rejects field operators before external service calls.
const sendMocks = { ...mocks };
mocks["@/lib/delivery/access-api"] =
  "export class DeliveryAccessApiError extends Error{};export async function deliveryVideoApiRequest(){throw new Error('must not call external send')}";
mocks["@/lib/payload"] =
  "export async function getPayloadClient(){throw new Error('must not load payload')}";
const send = await bundle("app/api/delivery/groups/[groupId]/actions/route.ts");
state.role = "field_operator";
for (const action of ["queue", "resume", "cancel"])
  assert.equal(
    (
      await send.POST(
        new Request("https://fixture.invalid/api", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action }),
        }),
        { params: Promise.resolve({ groupId: "1" }) },
      )
    ).status,
    403,
  );
Object.assign(mocks, sendMocks);
mocks["@/lib/payload"] =
  `export async function getPayloadClient(){return {findByID:async(args)=>{globalThis.videoSecurity.detailQueries.push(args);return {id:1,code:'TEST',campaign:{title:'Test'}}},find:async(args)=>{globalThis.videoSecurity.detailQueries.push(args);return {docs:args.collection==='delivery-messages'?[{id:1,body:'PRIVATE_ACCESS_CODE',recipientPhone:'+905551234567',providerMessageId:'PRIVATE_PROVIDER'}]:[]}}}}`;
const detail = await bundle(
  "app/api/delivery/groups/[groupId]/detail/route.ts",
);
const response = await detail.GET(new Request("https://fixture.invalid/api"), {
  params: Promise.resolve({ groupId: "1" }),
});
assert.equal(response.status, 200);
assert.equal(state.detailQueries.length, 4);
assert.ok(state.detailQueries.every((query) => query.select));
assert.ok(
  state.detailQueries.every(
    (query) => !(query.select as Record<string, boolean>).tailUnitPrice,
  ),
);
assert.doesNotMatch(
  JSON.stringify(await response.json()),
  /PRIVATE|905551234567/,
);
state.role = "admin";
assert.match(
  JSON.stringify(
    await (
      await detail.GET(new Request("https://fixture.invalid/api"), {
        params: Promise.resolve({ groupId: "1" }),
      })
    ).json(),
  ),
  /PRIVATE_ACCESS_CODE/,
);
console.log(
  "PASS: real upload route + reservation with isolated DB, both roles assigned/unassigned, denied roles/origin/MIME/size, group-code lock, lifecycle gate; actual-send route denies field operators. No uploads or messages sent.",
);
