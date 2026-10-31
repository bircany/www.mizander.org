"use client";
import { DonationCategoryIcon } from "@/components/icons/donation-category-icon";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { useCart } from "@/lib/cart-context";
import { useCurrency } from "@/lib/currency-context";
import { cn, formatCurrency } from "@/lib/utils";
import type { DonationArea } from "@/lib/public/donation-areas";
import type { AppLocale } from "@/lib/i18n";

type Props = {
  area: DonationArea;
  locale: AppLocale;
};

export function DonationAreaDetail({ area, locale }: Props) {
  const { items, addItem, clearCart, updateTitles } = useCart();
  const { formatPrice } = useCurrency();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    updateTitles({ [area.id]: area.title });
  }, [area.id, area.title, locale, updateTitles]);

  const donationAmount = useMemo(
    () =>
      area.pricingModel === "fixed"
        ? Number(area.unitPrice || 0) * quantity
        : selectedAmount ?? (customAmount ? Number(customAmount) : 0),
    [area.pricingModel, area.unitPrice, customAmount, quantity, selectedAmount],
  );

  function chooseAmount(amount: number) {
    setSelectedAmount(amount);
    setCustomAmount("");
  }

  function addDonation() {
    const hasOtherArea = items.some((item) => item.campaignId !== area.id);
    if (hasOtherArea) {
      clearCart();
      setNotice("Sepetteki önceki bağış alanı temizlendi.");
    }

    addItem({
      campaignId: area.id,
      currency: area.currency,
      title: area.title,
      amount:
        area.pricingModel === "fixed"
          ? Number(area.unitPrice || 0)
          : donationAmount,
      quantity: area.pricingModel === "fixed" ? quantity : 1,
      image: area.image?.src,
      isRecurring: false,
      pricingModel: area.pricingModel,
      unitLabel: area.unitLabel,
      participantRequired: area.participantRequired,
      videoDelivery: area.videoDelivery,
    });
  }

  return (
    <div className="bg-[linear-gradient(180deg,_#fbfbf8_0%,_#eef7ef_100%)]">
      <nav aria-label="Breadcrumb" className="mx-auto max-w-container-max px-margin-mobile pt-6 md:px-margin-desktop">
        <ol className="flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
          <li><Link className="hover:text-primary transition-colors" href="/">Anasayfa</Link></li>
          <li><span className="material-symbols-outlined text-[12px]">chevron_right</span></li>
          <li><Link className="hover:text-primary transition-colors" href="/bagis">Bağış alanları</Link></li>
          <li><span className="material-symbols-outlined text-[12px]">chevron_right</span></li>
          <li className="max-w-[200px] truncate font-semibold text-primary">{area.title}</li>
        </ol>
      </nav>

      <section className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop lg:py-10">
        <div className="overflow-hidden rounded-[32px] border border-[var(--admin-border)] bg-white shadow-[0_6px_32px_rgba(0,0,0,0.06)]">
          <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="relative min-h-[280px] bg-[var(--admin-surface-raised)] lg:min-h-[420px]">
              {area.image ? (
                <Image
                  alt={area.image.alt}
                  className="object-cover"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  src={area.image.src}
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white lg:p-8">
                {area.category ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[var(--admin-text)] backdrop-blur">
                    <DonationCategoryIcon name={area.category.icon || "folder"} className="text-[14px]" />
                    {area.category.name}
                  </span>
                ) : null}
                <h1 className="mt-4 text-3xl font-semibold leading-tight lg:text-5xl">{area.title}</h1>
              </div>
            </div>

            <div className="p-6 lg:p-8">
              <div className="flex flex-wrap gap-2">
                <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", area.isDonationOpen ? "bg-[rgb(166_215_178_/_90%)] text-[var(--admin-primary)]" : "bg-[rgb(245_185_66_/_90%)] text-[var(--admin-warning)]")}>
                  {area.isDonationOpen ? "Yayında" : "Kapalı"}
                </span>
                <span className="rounded-full bg-[var(--admin-surface-raised)] px-3 py-1 text-xs font-semibold text-[var(--admin-muted)]">
                  %{area.progress} tamamlandı
                </span>
              </div>

              <p className="mt-5 text-base leading-8 text-[var(--admin-muted)]">{area.description}</p>

              <dl className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-[var(--admin-surface-raised)] p-4">
                  <dt className="text-xs text-[var(--admin-muted)]">Toplanan</dt>
                  <dd className="mt-2 font-mono text-lg font-semibold text-[var(--admin-text)]">{formatCurrency(area.collectedAmount, area.currency)}</dd>
                </div>
                <div className="rounded-2xl bg-[var(--admin-surface-raised)] p-4">
                  <dt className="text-xs text-[var(--admin-muted)]">Hedef</dt>
                  <dd className="mt-2 font-mono text-lg font-semibold text-[var(--admin-text)]">{formatCurrency(area.targetAmount, area.currency)}</dd>
                </div>
                <div className="rounded-2xl bg-[var(--admin-surface-raised)] p-4">
                  <dt className="text-xs text-[var(--admin-muted)]">Bağışçı</dt>
                  <dd className="mt-2 font-mono text-lg font-semibold text-[var(--admin-text)]">{area.donorCount.toLocaleString("tr-TR")}</dd>
                </div>
              </dl>

              <div className="mt-6">
                <div className="h-3 overflow-hidden rounded-full bg-[var(--admin-border)]" aria-hidden="true">
                  <div className="h-full rounded-full bg-[var(--admin-primary)]" style={{ width: `${area.progress}%` }} />
                </div>
              </div>

              {area.pricingModel === "fixed" ? (
                <div className="mt-6 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface-raised)] p-4">
                  <p className="text-sm font-semibold text-[var(--admin-text)]">
                    {formatCurrency(Number(area.unitPrice), area.currency)} /{" "}
                    {area.unitLabel || "adet"}
                  </p>
                  <label className="mt-3 block">
                    <span className="mb-2 block text-sm text-[var(--admin-muted)]">
                      Adet / hisse
                    </span>
                    <input
                      className="admin-input"
                      max={area.availableStock ?? 100}
                      min={1}
                      onChange={(event) =>
                        setQuantity(Math.max(1, Number(event.target.value) || 1))
                      }
                      type="number"
                      value={quantity}
                    />
                  </label>
                  {area.availableStock !== null ? (
                    <p className="mt-2 text-xs text-[var(--admin-muted)]">
                      Kalan stok: {area.availableStock}
                    </p>
                  ) : null}
                </div>
              ) : (
                <>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {area.suggestedAmounts.map((amount) => (
                  <button
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors",
                      selectedAmount === amount
                        ? "border-[var(--admin-primary)] bg-[rgb(166_215_178_/_12%)] text-[var(--admin-primary)]"
                        : "border-[var(--admin-border)] bg-white text-[var(--admin-text)] hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]",
                    )}
                    key={amount}
                    onClick={() => chooseAmount(amount)}
                    type="button"
                  >
                    {formatCurrency(amount, area.currency)}
                  </button>
                ))}
              </div>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-semibold text-[var(--admin-muted)]">Özel tutar</span>
                <input
                  className="admin-input"
                  inputMode="numeric"
                  min={1}
                  onChange={(event) => {
                    setCustomAmount(event.target.value);
                    setSelectedAmount(null);
                  }}
                  placeholder="Diğer"
                  type="number"
                  value={customAmount}
                />
              </label>
                </>
              )}

              {donationAmount > 0 ? (
                <div className="mt-5 rounded-[24px] border border-dashed border-[var(--admin-primary)]/30 bg-[rgb(166_215_178_/_10%)] p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-[var(--admin-muted)]">Bağış tutarı</p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--admin-primary)]">{formatCurrency(donationAmount, area.currency)}</p>
                </div>
              ) : null}

              {notice ? <p className="mt-4 rounded-2xl bg-[rgb(166_215_178_/_18%)] px-4 py-3 text-sm text-[var(--admin-primary)]">{notice}</p> : null}

              <button
                className="admin-action-button mt-6 w-full justify-center"
                disabled={!donationAmount || !area.isDonationOpen}
                onClick={addDonation}
                type="button"
              >
                {area.isDonationOpen ? "Sepete ekle" : "Bağış kapalı"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
