"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";

import {
  type CampaignEditorRecord,
  UnifiedCampaignEditor,
} from "@/components/admin/unified-campaign-editor";
import { EmptyPanelState, PanelCard, StatusBadge } from "@/components/admin/panel-ui";
import { EftReviewActions } from "@/components/admin/eft-review-actions";
import { PanelSectionTabs } from "@/components/admin/panel-section-tabs";
import type {
  UnifiedCampaignRow,
  UnifiedDonationRow,
  UnifiedEftRow,
} from "@/lib/admin/unified-panel-data";
import { formatCurrency } from "@/lib/utils";
import { ChildDonationSettingsCard } from "@/components/admin/child-donation-settings-card";
import { ManualDonationForm } from "@/components/admin/manual-donation-form";
import { ManualDonationProof } from "@/components/admin/manual-donation-proof";

type DonationTab = "campaigns" | "archive" | "donations" | "eft";

export function UnifiedDonationManagement({
  campaigns,
  donations,
  efts,
  query,
  tab,
  editorData,
}: {
  campaigns: UnifiedCampaignRow[];
  donations: UnifiedDonationRow[];
  efts: UnifiedEftRow[];
  query: string;
  tab: DonationTab;
  editorData: {
    categoryOptions: Array<{ label: string; value: string }>;
    mediaOptions: Array<{ label: string; value: string }>;
    records: CampaignEditorRecord[];
    childDonation: { campaign: string; usdCampaign: string; eurCampaign: string; foodPrice: number; stationeryPrice: number; toyPrice: number; clothingPrice: number; foodUsdPrice: number; stationeryUsdPrice: number; toyUsdPrice: number; clothingUsdPrice: number; foodEurPrice: number; stationeryEurPrice: number; toyEurPrice: number; clothingEurPrice: number } | null;
  };
}) {
  const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
  const includesQuery = (...values: string[]) => !normalizedQuery || values.some((value) => value.toLocaleLowerCase("tr-TR").includes(normalizedQuery));
  const standardCampaigns = campaigns.filter((item) => !item.title.startsWith("Ahmet'e Destek ("));
  const currentCampaigns = standardCampaigns.filter((item) => item.status !== "archived");
  const archivedCampaigns = standardCampaigns.filter((item) => item.status === "archived");
  const filteredCampaigns = currentCampaigns.filter((item) => includesQuery(item.title, item.currency, item.status));
  const filteredArchivedCampaigns = archivedCampaigns.filter((item) => includesQuery(item.title, item.currency, item.status));
  const filteredDonations = donations.filter((item) => includesQuery(item.donorName, item.campaign, item.receipt, item.status, item.note));
  const filteredEfts = efts.filter((item) => includesQuery(item.donorName, item.reference, item.status));
  const tabs = [
    { id: "campaigns", label: "Kampanyalar", count: currentCampaigns.length + 1 },
    { id: "archive", label: "Arşiv", count: archivedCampaigns.length },
    { id: "donations", label: "Bağış Kayıtları", count: donations.length },
    { id: "eft", label: "EFT Bekleyenler", count: efts.length },
  ] as const;

  return (
    <div className="space-y-5">
      <PanelSectionTabs activeTab={tab} basePath="/panel/bagis-yonetimi" tabs={tabs} />
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <ManualDonationForm campaigns={editorData.records}/>
        </div>
        <form className="relative w-full max-w-md" method="get">
          <input name="tab" type="hidden" value={tab} />
          <Search aria-hidden="true" className="absolute left-3 top-3 size-4 text-[var(--admin-muted)]" />
          <input aria-label="Bağış yönetiminde ara" className="admin-input pl-10" defaultValue={query} name="q" placeholder="İsim, kampanya veya referans ara" />
        </form>
        {tab === "campaigns" ? (
          <UnifiedCampaignEditor
            categories={editorData.categoryOptions}
            media={editorData.mediaOptions}
          />
        ) : null}
      </div>

      {tab === "campaigns" ? (
        <CampaignCards
          categories={editorData.categoryOptions}
          media={editorData.mediaOptions}
          records={editorData.records}
          rows={filteredCampaigns}
          childDonation={editorData.childDonation}
          showChildDonation
        />
      ) : null}
      {tab === "archive" ? (
        filteredArchivedCampaigns.length ? (
          <CampaignCards
            categories={editorData.categoryOptions}
            media={editorData.mediaOptions}
            records={editorData.records}
            rows={filteredArchivedCampaigns}
            childDonation={editorData.childDonation}
          />
        ) : (
          <EmptyPanelState
            description={query ? "Arama ölçütlerinize uyan arşivlenmiş bağış alanı yok." : "Arşivlediğiniz bağış alanları burada görünür ve gerektiğinde yeniden düzenlenebilir."}
            title={query ? "Arşivde sonuç bulunamadı" : "Arşiv boş"}
          />
        )
      ) : null}
      {tab === "donations" ? <DonationTable rows={filteredDonations} /> : null}
      {tab === "eft" ? <EftTable rows={filteredEfts} /> : null}
    </div>
  );
}

