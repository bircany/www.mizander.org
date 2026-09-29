# Mizan video platform

This package is the VDS-side foundation for resumable uploads, video processing,
protected playback, retention, and durable Evolution WhatsApp delivery. It is a
plain Node.js ESM package. It does not import the Next.js or Payload runtime.

Production is deliberately blocked until all of the following are true:

- `20260728123605_video_operations_hardening.sql` is applied and verified.
- A real end-to-end upload/FFmpeg/playback/message run succeeds on the VDS.
- The installed Evolution version's lookup endpoint is verified.
- Daily encrypted off-site backup and restore testing exists.
- The KVKK/legal consent text has been reviewed.

No deployment is performed by this directory.

## Processes

- `video-api`: tusd hooks, signed Next-to-VDS access requests, protected Range
  delivery, access-material initialization/rotation, and safe test recipient
  endpoints.
- `video-worker`: one global FFmpeg process using a PostgreSQL advisory lock.
- `message-worker`: one global Evolution sender using `FOR UPDATE SKIP LOCKED`
  and a PostgreSQL advisory lock.
- `retention-worker`: 24-hour partial/quarantine cleanup, 3-day raw cleanup,
  7-day replacement/expired grace, 45-day unsent review, three-month expiry,
  PII redaction, and disk warnings/blocks.
- `tusd:v2.8.0`: configured in `deploy/video/compose.yaml`; browsers upload
  directly to it without passing video bytes through Vercel.

## Upload contract

The web backend signs a compact Ed25519 JWT with:

```json
{
  "iss": "mizan-web",
  "aud": "mizan-video-upload",
  "sub": "42",
  "role": "field_operator",
  "groupId": "17",
  "videoId": "99",
  "jti": "opaque-unique-id",
  "nonce": "opaque-single-use-nonce",
  "maxBytes": 2147483648,
  "allowedMime": ["video/mp4", "video/quicktime", "video/webm"],
  "iat": 1785250000,
  "exp": 1785250600
}
```

Header requirements are `alg=EdDSA`, `typ=JWT`, and the configured `kid`.
Lifetime is at most 600 seconds. tus metadata is exactly:

```json
{
  "token": "<compact JWT>",
  "filename": "source.mov",
  "filetype": "video/quicktime"
}
```

The `pre-create` hook validates the signature, size, MIME claim, group state,
two-slot global upload cap, and atomically consumes `jti + sha256(nonce)`.
The response replaces tus metadata with trusted IDs and removes the token.
`post-finish` never revalidates the now-expired JWT; it trusts only the internal
hook secret, tus upload ID, consumed database mapping, exact size, and a
canonical path inside the upload volume.

## Internal request signature

Next-to-VDS endpoints require:

```text
x-mizan-timestamp: <Unix seconds>
x-mizan-signature: v1=<hex HMAC-SHA256>
```

The signed bytes are:

```text
<exact timestamp>.<exact raw HTTP body>
```

The replay window is five minutes. For a GET request, the body is empty. The
viewer IP is read from `x-mizan-client-ip` only after this signature passes.
The internal secret must be independent from upload, media, and Evolution
secrets.

Endpoints:

- `GET /healthz`
- `GET /readyz`
- `POST /internal/tusd/hooks` (Docker-internal; tus hook secret)
- `GET /v1/groups/:linkToken` (signed Next proxy)
- `POST /v1/access/verify` (signed Next proxy)
- `GET|HEAD /v1/media/:videoId?authorization=...&disposition=inline|attachment`
- `GET /v1/internal/test-recipients` (signed; returns only key and label)
- `POST /v1/internal/test-messages` (signed)
- `POST /v1/internal/groups/:groupId/access-materials` (signed)
- `POST /v1/internal/groups/:groupId/access-code/rotate` (signed)

The access verification response contains five-minute, purpose-bound stream
and download URLs. Media delivery rechecks active video, expiry, group, and
access-code rotation against PostgreSQL. It supports one HTTP byte range and
sets `Content-Disposition` for downloads. Storage paths are never returned.

## Access material model

`PUBLIC_LINK_TOKEN_SECRET` derives the stable public token:

