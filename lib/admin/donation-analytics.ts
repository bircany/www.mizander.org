import "server-only";

import { getPayloadClient } from "@/lib/payload";

type LooseRecord = Record<string, unknown> & { id?: number | string };

function record(value: unknown): LooseRecord {
  return value && typeof value === "object" ? (value as LooseRecord) : {};
}

function text(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const localized = value as Record<string, unknown>;
    return text(
      localized.tr ?? localized.en ?? localized.title ?? localized.name,
      fallback
    );
  }
  return fallback;
}

export type DonationRecord = {
  id: string;
  donorName: string;
  email: string;
  phone: string;
  amount: number;
  netConfirmedAmount: number;
  currency: string;
  receiptNumber: string;
  status: string;
  paymentMethod: string;
  paymentMethodLabel: string;
  campaignId: string;
  campaignTitle: string;
  categoryId: string;
  categoryName: string;
  groupType: "slaughter_video" | "standard_video" | "none";
  groupTypeLabel: string;
  pricingModel: "fixed" | "free";
  quantity: number;
  note: string;
  address: string;
  manual: boolean;
  createdAt: string;
  confirmedAt: string | null;
};

export type ChartSlice = {
  key: string;
  label: string;
  count: number;
  totalAmount: number;
  percentage: number;
  color: string;
};

export type DonationDashboardAnalytics = {
  metrics: {
    totalRevenueTRY: number;
    totalConfirmedCount: number;
    averageDonationTRY: number;
    thisMonthRevenueTRY: number;
    thisMonthCount: number;
    currencyTotals: Record<string, { amount: number; count: number }>;
  };
  charts: {
    groupType: ChartSlice[];
    paymentMethod: ChartSlice[];
    category: ChartSlice[];
    amountTier: ChartSlice[];
    status: ChartSlice[];
  };
  records: DonationRecord[];
  campaignOptions: Array<{ id: string; title: string }>;
  categoryOptions: Array<{ id: string; name: string }>;
};

const CHART_PALETTE = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#64748b", // slate
  "#14b8a6", // teal
  "#f97316", // orange
  "#6366f1", // indigo
];

