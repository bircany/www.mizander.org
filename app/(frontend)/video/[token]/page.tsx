import type { Metadata } from "next";

import {
  DeliveryAccessApiError,
  getDeliveryAccessMetadata,
  normalizeDeliveryLinkToken,
} from "@/lib/delivery/access-api";

import { VideoAccessClient } from "./video-access-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bağış Videonuz | Mizan Derneği",
  description: "Mizan Derneği bağış operasyonu video teslimat ekranı.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function VideoAccessPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const normalizedToken = normalizeDeliveryLinkToken(token);
  let metadata = null;
  let error = "";
  if (!normalizedToken) {
    error = "Video bağlantısı geçersiz.";
  } else {
    try {
      metadata = await getDeliveryAccessMetadata(normalizedToken);
    } catch (cause) {
      error = cause instanceof DeliveryAccessApiError && cause.status === 404
        ? cause.message
        : "Video servisine şu anda ulaşılamıyor. Lütfen biraz sonra yeniden deneyin.";
    }
  }

  return (
    <main className="min-h-[75vh] bg-[#f5f2e9] px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <header className="mb-7 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8a6a2f]">
            Güvenli video teslimatı
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#18392f] sm:text-4xl">
            Mizan Derneği bağış videonuz
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#53645e]">
            Video herkese açık değildir. Mesajınızda iletilen 4 haneli PIN&apos;i
            kullanın. Daha önce gönderilen 8 karakterli kodlar da geçerlidir.
          </p>
        </header>

        {metadata && normalizedToken ? (
          <VideoAccessClient
            initialMetadata={metadata}
            linkToken={normalizedToken}
          />
        ) : (
          <section
            className="rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm"
            role="alert"
          >
            <h2 className="text-lg font-bold text-red-900">Video açılamadı</h2>
            <p className="mt-2 text-sm leading-6 text-red-800">{error}</p>
          </section>
        )}
      </div>
    </main>
  );
}
