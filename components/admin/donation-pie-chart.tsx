"use client";

import { useMemo, useState } from "react";
import type { ChartSlice } from "@/lib/admin/donation-analytics";
import { formatCurrency } from "@/lib/utils";

type PieChartProps = {
  title: string;
  description?: string;
  slices: ChartSlice[];
  currency?: string;
  defaultMode?: "amount" | "count";
};

export function DonationPieChart({
  title,
  description,
  slices,
  currency = "TRY",
  defaultMode = "amount",
}: PieChartProps) {
  const [mode, setMode] = useState<"amount" | "count">(defaultMode);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  // Calculate items based on current mode (amount vs count)
  const items = useMemo(() => {
    const total = slices.reduce(
      (sum, s) => sum + (mode === "amount" ? s.totalAmount : s.count),
      0
    );

    return slices.map((s) => {
      const val = mode === "amount" ? s.totalAmount : s.count;
      const pct = total > 0 ? (val / total) * 100 : 0;
      return {
        ...s,
        displayValue: val,
        computedPercentage: Number(pct.toFixed(1)),
      };
    });
  }, [slices, mode]);

  const totalValue = useMemo(() => {
    return items.reduce((sum, s) => sum + s.displayValue, 0);
  }, [items]);

  // SVG Donut Path calculations
  const cx = 100;
  const cy = 100;
  const outerR = 76;
  const innerR = 48;

  const paths = useMemo(() => {
    if (totalValue === 0) return [];

    let currentAngle = -Math.PI / 2; // Start from top 12 o'clock

    return items
      .filter((item) => item.displayValue > 0)
      .map((item) => {
        const sliceAngle = (item.displayValue / totalValue) * (Math.PI * 2);
        const startAngle = currentAngle;
        const endAngle = currentAngle + sliceAngle;
        currentAngle = endAngle;

        // If a single slice is 100%, render a complete ring
        if (sliceAngle >= Math.PI * 2 - 0.001) {
          return {
            key: item.key,
            item,
            isFull: true,
            color: item.color,
          };
        }

        const isLarge = sliceAngle > Math.PI ? 1 : 0;

        const x1 = cx + outerR * Math.cos(startAngle);
        const y1 = cy + outerR * Math.sin(startAngle);
        const x2 = cx + outerR * Math.cos(endAngle);
        const y2 = cy + outerR * Math.sin(endAngle);

        const x3 = cx + innerR * Math.cos(endAngle);
        const y3 = cy + innerR * Math.sin(endAngle);
        const x4 = cx + innerR * Math.cos(startAngle);
        const y4 = cy + innerR * Math.sin(startAngle);

        const d = [
          `M ${x1} ${y1}`,
          `A ${outerR} ${outerR} 0 ${isLarge} 1 ${x2} ${y2}`,
          `L ${x3} ${y3}`,
          `A ${innerR} ${innerR} 0 ${isLarge} 0 ${x4} ${y4}`,
          "Z",
        ].join(" ");

        return {
          key: item.key,
          item,
          isFull: false,
          d,
          color: item.color,
        };
      });
  }, [items, totalValue]);

  const activeItem = useMemo(() => {
    if (!hoveredKey) return null;
    return items.find((i) => i.key === hoveredKey) || null;
  }, [hoveredKey, items]);

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm transition hover:shadow-md">
      {/* Header with Title and Mode Switcher */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--admin-border)] pb-3">
        <div>
          <h3 className="font-semibold text-base text-[var(--admin-text)]">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs text-[var(--admin-muted)]">{description}</p>
          ) : null}
        </div>
        <div className="flex rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-raised)] p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => setMode("amount")}
            className={`rounded-md px-2.5 py-1 transition-colors ${
              mode === "amount"
                ? "bg-[var(--admin-primary-strong)] text-white shadow-xs"
                : "text-[var(--admin-muted)] hover:text-[var(--admin-text)]"
            }`}
          >
            ₺ Tutar
          </button>
          <button
            type="button"
            onClick={() => setMode("count")}
            className={`rounded-md px-2.5 py-1 transition-colors ${
              mode === "count"
                ? "bg-[var(--admin-primary-strong)] text-white shadow-xs"
                : "text-[var(--admin-muted)] hover:text-[var(--admin-text)]"
            }`}
          >
            Adet
          </button>
        </div>
      </div>

      {/* Donut Chart SVG and Center Label */}
      <div className="my-4 flex flex-col items-center justify-center">
        <div className="relative size-48 sm:size-52">
          <svg
            viewBox="0 0 200 200"
            className="size-full -rotate-90 transform overflow-visible"
            aria-label={title}
          >
            {paths.length === 0 ? (
              <circle
                cx={cx}
                cy={cy}
                r={(outerR + innerR) / 2}
                fill="none"
                stroke="var(--admin-border)"
                strokeWidth={outerR - innerR}
                className="opacity-40"
              />
            ) : null}

            {paths.map((p) => {
              const isHovered = hoveredKey === p.key;

              if (p.isFull) {
                return (
                  <circle
                    key={p.key}
                    cx={cx}
                    cy={cy}
                    r={(outerR + innerR) / 2}
                    fill="none"
                    stroke={p.color}
                    strokeWidth={outerR - innerR}
                    className="cursor-pointer transition-opacity hover:opacity-90"
                    onMouseEnter={() => setHoveredKey(p.key)}
                    onMouseLeave={() => setHoveredKey(null)}
                  />
                );
              }

              return (
                <path
                  key={p.key}
                  d={p.d}
                  fill={p.color}
                  stroke="var(--admin-surface)"
                  strokeWidth="2.5"
                  className={`cursor-pointer transition-all duration-200 ${
                    isHovered
                      ? "opacity-100 filter drop-shadow-md scale-[1.03] origin-center"
                      : hoveredKey
                        ? "opacity-45"
                        : "opacity-95 hover:opacity-100"
                  }`}
                  onMouseEnter={() => setHoveredKey(p.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                />
              );
            })}
          </svg>

          {/* Center Content */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center p-2">
            {activeItem ? (
              <>
                <span className="truncate max-w-[110px] text-[11px] font-semibold text-[var(--admin-muted)]">
                  {activeItem.label}
                </span>
                <span className="mt-0.5 font-mono text-base font-bold text-[var(--admin-text)]">
                  {mode === "amount"
                    ? formatCurrency(activeItem.displayValue, currency)
                    : `${activeItem.displayValue} adet`}
                </span>
                <span className="mt-0.5 text-xs font-semibold text-emerald-700">
                  %{activeItem.computedPercentage}
                </span>
              </>
            ) : (
              <>
                <span className="text-[11px] uppercase tracking-wider text-[var(--admin-muted)]">
                  Toplam
                </span>
                <span className="mt-0.5 font-mono text-sm sm:text-base font-bold text-[var(--admin-text)]">
                  {mode === "amount"
                    ? formatCurrency(totalValue, currency)
                    : `${totalValue} bağış`}
                </span>
                <span className="mt-0.5 text-[10px] text-[var(--admin-muted)]">
                  {items.length} kategori
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-2 space-y-2 border-t border-[var(--admin-border)] pt-3 text-xs">
        {items.map((item) => {
          const isHovered = hoveredKey === item.key;
          return (
            <div
              key={item.key}
              onMouseEnter={() => setHoveredKey(item.key)}
              onMouseLeave={() => setHoveredKey(null)}
              className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors cursor-pointer ${
                isHovered
                  ? "bg-[var(--admin-surface-raised)] font-medium"
                  : "hover:bg-[var(--admin-surface-raised)]"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate text-[var(--admin-text)]" title={item.label}>
                  {item.label}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 font-mono">
                <span className="text-[var(--admin-muted)]">
                  {mode === "amount"
                    ? formatCurrency(item.displayValue, currency)
                    : `${item.displayValue} adet`}
                </span>
                <span className="w-11 text-right text-xs font-semibold text-[var(--admin-text)]">
                  %{item.computedPercentage}
                </span>
              </div>
            </div>
          );
        })}
        {items.length === 0 ? (
          <p className="text-center text-xs text-[var(--admin-muted)] py-2">
            Gösterilecek veri kaydı bulunmuyor.
          </p>
        ) : null}
      </div>
    </div>
  );
}
