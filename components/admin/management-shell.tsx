"use client";

import Link from "next/link";
import Image from "next/image";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { PanelNavigation } from "@/components/admin/panel-navigation";
import { AdminContactMessageNotifier } from "@/components/admin/admin-contact-message-notifier";
import { PanelSessionActions } from "@/components/admin/panel-session-actions";
import { PanelBreadcrumbs } from "@/components/admin/panel-ui";
import type { UserRole } from "@/lib/auth/roles";

const sidebarStorageKey = "mizan-admin-sidebar-pinned";
const sidebarStorageEvent = "mizan-sidebar-preference";

function subscribeSidebarPreference(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(sidebarStorageEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(sidebarStorageEvent, callback);
  };
}

function getSidebarPreference() {
  return window.localStorage.getItem(sidebarStorageKey) === "true";
}

export function ManagementShell({
  currentPath,
  role,
  name,
  children,
}: {
  currentPath: string;
  role: UserRole;
  name: string;
  children: React.ReactNode;
}) {
  const isPinned = useSyncExternalStore(subscribeSidebarPreference, getSidebarPreference, () => false);
  const [isPeekOpen, setIsPeekOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSidebarOpen = isPinned || isPeekOpen;
  const breadcrumbLabels: Record<string, string> = {
    icerik: "İçerik", "bagis-alanlari": "Bağış alanları", kategoriler: "Kategoriler", haberler: "Haberler", sayfalar: "Sayfalar", medya: "Medya",
    bagislar: "Bağışlar", odemeler: "Ödemeler", iadeler: "İadeler", teslimatlar: "Teslimatlar", kurban: "Kurban", saha: "Saha", teslimler: "Teslimler", raporlar: "Raporlar", kullanicilar: "Kullanıcılar", denetim: "Denetim", sistem: "Sistem",
    "bagis-yonetimi": "Bağış Yönetimi", "video-teslimat": "Video Teslimat", whatsapp: "WhatsApp Bağlantısı", icerikler: "İçerikler", ayarlar: "Denetim ve Ayarlar",
  };
  const pathParts = currentPath.split("/").filter(Boolean).slice(1);
  const breadcrumbs = [{ label: "Panel", href: currentPath === "/panel" ? undefined : "/panel" }, ...pathParts.map((part) => ({ label: breadcrumbLabels[part] || part }))];

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPinned) setIsPeekOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPinned]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  function openSidebar() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setIsPeekOpen(true);
  }

  function closeSidebarSoon() {
    if (isPinned) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setIsPeekOpen(false), 180);
  }

  function togglePinned() {
    const next = !isPinned;
    setIsPeekOpen(false);
    window.localStorage.setItem(sidebarStorageKey, String(next));
    window.dispatchEvent(new Event(sidebarStorageEvent));
  }

  return (
    <div className="admin-panel min-h-screen bg-[var(--admin-surface)] text-[var(--admin-text)]" suppressHydrationWarning>
      {role === "admin" ? <AdminContactMessageNotifier /> : null}
      <div className="min-h-screen bg-[var(--admin-surface)]">
        <header className="hidden h-[73px] items-center justify-between border-b border-[var(--admin-shell-border)] bg-[var(--admin-shell-surface)] px-6 md:flex">
          <div className="flex items-center gap-3">
            <button aria-expanded={isPinned} aria-label={isPinned ? "Sol menünün sabitlemesini kaldır" : "Sol menüyü sabitle"} className="admin-icon-button" onClick={togglePinned} type="button">
              {isPinned ? <PanelLeftClose aria-hidden="true" className="size-5" /> : <PanelLeftOpen aria-hidden="true" className="size-5" />}
            </button>
            <Link className="flex items-center gap-3" href="/panel">
            <Image alt="Mizan Derneği" className="rounded-full bg-[#f7f3ea] p-0.5" height={36} priority src="/mizan-logo.png" width={36} />
            <span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--admin-primary)]">Mizan Derneği</span>
              <span className="mt-0.5 block text-sm font-semibold text-[var(--admin-shell-text)]">Bağış Operasyon Merkezi</span>
            </span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden text-right lg:block">
              <p className="text-sm font-medium text-[var(--admin-shell-text)]">{name}</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--admin-shell-muted)]">{role === "field_operator" ? "Saha görevlisi" : "Yönetici"}</p>
            </div>
            <PanelSessionActions />
          </div>
        </header>

        <div className={isPinned ? "min-h-[calc(100vh-73px)] md:grid md:grid-cols-[248px_minmax(0,1fr)]" : "min-h-[calc(100vh-73px)] md:block md:w-full"}>
          <button aria-label="Sol menüyü aç" className="fixed inset-y-0 left-0 z-40 hidden w-4 cursor-default md:block" onFocus={openSidebar} onMouseEnter={openSidebar} type="button" />
          <PanelNavigation
            currentPath={currentPath}
            key={currentPath}
            desktopOpen={isSidebarOpen}
            name={name}
            onDesktopEnter={openSidebar}
            onDesktopLeave={closeSidebarSoon}
            onPinToggle={togglePinned}
            pinned={isPinned}
            role={role}
          />
          <main className="min-h-[calc(100vh-73px)] min-w-0 w-full bg-[var(--admin-surface)] px-4 pb-24 pt-5 md:p-7 md:pb-8">{currentPath !== "/panel" ? <div className="mb-5"><PanelBreadcrumbs items={breadcrumbs} /></div> : null}{children}</main>
        </div>
      </div>
    </div>
  );
}
