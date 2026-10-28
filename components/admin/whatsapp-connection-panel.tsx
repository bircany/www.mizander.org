"use client";

import Image from "next/image";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  LoaderCircle,
  LogOut,
  MessageCircle,
  QrCode,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { StatusBadge } from "@/components/admin/panel-ui";
import {
  manageWhatsAppConnection,
  type WhatsAppActionState,
} from "@/lib/admin/whatsapp-actions";
import type {
  EvolutionConnectionStatus,
  EvolutionWebhookStatus,
} from "@/lib/qurbani/evolution";

function SubmitButton({
  children,
  danger = false,
}: {
  children: React.ReactNode;
  danger?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={danger ? "admin-danger-button" : "admin-action-button"}
      disabled={pending}
      type="submit"
    >
      {pending ? (
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      ) : null}
      {children}
    </button>
  );
}

export function WhatsAppConnectionPanel({
  initialStatus,
  initialWebhook,
}: {
  initialStatus: EvolutionConnectionStatus;
  initialWebhook: EvolutionWebhookStatus;
}) {
  const initialState: WhatsAppActionState = {
    success:
      initialStatus.state !== "error" && initialStatus.state !== "unconfigured",
    message: null,
    status: initialStatus,
    webhook: initialWebhook,
  };
  const [actionState, action] = useActionState(
    manageWhatsAppConnection,
    initialState,
  );
  const [live, setLive] = useState<{
    status: EvolutionConnectionStatus;
    webhook: EvolutionWebhookStatus;
    sourceHost: string;
    checkedAt: string;
  } | null>(null);
  const [pollError, setPollError] = useState(false);

  useEffect(() => {
    let active = true;
    let request: AbortController | null = null;
    const poll = async () => {
      if (!active || document.visibilityState !== "visible" || request) return;
      request = new AbortController();
      try {
        const response = await fetch("/api/admin/whatsapp/status", {
          cache: "no-store",
          credentials: "same-origin",
          signal: request.signal,
        });
        if (!response.ok) throw new Error("Canlı durum alınamadı.");
        const result = (await response.json()) as {
          status: EvolutionConnectionStatus;
          webhook: EvolutionWebhookStatus;
          sourceHost: string;
          checkedAt: string;
        };
        if (!active) return;
        setLive(result);
        setPollError(false);
      } catch {
        if (active && !request?.signal.aborted) setPollError(true);
      } finally {
        request = null;
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 5_000);
    const onVisible = () => { if (document.visibilityState === "visible") void poll(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      request?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const actionTime = actionState.updatedAt ? Date.parse(actionState.updatedAt) : 0;
  const pollTime = live ? Date.parse(live.checkedAt) : 0;
  const actionIsNewest = actionTime > pollTime;
  const latestStatus = actionIsNewest ? actionState.status || initialStatus : live?.status || initialStatus;
  const recentQr =
    actionTime > 0 &&
    (pollTime === 0 || pollTime - actionTime < 60_000) &&
    latestStatus.state !== "connected" &&
    (actionState.status?.qrCodeDataUrl || actionState.status?.pairingCode);
  const status: EvolutionConnectionStatus = pollError
    ? { ...latestStatus, state: "error", message: "Canlı bağlantı durumu şu anda doğrulanamadı." }
    : recentQr
      ? {
          ...latestStatus,
          state: latestStatus.state === "disconnected" ? "connecting" : latestStatus.state,
          qrCodeDataUrl: actionState.status?.qrCodeDataUrl,
          pairingCode: actionState.status?.pairingCode,
          message: actionState.status?.message,
        }
      : latestStatus;
  const connected = status.state === "connected";
  const webhook = actionIsNewest ? actionState.webhook || initialWebhook : live?.webhook || initialWebhook;
  const actionError = actionIsNewest && !actionState.success ? actionState.message : null;

  return (
    <div className="space-y-5">
      <section className="admin-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-xl bg-[#25d366]/10 text-[#178c46]">
              <MessageCircle aria-hidden="true" className="size-7" />
            </span>
            <div>
              <p className="admin-eyebrow">Video mesajları</p>
              <h3 className="mt-1 text-lg font-semibold">
                Kurumsal WhatsApp bağlantısı
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={status.state} />
            <span className="text-xs font-medium text-[var(--admin-muted)]">
              {live?.checkedAt
                ? `Son kontrol: ${new Date(live.checkedAt).toLocaleTimeString("tr-TR")}`
                : "Canlı durum yükleniyor"}
            </span>
          </div>
        </div>

        <p className="mt-5 text-sm">
          {connected
            ? `Bağlı telefon: ${status.phone || "Numara alınamadı"}`
            : status.state === "error"
              ? "Bağlantı durumu doğrulanamadı. Birkaç saniye içinde yeniden denenecek."
              : "Bağlamak için QR kodu oluşturun ve telefonunuzdan okutun."}
        </p>
        {connected && !webhook.configured ? (
          <p className="mt-3 text-sm text-amber-700" role="alert">
            Teslimat bildirimleri henüz bağlı değil. Gelişmiş ayarlardan webhook&apos;u kurun.
          </p>
        ) : null}

        <details className="mt-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <summary className="cursor-pointer text-sm font-semibold">Gelişmiş bağlantı ayarları</summary>
          <p className="mt-3 text-xs text-[var(--admin-muted)]">Bağlantı kimliği: {status.instanceName}</p>
          {live?.sourceHost ? <p className="mt-1 text-xs text-[var(--admin-muted)]">Durum kaynağı: {live.sourceHost}</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Teslimat webhook&apos;u</p>
              <p className="mt-1 break-all text-xs text-[var(--admin-muted)]">
                {webhook.url}
              </p>
              <p className="mt-1 text-xs text-[var(--admin-muted)]">
                {webhook.message}
              </p>
            </div>
            <StatusBadge status={webhook.configured ? "success" : "failed"} />
          </div>
          <p className="mt-3 text-xs text-[var(--admin-muted)]">
            {webhook.events.join(" · ")}
          </p>
          <form action={action} className="mt-3">
            <input name="intent" type="hidden" value="webhook" />
            <SubmitButton>
              <ShieldCheck aria-hidden="true" className="size-4" />
              Webhook&apos;u kur ve doğrula
            </SubmitButton>
          </form>
        </details>

        {actionError || status.message ? (
          <p
            className={`mt-4 text-sm ${actionError ? "text-[var(--admin-danger)]" : "text-[var(--admin-muted)]"}`}
            role="status"
          >
            {actionError || status.message}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          {!connected ? (
            <form action={action}>
              <input name="intent" type="hidden" value="connect" />
              <SubmitButton>
                <QrCode aria-hidden="true" className="size-4" />
                QR kodu oluştur
              </SubmitButton>
            </form>
          ) : null}
          <form action={action}>
            <input name="intent" type="hidden" value="status" />
            <SubmitButton>
              <RefreshCw aria-hidden="true" className="size-4" />
              Durumu yenile
            </SubmitButton>
          </form>
        </div>
        {connected ? (
          <details className="mt-5 text-sm">
            <summary className="cursor-pointer text-[var(--admin-muted)]">Bağlantıyı kapat</summary>
            <p className="my-3 text-xs text-[var(--admin-muted)]">
              Bağlantı kesilirse video mesajları gönderilemez.
            </p>
            <form action={action}>
              <input name="confirm" type="hidden" value="disconnect" />
              <input name="intent" type="hidden" value="disconnect" />
              <SubmitButton danger>
                <LogOut aria-hidden="true" className="size-4" />
                Bağlantıyı kapat
              </SubmitButton>
            </form>
          </details>
        ) : null}
      </section>

      {!connected ? <section className="admin-card">
        <div className="flex items-center gap-2">
          <QrCode
            aria-hidden="true"
            className="size-5 text-[var(--admin-primary)]"
          />
          <h3 className="font-semibold">WhatsApp cihaz eşleştirme</h3>
        </div>
        {status.qrCodeDataUrl ? (
          <>
            <div className="mt-4 rounded-xl bg-white p-4">
              <Image
                alt="WhatsApp bağlantı QR kodu"
                className="mx-auto size-72 max-w-full"
                height={288}
                src={status.qrCodeDataUrl}
                unoptimized
                width={288}
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-[var(--admin-muted)]">
              WhatsApp uygulamasında Ayarlar → Bağlı cihazlar → Cihaz bağla
              yolunu açıp kodu tarayın. Sonra “Durumu yenile” düğmesine basın.
            </p>
          </>
        ) : status.pairingCode ? (
          <div className="mt-5 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 text-center">
            <p className="text-xs text-[var(--admin-muted)]">Eşleştirme kodu</p>
            <p className="mt-2 break-all font-mono text-2xl font-semibold tracking-[0.12em]">
              {status.pairingCode}
            </p>
          </div>
        ) : (
          <div className="mt-4 grid min-h-72 place-items-center rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 text-center">
            <div>
              <QrCode
                aria-hidden="true"
                className="mx-auto size-8 text-[var(--admin-muted)]"
              />
              <p className="mt-3 text-sm font-semibold">
                {connected ? "Hesap bağlı" : "QR kodu bekleniyor"}
              </p>
              <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-[var(--admin-muted)]">
                {connected
                  ? "Bağlı hesap için QR kodu gösterilmez."
                  : "Sunucu ayarları tamamsa QR kodu oluştur düğmesi bağlantıyı başlatır."}
              </p>
            </div>
          </div>
        )}
      </section> : null}
    </div>
  );
}
