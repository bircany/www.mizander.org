"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  Calendar,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  Filter,
  HandCoins,
  Layers,
  PieChart as PieChartIcon,
  RotateCcw,
  Search,
  Tag,
  TrendingUp,
  Users,
  Video,
  X,
} from "lucide-react";

import { PanelCard, StatusBadge } from "@/components/admin/panel-ui";
import { DonationPieChart } from "@/components/admin/donation-pie-chart";
import type {
  DonationDashboardAnalytics,
  DonationRecord,
} from "@/lib/admin/donation-analytics";
import { formatCurrency } from "@/lib/utils";

type Props = {
  data: DonationDashboardAnalytics;
};

export function DonationDashboardView({ data }: Props) {
  const { metrics, charts, records, campaignOptions } = data;

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupType, setSelectedGroupType] = useState<string>("all");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("all");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Table Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Selected Record Modal
  const [selectedDonation, setSelectedDonation] = useState<DonationRecord | null>(null);

  // Filter Logic
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLocaleLowerCase("tr-TR");
        const matchName = r.donorName.toLocaleLowerCase("tr-TR").includes(q);
        const matchEmail = r.email.toLocaleLowerCase("tr-TR").includes(q);
        const matchPhone = r.phone.toLocaleLowerCase("tr-TR").includes(q);
        const matchReceipt = r.receiptNumber.toLocaleLowerCase("tr-TR").includes(q);
        const matchCampaign = r.campaignTitle.toLocaleLowerCase("tr-TR").includes(q);
        const matchNote = r.note.toLocaleLowerCase("tr-TR").includes(q);
        if (!matchName && !matchEmail && !matchPhone && !matchReceipt && !matchCampaign && !matchNote) {
          return false;
        }
      }

      // Group Type
      if (selectedGroupType !== "all" && r.groupType !== selectedGroupType) {
        return false;
      }

      // Payment Method
      if (selectedPaymentMethod !== "all" && r.paymentMethod !== selectedPaymentMethod) {
        return false;
      }

      // Campaign
      if (selectedCampaign !== "all" && r.campaignId !== selectedCampaign) {
        return false;
      }

      // Status
      if (selectedStatus !== "all" && r.status !== selectedStatus) {
        return false;
      }

      // Date Range
      const recordDate = r.confirmedAt || r.createdAt;
      if (startDate && recordDate) {
        if (new Date(recordDate) < new Date(startDate)) return false;
      }
      if (endDate && recordDate) {
        // End of the day for end date
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(recordDate) > end) return false;
      }

      return true;
    });
  }, [
    records,
    searchQuery,
    selectedGroupType,
    selectedPaymentMethod,
    selectedCampaign,
    selectedStatus,
    startDate,
    endDate,
  ]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Filtered Totals
  const filteredTotalAmount = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + r.netConfirmedAmount, 0);
  }, [filteredRecords]);

  // Reset Filters
  function resetFilters() {
    setSearchQuery("");
    setSelectedGroupType("all");
    setSelectedPaymentMethod("all");
    setSelectedCampaign("all");
    setSelectedStatus("all");
    setStartDate("");
    setEndDate("");
    setPage(1);
  }

  // Export to CSV
  function exportCSV() {
    if (!filteredRecords.length) return;

    const headers = [
      "ID",
      "Bağışçı Adı",
      "E-Posta",
      "Telefon",
      "Kampanya",
      "Kategori",
      "Grup Türü",
      "Tutar",
      "Para Birimi",
      "Ödeme Yöntemi",
      "Makbuz No",
      "Durum",
      "Adet/Hisse",
      "Tarih",
      "Not",
      "Adres",
    ];

    const rows = filteredRecords.map((r) => [
      r.id,
      r.donorName,
      r.email,
      r.phone,
      r.campaignTitle,
      r.categoryName,
      r.groupTypeLabel,
      r.netConfirmedAmount,
      r.currency,
      r.paymentMethodLabel,
      r.receiptNumber,
      r.status,
      r.quantity,
      r.confirmedAt || r.createdAt,
      (r.note || "").replace(/"/g, '""'),
      (r.address || "").replace(/"/g, '""'),
    ]);

    const csvContent =
      "\uFEFF" +
      [
        headers.join(","),
        ...rows.map((row) =>
          row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
        ),
      ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `mizan-bagis-kayitlari-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* KPI Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue */}
        <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-xs transition hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="admin-eyebrow">Toplam Tahsilat</span>
            <span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <Banknote className="size-5" />
            </span>
          </div>
          <p className="mt-3 font-mono text-2xl sm:text-3xl font-bold tracking-tight text-[var(--admin-text)]">
            {formatCurrency(metrics.totalRevenueTRY)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--admin-muted)]">
            <span>Kesinleşmiş toplam gelir</span>
            {metrics.currencyTotals.USD ? (
              <span>· ${metrics.currencyTotals.USD.amount.toLocaleString("tr-TR")}</span>
            ) : null}
            {metrics.currencyTotals.EUR ? (
              <span>· €{metrics.currencyTotals.EUR.amount.toLocaleString("tr-TR")}</span>
            ) : null}
          </div>
        </div>

        {/* Total Donors / Transactions */}
        <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-xs transition hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="admin-eyebrow">Bağış Sayısı</span>
            <span className="grid size-9 place-items-center rounded-xl bg-blue-50 text-blue-700">
              <Users className="size-5" />
            </span>
          </div>
          <p className="mt-3 font-mono text-2xl sm:text-3xl font-bold tracking-tight text-[var(--admin-text)]">
            {metrics.totalConfirmedCount.toLocaleString("tr-TR")}
          </p>
          <p className="mt-2 text-xs text-[var(--admin-muted)]">
            Onaylanmış bağış ve hisse kaydı
          </p>
        </div>

        {/* Average Donation */}
        <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-xs transition hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="admin-eyebrow">Ortalama Bağış</span>
            <span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-700">
              <TrendingUp className="size-5" />
            </span>
          </div>
          <p className="mt-3 font-mono text-2xl sm:text-3xl font-bold tracking-tight text-[var(--admin-text)]">
            {formatCurrency(metrics.averageDonationTRY)}
          </p>
          <p className="mt-2 text-xs text-[var(--admin-muted)]">
            İşlem başına düşen ortalama tutar
          </p>
        </div>

        {/* This Month's Performance */}
        <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-xs transition hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="admin-eyebrow">Bu Ay Alınan</span>
            <span className="grid size-9 place-items-center rounded-xl bg-purple-50 text-purple-700">
              <Calendar className="size-5" />
            </span>
          </div>
          <p className="mt-3 font-mono text-2xl sm:text-3xl font-bold tracking-tight text-[var(--admin-text)]">
            {formatCurrency(metrics.thisMonthRevenueTRY)}
          </p>
          <p className="mt-2 text-xs text-[var(--admin-muted)]">
            Bu ay içinde {metrics.thisMonthCount} bağış alındı
          </p>
        </div>
      </div>

      {/* Pie Charts Section */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <PieChartIcon className="size-5 text-[var(--admin-primary-strong)]" />
          <h2 className="text-lg font-semibold text-[var(--admin-text)]">
            Bağış ve Gelir Dağılım Grafikleri
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {/* 1. Grup Türü Dağılımı */}
          <DonationPieChart
            title="Kullanılan Grup & Operasyon Türü"
            description="Kesim videosu, standart video veya videosuz genel bağış oranları"
            slices={charts.groupType}
          />

          {/* 2. Ödeme Yöntemi & Alınan Ücret */}
          <DonationPieChart
            title="Alınan Ücret & Ödeme Yöntemi"
            description="Kredi Kartı, Havale / EFT ve manuel aktarım kırılımı"
            slices={charts.paymentMethod}
          />

          {/* 3. Kampanya Kategorileri */}
          <DonationPieChart
            title="Kategorilere Göre Bağış Payı"
            description="Su Kuyusu, Kurban, Yetim ve diğer yardım kategorileri"
            slices={charts.category}
          />

          {/* 4. Bağış Tutar Segmentleri */}
          <DonationPieChart
            title="Bağış Tutar Kademeleri (Segmentler)"
            description="Mikro bağışlardan kurumsal ve büyük hisselere dağılım"
            slices={charts.amountTier}
          />
        </div>
      </section>

      {/* Filter and Table Section */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] pb-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">
              Tüm Bağış Kayıtları ({records.length})
            </h2>
            <p className="text-xs text-[var(--admin-muted)]">
              Kayıtları filtreleyin, inceleyin veya Excel/CSV olarak indirin.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportCSV}
              disabled={filteredRecords.length === 0}
              className="admin-action-button-secondary flex items-center gap-1.5 text-xs py-2 px-3 disabled:opacity-50"
            >
              <Download className="size-4" />
              CSV / Excel İndir ({filteredRecords.length})
            </button>
            <Link
              href="/panel/bagis-yonetimi"
              className="admin-action-button flex items-center gap-1.5 text-xs py-2 px-3"
            >
              <HandCoins className="size-4" />
              Bağış Yönetimi
            </Link>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface-raised)] p-4 sm:p-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Search Box */}
            <div className="sm:col-span-2">
              <label className="admin-label block">Bağışçı, Makbuz veya Not Ara</label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-[var(--admin-muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="İsim, e-posta, telefon, makbuz numarası..."
                  className="admin-input pl-9"
                />
              </div>
            </div>

            {/* Group Type */}
            <div>
              <label className="admin-label block">Grup Türü</label>
              <select
                className="admin-input mt-1"
                value={selectedGroupType}
                onChange={(e) => {
                  setSelectedGroupType(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Tüm Grup Türleri</option>
                <option value="slaughter_video">Kesim Videosu (Kurban / Adak)</option>
                <option value="standard_video">Standart Video (Su Kuyusu vb.)</option>
                <option value="none">Genel Bağış (Videosuz)</option>
              </select>
            </div>

            {/* Payment Method */}
            <div>
              <label className="admin-label block">Ödeme Yöntemi</label>
              <select
                className="admin-input mt-1"
                value={selectedPaymentMethod}
                onChange={(e) => {
                  setSelectedPaymentMethod(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Tüm Ödeme Yolları</option>
                <option value="card">Kredi / Banka Kartı</option>
                <option value="bank_transfer">Havale / EFT</option>
                <option value="manual">Manuel IBAN</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
            {/* Campaign Select */}
            <div>
              <label className="admin-label block">Kampanya</label>
              <select
                className="admin-input mt-1"
                value={selectedCampaign}
                onChange={(e) => {
                  setSelectedCampaign(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Tüm Kampanyalar</option>
                {campaignOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Select */}
            <div>
              <label className="admin-label block">Durum</label>
              <select
                className="admin-input mt-1"
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Tüm Durumlar</option>
                <option value="paid">Tahsil Edildi (Başarılı)</option>
                <option value="pending_review">İnceleme Bekliyor</option>
                <option value="partially_refunded">Kısmi İade</option>
                <option value="refunded">İade Edildi</option>
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="admin-label block">Başlangıç Tarihi</label>
              <input
                type="date"
                className="admin-input mt-1 text-xs"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* Date To and Reset */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="admin-label block">Bitiş Tarihi</label>
                <input
                  type="date"
                  className="admin-input mt-1 text-xs"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <button
                type="button"
                onClick={resetFilters}
                title="Filtreleri Temizle"
                className="admin-button-secondary mt-5 p-2.5"
              >
                <RotateCcw className="size-4" />
              </button>
            </div>
          </div>

          {/* Filter status bar */}
          <div className="flex flex-wrap items-center justify-between text-xs text-[var(--admin-muted)] pt-2 border-t border-[var(--admin-border)]">
            <div>
              Filtrelenen:{" "}
              <span className="font-semibold text-[var(--admin-text)]">
                {filteredRecords.length}
              </span>{" "}
              bağış kaydı · Toplam:{" "}
              <span className="font-mono font-semibold text-emerald-700">
                {formatCurrency(filteredTotalAmount)}
              </span>
            </div>
            <div>
              Sayfa başına:
              <select
                className="ml-2 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-0.5 text-xs"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <PanelCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-raised)] text-[11px] uppercase tracking-[0.12em] text-[var(--admin-muted)]">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Bağışçı</th>
                  <th className="px-4 py-3.5 font-semibold">Kampanya & Kategori</th>
                  <th className="px-4 py-3.5 font-semibold">Grup Türü</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Alınan Ücret</th>
                  <th className="px-4 py-3.5 font-semibold">Ödeme Yolu</th>
                  <th className="px-4 py-3.5 font-semibold">Makbuz No</th>
                  <th className="px-4 py-3.5 font-semibold">Tarih</th>
                  <th className="px-5 py-3.5 font-semibold">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]">
                {paginatedRecords.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedDonation(item)}
                    className="cursor-pointer transition hover:bg-[var(--admin-surface-raised)]"
                  >
                    {/* Donor */}
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-[var(--admin-text)]">{item.donorName}</p>
                      <p className="mt-0.5 text-xs text-[var(--admin-muted)]">
                        {item.phone || item.email || "İletişim yok"}
                      </p>
                    </td>

                    {/* Campaign */}
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-[var(--admin-text)] line-clamp-1">
                        {item.campaignTitle}
                      </p>
                      <span className="mt-0.5 inline-block text-xs text-[var(--admin-muted)]">
                        {item.categoryName}
                      </span>
                    </td>

                    {/* Group Type Badge */}
                    <td className="px-4 py-3.5">
                      {item.groupType === "slaughter_video" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                          <Video className="size-3 text-amber-600" />
                          Kesim Videosu
                        </span>
                      ) : item.groupType === "standard_video" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          <Video className="size-3 text-emerald-600" />
                          Standart Video
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          Genel Bağış
                        </span>
                      )}
                    </td>

                    {/* Net Amount */}
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-[var(--admin-text)]">
                      {formatCurrency(item.netConfirmedAmount, item.currency)}
                    </td>

                    {/* Payment Method */}
                    <td className="px-4 py-3.5 text-xs">
                      <span className="inline-flex items-center gap-1 text-[var(--admin-text)]">
                        {item.paymentMethod === "card" ? (
                          <CreditCard className="size-3.5 text-[var(--admin-muted)]" />
                        ) : (
                          <Banknote className="size-3.5 text-[var(--admin-muted)]" />
                        )}
                        {item.paymentMethodLabel}
                      </span>
                    </td>

                    {/* Receipt */}
                    <td className="px-4 py-3.5 font-mono text-xs text-[var(--admin-muted)]">
                      {item.receiptNumber || "—"}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3.5 text-xs text-[var(--admin-muted)] whitespace-nowrap">
                      {item.confirmedAt || item.createdAt
                        ? new Date(item.confirmedAt || item.createdAt).toLocaleDateString("tr-TR", {
                            timeZone: "Europe/Istanbul",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })
                        : "—"}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <StatusBadge status={item.status} />
                    </td>
                  </tr>
                ))}

                {paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-[var(--admin-muted)]">
                      Arama ve filtre kriterlerinize uyan bağış kaydı bulunamadı.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Controls */}
          {totalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-[var(--admin-border)] px-5 py-3 text-xs bg-[var(--admin-surface)]">
              <span className="text-[var(--admin-muted)]">
                Sayfa {currentPage} / {totalPages} (Toplam {filteredRecords.length} kayıt)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="admin-button-secondary px-3 py-1 disabled:opacity-40"
                >
                  Önceki
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="admin-button-secondary px-3 py-1 disabled:opacity-40"
                >
                  Sonraki
                </button>
              </div>
            </div>
          ) : null}
        </PanelCard>
      </section>

      {/* Donation Detail Modal */}
      {selectedDonation ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-4 backdrop-blur-xs"
          onClick={() => setSelectedDonation(null)}
          role="dialog"
        >
          <div
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-[var(--admin-surface)] p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--admin-border)] pb-4">
              <div>
                <p className="admin-eyebrow">Bağış Detayı</p>
                <h3 className="mt-1 text-xl font-bold text-[var(--admin-text)]">
                  {selectedDonation.donorName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDonation(null)}
                className="admin-icon-button"
                aria-label="Kapat"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              <div className="rounded-xl bg-[var(--admin-surface-raised)] p-3.5">
                <span className="text-xs text-[var(--admin-muted)] block">Yapılan Bağış</span>
                <span className="font-semibold mt-1 block">{selectedDonation.campaignTitle}</span>
                <span className="text-xs text-[var(--admin-muted)] mt-0.5 block">
                  Kategori: {selectedDonation.categoryName}
                </span>
              </div>

              <div className="rounded-xl bg-[var(--admin-surface-raised)] p-3.5">
                <span className="text-xs text-[var(--admin-muted)] block">Tahsil Edilen Tutar</span>
                <span className="font-mono text-xl font-bold text-emerald-700 mt-1 block">
                  {formatCurrency(selectedDonation.netConfirmedAmount, selectedDonation.currency)}
                </span>
              </div>

              <div className="rounded-xl bg-[var(--admin-surface-raised)] p-3.5">
                <span className="text-xs text-[var(--admin-muted)] block">Grup & Operasyon Türü</span>
                <span className="font-medium mt-1 block">{selectedDonation.groupTypeLabel}</span>
              </div>

              <div className="rounded-xl bg-[var(--admin-surface-raised)] p-3.5">
                <span className="text-xs text-[var(--admin-muted)] block">Ödeme Yöntemi</span>
                <span className="font-medium mt-1 block">{selectedDonation.paymentMethodLabel}</span>
              </div>

              <div className="rounded-xl bg-[var(--admin-surface-raised)] p-3.5">
                <span className="text-xs text-[var(--admin-muted)] block">Makbuz Numarası</span>
                <span className="font-mono font-medium mt-1 block">
                  {selectedDonation.receiptNumber || "Makbuz yok"}
                </span>
              </div>

              <div className="rounded-xl bg-[var(--admin-surface-raised)] p-3.5">
                <span className="text-xs text-[var(--admin-muted)] block">İşlem Durumu</span>
                <div className="mt-1">
                  <StatusBadge status={selectedDonation.status} />
                </div>
              </div>

              <div className="rounded-xl bg-[var(--admin-surface-raised)] p-3.5">
                <span className="text-xs text-[var(--admin-muted)] block">İletişim</span>
                <span className="font-medium mt-1 block">{selectedDonation.email || "E-posta yok"}</span>
                <span className="text-xs text-[var(--admin-muted)] mt-0.5 block">
                  {selectedDonation.phone || "Telefon yok"}
                </span>
              </div>

              <div className="rounded-xl bg-[var(--admin-surface-raised)] p-3.5">
                <span className="text-xs text-[var(--admin-muted)] block">İşlem Tarihi</span>
                <span className="font-medium mt-1 block">
                  {selectedDonation.confirmedAt || selectedDonation.createdAt
                    ? new Date(selectedDonation.confirmedAt || selectedDonation.createdAt).toLocaleString(
                        "tr-TR",
                        { timeZone: "Europe/Istanbul" }
                      )
                    : "—"}
                </span>
              </div>
            </div>

            {selectedDonation.address ? (
              <div className="rounded-xl bg-[var(--admin-surface-raised)] p-3.5 text-sm">
                <span className="text-xs text-[var(--admin-muted)] block">Adres</span>
                <p className="mt-1 font-medium">{selectedDonation.address}</p>
              </div>
            ) : null}

            {selectedDonation.note ? (
              <div className="rounded-xl bg-[var(--admin-surface-raised)] p-3.5 text-sm">
                <span className="text-xs text-[var(--admin-muted)] block">Bağış Notu</span>
                <p className="mt-1 font-medium whitespace-pre-wrap">{selectedDonation.note}</p>
              </div>
            ) : null}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedDonation(null)}
                className="admin-button-secondary"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