function CampaignCards({
  categories,
  media,
  records,
  rows,
  childDonation,
  showChildDonation = false,
}: {
  categories: Array<{ label: string; value: string }>;
  media: Array<{ label: string; value: string }>;
  records: CampaignEditorRecord[];
  rows: UnifiedCampaignRow[];
  childDonation: { campaign: string; usdCampaign: string; eurCampaign: string; foodPrice: number; stationeryPrice: number; toyPrice: number; clothingPrice: number; foodUsdPrice: number; stationeryUsdPrice: number; toyUsdPrice: number; clothingUsdPrice: number; foodEurPrice: number; stationeryEurPrice: number; toyEurPrice: number; clothingEurPrice: number } | null;
  showChildDonation?: boolean;
}) {
  // The managed Ahmet card exists independently of the standard campaign list.
  const visibleIds = new Set(rows.map((row) => row.id));
  return (
    <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {showChildDonation ? <ChildDonationSettingsCard settings={childDonation} /> : null}
      {records
        .filter((record) => visibleIds.has(record.id))
        .map((record) => (
          <UnifiedCampaignEditor
            categories={categories}
            key={record.id}
            media={media}
            record={record}
          />
        ))}
    </div>
  );
}

function DonationTable({ rows }: { rows: UnifiedDonationRow[] }) {
  const [selected, setSelected] = useState<UnifiedDonationRow | null>(null);
  if (!rows.length) return <EmptyPanelState title="Bağış kaydı bulunamadı" description="Başarılı ödeme ve onaylanan EFT kayıtları burada görünür." />;
  return <>
    <PanelCard className="overflow-hidden p-0"><div className="overflow-x-auto"><table className="w-full min-w-[1250px] text-left text-sm"><thead className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-raised)] text-[11px] uppercase tracking-[0.12em] text-[var(--admin-muted)]"><tr><th className="px-4 py-3">Bağışçı</th><th className="px-4 py-3">Yapılan bağış</th><th className="px-4 py-3">Makbuz no</th><th className="px-4 py-3">Durum</th><th className="px-4 py-3 text-right">Tutar</th><th className="px-4 py-3">Not</th><th className="px-4 py-3">İletişim</th><th className="px-4 py-3">Adres</th></tr></thead><tbody className="divide-y divide-[var(--admin-border)]">{rows.map((item) => <tr className="cursor-pointer transition hover:bg-[var(--admin-surface-raised)]" key={item.id} onClick={() => setSelected(item)}><td className="px-4 py-4 font-semibold">{item.donorName}</td><td className="px-4 py-4 text-[var(--admin-muted)]">{item.campaign}</td><td className="px-4 py-4 font-mono text-xs text-[var(--admin-muted)]">{item.receipt}</td><td className="px-4 py-4"><StatusBadge status={item.status} /></td><td className="px-4 py-4 text-right font-mono font-semibold">{formatCurrency(item.amount, item.currency)}</td><td className="max-w-44 truncate px-4 py-4 text-xs text-[var(--admin-muted)]">{item.note || "—"}</td><td className="max-w-52 px-4 py-4 text-xs text-[var(--admin-muted)]"><span className="block truncate">{item.phone || "—"}</span><span className="block truncate">{item.email || "—"}</span></td><td className="max-w-56 truncate px-4 py-4 text-xs text-[var(--admin-muted)]">{item.address || "—"}</td></tr>)}</tbody></table></div></PanelCard>
    {selected ? <div aria-modal="true" className="fixed inset-0 z-[90] grid place-items-center bg-black/45 p-4" onClick={() => setSelected(null)} role="dialog">
      <section className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-[var(--admin-surface)] p-6 shadow-2xl" onClick={event=>event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4"><div><p className="admin-eyebrow">{selected.manual ? "Manuel IBAN bağışı" : "Bağış kaydı"}</p><h2 className="mt-1 text-xl font-semibold">{selected.donorName}</h2></div><button aria-label="Pencereyi kapat" title="Pencereyi kapat" className="admin-icon-button" onClick={()=>setSelected(null)} type="button"><X className="size-5" /></button></div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">{[["Yapılan bağış",selected.campaign],["Hisse/adet",String(selected.quantity)],["Makbuz no",selected.receipt],["Durum",selected.status],["Alınan ödeme",formatCurrency(selected.amount,selected.currency)],["E-posta",selected.email || "—"],["Telefon",selected.phone || "—"],["Adres",selected.address || "—"],["Ödeme tarihi",selected.createdAt ? new Date(selected.createdAt).toLocaleDateString("tr-TR",{timeZone:"Europe/Istanbul"}) : "—"]].map(([label,value])=><div className="rounded-xl bg-[var(--admin-surface-raised)] p-4" key={label}><dt className="text-xs text-[var(--admin-muted)]">{label}</dt><dd className="mt-1 break-words text-sm font-semibold">{value}</dd></div>)}</dl>
        <div className="mt-4 rounded-xl bg-[var(--admin-surface-raised)] p-4"><p className="text-xs text-[var(--admin-muted)]">Bağış notu</p><p className="mt-1 whitespace-pre-wrap text-sm">{selected.note || "Not bırakılmadı."}</p></div>
        {selected.manual ? <ManualDonationProof key={selected.id} donationId={selected.id} sessionId={selected.paymentSessionId}/> : null}
      </section>
    </div> : null}
  </>;
}

