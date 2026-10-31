"use client";

import Link from "next/link";
import NextImage from "next/image";
import { useState } from "react";
import {
  BarChart3,
  ClipboardCheck,
  FileText,
  FileCheck2,
  Folder,
  HandCoins,
  Image,
  LayoutDashboard,
  Menu,
  MessagesSquare,
  MessageCircle,
  Newspaper,
  Pin,
  PinOff,
  ReceiptText,
  ScrollText,
  Tag,
  Users,
  WalletCards,
  Beef,
  ChevronDown,
  CircleHelp,
  Clapperboard,
  PanelsTopLeft,
  Settings,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PanelSessionActions } from "@/components/admin/panel-session-actions";
import type { UserRole } from "@/lib/auth/roles";
import { hasRole } from "@/lib/auth/roles";
import { PANEL_NAVIGATION_GROUPS, type PanelNavigationIcon, type PanelRouteKey } from "@/lib/auth/panel-access";
import { cn } from "@/lib/utils";

const icons: Record<PanelNavigationIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  donationManagement: HandCoins,
  videoDelivery: Clapperboard,
  whatsapp: MessageCircle,
  content: PanelsTopLeft,
  settings: Settings,
  campaigns: Folder,
  categories: Tag,
  news: Newspaper,
  pages: FileText,
  media: Image,
  donations: HandCoins,
  payments: WalletCards,
  refunds: ReceiptText,
  fulfillments: ReceiptText,
  reports: BarChart3,
  fieldTasks: FileCheck2,
  fieldSubmissions: ClipboardCheck,
  qurbani: Beef,
  users: Users,
  auditLogs: ScrollText,
  systemPayments: WalletCards,
  contactMessages: MessagesSquare,
};

const mobileRoutePriority: readonly PanelRouteKey[] = [
  "dashboard",
  "donations",
  "donationManagement",
  "videoDelivery",
  "content",
  "users",
  "settings",
];

type PanelNavigationProps = {
  currentPath: string;
  desktopOpen: boolean;
  name: string;
  onDesktopEnter(): void;
  onDesktopLeave(): void;
  onPinToggle(): void;
  pinned: boolean;
  role: UserRole;
};

