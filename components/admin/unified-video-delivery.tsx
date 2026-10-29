import Link from "next/link";
import { VideoViewSwitch } from "./video-view-switch";
import {
  EmptyPanelState,
  PanelCard,
  StatusBadge,
} from "@/components/admin/panel-ui";
import { DeliveryRowActions } from "@/components/admin/delivery-row-actions";
import { DeliveryOperationModal } from "@/components/admin/delivery-operation-modal";
import { DeliveryPanelAutoRefresh } from "@/components/admin/delivery-panel-auto-refresh";
import { DeliveryVideoFlow } from "@/components/admin/delivery-video-flow";
import { DeliveryBulkVideoFlow } from "@/components/admin/delivery-bulk-video-flow";
import type { UnifiedDeliveryRow } from "@/lib/admin/unified-panel-data";
import {
  filterVideos,
  videoTab,
  videoQuery,
  videoTabs,
  type VideoFilters,
  type VideoTab,
} from "@/lib/admin/video-filters";

const labels: Record<VideoTab, string> = {
  all: "Tümü",
  waiting_video: "Video Bekleyenler",
  draft: "Taslak Mesajlar",
  sending: "Gönderiliyor",
  completed: "Tamamlananlar",
  failed: "Hatalılar",
};
function Actions({
  row,
  canManage,
}: {
  row: UnifiedDeliveryRow;
  canManage: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {!canManage || (row.videoStatus === "ready" && row.status === "draft") ? <DeliveryOperationModal groupId={row.groupId} /> : null}
      <DeliveryRowActions
        groupId={row.groupId}
        groupCode={row.groupCode}
        messageId={row.messageId}
        messageBody={canManage ? row.messageBody : ""}
        status={row.status}
        videoStatus={row.videoStatus}
        canManage={canManage}
        simpleFlow={canManage}
      />
    </div>
  );
}
function Recipients({ row, floating = false }: { row: UnifiedDeliveryRow; floating?: boolean }) {
  return (
    <details className={`mt-3 min-w-0 break-words text-sm ${floating ? "relative open:z-20" : ""}`}>
      <summary className="cursor-pointer font-semibold">
        Hissedarlar ({row.recipients.length})
      </summary>
      <ul className={floating ? "absolute right-0 top-full z-20 mt-2 max-h-56 w-72 max-w-[calc(100vw-4rem)] overflow-y-auto overscroll-contain rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 shadow-xl" : "mt-2 max-h-56 overflow-auto"}>
        {row.recipients.map((r, i) => (
          <li className="border-t border-[var(--admin-border)] py-2" key={r.id}>
            {i + 1}. {r.name}{" "}
            <span className="block text-xs text-[var(--admin-muted)]">
              {r.maskedPhone} · <StatusBadge status={r.status} />
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
function updated(row: UnifiedDeliveryRow) {
  return row.updatedAt && Number.isFinite(Date.parse(row.updatedAt))
    ? new Date(row.updatedAt).toLocaleString("tr-TR", {
        timeZone: "Europe/Istanbul",
      })
    : "Kayıt yok";
}

export function UnifiedVideoDelivery({
  rows,
  tab,
  filters,
  canManage = true,
}: {
  rows: UnifiedDeliveryRow[];
  tab: VideoTab;
  filters: VideoFilters;
  canManage?: boolean;
}) {
  const matching = filterVideos(rows, filters);
  const visible = matching.filter(
    (row) => tab === "all" || videoTab(row) === tab,
  );
  const pages = Math.max(1, Math.ceil(visible.length / 24));
  const page = Math.min(filters.page, pages);
  const slice = visible.slice((page - 1) * 24, page * 24);
  const campaigns = [
    ...new Map(rows.map((r) => [r.campaignId || "", r.campaign])).entries(),
  ].filter(([id]) => id);
  const categories = [
    ...new Map(
      rows.map((r) => [r.categoryId || "", r.category || "Kategorisiz"]),
    ).entries(),
  ].filter(([id]) => id);
  return (
    <div className="space-y-5">
      <DeliveryPanelAutoRefresh />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {canManage ? (
            <>
              <DeliveryVideoFlow rows={rows} />
              <DeliveryBulkVideoFlow rows={rows} />
            </>
          ) : null}
          <p className="text-sm font-semibold">{visible.length} teslimat</p>
        </div>
        <VideoViewSwitch filters={filters} tab={tab} />
      </div>
      <form
        className="grid gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-raised)] p-4 sm:grid-cols-2 xl:grid-cols-4"
        method="get"
      >
        <input name="tab" type="hidden" value={tab} />
        <label>
          <span className="admin-label">Başlık / hissedar ara</span>
          <input
            className="admin-input"
            name="q"
            defaultValue={filters.q}
            placeholder="Kampanya, grup veya isim"
          />
        </label>
        <label>
          <span className="admin-label">Grup kodu / başlığı</span>
          <input
            className="admin-input"
            name="group"
            defaultValue={filters.group}
            placeholder="MD-2026-…"
          />
        </label>
        <label>
          <span className="admin-label">Kampanya</span>
          <select
            className="admin-input"
            name="campaign"
            defaultValue={filters.campaign}
          >
            <option value="">Tüm kampanyalar</option>
            {campaigns.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="admin-label">Kategori</span>
          <select
            className="admin-input"
            name="category"
            defaultValue={filters.category}
          >
            <option value="">Tüm kategoriler</option>
            {categories.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="admin-label">Son hareket · başlangıç</span>
          <input
            className="admin-input"
            type="date"
            name="from"
            defaultValue={filters.from}
          />
        </label>
        <label>
          <span className="admin-label">Son hareket · bitiş</span>
          <input
            className="admin-input"
            type="date"
            name="to"
            defaultValue={filters.to}
          />
        </label>
        <input name="view" type="hidden" value={filters.view} />
        <div className="flex items-end gap-3">
          <button className="admin-action-button" type="submit">
            Uygula
          </button>
          <Link
            className="admin-button-secondary"
            href={`/panel/video-teslimat?tab=${tab}&view=${filters.view}`}
          >
            Temizle
          </Link>
        </div>
      </form>
      {filters.from && filters.to && filters.from > filters.to ? (
        <p role="alert" className="text-sm text-red-700">
          Başlangıç tarihi bitişten sonra olamaz.
        </p>
      ) : null}
      <nav aria-label="Video aşamaları" className="flex gap-2 overflow-x-auto">
        {videoTabs.map((t) => (
          <Link
            aria-current={tab === t ? "page" : undefined}
            className={`admin-tab whitespace-nowrap ${tab === t ? "admin-tab-active" : ""}`}
            href={`/panel/video-teslimat?${videoQuery(filters, t)}`}
            key={t}
            scroll={false}
          >
            {labels[t]} (
            {t === "all"
              ? matching.length
              : matching.filter((r) => videoTab(r) === t).length}
            )
          </Link>
        ))}
      </nav>
      <p className="text-sm text-[var(--admin-muted)]">
        {visible.length} grup · Sayfa {page}/{pages} · Tarihler Türkiye saatine göre.
      </p>
      {slice.length ? (
        filters.view === "cards" ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {slice.map((row) => (
              <PanelCard key={row.id} className="min-w-0 p-5">
                <p className="font-mono text-sm font-semibold">
                  {row.groupCode}
                </p>
                <h2 className="mt-2 text-lg font-semibold">{row.campaign}</h2>
                <p className="mt-1 text-xs text-[var(--admin-muted)]">
                  {row.category}
                </p>
                <dl className="my-4 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt>Video</dt>
                    <dd>
                      <StatusBadge status={row.videoStatus} />
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt>Mesaj</dt>
                    <dd>
                      <StatusBadge status={row.status} />
                      <Recipients row={row} floating />
                    </dd>
                  </div>
                </dl>
                <p className="mb-3 text-xs text-[var(--admin-muted)]">
                  Son hareket: {updated(row)}
                </p>
                <Actions row={row} canManage={canManage} />
              </PanelCard>
            ))}
          </div>
        ) : (
          <PanelCard className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr>
                    {[
                      "Grup / kampanya",
                      "Hissedarlar",
                      "Video",
                      "Mesaj",
                      "Son hareket",
                      "İşlem",
                    ].map((s) => (
                      <th className="p-4" key={s}>
                        {s}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {slice.map((row) => (
                    <tr
                      className="border-t border-[var(--admin-border)]"
                      key={row.id}
                    >
                      <td className="p-4">
                        <strong className="font-mono">{row.groupCode}</strong>
                        <p>{row.campaign}</p>
                        <span className="text-xs text-[var(--admin-muted)]">
                          {row.category}
                        </span>
                      </td>
                      <td className="p-4">
                        <Recipients row={row} />
                      </td>
                      <td className="p-4">
                        <StatusBadge status={row.videoStatus} />
                      </td>
                      <td className="p-4">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="p-4 text-xs">{updated(row)}</td>
                      <td className="p-4">
                        <Actions row={row} canManage={canManage} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PanelCard>
        )
      ) : (
        <EmptyPanelState
          title="Bu filtrelerle eşleşen grup yok"
          description="Filtreleri temizleyin veya başka bir aşama seçin."
        />
      )}
      {pages > 1 ? (
        <nav aria-label="Sonuç sayfaları" className="flex gap-3">
          {page > 1 ? (
            <Link
              className="admin-button-secondary"
              href={`/panel/video-teslimat?${videoQuery(filters, tab, page - 1)}`}
            >
              Önceki
            </Link>
          ) : null}
          {page < pages ? (
            <Link
              className="admin-button-secondary"
              href={`/panel/video-teslimat?${videoQuery(filters, tab, page + 1)}`}
            >
              Sonraki
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