export async function getDonationDashboardData(): Promise<DonationDashboardAnalytics> {
  const payload = await getPayloadClient();

  // Safely query collections
  const [donationDocs, campaignDocs, categoryDocs] = await Promise.all([
    payload
      .find({
        collection: "donations",
        depth: 2,
        limit: 2000,
        pagination: false,
        sort: "-createdAt",
      })
      .then((res) => res.docs.map(record))
      .catch(() => [] as LooseRecord[]),
    payload
      .find({
        collection: "campaigns",
        depth: 1,
        limit: 500,
        pagination: false,
      })
      .then((res) => res.docs.map(record))
      .catch(() => [] as LooseRecord[]),
    payload
      .find({
        collection: "categories",
        depth: 0,
        limit: 100,
        pagination: false,
      })
      .then((res) => res.docs.map(record))
      .catch(() => [] as LooseRecord[]),
  ]);

  // Index categories
  const categoryMap = new Map<string, string>();
  for (const cat of categoryDocs) {
    categoryMap.set(String(cat.id ?? ""), text(cat.name, "Kategorisiz"));
  }

  // Index campaigns with metadata
  const campaignMap = new Map<
    string,
    {
      id: string;
      title: string;
      categoryId: string;
      categoryName: string;
      videoDelivery: string;
      operationType: string;
      pricingModel: "fixed" | "free";
    }
  >();

  for (const camp of campaignDocs) {
    const id = String(camp.id ?? "");
    const title = text(camp.title, "Başlıksız Kampanya");
    const categoryRel = record(camp.category);
    const categoryId = String(categoryRel.id ?? camp.category ?? "");
    const categoryName = categoryMap.get(categoryId) || text(categoryRel.name, "Genel");
    const videoDelivery = text(camp.videoDelivery, "none");
    const operationType = text(camp.operationType, "");
    const pricingModel = text(camp.pricingModel, "free") === "fixed" ? "fixed" : "free";

    campaignMap.set(id, {
      id,
      title,
      categoryId,
      categoryName,
      videoDelivery,
      operationType,
      pricingModel,
    });
  }

  // Map donations into normalized records
  const records: DonationRecord[] = donationDocs.map((item) => {
    const intent = record(item.donationIntent);
    const campaignRel = record(item.campaign);
    const campaignId = String(campaignRel.id ?? item.campaign ?? "");
    const campaignInfo = campaignMap.get(campaignId);

    const campaignTitle = campaignInfo?.title || text(campaignRel.title, "Bağış Kampanyası");
    const categoryId = campaignInfo?.categoryId || String(record(campaignRel.category).id ?? "");
    const categoryName =
      campaignInfo?.categoryName ||
      categoryMap.get(categoryId) ||
      text(record(campaignRel.category).name, "Genel");

    // Determine Group / Operation Type
    let groupType: "slaughter_video" | "standard_video" | "none" = "none";
    let groupTypeLabel = "Genel Bağış (Videosuz)";

    const opType = campaignInfo?.operationType || text(campaignRel.operationType);
    const vDelivery = campaignInfo?.videoDelivery || text(campaignRel.videoDelivery);

    if (opType === "slaughter_video") {
      groupType = "slaughter_video";
      groupTypeLabel = "Kesim Videosu (Kurban / Adak)";
    } else if (vDelivery === "video" || opType === "standard_video") {
      groupType = "standard_video";
      groupTypeLabel = "Standart Video (Su Kuyusu vb.)";
    }

    // Determine Payment Method
    const rawMethod = text(item.paymentMethod);
    const isManual = intent.source === "admin_manual";
    let paymentMethod = rawMethod || "card";
    let paymentMethodLabel = "Kredi / Banka Kartı";

    if (isManual) {
      paymentMethod = "manual";
      paymentMethodLabel = "Manuel IBAN";
    } else if (rawMethod === "bank_transfer") {
      paymentMethod = "bank_transfer";
      paymentMethodLabel = "Havale / EFT";
    }

    const netConfirmedAmount = Number(
      item.netConfirmedAmount ?? item.grossAmount ?? item.amount ?? 0
    );
    const amount = Number(item.grossAmount ?? item.amount ?? netConfirmedAmount);
    const currency = text(item.currency, "TRY");

    return {
      id: String(item.id ?? ""),
      donorName: text(item.donorName, "İsimsiz Bağışçı"),
      email: text(item.email ?? intent.email),
      phone: text(item.phone ?? intent.phone),
      amount,
      netConfirmedAmount,
      currency,
      receiptNumber: text(item.receiptNumber, "—"),
      status: text(item.status, "pending_review"),
      paymentMethod,
      paymentMethodLabel,
      campaignId,
      campaignTitle,
      categoryId,
      categoryName,
      groupType,
      groupTypeLabel,
      pricingModel: campaignInfo?.pricingModel || "free",
      quantity: Number(item.quantity || 1),
      note: text(item.donationNote),
      address: [text(intent.address), text(intent.city), text(intent.countryCode)]
        .filter(Boolean)
        .join(", "),
      manual: isManual,
      createdAt: text(item.createdAt),
      confirmedAt: item.confirmedAt ? text(item.confirmedAt) : null,
    };
  });

  // Calculate Metrics
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  let totalRevenueTRY = 0;
  let totalConfirmedCount = 0;
  let thisMonthRevenueTRY = 0;
  let thisMonthCount = 0;

  const currencyTotals: Record<string, { amount: number; count: number }> = {};

  for (const r of records) {
    const isConfirmed = r.status === "paid" || r.status === "partially_refunded";
    const cur = r.currency || "TRY";

    if (!currencyTotals[cur]) {
      currencyTotals[cur] = { amount: 0, count: 0 };
    }
    currencyTotals[cur].count++;
    currencyTotals[cur].amount += r.netConfirmedAmount;

    if (isConfirmed) {
      totalConfirmedCount++;
      // Approximate non-TRY if needed, but primarily accumulate TRY
      totalRevenueTRY += r.netConfirmedAmount;

      const recordTime = Date.parse(r.confirmedAt || r.createdAt) || 0;
      if (recordTime >= currentMonthStart) {
        thisMonthRevenueTRY += r.netConfirmedAmount;
        thisMonthCount++;
      }
    }
  }

  const averageDonationTRY =
    totalConfirmedCount > 0 ? Math.round(totalRevenueTRY / totalConfirmedCount) : 0;

  // Helper to build pie chart slices
  function buildSlices(
    itemsMap: Map<string, { label: string; count: number; totalAmount: number }>,
    sortBy: "amount" | "count" = "amount"
  ): ChartSlice[] {
    const rawSlices = Array.from(itemsMap.entries()).map(([key, data]) => ({
      key,
      label: data.label,
      count: data.count,
      totalAmount: data.totalAmount,
    }));

    if (sortBy === "amount") {
      rawSlices.sort((a, b) => b.totalAmount - a.totalAmount);
    } else {
      rawSlices.sort((a, b) => b.count - a.count);
    }

    const totalVal = rawSlices.reduce((sum, s) => sum + s.totalAmount, 0);

    return rawSlices.map((slice, idx) => ({
      ...slice,
      percentage: totalVal > 0 ? Number(((slice.totalAmount / totalVal) * 100).toFixed(1)) : 0,
      color: CHART_PALETTE[idx % CHART_PALETTE.length],
    }));
  }

  // 1. Group Type Breakdown
  const groupTypeMap = new Map<string, { label: string; count: number; totalAmount: number }>();
  for (const r of records) {
    const existing = groupTypeMap.get(r.groupType) || {
      label: r.groupTypeLabel,
      count: 0,
      totalAmount: 0,
    };
    existing.count++;
    existing.totalAmount += r.netConfirmedAmount;
    groupTypeMap.set(r.groupType, existing);
  }
  const groupTypeSlices = buildSlices(groupTypeMap);

  // 2. Payment Method Breakdown
  const paymentMethodMap = new Map<string, { label: string; count: number; totalAmount: number }>();
  for (const r of records) {
    const existing = paymentMethodMap.get(r.paymentMethod) || {
      label: r.paymentMethodLabel,
      count: 0,
      totalAmount: 0,
    };
    existing.count++;
    existing.totalAmount += r.netConfirmedAmount;
    paymentMethodMap.set(r.paymentMethod, existing);
  }
  const paymentMethodSlices = buildSlices(paymentMethodMap);

  // 3. Category Breakdown
  const categoryChartMap = new Map<string, { label: string; count: number; totalAmount: number }>();
  for (const r of records) {
    const catName = r.categoryName || "Diğer";
    const existing = categoryChartMap.get(catName) || {
      label: catName,
      count: 0,
      totalAmount: 0,
    };
    existing.count++;
    existing.totalAmount += r.netConfirmedAmount;
    categoryChartMap.set(catName, existing);
  }
  const categorySlices = buildSlices(categoryChartMap).slice(0, 7);

  // 4. Amount Tier Breakdown
  const tierMap = new Map<string, { label: string; count: number; totalAmount: number }>([
    ["tier_1", { label: "0 - 500 ₺ (Mikro)", count: 0, totalAmount: 0 }],
    ["tier_2", { label: "500 - 2.500 ₺ (Genel)", count: 0, totalAmount: 0 }],
    ["tier_3", { label: "2.500 - 10.000 ₺ (Hisse / Kurban)", count: 0, totalAmount: 0 }],
    ["tier_4", { label: "10.000 ₺ + (Kurumsal / Büyük)", count: 0, totalAmount: 0 }],
  ]);

  for (const r of records) {
    const amt = r.netConfirmedAmount;
    let tierKey = "tier_1";
    if (amt >= 10000) tierKey = "tier_4";
    else if (amt >= 2500) tierKey = "tier_3";
    else if (amt >= 500) tierKey = "tier_2";

    const tier = tierMap.get(tierKey)!;
    tier.count++;
    tier.totalAmount += amt;
  }
  const amountTierSlices = buildSlices(tierMap, "amount");

  // 5. Status Breakdown
  const statusLabels: Record<string, string> = {
    paid: "Tahsil Edildi (Başarılı)",
    pending_review: "İnceleme Bekliyor",
    partially_refunded: "Kısmi İade Edildi",
    refunded: "İade Edildi",
    failed: "Başarısız",
    cancelled: "İptal Edildi",
  };
  const statusMap = new Map<string, { label: string; count: number; totalAmount: number }>();
  for (const r of records) {
    const label = statusLabels[r.status] || r.status;
    const existing = statusMap.get(r.status) || { label, count: 0, totalAmount: 0 };
    existing.count++;
    existing.totalAmount += r.netConfirmedAmount;
    statusMap.set(r.status, existing);
  }
  const statusSlices = buildSlices(statusMap, "count");

  // Options for filter selects
  const campaignOptions = Array.from(campaignMap.values()).map((c) => ({
    id: c.id,
    title: c.title,
  }));
  const categoryOptions = Array.from(categoryMap.entries()).map(([id, name]) => ({
    id,
    name,
  }));

  return {
    metrics: {
      totalRevenueTRY,
      totalConfirmedCount,
      averageDonationTRY,
      thisMonthRevenueTRY,
      thisMonthCount,
      currencyTotals,
    },
    charts: {
      groupType: groupTypeSlices,
      paymentMethod: paymentMethodSlices,
      category: categorySlices,
      amountTier: amountTierSlices,
      status: statusSlices,
    },
    records,
    campaignOptions,
    categoryOptions,
  };
}