function DonationTableLegacy({ rows }: { rows: UnifiedDonationRow[] }) {
  if (!rows.length) return <EmptyPanelState title="Bağış kaydı bulunamadı" description="Başarılı ödeme ve onaylanan EFT kayıtları burada görünür." />;
  return (
    <PanelCard className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-raised)] text-[11px] uppercase tracking-[0.12em] text-[var(--admin-muted)]">
            <tr><th className="px-5 py-3">Bağışçı</th><th className="px-5 py-3">Kampanya</th><th className="px-5 py-3">Makbuz</th><th className="px-5 py-3">Durum</th><th className="px-5 py-3 text-right">Tutar</th></tr>
          </thead>
          <tbody className="divide-y divide-[var(--admin-border)]">
            {rows.map((item) => (
              <tr className="hover:bg-[var(--admin-surface-raised)]" key={item.id}>
                <td className="px-5 py-4 font-semibold">{item.donorName}</td>
                <td className="px-5 py-4 text-[var(--admin-muted)]"><span className="block">{item.campaign}</span>{item.note ? <span className="mt-1 block max-w-56 truncate text-xs" title={item.note}>Not: {item.note}</span> : null}</td>
                <td className="px-5 py-4 font-mono text-xs text-[var(--admin-muted)]">{item.receipt}</td>
                <td className="px-5 py-4"><StatusBadge status={item.status} /></td>
                <td className="px-5 py-4 text-right font-mono font-semibold">{formatCurrency(item.amount, item.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelCard>
  );
}

function EftTable({ rows }: { rows: UnifiedEftRow[] }) {
  if (!rows.length) return <EmptyPanelState title="Bekleyen EFT yok" description="Dekont incelemesi gerektiren işlemler oluştuğunda burada listelenir." />;
  return (
    <PanelCard className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-raised)] text-[11px] uppercase tracking-[0.12em] text-[var(--admin-muted)]">
            <tr><th className="px-5 py-3">Bağışçı</th><th className="px-5 py-3">Referans</th><th className="px-5 py-3">Rezervasyon sonu</th><th className="px-5 py-3">Durum</th><th className="px-5 py-3 text-right">Tutar</th><th className="px-5 py-3">İşlem</th></tr>
          </thead>
          <tbody className="divide-y divide-[var(--admin-border)]">
            {rows.map((item) => (
              <tr className="hover:bg-[var(--admin-surface-raised)]" key={item.id}>
                <td className="px-5 py-4 font-semibold">{item.donorName}</td>
                <td className="px-5 py-4 font-mono text-xs">{item.reference}</td>
                <td className="px-5 py-4 text-[var(--admin-muted)]">{item.expiresAt ? new Date(item.expiresAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }) : "Süre belirtilmedi"}</td>
                <td className="px-5 py-4"><StatusBadge status={item.status} /></td>
                <td className="px-5 py-4 text-right font-mono font-semibold">{formatCurrency(item.amount, item.currency)}</td>
                <td className="px-5 py-4"><EftReviewActions proofAvailable={item.proofAvailable} sessionId={item.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelCard>
  );
}
