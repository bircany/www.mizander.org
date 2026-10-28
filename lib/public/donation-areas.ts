import { cache } from "react";

import { getPayloadClient } from "@/lib/payload";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import type { AppLocale } from "@/lib/i18n";
import { sortVideoShareAreas } from "@/lib/donations/video-share-order";

export type DonationAreaCategory = {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
};

export type DonationArea = {
  id: string;
  slug: string;
  title: string;
  description: string;
  excerpt: string;
  category: DonationAreaCategory | null;
  image: {
    src: string;
    alt: string;
  } | null;
  targetAmount: number;
  collectedAmount: number;
  donorCount: number;
  currency: string;
  reportingMode: "pool" | "donation_based";
  isDonationOpen: boolean;
  suggestedAmounts: number[];
  progress: number;
  pricingModel: "free" | "fixed";
  unitPrice: number | null;
  unitLabel: string | null;
  totalStock: number | null;
  availableStock: number | null;
  videoDelivery: "none" | "video";
  participantRequired: boolean;
};

function localizedText(value: unknown, locale: AppLocale) {
  if (typeof value === "string") {
    let decoded: unknown = value;
    for (let depth = 0; depth < 3 && typeof decoded === "string"; depth += 1) {
      const candidate = decoded.trim();
      if (!candidate.startsWith("{") && !candidate.startsWith('"')) break;
      try {
        decoded = JSON.parse(candidate);
      } catch {
        break;
      }
    }
    if (typeof decoded === "string") return decoded;
    if (decoded && typeof decoded === "object") return localizedText(decoded, locale);
    return "";
  }
  if (value && typeof value === "object") {
    const record = value as Partial<Record<AppLocale, unknown>>;
    const localized = record[locale];
    return typeof localized === "string" ? localized : "";
  }

  return "";
}

function lexicalText(value: unknown): string {
  if (!value || typeof value !== "object") return "";

  const text: string[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const record = node as { children?: unknown[]; root?: unknown; text?: unknown };
    if (typeof record.text === "string") text.push(record.text);
    if (record.root) visit(record.root);
    record.children?.forEach(visit);
  };

  visit(value);
  return text.join(" ").replace(/\s+/g, " ").trim();
}