```text
base64url(HMAC-SHA256(secret, "mizan-group-link:v1:" + groupId))
```

Only its SHA-256 hash is stored. New access credentials are four-digit numeric
PINs, verified with scrypt and encrypted with AES-256-GCM for VDS-only message
rendering. Previously issued eight-character codes remain valid so existing
deliveries are not broken. The initialization and rotation endpoints never
return either plaintext value.

Five wrong code attempts inside 15 minutes block the IP+link pair through the
existing `consume_api_rate_limit` database function. Rotation increments the
version, invalidates the prior group-wide code and test fingerprint, and is
rejected while dispatch is running.

`DELIVERY_WEB_BASE_URL` is the public Next.js site origin used for links sent
to recipients (for example, `https://www.mizander.com.tr`). It is deliberately
separate from `VIDEO_PUBLIC_BASE_URL`, which remains the VDS API/media origin.

## Message snapshot contract

Editable text is stored only in `body_snapshot`. Immutable values are:

```json
{
  "message_snapshot": {
    "schemaVersion": 1,
    "recipientNames": ["Ayşe Yılmaz", "Mehmet Yılmaz"],
    "campaignName": "2026 Kurban"
  },
  "system_payload_snapshot": {
    "schemaVersion": 1,
    "groupId": 17,
    "videoId": 99,
    "messageType": "normal"
  }
}
```

The worker ignores any client-supplied link, group code, or access code. It
loads the group code, derives the stable link, decrypts the current code on the
VDS, and renders the final body. Normalized duplicate phones are expected to
have already been merged into one draft with all names in `recipientNames`.

Test messages accept only a key from `DELIVERY_SAFE_TEST_NUMBERS_JSON`; phone
numbers are neither returned by the API nor written into test message rows.
The test fingerprint covers active video ID/version/checksum, access-code
rotation, and every non-test draft's immutable snapshots in ID order. A
successful test atomically writes the fingerprint to the group. Normal claim
recomputes it and pauses dispatch if it differs only when
`REQUIRE_DELIVERY_TEST=true`. The default `false` keeps test delivery optional.

Normal dispatch starts with `scheduled_at = now() + 5 seconds`. A claim accepts
`countdown`, changes it to `sending` in the same short transaction, and never
holds a row lock during Evolution HTTP calls. Sending is sequential, waits a
random 5–9 seconds, and pauses 120 seconds after each 50 messages.

Transient retry delays are 30 seconds, 2 minutes, and 10 minutes. Permanent
number errors do not retry. Network/provider ambiguity is marked
`retry_class=ambiguous` and is never blindly requeued. If
`EVOLUTION_LOOKUP_PATH` has been verified for the installed Evolution version,
provider IDs are queried before resolution; without a provider ID the row
requires manual review.

An Evolution outage permanently pauses active groups. Health monitoring records
healthy-since and check count, but never resumes automatically. The panel must
require two successful checks and at least 60 stable seconds before manual
resume. Five consecutive system failures pause all active dispatches.

## Video processing

The worker validates the real container, codec, stream count, duration,
dimensions, and size with ffprobe. Accepted containers are MP4, MOV, and WebM;
the exact source MIME must match the upload claim. It computes raw and processed
SHA-256 checksums.

Output is MP4/H.264/AAC with `+faststart`, CRF 23, loudness normalization,
maximum 1080p, preserved ratio, and no source upscaling. The Mizan logo and
group code stay visible. A separate three-second orientation-matched closing
card is concatenated. If output is needlessly larger than the raw source, CRF
26/slow is attempted. Settings and content snapshots are stored per video.

Success enters `review_pending`; a human review must promote it to `ready`.
The worker never claims content correctness. FFmpeg gets one automatic retry.
Technical validation failures and second processing failures move the raw file
to 24-hour quarantine. Full bounded FFmpeg logs are stored for admin access;
operators receive a short Turkish error.

## Local checks

From the repository root:

```powershell
node services/video-platform/scripts/check-syntax.js
npm.cmd test --prefix services/video-platform
docker compose --env-file deploy/video/.env.example -f deploy/video/compose.yaml config
```

The example environment intentionally contains invalid credentials and must
not be used to start the stack.