export function PanelNavigation({ currentPath, desktopOpen, name, onDesktopEnter, onDesktopLeave, onPinToggle, pinned, role }: PanelNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const groups = PANEL_NAVIGATION_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.isAvailable && hasRole(role, item.roles as readonly UserRole[])),
  })).filter((group) => group.items.length > 0);

  const items = groups.flatMap((group) => group.items);
  const activeGroupId = groups.find((group) => group.items.some((item) => currentPath === item.href || (item.href !== "/panel" && currentPath.startsWith(`${item.href}/`))))?.id || null;
  const [openGroupOverride, setOpenGroupOverride] = useState<string | false | null>(null);
  const openGroupId = openGroupOverride === null ? activeGroupId : openGroupOverride || null;
  const mobileItems = mobileRoutePriority
    .map((route) => items.find((item) => item.route === route))
    .filter((item): item is (typeof items)[number] => Boolean(item))
    .slice(0, 5);

  const navigation = (variant: "desktop" | "mobile") => (
    <nav aria-label="Panel navigasyonu" className={cn("flex", variant === "desktop" ? "flex-col gap-1" : "flex-col gap-2")}>
      {groups.map((group) => (
        <div className="space-y-1" key={group.id}>
          {group.id === "workspace" ? group.items.map((item) => {
            const Icon = icons[item.icon];
            const active = currentPath === item.href || (item.href !== "/panel" && currentPath.startsWith(`${item.href}/`));
            return (
              <Link
                className={cn("admin-nav-link", active && "admin-nav-link-active", variant === "mobile" && "min-h-12 text-base")}
                href={item.href}
                key={item.href}
                onClick={() => setIsOpen(false)}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.8} />
                <span>{item.label}</span>
              </Link>
            );
          }) : <>
            <button
              aria-controls={`panel-nav-${variant}-${group.id}`}
              aria-expanded={openGroupId === group.id}
              className="admin-nav-group-button"
              onClick={() => setOpenGroupOverride((current) => (current === group.id || (current === null && activeGroupId === group.id)) ? false : group.id)}
              type="button"
            >
              <span>{group.label}</span>
              <ChevronDown aria-hidden="true" className={cn("size-3.5 transition-transform", openGroupId === group.id && "rotate-180")} />
            </button>
            {openGroupId === group.id ? <div className="space-y-1" id={`panel-nav-${variant}-${group.id}`}>
              {group.items.map((item) => {
                const Icon = icons[item.icon];
                const active = currentPath === item.href || (item.href !== "/panel" && currentPath.startsWith(`${item.href}/`));
                return <Link className={cn("admin-nav-link", active && "admin-nav-link-active", variant === "mobile" && "min-h-12 text-base")} href={item.href} key={item.href} onClick={() => setIsOpen(false)}>
                  <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.8} />
                  <span>{item.label}</span>
                </Link>;
              })}
            </div> : null}
          </>}
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <aside
        aria-hidden={!desktopOpen}
        className={cn(
          "hidden w-[248px] overflow-y-auto bg-[var(--admin-shell-surface)] p-4 transition-[transform,opacity] duration-200 md:block",
          pinned ? "relative" : "fixed bottom-0 left-0 top-[73px] z-50 shadow-[18px_0_48px_rgba(28,55,41,0.14)]",
          !desktopOpen && "pointer-events-none -translate-x-full opacity-0",
        )}
        onFocus={onDesktopEnter}
        onMouseEnter={onDesktopEnter}
        onMouseLeave={onDesktopLeave}
      >
        <div className="mb-5 flex items-center gap-3 border-b border-[var(--admin-shell-border)] pb-5">
          <NextImage alt="Mizan Derneği" className="rounded-full bg-[#f7f3ea] p-0.5" height={36} src="/mizan-logo.png" width={36} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--admin-shell-text)]">{name}</p>
            <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--admin-shell-muted)]">
              {role === "field_operator" ? "Saha görevlisi" : "Yönetici"}
            </p>
          </div>
          <button aria-label={pinned ? "Menünün sabitlemesini kaldır" : "Menüyü sabitle"} className="admin-icon-button ml-auto shrink-0" onClick={onPinToggle} type="button">
            {pinned ? <PinOff aria-hidden="true" className="size-4" /> : <Pin aria-hidden="true" className="size-4" />}
          </button>
        </div>
        {navigation("desktop")}
        <Link className={cn("admin-nav-link mt-6 border-t border-[var(--admin-shell-border)] pt-5", currentPath.startsWith("/panel/yardim") && "admin-nav-link-active")} href="/panel/yardim">
          <CircleHelp aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.8} />
          <span>Yardım ve Destek</span>
        </Link>
      </aside>

      <div className="flex items-center justify-between border-b border-[var(--admin-shell-border)] bg-[var(--admin-shell-surface-deep)] px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <NextImage alt="Mizan Derneği" className="rounded-full bg-[#f7f3ea] p-0.5" height={32} src="/mizan-logo.png" width={32} />
          <span className="text-sm font-semibold text-[var(--admin-shell-text)]">Operasyon Merkezi</span>
        </div>
        <div className="flex items-center gap-2">
          <PanelSessionActions mobile />
          <button
            aria-controls="panel-mobile-navigation"
            aria-expanded={isOpen}
            aria-label="Panel menüsünü aç"
            className="admin-icon-button"
            onClick={() => setIsOpen(true)}
            type="button"
          >
            <Menu aria-hidden="true" className="size-5" />
          </button>
        </div>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" id="panel-mobile-navigation">
          <button
            aria-label="Panel menüsünü kapat"
            className="absolute inset-0 bg-black/70"
            onClick={() => setIsOpen(false)}
            type="button"
          />
          <aside className="relative h-full w-[min(20rem,86vw)] border-r border-[var(--admin-shell-border)] bg-[var(--admin-shell-surface-deep)] p-4 shadow-[16px_0_36px_rgba(0,0,0,0.45)]">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--admin-primary)]">Mizan</p>
                <p className="mt-1 text-base font-semibold text-[var(--admin-shell-text)]">Operasyon Merkezi</p>
              </div>
              <button
                aria-label="Panel menüsünü kapat"
                className="admin-icon-button"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            {navigation("mobile")}
            <Link className={cn("admin-nav-link mt-6 border-t border-[var(--admin-shell-border)] pt-5", currentPath.startsWith("/panel/yardim") && "admin-nav-link-active")} href="/panel/yardim" onClick={() => setIsOpen(false)}>
              <CircleHelp aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.8} />
              <span>Yardım ve Destek</span>
            </Link>
          </aside>
        </div>
      ) : null}

      <nav
        aria-label="Hızlı navigasyon"
        className="admin-bottom-nav md:hidden"
        style={{ gridTemplateColumns: `repeat(${Math.max(mobileItems.length, 1)}, minmax(0, 1fr))` }}
      >
        {mobileItems.map((item) => {
          const Icon = icons[item.icon];
          const active = currentPath === item.href || (item.href !== "/panel" && currentPath.startsWith(`${item.href}/`));

          return (
            <Link className={cn("admin-bottom-nav-link", active && "admin-bottom-nav-link-active")} href={item.href} key={item.href}>
              <Icon aria-hidden="true" className="size-[18px]" strokeWidth={1.8} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