function localizedLexicalText(value: unknown, locale: AppLocale) {
  if (value && typeof value === "object") {
    if ("root" in value) return lexicalText(value);
    const record = value as Partial<Record<AppLocale, unknown>>;
    return lexicalText(record[locale]);
  }

  return lexicalText(value);
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function relationValue(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object" && "id" in value) {
    const relationId = (value as { id?: unknown }).id;
    return typeof relationId === "string" || typeof relationId === "number" ? String(relationId) : "";
  }

  return "";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u024F\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function extractImage(image: unknown, fallbackAlt: string) {
  if (!image || typeof image !== "object") return null;
  const record = image as {
    alt?: unknown;
    url?: unknown;
    sizes?: { thumbnail?: { url?: unknown } };
  };

  const src =
    typeof record.url === "string" && record.url
      ? record.url
      : typeof record.sizes?.thumbnail?.url === "string"
        ? record.sizes.thumbnail.url
        : "";

  if (!src) return null;

  return {
    alt: typeof record.alt === "string" && record.alt ? record.alt : fallbackAlt,
    src,
  };
}

function extractCampaignCover(path: unknown, alt: unknown, fallbackAlt: string) {
  if (typeof path !== "string" || !path) return null;

  return {
    alt: typeof alt === "string" && alt ? alt : fallbackAlt,
    src: getSupabaseServiceClient().storage.from("campaign-covers").getPublicUrl(path).data.publicUrl,
  };
}

function roundToIncrement(value: number, increment: number) {
  return Math.max(increment, Math.round(value / increment) * increment);
}

function computeSuggestedAmounts(targetAmount: number, currency: string) {
  const baseIncrement = currency === "TRY" ? 100 : 10;
  const scaled =
    targetAmount >= 250000 ? baseIncrement * 10 :
    targetAmount >= 100000 ? baseIncrement * 5 :
    targetAmount >= 25000 ? baseIncrement * 2 :
    baseIncrement;

  const amounts = [scaled, scaled * 2, scaled * 4].map((amount) =>
    roundToIncrement(amount, baseIncrement),
  );

  return Array.from(new Set(amounts)).sort((a, b) => a - b);
}

function toDonationArea(document: Record<string, unknown>, locale: AppLocale, pool?: Record<string, unknown>): DonationArea | null {
  const source = pool || document;
  const videoShareGroup = /^video-kurban-([1-7])-kisilik-grup$/.exec(String(document.code || ""));
  const title = localizedText(source.title, locale) || (videoShareGroup
    ? locale === "en"
      ? `${videoShareGroup[1]}-Person Qurbani Video Group`
      : locale === "ar"
        ? `مجموعة أضاحي بالفيديو من ${videoShareGroup[1]} أشخاص`
        : `${videoShareGroup[1]} Kişilik Kurban Video Grubu`
    : "");
  const slug = typeof document.slug === "string" && document.slug
    ? document.slug
    : title
      ? slugify(title)
      : String(document.id);

  const targetAmount = numberValue(source.targetAmount);
  const collectedAmount = numberValue(source.collectedAmount);
  const donorCount = numberValue(source.donorCount);
  const currency = typeof source.currency === "string" && source.currency ? source.currency : "TRY";
  const categoryDoc = source.category && typeof source.category === "object" ? source.category as Record<string, unknown> : null;
  const categoryName = categoryDoc ? localizedText(categoryDoc.name, locale) : "";
  const categorySlug = categoryDoc ? (typeof categoryDoc.slug === "string" ? categoryDoc.slug : slugify(categoryName)) : "";
  const categoryIcon = categoryDoc && typeof categoryDoc.icon === "string" ? categoryDoc.icon : undefined;
  const categoryColor = categoryDoc && typeof categoryDoc.color === "string" ? categoryDoc.color : undefined;
  const description = localizedLexicalText(source.description, locale) || (videoShareGroup
    ? locale === "en"
      ? `Donate one share to a ${videoShareGroup[1]}-person Qurbani group with video delivery.`
      : locale === "ar"
        ? `ساهم بسهم واحد في مجموعة أضاحي من ${videoShareGroup[1]} أشخاص مع توثيق بالفيديو.`
        : `Video ile belgelenen ${videoShareGroup[1]} kişilik kurban grubuna bir hisse bağışlayın.`
    : "");
  const coverImagePath = document.coverImagePath;
  const coverImageAlt = localizedText(source.coverImageAlt, locale) || localizedText(document.coverImageAlt, locale);
  if (!title.trim()) return null;
  const image = extractCampaignCover(coverImagePath, coverImageAlt, title)
    ?? extractImage(document.image, title)
    ?? (videoShareGroup ? { alt: title, src: "/images/donations/kurban-dagitimi.png" } : null);
  const progress = targetAmount > 0 ? Math.min(100, Math.round((collectedAmount / targetAmount) * 100)) : 0;
  const pricingModel = source.pricingModel === "fixed" ? "fixed" : "free";
  const unitPrice = pricingModel === "fixed" ? numberValue(source.unitPrice) : null;
  const totalStock =
    typeof source.totalStock === "number" ? source.totalStock : null;
  const unavailable =
    numberValue(source.reservedUnits) + numberValue(source.confirmedUnits);
  const now = Date.now();
  const publishStart = typeof source.publishStartAt === "string"
    ? new Date(source.publishStartAt).getTime()
    : null;
  const publishEnd = typeof source.publishEndAt === "string"
    ? new Date(source.publishEndAt).getTime()
    : null;

  return {
    id: String(source.id),
    slug,
    title,
    description,
    excerpt: description.slice(0, 180),
    category: categoryName
      ? {
          id: categoryDoc?.id ? String(categoryDoc.id) : categorySlug || categoryName,
          name: categoryName,
          slug: categorySlug || slugify(categoryName),
          icon: categoryIcon,
          color: categoryColor,
        }
      : null,
    image,
    targetAmount,
    collectedAmount,
    donorCount,
    currency,
    reportingMode: source.reportingMode === "donation_based" ? "donation_based" : "pool",
    isDonationOpen:
      source.status === "active" &&
      source.isDonationOpen !== false &&
      (publishStart === null || publishStart <= now) &&
      (publishEnd === null || publishEnd > now),
    suggestedAmounts:
      pricingModel === "fixed" && unitPrice
        ? [unitPrice]
        : computeSuggestedAmounts(targetAmount, currency),
    progress,
    pricingModel,
    unitPrice,
    unitLabel:
      typeof source.unitLabel === "string" ? source.unitLabel : null,
    totalStock,
    availableStock:
      totalStock === null ? null : Math.max(0, totalStock - unavailable),
    videoDelivery: source.videoDelivery === "video" ? "video" : "none",
    participantRequired: source.participantRequired === true,
  };
}

export const getOpenDonationAreas = cache(async (locale: AppLocale = "tr"): Promise<DonationArea[]> => {
  try {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: "campaigns",
      depth: 2,
      fallbackLocale: false,
      limit: 100,
      pagination: false,
      locale,
      sort: "-updatedAt",
      where: { status: { equals: "active" } },
    });

    return sortVideoShareAreas(result.docs
      .filter((campaign) => !String((campaign as { code?: unknown }).code || "").startsWith("ahmet-destek-"))
      .map((campaign) =>
        toDonationArea(
          campaign as unknown as Record<string, unknown>,
          locale,
        ),
      )
      .filter((item): item is DonationArea => Boolean(item?.isDonationOpen)));
  } catch (error) {
    console.warn("Bagis alanlari okunamadi.", error);
    return [];
  }
});

