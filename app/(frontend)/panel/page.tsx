import Link from "next/link";

import { ManagementShell } from "@/components/admin/management-shell";
import {
  EmptyPanelState,
  PanelCard,
  PanelMetric,
  PanelPageHeader,
  StatusBadge,
} from "@/components/admin/panel-ui";
import { getUnifiedDeliveryPanelData, getUnifiedDonationPanelData } from "@/lib/admin/unified-panel-data";
import { requireAdminUser } from "@/lib/admin/data";
import { PANEL_ROUTE_ACCESS } from "@/lib/auth/panel-access";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PanelDashboardPage() {
  const user = await requireAdminUser(PANEL_ROUTE_ACCESS.dashboard);
  const [donationData, deliveryRows] = await Promise.all([
    user.role === "admin"
      ? getUnifiedDonationPanelData()
      : Promise.resolve({ campaigns: [], donations: [], efts: [] }),
    getUnifiedDeliveryPanelData(),
  ]);

  const failedMessages = deliveryRows.filter(
    (row) => row.status === "failed",
  );
  const draftMessages = deliveryRows.filter(
    (row) => row.status === "draft",
  );
  const waitingVideos = deliveryRows.filter(
    (row) =>
      row.videoStatus === "waiting" ||
      row.videoStatus === "pending" ||
      row.status === "video_pending",
  );

  return (
    <ManagementShell
      currentPath="/panel"
      name={user.name || user.email}
      role={user.role}
    >
      <div className="space-y-6">
        <PanelPageHeader
          description="Bugün işlem bekleyen kayıtları tek ekrandan takip edin."
          eyebrow="Genel bakış"
          title="Bekleyen İşler"
        />

        {user.role === "admin" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <PanelMetric
                detail="Dekont incelemesi gereken işlemler"
                label="EFT bekleyen"
                tone="warning"
                value={String(donationData.efts.length)}
              />
              <PanelMetric
                detail="Yayında olan bağış kampanyaları"
                label="Aktif kampanya"
                value={String(
                  donationData.campaigns.filter(
                    (campaign) => campaign.status === "active",
                  ).length,
                )}
              />
              <PanelMetric
                detail="Kesinleşmiş bağış kayıtları"
                label="Bağışlar"
                value={String(donationData.donations.length)}
              />
              <PanelMetric
                detail="Tekrar denenmesi gereken mesajlar"
                label="Hatalı mesaj"
                tone="warning"
                value={String(failedMessages.length)}
              />
            </div>

            <PanelCard>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="admin-eyebrow">Son kayıtlar</p>
                  <h2 className="mt-1 text-base font-semibold">
                    Bağış hareketleri
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    className="text-sm font-semibold text-[var(--admin-primary)]"
                    href="/panel/bagislar"
                  >
                    Bağış Dashboard
                  </Link>
                  <span className="text-[var(--admin-border)]">·</span>
                  <Link
                    className="text-sm font-semibold text-[var(--admin-muted)] hover:text-[var(--admin-text)]"
                    href="/panel/bagis-yonetimi?tab=donations"
                  >
                    Tümünü aç
                  </Link>
                </div>
              </div>
              <div className="mt-4 divide-y divide-[var(--admin-border)]">
                {donationData.donations.length ? (
                  donationData.donations.slice(0, 5).map((donation) => (
                    <div
                      className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
                      key={donation.id}
                    >
                      <div>
                        <p className="text-sm font-semibold">
                          {donation.donorName}
                        </p>
                        <p className="mt-1 text-xs text-[var(--admin-muted)]">
                          {donation.campaign}
                        </p>
                      </div>
                      <StatusBadge status={donation.status} />
                      <p className="font-mono text-sm font-semibold">
                        {formatCurrency(donation.amount, donation.currency)}
                      </p>
                    </div>
                  ))
                ) : (
                  <EmptyPanelState
                    description="İlk bağış kesinleştiğinde burada görünecek."
                    title="Henüz bağış kaydı yok"
                  />
                )}
              </div>
            </PanelCard>
          </>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <PanelMetric
              detail="Video yüklenmesi gereken gruplar"
              label="Video bekleyen"
              tone="warning"
              value={String(waitingVideos.length)}
            />
            <PanelMetric
              detail="Kontrol edilip gönderilecek mesajlar"
              label="Taslak mesaj"
              value={String(draftMessages.length)}
            />
            <PanelMetric
              detail="Tekrar kuyruğa alınması gerekenler"
              label="Hatalı mesaj"
              tone="warning"
              value={String(failedMessages.length)}
            />
          </div>
        )}

        <PanelCard>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="admin-eyebrow">Video teslimat</p>
              <h2 className="mt-1 text-base font-semibold">
                Öncelikli operasyonlar
              </h2>
            </div>
            <Link
              className="text-sm font-semibold text-[var(--admin-primary)]"
              href="/panel/video-teslimat"
            >
              Kuyruğu aç
            </Link>
          </div>
          <div className="mt-4 divide-y divide-[var(--admin-border)]">
            {deliveryRows.length ? (
              deliveryRows.slice(0, 5).map((row) => (
                <div
                  className="grid gap-3 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
                  key={row.id}
                >
                  <p className="font-mono text-xs font-semibold">
                    {row.groupCode}
                  </p>
                  <div>
                    <p className="text-sm font-semibold">{row.campaign}</p>
                    <p className="mt-1 text-xs text-[var(--admin-muted)]">
                      {row.recipient}
                    </p>
                  </div>
                  <StatusBadge status={row.status} />
                </div>
              ))
            ) : (
              <EmptyPanelState
                description="Videolu bağış grubu oluştuğunda burada görünecek."
                title="Bekleyen operasyon yok"
              />
            )}
          </div>
        </PanelCard>
      </div>
    </ManagementShell>
  );
}
