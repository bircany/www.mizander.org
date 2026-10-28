import { getPool } from "./db.js";
import { computeGroupMessageFingerprint } from "./message-fingerprint.js";

const senderLockName = "mizan:whatsapp-single-sender:v1";

export async function claimDeliveryMessage(workerId, leaseMinutes, requireTestBeforeDispatch) {
  const client = await getPool().connect();
  try {
    const lock = await client.query("select pg_try_advisory_lock(hashtext($1)) as acquired", [senderLockName]);
    if (!lock.rows[0]?.acquired) {
      client.release();
      return null;
    }
    await client.query("begin");
    const candidate = await client.query(
      `select
         m.*,
         g.code as group_code,
         g.access_code_ciphertext as group_access_code_ciphertext,
         g.access_code_rotation_count as group_access_code_rotation_count,
         g.active_video_id as group_active_video_id,
         g.test_message_video_id as group_test_message_video_id,
         g.test_message_fingerprint as group_test_message_fingerprint,
         g.test_message_passed_at as group_test_message_passed_at,
         g.test_message_invalidated_at as group_test_message_invalidated_at,
         g.dispatch_state as group_dispatch_state
       from delivery_messages m
       join operation_groups g on g.id = m.group_id
       where m.status = 'queued'
         and m.attempt_count < 4
         and not exists (
           select 1 from delivery_messages paced
           where paced.status in ('sent', 'delivered', 'read')
             and paced.is_test = false and paced.locked_at > now()
         )
         and m.provider_message_id is null
         and m.retry_class <> 'ambiguous'
         and coalesce(m.next_retry_at, m.scheduled_at, now()) <= now()
         and (g.dispatch_locked_at is null or g.dispatch_locked_at <= now())
         and (
           (
             m.is_test = true
             and g.dispatch_state not in ('sending')
             and (g.dispatch_pause_reason is null or g.dispatch_pause_reason = 'TEST_MESSAGE_REQUIRED')
           )
           or (
             m.is_test = false
             and g.dispatch_state in ('countdown', 'queued', 'sending')
             and g.dispatch_pause_reason is null
           )
         )
       order by m.is_test desc, coalesce(m.next_retry_at, m.scheduled_at, m.created_at), m.id
       for update of m, g skip locked
       limit 1`,
    );
    const message = candidate.rows[0];
    if (!message) {
      await client.query("commit");
      await client.query("select pg_advisory_unlock(hashtext($1))", [senderLockName]);
      client.release();
      return null;
    }

    if (!message.is_test && requireTestBeforeDispatch && message.system_payload_snapshot?.autoDispatch !== true) {
      const current = await computeGroupMessageFingerprint(client, message.group_id);
      const validTest =
        String(message.group_active_video_id) === String(message.video_id) &&
        String(message.group_test_message_video_id) === String(message.video_id) &&
        Boolean(message.group_test_message_passed_at) &&
        !message.group_test_message_invalidated_at &&
        message.group_test_message_fingerprint === current.fingerprint;
      if (!validTest) {
        await client.query(
          `update operation_groups
           set dispatch_state = 'paused',
               dispatch_pause_reason = 'TEST_MESSAGE_REQUIRED',
               updated_at = now()
           where id = $1`,
          [message.group_id],
        );
        await client.query(
          `update delivery_messages
           set status = 'paused', locked_at = null, locked_by = null, updated_at = now()
           where group_id = $1 and status = 'queued' and is_test = false`,
          [message.group_id],
        );
        await client.query("commit");
        await client.query("select pg_advisory_unlock(hashtext($1))", [senderLockName]);
        client.release();
        return null;
      }
    }

    const updated = await client.query(
      `update delivery_messages
       set status = 'sending',
           locked_at = now(),
           locked_by = $2,
           attempt_count = attempt_count + 1,
           last_attempt_at = now(),
           next_retry_at = null,
           updated_at = now()
       where id = $1
       returning *`,
      [message.id, workerId],
    );
    if (!message.is_test && message.group_dispatch_state === "countdown") {
      await client.query(
        `update operation_groups
         set dispatch_state = 'sending', dispatch_locked_at = now(), dispatch_locked_by = $2, updated_at = now()
         where id = $1`,
        [message.group_id, workerId],
      );
    }
    await client.query("commit");
    return {
      client,
      message: {
        ...message,
        ...updated.rows[0],
      },
      group: {
        id: message.group_id,
        code: message.group_code,
        access_code_ciphertext: message.group_access_code_ciphertext,
        access_code_rotation_count: message.group_access_code_rotation_count,
      },
    };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    await client.query("select pg_advisory_unlock(hashtext($1))", [senderLockName]).catch(() => {});
    client.release();
    throw error;
  }
}

export async function releaseDeliveryClaim(claim) {
  if (!claim?.client) return;
  await claim.client.query("select pg_advisory_unlock(hashtext($1))", [senderLockName]).catch(() => {});
  claim.client.release();
}