export const getDonationAreaBySlug = cache(async (slug: string, locale: AppLocale = "tr"): Promise<DonationArea | null> => {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) return null;

  try {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: "campaigns",
      depth: 2,
      fallbackLocale: false,
      limit: 1,
      locale,
      where: {
        and: [
          { slug: { equals: normalizedSlug } },
          { status: { equals: "active" } },
        ],
      },
    });

    const campaign = result.docs[0];
    return campaign
      ? toDonationArea(
          campaign as unknown as Record<string, unknown>,
          locale,
        )
      : null;
  } catch (error) {
    console.warn("Bagis alani detayi okunamadi.", error);
    return null;
  }
});

export function buildDonationAreaCategories(areas: DonationArea[], locale: AppLocale = "tr") {
  const bySlug = new Map<string, DonationAreaCategory>();

  for (const area of areas) {
    if (!area.category) continue;
    if (!bySlug.has(area.category.slug)) {
      bySlug.set(area.category.slug, area.category);
    }
  }

  return [
    { id: "all", label: locale === "ar" ? "جميع مجالات التبرع" : locale === "en" ? "All donation areas" : "Tüm bağış alanları", icon: "apps" },
    ...Array.from(bySlug.values())
      .sort((a, b) => a.name.localeCompare(b.name, locale))
      .map((category) => ({
        id: category.slug,
        label: category.name,
        icon: category.icon || "volunteer_activism",
      })),
  ];
}

export function isQurbaniDonationArea(area: DonationArea) {
  const category = `${area.category?.slug || ""} ${area.category?.name || ""}`
    .toLocaleLowerCase("tr-TR");
  return category.includes("kurban");
}

export function getDonationAreaSummary(areas: DonationArea[]) {
  const featured = [...areas].sort((left, right) => right.progress - left.progress)[0] ?? null;
  return {
    featured,
    count: areas.length,
  };
}
