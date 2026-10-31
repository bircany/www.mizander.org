import type { UserRole } from "@/lib/auth/roles";
import { hasRole } from "@/lib/auth/roles";

const ALL_PANEL_ROLES = ["admin", "field_operator"] as const;

export const PANEL_ROUTE_ACCESS = {
  dashboard: ALL_PANEL_ROLES,
  donationManagement: ["admin"],
  videoDelivery: ["admin", "field_operator"],
  whatsapp: ["admin"],
  content: ["admin"],
  settings: ["admin"],
  contentCampaigns: ["admin"],
  contentCategories: ["admin"],
  contentNews: ["admin"],
  contentPages: ["admin"],
  contentMedia: ["admin"],
  donations: ["admin"],
  payments: ["admin"],
  refunds: ["admin"],
  fulfillments: ["admin"],
  reports: ["admin"],
  fieldTasks: ["admin", "field_operator"],
  fieldSubmissions: ["admin", "field_operator"],
  qurbani: ["admin", "field_operator"],
  help: ALL_PANEL_ROLES,
  users: ["admin"],
  auditLogs: ["admin"],
  systemPayments: ["admin"],
  contactMessages: ["admin"],
} as const satisfies Record<string, readonly UserRole[]>;

export type PanelRouteKey = keyof typeof PANEL_ROUTE_ACCESS;

export type PanelNavigationItem = {
  href: string;
  icon: PanelNavigationIcon;
  isAvailable: boolean;
  label: string;
  roles: readonly UserRole[];
  route: PanelRouteKey;
};

export type PanelNavigationGroup = {
  id: "workspace" | "management";
  items: readonly PanelNavigationItem[];
  label: string;
};

export type PanelNavigationIcon =
  | "dashboard"
  | "donationManagement"
  | "videoDelivery"
  | "whatsapp"
  | "content"
  | "settings"
  | "campaigns"
  | "categories"
  | "news"
  | "pages"
  | "media"
  | "donations"
  | "payments"
  | "refunds"
  | "fulfillments"
  | "reports"
  | "fieldTasks"
  | "fieldSubmissions"
  | "qurbani"
  | "users"
  | "auditLogs"
  | "systemPayments"
  | "contactMessages";

export type PanelQuickAccessItem = {
  href: string;
  icon: PanelNavigationIcon;
  key: string;
  label: string;
  roles: readonly UserRole[];
};

/**
 * Paneldeki görünürlük, sayfa erişimi ve gelecekteki modül sırası tek kaynaktan yönetilir.
 * Henüz taşınmamış modüller isAvailable false kalır; menüde kırık bağlantı oluşmaz.
 */
export const PANEL_NAVIGATION_GROUPS: readonly PanelNavigationGroup[] = [
  {
    id: "workspace",
    label: "Çalışma alanı",
    items: [
      {
        href: "/panel",
        icon: "dashboard",
        isAvailable: true,
        label: "Genel bakış",
        roles: PANEL_ROUTE_ACCESS.dashboard,
        route: "dashboard",
      },
      {
        href: "/panel/bagislar",
        icon: "reports",
        isAvailable: true,
        label: "Bağış Dashboard",
        roles: PANEL_ROUTE_ACCESS.donations,
        route: "donations",
      },
    ],
  },
  {
    id: "management",
    label: "Yönetim",
    items: [
      { href: "/panel/bagis-yonetimi", icon: "donationManagement", isAvailable: true, label: "Bağış Yönetimi", roles: PANEL_ROUTE_ACCESS.donationManagement, route: "donationManagement" },
      { href: "/panel/video-teslimat", icon: "videoDelivery", isAvailable: true, label: "Video Teslimat", roles: PANEL_ROUTE_ACCESS.videoDelivery, route: "videoDelivery" },
      { href: "/panel/whatsapp", icon: "whatsapp", isAvailable: true, label: "WhatsApp Bağlantısı", roles: PANEL_ROUTE_ACCESS.whatsapp, route: "whatsapp" },
      { href: "/panel/icerikler", icon: "content", isAvailable: true, label: "İçerikler", roles: PANEL_ROUTE_ACCESS.content, route: "content" },
      { href: "/panel/mesajlar", icon: "contactMessages", isAvailable: true, label: "Mesajlar", roles: PANEL_ROUTE_ACCESS.contactMessages, route: "contactMessages" },
      { href: "/panel/kullanicilar", icon: "users", isAvailable: true, label: "Kullanıcılar", roles: PANEL_ROUTE_ACCESS.users, route: "users" },
      { href: "/panel/ayarlar", icon: "settings", isAvailable: true, label: "Denetim ve Ayarlar", roles: PANEL_ROUTE_ACCESS.settings, route: "settings" },
    ],
  },
];

export const PANEL_NAV_ITEMS = PANEL_NAVIGATION_GROUPS.flatMap((group) =>
  group.items.filter((item) => item.isAvailable),
);

/** Safe, curated destinations used by the shared dashboard shortcuts. */
export const PANEL_QUICK_ACCESS_ITEMS: readonly PanelQuickAccessItem[] = [
  { key: "campaigns", label: "Bağış alanları", href: "/panel/icerik/bagis-alanlari", icon: "campaigns", roles: PANEL_ROUTE_ACCESS.contentCampaigns },
  { key: "news", label: "Haberler", href: "/panel/icerik/haberler", icon: "news", roles: PANEL_ROUTE_ACCESS.contentNews },
  { key: "media", label: "Medya", href: "/panel/icerik/medya", icon: "media", roles: PANEL_ROUTE_ACCESS.contentMedia },
  { key: "payments", label: "Ödeme izleme", href: "/panel/odemeler", icon: "payments", roles: PANEL_ROUTE_ACCESS.payments },
  { key: "fulfillments", label: "Makbuz ve teslim", href: "/panel/teslimatlar", icon: "fulfillments", roles: PANEL_ROUTE_ACCESS.fulfillments },
  { key: "reports", label: "Video teslimat", href: "/panel/video-teslimat", icon: "reports", roles: PANEL_ROUTE_ACCESS.videoDelivery },
  { key: "quick-stock", label: "Yeni kampanya", href: "/panel/bagis-yonetimi?tab=campaigns", icon: "campaigns", roles: PANEL_ROUTE_ACCESS.donationManagement },
] as const;

export const DEFAULT_PANEL_QUICK_ACCESS_KEYS = [
  "campaigns",
  "news",
  "media",
  "payments",
  "fulfillments",
  "reports",
] as const;

export function getPanelQuickAccessItem(key: string) {
  return PANEL_QUICK_ACCESS_ITEMS.find((item) => item.key === key);
}

export function canAccessPanelRoute(role: string | null | undefined, route: keyof typeof PANEL_ROUTE_ACCESS) {
  return hasRole(role, PANEL_ROUTE_ACCESS[route]);
}

export function canAccessPayloadApi(role: string | null | undefined) {
  return hasRole(role, ["admin"]);
}

export function getSafePanelReturnTo(value: string | null | undefined) {
  if (!value || !value.startsWith("/panel") || value.startsWith("//")) {
    return "/panel";
  }

  return value;
}
