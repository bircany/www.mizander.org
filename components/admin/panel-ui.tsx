import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AlertTriangle, CheckCircle2, Clock3, Inbox, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export function PanelBreadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return <nav aria-label="İçerik yolu" className="flex flex-wrap items-center gap-1 text-xs text-[var(--admin-muted)]">{items.map((item, index) => <span className="flex items-center gap-1" key={`${item.label}-${index}`}>{index ? <ChevronRight aria-hidden="true" className="size-3" /> : null}{item.href ? <Link className="transition hover:text-[var(--admin-primary-strong)]" href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}</span>)}</nav>;
}

export function PanelPageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <header className="flex flex-col gap-4 border-b border-[var(--admin-border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="admin-eyebrow">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--admin-text)] sm:text-[28px]">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--admin-muted)]">{description}</p>
      </div>
      {action}
    </header>
  );
}

export function PanelCard({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("admin-card", className)}>{children}</section>;
}

export function PanelMetric({ label, value, detail, tone = "default" }: { label: string; value: string; detail: string; tone?: "default" | "warning" | "danger" }) {
  return (
    <section className={cn("admin-metric", tone === "warning" && "admin-metric-warning", tone === "danger" && "admin-metric-danger")}>
      <p className="admin-eyebrow">{label}</p>
      <p className="mt-3 font-mono text-2xl font-semibold tracking-[-0.04em] text-[var(--admin-text)]">{value}</p>
      <p className="mt-2 text-xs leading-5 text-[var(--admin-muted)]">{detail}</p>
    </section>
  );
}

type StatusTone = "success" | "warning" | "danger" | "neutral" | "info";

const statusToneMap: Record<string, StatusTone> = {
  waiting:"warning", video_pending:"warning", uploading:"info", uploaded:"info", processing:"info", ready:"success", video_ready:"success", countdown:"info", queued:"info", sending:"info", paused:"warning", delivered:"success", read:"success", quarantined:"danger", processing_failed:"danger", action_required:"danger",
  paid: "success", approved: "success", completed: "success", sent: "success", success: "success", confirmed: "success",
  pending_review: "warning", pending: "warning", review_pending: "warning", external_pending: "warning", reserved: "warning",
  draft: "neutral", todo: "neutral", failed: "danger", rejected: "danger", cancelled: "danger", refunded: "danger", needs_revision: "danger", stopped: "danger",
  partially_refunded: "info", submitted: "info", in_progress: "info", connected: "success", connecting: "warning", disconnected: "warning", unconfigured: "danger", error: "danger",
};

const statusLabelMap: Record<string, string> = {
  waiting:"Video bekleniyor", video_pending:"Video bekleniyor", uploading:"Yükleniyor", uploaded:"Yüklendi", processing:"İşleniyor", ready:"Video hazır", video_ready:"Video hazır", countdown:"Gönderim hazırlanıyor", queued:"Sırada", sending:"Gönderiliyor", paused:"Duraklatıldı", delivered:"Teslim edildi", read:"Okundu", quarantined:"Güvenlik kontrolünde", processing_failed:"İşleme başarısız", action_required:"İşlem gerekli", open:"Alım açık", full:"Grup dolu", collecting:"Hisse toplanıyor", ready_for_slaughter:"Kesime hazır", scheduled:"Kesim planlandı", slaughtered:"Kesim tamamlandı", delivery_started:"Teslimat başladı", notified:"Bildirildi", closed:"Kapalı", superseded:"Önceki sürüm",
  paid: "Tahsil edildi", pending_review: "İnceleme bekliyor", failed: "Başarısız", cancelled: "İptal edildi",
  partially_refunded: "Kısmi iade", refunded: "İade edildi", approved: "Onaylandı", rejected: "Reddedildi",
  draft: "Taslak", todo: "Başlamadı", submitted: "Gönderildi", external_pending: "Dış onay bekliyor", review_pending: "Onay bekliyor",
  in_progress: "Devam ediyor", needs_revision: "Düzeltme bekliyor", stopped: "Durduruldu", completed: "Tamamlandı", success: "Başarılı", pending: "Bekliyor", sent: "Gönderildi", connected: "Bağlı", connecting: "Bağlanıyor", disconnected: "Bağlı değil", unconfigured: "Yapılandırılmadı", error: "Doğrulanamadı",
  confirmed: "Ödeme onaylı", reserved: "Ödeme bekliyor",
};

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  const normalized = status?.toLowerCase() || "pending";
  const tone = statusToneMap[normalized] || "neutral";
  const Icon = tone === "success" ? CheckCircle2 : tone === "warning" ? Clock3 : tone === "danger" ? XCircle : tone === "info" ? AlertTriangle : Clock3;

  return (
    <span className={cn("admin-status", `admin-status-${tone}`, className)}>
      <Icon aria-hidden="true" className="size-3" strokeWidth={2} />
      {statusLabelMap[normalized] || status || "Bekliyor"}
    </span>
  );
}

export function EmptyPanelState({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-raised)] p-6 text-center shadow-sm">
      <div>
        <Inbox aria-hidden="true" className="mx-auto size-6 text-[var(--admin-muted)]" strokeWidth={1.5} />
        <p className="mt-3 text-sm font-semibold text-[var(--admin-text)]">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[var(--admin-muted)]">{description}</p>
      </div>
    </div>
  );
}
