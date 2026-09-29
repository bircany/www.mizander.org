"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

import type {
  DeliveryAccessAuthorization,
  DeliveryAccessMetadata,
} from "@/lib/delivery/access-api";

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

function remainingLabel(milliseconds: number) {
  if (milliseconds <= 0) return "Erişim süresi sona erdi";
  const days = Math.ceil(milliseconds / DAY);
  const hours = Math.ceil(milliseconds / HOUR);
  const minutes = Math.max(1, Math.ceil(milliseconds / 60_000));
  if (days >= 75 && days <= 90) return "3 ay kaldı";
  if (days >= 45 && days <= 74) return "2 ay kaldı";
  if (days >= 30 && days <= 44) return "1 ay kaldı";
  if (days >= 3 && days <= 29) return `${days} gün kaldı`;
  if (hours > 48) return `${days} gün kaldı`;
  if (hours >= 1) return `${hours} saat kaldı`;
  return `${minutes} dakika kaldı`;
}

export function VideoAccessClient({
  linkToken,
  initialMetadata,
}: {
  linkToken: string;
  initialMetadata: DeliveryAccessMetadata;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [accessCode, setAccessCode] = useState("");
  const [legacyCode, setLegacyCode] = useState(false);
  const [authorization, setAuthorization] =
    useState<DeliveryAccessAuthorization | null>(null);
  const [warningAccepted, setWarningAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [serverNow, setServerNow] = useState(initialMetadata.serverNow);
  const [adjustedNow, setAdjustedNow] = useState(
    Date.parse(initialMetadata.serverNow),
  );
  const expiresAt =
    authorization?.expiresAt || initialMetadata.expiresAt;
  const remaining = Math.max(0, Date.parse(expiresAt) - adjustedNow);
  const expired = remaining <= 0 || !initialMetadata.available;
  const last48Hours = remaining > 0 && remaining <= 48 * HOUR;
  const sensitiveContent =
    authorization?.sensitiveContent ?? initialMetadata.sensitiveContent;
  const accessCodeValid = legacyCode
    ? /^[A-HJ-NP-Z2-9]{8}$/.test(accessCode)
    : /^\d{4}$/.test(accessCode);

  useEffect(() => {
    const offset = Date.parse(serverNow) - Date.now();
    const timer = window.setInterval(
      () => setAdjustedNow(Date.now() + offset),
      30_000,
    );
    return () => window.clearInterval(timer);
  }, [serverNow]);

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || expired) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/delivery/access/${encodeURIComponent(linkToken)}/verify`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ accessCode }),
          cache: "no-store",
        },
      );
      const result = await response.json().catch(() => ({})) as {
        ok?: boolean;
        error?: string;
      } & Partial<DeliveryAccessAuthorization>;
      if (
        !response.ok ||
        !result.ok ||
        !result.streamUrl ||
        !result.downloadUrl ||
        !result.expiresAt ||
        !result.serverNow
      ) {
        throw new Error(result.error || "Erişim kodu doğrulanamadı.");
      }
      setAuthorization({
        streamUrl: result.streamUrl,
        downloadUrl: result.downloadUrl,
        expiresAt: result.expiresAt,
        serverNow: result.serverNow,
        sensitiveContent: result.sensitiveContent === true,
      });
      setServerNow(result.serverNow);
      setAdjustedNow(Date.parse(result.serverNow));
      setAccessCode("");
      setWarningAccepted(result.sensitiveContent !== true);
      formRef.current?.reset();
    } catch (cause) {
      setAuthorization(null);
      setWarningAccepted(false);
      setError(cause instanceof Error ? cause.message : "Erişim kodu doğrulanamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-[#ddd5c3] bg-white shadow-[0_20px_60px_rgba(24,57,47,0.10)]">
      <div className="border-b border-[#e7e0d2] bg-[#18392f] px-6 py-5 text-white sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d7c79c]">
              {initialMetadata.groupCode}
            </p>
            <h2 className="mt-1 text-xl font-bold">{initialMetadata.campaignName}</h2>
          </div>
          <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">
            {remainingLabel(remaining)}
          </span>
        </div>
      </div>

      <div className="p-6 sm:p-8">
        {last48Hours ? (
          <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-950">
            Videonuzu kaybetmemek için şimdi indirin.
          </div>
        ) : null}

        {expired ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
            <h3 className="font-bold text-slate-900">Video erişiminiz sona erdi</h3>
            <p className="mt-2 text-sm text-slate-600">
              Saklama süresi dolduğu için video artık izlenemiyor veya indirilemiyor.
            </p>
          </div>
        ) : !authorization ? (
          <form className="mx-auto max-w-md" onSubmit={verifyCode} ref={formRef}>
            <label className="block text-sm font-bold text-[#18392f]" htmlFor="video-access-code">
              {legacyCode ? "8 karakterli eski erişim kodu" : "4 haneli video PIN'i"}
            </label>
            <input
              autoCapitalize={legacyCode ? "characters" : "none"}
              autoComplete="one-time-code"
              className="mt-2 w-full rounded-2xl border border-[#cfc6b3] bg-white px-4 py-3 text-center font-mono text-xl font-bold uppercase tracking-[0.28em] text-[#18392f] outline-none transition focus:border-[#b38a3e] focus:ring-4 focus:ring-[#b38a3e]/15"
              id="video-access-code"
              inputMode={legacyCode ? "text" : "numeric"}
              maxLength={legacyCode ? 8 : 4}
              onChange={(event) => {
                setAccessCode(
                  legacyCode
                    ? event.target.value
                        .toLocaleUpperCase("en-US")
                        .replace(/[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g, "")
                        .slice(0, 8)
                    : event.target.value.replace(/\D/g, "").slice(0, 4),
                );
                setError("");
              }}
              pattern={legacyCode ? "[A-HJ-NP-Z2-9]{8}" : "[0-9]{4}"}
              placeholder={legacyCode ? "ABCD2345" : "0000"}
              required
              type="text"
              value={accessCode}
            />
            <button
              className="mt-4 w-full rounded-2xl bg-[#b38a3e] px-5 py-3 font-bold text-white transition hover:bg-[#987332] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy || !accessCodeValid}
              type="submit"
            >
              {busy ? "Doğrulanıyor…" : "Videoya eriş"}
            </button>
            {error ? (
              <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">
                {error}
              </p>
            ) : null}
            <button
              className="mt-4 w-full text-center text-xs font-semibold text-[#765922] underline underline-offset-4"
              onClick={() => {
                setLegacyCode((current) => !current);
                setAccessCode("");
                setError("");
              }}
              type="button"
            >
              {legacyCode ? "4 haneli PIN kullan" : "Eski 8 karakterli kodum var"}
            </button>
            <p className="mt-4 text-center text-xs leading-5 text-slate-500">
              Beş yanlış denemede erişim 15 dakika geçici olarak engellenir.
            </p>
          </form>
        ) : sensitiveContent && !warningAccepted ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-950">
            <div className="flex items-center gap-3">
              <Image
                alt=""
                aria-hidden="true"
                className="size-12 rounded-full bg-white object-contain p-1"
                height={48}
                src="/mizan-logo.png"
                width={48}
              />
              <h3 className="text-lg font-bold">Hassas içerik uyarısı</h3>
            </div>
            <p className="mt-4 text-sm leading-6">
              Bu video kurban kesimine ait görüntüler içermektedir. Görüntüler
              bazı izleyiciler için rahatsız edici olabilir.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                className="rounded-xl bg-[#18392f] px-5 py-3 text-sm font-bold text-white"
                onClick={() => setWarningAccepted(true)}
                type="button"
              >
                İzlemeye devam et
              </button>
              <a
                className="rounded-xl border border-amber-400 bg-white px-5 py-3 text-center text-sm font-bold text-amber-950"
                href={authorization.downloadUrl}
                rel="noopener noreferrer"
              >
                Videoyu izlemeden indir
              </a>
            </div>
          </div>
        ) : (
          <div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#132a24]">
              <video
                autoPlay={false}
                className="aspect-video w-full bg-[#132a24] object-contain"
                controls
                playsInline
                poster="/mizan-logo.png"
                preload="metadata"
                src={authorization.streamUrl}
              >
                Tarayıcınız video oynatmayı desteklemiyor.
              </video>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Otomatik oynatma kapalıdır. Video yalnızca siz başlattığınızda oynar.
              </p>
              <a
                className="rounded-xl border border-[#b38a3e] px-4 py-2 text-sm font-bold text-[#765922]"
                href={authorization.downloadUrl}
                rel="noopener noreferrer"
              >
                Videoyu indir
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