export async function markDeliverySent(claim, provider, pace) {
  const client = claim.client;
  await client.query("begin");
  try {
    await client.query(
      `update delivery_messages
       set status = 'sent',
           provider_message_id = $2,
           provider_status = 'sent',
           provider_payload = $3::jsonb,
           retry_class = 'none',
           sent_at = now(),
           locked_at = null,
           locked_by = null,
           last_error = null,
           last_error_code = null,
           updated_at = now()
      where id = $1 and status = 'sending'`,
      [
        claim.message.id,
        provider.providerMessageId,
        JSON.stringify({
          providerMessageId: provider.providerMessageId,
          accepted: true,
        }),
      ],
    );

    const sentCount = await client.query(
      `select count(*)::int as count
       from delivery_messages
       where group_id = $1
         and is_test = false
         and ($2::varchar is null or dispatch_batch_id = $2)
         and status in ('sent', 'delivered', 'read', 'manual_sent')`,
      [claim.message.group_id, claim.message.dispatch_batch_id],
    );
    const count = Number(sentCount.rows[0]?.count || 0);
    const effectiveDelayMs =
      !claim.message.is_test && count > 0 && count % pace.batchSize === 0
        ? pace.batchPauseMs
        : pace.delayMs;

    if (claim.message.is_test) {
      const current = await computeGroupMessageFingerprint(client, claim.message.group_id);
      const requestedById = Number(claim.message.system_payload_snapshot?.testRequestedById);
      if (
        current.fingerprint === claim.message.test_fingerprint &&
        Number.isSafeInteger(requestedById) &&
        requestedById > 0
      ) {
        await client.query(
          `update operation_groups
           set test_message_video_id = $2,
               test_message_fingerprint = $3,
               test_message_passed_at = now(),
               test_message_passed_by_id = $4,
               test_message_invalidated_at = null,
               dispatch_state = case
                 when dispatch_pause_reason = 'TEST_MESSAGE_REQUIRED' then 'idle'::public.enum_operation_groups_dispatch_state
                 else dispatch_state
               end,
               dispatch_pause_reason = case
                 when dispatch_pause_reason = 'TEST_MESSAGE_REQUIRED' then null
                 else dispatch_pause_reason
               end,
               updated_at = now()
           where id = $1`,
          [claim.message.group_id, current.activeVideoId, current.fingerprint, requestedById],
        );
      } else {
        await client.query(
          `update operation_groups
           set test_message_invalidated_at = now(), updated_at = now()
           where id = $1`,
          [claim.message.group_id],
        );
      }
    } else {
      await client.query(
        `update delivery_messages
         set locked_at = now() + ($2::int * interval '1 millisecond')
         where id = $1`,
        [claim.message.id, effectiveDelayMs],
      );
      await client.query(
        `update operation_groups
         set dispatch_state = 'sending',
             dispatch_locked_at = now() + ($2::int * interval '1 millisecond'),
             dispatch_locked_by = $3,
             consecutive_system_failures = 0,
             updated_at = now()
         where id = $1`,
        [claim.message.group_id, effectiveDelayMs, claim.message.locked_by],
      );
    }

    const remaining = await client.query(
      `select count(*)::int as count
       from delivery_messages
       where group_id = $1 and is_test = false
         and status in ('countdown', 'queued', 'paused', 'sending')`,
      [claim.message.group_id],
    );
    if (!claim.message.is_test && Number(remaining.rows[0]?.count || 0) === 0) {
      await client.query(
        `update operation_groups
         set dispatch_state = 'completed', dispatch_locked_at = null, dispatch_locked_by = null, updated_at = now()
         where id = $1`,
        [claim.message.group_id],
      );
    }
    await client.query("commit");
    return { sentCount: count, delayMs: effectiveDelayMs };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

export async function markDeliveryFailed(claim, failure) {
  const client = claim.client;
  const attempts = Number(claim.message.attempt_count);
  const delays = [30, 120, 600];
  const canRetry = failure.kind === "transient" && attempts <= delays.length;
  const delaySeconds = canRetry ? delays[attempts - 1] : null;
  await client.query("begin");
  try {
    await client.query(
      `update delivery_messages
       set status = $2::public.enum_delivery_messages_status,
           retry_class = $3::public.enum_delivery_messages_retry_class,
           next_retry_at = case when $4::int is null then null else now() + ($4::int * interval '1 second') end,
           provider_status = $5,
           provider_payload = $6::jsonb,
           failed_at = case when $2 = 'failed' then now() else failed_at end,
           last_error = $7,
           last_error_code = $8,
           locked_at = null,
           locked_by = null,
           updated_at = now()
       where id = $1 and status = 'sending'`,
      [
        claim.message.id,
        canRetry ? "queued" : "failed",
        failure.kind === "system" ? "transient" : failure.kind,
        delaySeconds,
        failure.providerStatus || failure.kind,
        JSON.stringify({
          kind: failure.kind,
          providerStatus: failure.providerStatus || null,
          errorCode: failure.code,
        }),
        failure.publicMessage.slice(0, 1000),
        failure.code.slice(0, 120),
      ],
    );
    await client.query("commit");
    return { retryScheduled: canRetry, delaySeconds };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

export async function recordProviderHealth(health) {
  const client = await getPool().connect();
  try {
    if (health.healthy) {
      await client.query(
        `update operation_groups
         set provider_healthy_since = coalesce(provider_healthy_since, now()),
             provider_health_check_count = provider_health_check_count + 1,
             updated_at = now()
         where dispatch_state = 'paused'
           and dispatch_pause_reason like 'EVOLUTION_%'`,
      );
    } else {
      await client.query(
        `update operation_groups
         set dispatch_state = 'paused',
             dispatch_pause_reason = 'EVOLUTION_OUTAGE_MANUAL_RESUME_REQUIRED',
             provider_healthy_since = null,
             provider_health_check_count = 0,
             consecutive_system_failures = consecutive_system_failures + 1,
             dispatch_locked_at = null,
             dispatch_locked_by = null,
             updated_at = now()
         where dispatch_state in ('countdown', 'queued', 'sending')
            or (dispatch_state = 'paused' and dispatch_pause_reason like 'EVOLUTION_%')`,
      );
    }
  } finally {
    client.release();
  }
}

export async function pauseAllForSystemFailures() {
  const client = await getPool().connect();
  try {
    await client.query(
      `update operation_groups
       set consecutive_system_failures = consecutive_system_failures + 1,
           dispatch_state = case
             when consecutive_system_failures + 1 >= 5 then 'paused'::public.enum_operation_groups_dispatch_state
             else dispatch_state
           end,
           dispatch_pause_reason = case
             when consecutive_system_failures + 1 >= 5 then 'EVOLUTION_5_SYSTEM_ERRORS_MANUAL_RESUME'
             else dispatch_pause_reason
           end,
           updated_at = now()
       where dispatch_state in ('countdown', 'queued', 'sending', 'paused')`,
    );
  } finally {
    client.release();
  }
}

export async function quarantineStaleSending(leaseMinutes) {
  const client = await getPool().connect();
  try {
    const result = await client.query(
      `update delivery_messages
       set status = 'failed',
           retry_class = 'ambiguous',
           last_error_code = 'STALE_SENDING_PROVIDER_AMBIGUOUS',
           last_error = 'Worker yeniden başladı; sağlayıcı sonucu doğrulanmadan mesaj tekrar gönderilmeyecek.',
           failed_at = now(),
           locked_at = null,
           locked_by = null,
           updated_at = now()
       where status = 'sending'
         and locked_at < now() - ($1::int * interval '1 minute')
         and provider_message_id is null`,
      [leaseMinutes],
    );
    return result.rowCount || 0;
  } finally {
    client.release();
  }
}

export async function claimAmbiguousProviderLookup() {
  const client = await getPool().connect();
  try {
    const result = await client.query(
      `with candidate as (
         select id
         from delivery_messages
         where status = 'failed'
           and retry_class = 'ambiguous'
           and provider_message_id is not null
           and (provider_lookup_at is null or provider_lookup_at <= now() - interval '15 minutes')
         order by coalesce(provider_lookup_at, failed_at), id
         for update skip locked
         limit 1
       )
       update delivery_messages m
       set provider_lookup_at = now(), updated_at = now()
       from candidate
       where m.id = candidate.id
       returning m.id, m.provider_message_id`,
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function recordAmbiguousLookup(messageId, lookup) {
  const client = await getPool().connect();
  try {
    if (lookup.found) {
      await client.query(
        `update delivery_messages
         set status = 'sent',
             retry_class = 'none',
             provider_status = 'recovered_by_lookup',
             provider_payload = $2::jsonb,
             sent_at = coalesce(sent_at, now()),
             last_error = null,
             last_error_code = null,
             updated_at = now()
         where id = $1 and status = 'failed' and retry_class = 'ambiguous'`,
        [
          messageId,
          JSON.stringify({
            checked: true,
            found: true,
            supported: lookup.supported !== false,
          }),
        ],
      );
    } else {
      await client.query(
        `update delivery_messages
         set provider_status = 'ambiguous_not_found_manual_review',
             provider_payload = $2::jsonb,
             updated_at = now()
         where id = $1 and status = 'failed' and retry_class = 'ambiguous'`,
        [
          messageId,
          JSON.stringify({
            checked: true,
            found: false,
            supported: lookup.supported !== false,
          }),
        ],
      );
    }
  } finally {
    client.release();
  }
}
