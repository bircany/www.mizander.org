"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Eye,
  EyeOff,
  Layers,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import * as tus from "tus-js-client";

import type { UnifiedDeliveryRow } from "@/lib/admin/unified-panel-data";
import { deliveryVideoMime } from "@/lib/delivery/upload-metadata";

const MAX_BYTES = 2_147_483_648; // 2 GB

type GroupDetail = {
  recipients: Array<{ id: string; name: string; unitIndex: number; status: string }>;
};

type BulkItem = {
  id: string;
  file: File | null;
  previewUrl: string;
  showPreview: boolean;
  groupId: string;
  detail: GroupDetail | null;
  loadingDetail: boolean;
  mode: "now" | "later";
  schedule: string;
  status: "idle" | "waiting" | "uploading" | "completed" | "failed";
  progress: number;
  error: string;
};

function canSelect(row: UnifiedDeliveryRow) {
  if (!row.confirmedCount || !["idle", "paused", "cancelled", "failed"].includes(row.dispatchState)) return false;
  if (!["waiting", "failed", "rejected", "processing_failed", "quarantined"].includes(row.videoStatus)) return false;
  if (row.operationType === "slaughter_video") return row.capacity > 0 && row.confirmedCount >= row.capacity;
  return row.operationType === "standard_video" && ["video_pending", "video_ready", "delivery_started", "completed"].includes(row.groupStatus);
}

function createEmptyItem(): BulkItem {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    file: null,
    previewUrl: "",
    showPreview: false,
    groupId: "",
    detail: null,
    loadingDetail: false,
    mode: "now",
    schedule: "",
    status: "idle",
    progress: 0,
    error: "",
  };
}

export function DeliveryBulkVideoFlow({ rows }: { rows: UnifiedDeliveryRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<BulkItem[]>([createEmptyItem()]);
  const [busy, setBusy] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [currentQueueIndex, setCurrentQueueIndex] = useState<number | null>(null);
  const [globalError, setGlobalError] = useState("");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [groupSearchTerm, setGroupSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const previewUrlsRef = useRef<Set<string>>(new Set());

  // Close dropdown on outside click
  useEffect(() => {
    if (!openDropdownId) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownId(null);
        setGroupSearchTerm("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openDropdownId]);

  const toggleDropdown = useCallback((itemId: string) => {
    setOpenDropdownId((prev) => {
      if (prev === itemId) {
        setGroupSearchTerm("");
        return null;
      }
      setGroupSearchTerm("");
      return itemId;
    });
  }, []);

  const eligibleGroups = useMemo(
    () => [...new Map(rows.filter(canSelect).map((row) => [row.groupId, row])).values()],
    [rows]
  );

  // Keep previews available while form state changes and release them on exit.
  useEffect(() => {
    const urls = previewUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open]);

  function updateItem(id: string, patch: Partial<BulkItem>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function handleFileChange(itemId: string, nextFile: File | null) {
    const previousUrl = items.find((item) => item.id === itemId)?.previewUrl;
    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
      previewUrlsRef.current.delete(previousUrl);
    }
    const newPreviewUrl = nextFile ? URL.createObjectURL(nextFile) : "";
    if (newPreviewUrl) previewUrlsRef.current.add(newPreviewUrl);
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          file: nextFile,
          previewUrl: newPreviewUrl,
          showPreview: false,
          error: "",
        };
      })
    );
  }

  async function handleGroupChange(itemId: string, nextGroupId: string) {
    if (!nextGroupId) {
      updateItem(itemId, { groupId: "", detail: null, error: "" });
      return;
    }
    updateItem(itemId, { groupId: nextGroupId, detail: null, loadingDetail: true, error: "" });
    try {
      const res = await fetch(`/api/delivery/groups/${nextGroupId}/detail`, { cache: "no-store" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Bağışçı listesi alınamadı.");
      updateItem(itemId, { detail: result, loadingDetail: false, error: "" });
    } catch (cause) {
      updateItem(itemId, {
        detail: null,
        loadingDetail: false,
        error: cause instanceof Error ? cause.message : "Bağışçı listesi alınamadı.",
      });
    }
  }

  function addItem() {
    if (busy) return;
    setItems((prev) => [...prev, createEmptyItem()]);
    setGlobalError("");
  }

  function removeItem(itemId: string) {
    if (busy || items.length <= 1) return;
    const previewUrl = items.find((item) => item.id === itemId)?.previewUrl;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrlsRef.current.delete(previewUrl);
    }
    setItems((prev) => prev.filter((item) => item.id !== itemId));
    setGlobalError("");
  }

  function close() {
    if (busy) return;
    items.forEach((item) => {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
        previewUrlsRef.current.delete(item.previewUrl);
      }
    });
    setOpen(false);
    setItems([createEmptyItem()]);
    setBusy(false);
    setAllDone(false);
    setCurrentQueueIndex(null);
    setGlobalError("");
  }

  async function startQueue() {
    if (busy) return;
    setGlobalError("");

    // Validate all items
    let hasValidationError = false;
    const validatedItems = items.map((item) => {
      if (item.status === "completed") return item;

      if (!item.file) {
        hasValidationError = true;
        return { ...item, error: "Lütfen bir video dosyası seçin." };
      }
      const mimeType = deliveryVideoMime(item.file.name, item.file.type);
      if (!mimeType || item.file.size < 1 || item.file.size > MAX_BYTES) {
        hasValidationError = true;
        return { ...item, error: "MP4, MOV veya WebM dosyası seçin (En fazla 2 GB)." };
      }
      if (!item.groupId) {
        hasValidationError = true;
        return { ...item, error: "Lütfen gönderilecek bir grup seçin." };
      }
      const selectedGroup = eligibleGroups.find((g) => g.groupId === item.groupId);
      if (!selectedGroup) {
        hasValidationError = true;
        return { ...item, error: "Seçilen grup bulunamadı." };
      }
      if (!item.detail) {
        hasValidationError = true;
        return { ...item, error: "Grup bilgileri yüklenemedi. Lütfen grubu tekrar seçin." };
      }
      const confirmed = item.detail.recipients.filter((r) => r.status === "confirmed");
      if (confirmed.length !== selectedGroup.confirmedCount) {
        hasValidationError = true;
        return { ...item, error: "Bağışçı sayısı eşleşmiyor. Lütfen sayfayı yenileyin." };
      }
      if (item.mode === "later") {
        if (!item.schedule || !Number.isFinite(Date.parse(item.schedule)) || Date.parse(item.schedule) <= Date.now()) {
          hasValidationError = true;
          return { ...item, error: "Gelecekte bir gönderim zamanı seçin." };
        }
      }
      return { ...item, error: "", status: "waiting" as const };
    });

    if (hasValidationError) {
      setItems(validatedItems);
      setGlobalError("Lütfen eksik veya hatalı video satırlarını düzeltin.");
      return;
    }

    setItems(validatedItems);
    setBusy(true);

    let successCounter = 0;
    let failCounter = 0;
    let unavailableServiceMessage = "";

    // FIFO Queue sequential execution
    for (let index = 0; index < validatedItems.length; index++) {
      const item = validatedItems[index];
      if (item.status === "completed") {
        successCounter++;
        continue;
      }

      setCurrentQueueIndex(index);
      updateItem(item.id, { status: "uploading", progress: 0, error: "" });

      try {
        const group = eligibleGroups.find((g) => g.groupId === item.groupId)!;
        const confirmed = item.detail!.recipients.filter((r) => r.status === "confirmed");
        const dispatchAt = item.mode === "later" ? new Date(item.schedule).toISOString() : null;
        const mimeType = deliveryVideoMime(item.file!.name, item.file!.type)!;

        // 1. Session oluştur
        const sessionRes = await fetch("/api/delivery/uploads/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            groupId: group.groupId,
            groupCode: group.groupCode,
            fileName: item.file!.name,
            mimeType,
            sizeBytes: item.file!.size,
            dispatchAt,
            expectedConfirmedCount: confirmed.length,
          }),
        });

        const session = await sessionRes.json();
        if (sessionRes.status === 503 && session.code === "UPLOAD_SERVICE_NOT_CONFIGURED") {
          unavailableServiceMessage = session.error || "Video yükleme servisi bağlı değil.";
          throw new Error(unavailableServiceMessage);
        }
        if (!sessionRes.ok || !session.ok || !session.endpoint || !session.metadata?.token) {
          throw new Error(session.error || "Video yükleme başlatılamadı.");
        }

        // 2. tus-js-client ile yükle
        await new Promise<void>((resolve, reject) => {
          const upload = new tus.Upload(item.file!, {
            endpoint: session.endpoint,
            metadata: {
              token: session.metadata.token,
              filename: item.file!.name,
              filetype: mimeType,
            },
            chunkSize: 10 * 1024 * 1024,
            parallelUploads: 1,
            retryDelays: [0, 1000, 3000, 5000, 10000],
            storeFingerprintForResuming: false,
            onProgress(uploaded, total) {
              const pct = Math.round((uploaded / total) * 100);
              updateItem(item.id, { progress: pct });
            },
            onError(cause) {
              reject(cause);
            },
            onSuccess() {
              resolve();
            },
          });
          upload.start();
        });

        // 3. Başarılı
        updateItem(item.id, { status: "completed", progress: 100, error: "" });
        successCounter++;
      } catch (cause) {
        const msg = cause instanceof Error ? cause.message : "Video yüklenemedi.";
        if (unavailableServiceMessage) {
          updateItem(item.id, { status: "waiting", progress: 0, error: "" });
          break;
        }
        updateItem(item.id, { status: "failed", error: `${msg} Yeniden deneyebilirsiniz.` });
        failCounter++;
      }
    }

    setBusy(false);
    setCurrentQueueIndex(null);
    router.refresh();

    if (unavailableServiceMessage) {
      setGlobalError(unavailableServiceMessage);
    } else if (failCounter === 0) {
      setAllDone(true);
    } else {
      setGlobalError(
        `${successCounter} video yüklendi, ${failCounter} video yüklenemedi. Hatalı olanları kontrol edip tekrar deneyebilirsiniz.`
      );
    }
  }

  const selectedGroupIds = useMemo(
    () => new Set(items.map((i) => i.groupId).filter(Boolean)),
    [items]
  );

  const completedCount = items.filter((i) => i.status === "completed").length;
  const remainingCount = items.length - completedCount;
  const overallPercent =
    currentQueueIndex !== null
      ? Math.min(
          100,
          Math.round(
            ((currentQueueIndex + (items[currentQueueIndex]?.progress || 0) / 100) / items.length) *
              100
          )
        )
      : allDone
        ? 100
        : 0;

  return (
    <>
      <button
        className="admin-action-button-secondary flex items-center gap-2"
        onClick={() => setOpen(true)}
        ref={triggerRef}
        type="button"
      >
        <Layers className="size-4" />
        Birden fazla video yükle
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/75 backdrop-blur-[2px] sm:items-center sm:p-4 lg:p-6"
          role="presentation"
        >
          <div
            aria-label="Birden fazla video yükle"
            aria-modal="true"
            className="flex h-[100dvh] w-full min-w-0 flex-col border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl sm:h-[min(92dvh,940px)] sm:max-w-6xl sm:rounded-3xl"
            onKeyDown={(event) => {
              if (event.key === "Tab") {
                const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
                  'button:not([disabled]), input:not([disabled]), select:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])',
                );
                if (focusable?.length) {
                  const first = focusable[0];
                  const last = focusable[focusable.length - 1];
                  if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                  } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                  }
                }
              }
              if (event.key !== "Escape") return;
              event.stopPropagation();
              if (openDropdownId) {
                setOpenDropdownId(null);
                setGroupSearchTerm("");
              } else {
                close();
              }
            }}
            ref={dialogRef}
            role="dialog"
            tabIndex={-1}
          >
            {/* Modal Header */}
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--admin-border)] px-5 py-5 sm:px-8 sm:py-6">
              <div>
                <p className="admin-eyebrow">Video teslimatı</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight">Birden fazla video yükle</h2>
                <p className="mt-2 text-sm text-[var(--admin-muted)]">Her video için dosyayı, grubu ve gönderim zamanını seçin.</p>
              </div>
              <button
                aria-label="Kapat"
                className="admin-icon-button"
                disabled={busy}
                onClick={close}
                type="button"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-6">
              {allDone ? (
                <div className="rounded-2xl bg-emerald-50 p-6 text-emerald-900 space-y-4" role="status">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="size-6 text-emerald-600 shrink-0" />
                    <div>
                      <h3 className="font-semibold text-base">Tüm videolar yüklendi</h3>
                      <p className="text-sm mt-0.5">
                        {items.length} video alındı. Videolar hazır olduğunda seçtiğiniz zamanlara göre gönderilecek.
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button className="admin-action-button" onClick={close} type="button">
                      Tamamla ve Kapat
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Queue Progress Bar */}
                  {busy ? (
                    <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 space-y-2.5">
                      <div className="flex items-center justify-between text-sm font-semibold text-blue-900">
                        <span className="flex items-center gap-2">
                          <Loader2 className="size-4 animate-spin text-blue-600" />
                          Videolar yükleniyor: {currentQueueIndex !== null ? currentQueueIndex + 1 : 0} / {items.length}
                        </span>
                        <span className="font-mono text-xs">Toplam %{overallPercent}</span>
                      </div>
                      {currentQueueIndex !== null && items[currentQueueIndex] ? (
                        <p className="text-xs text-blue-700">
                          Şu anda yüklenen:{" "}
                          <span className="font-mono font-semibold">
                            {eligibleGroups.find((g) => g.groupId === items[currentQueueIndex].groupId)?.groupCode || "Grup"}
                          </span>{" "}
                          · {items[currentQueueIndex].file?.name} (%{items[currentQueueIndex].progress})
                        </p>
                      ) : null}
                      <div
                        aria-label="Toplam yükleme ilerlemesi"
                        aria-valuemax={100}
                        aria-valuemin={0}
                        aria-valuenow={overallPercent}
                        className="h-2.5 w-full overflow-hidden rounded-full bg-blue-100"
                        role="progressbar"
                      >
                        <div
                          className="h-full bg-blue-600 transition-all duration-200"
                          style={{ width: `${overallPercent}%` }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {globalError ? (
                    <div className="rounded-xl bg-red-50 p-4 text-sm text-red-800 flex items-start gap-2.5" role="alert">
                      <AlertCircle className="size-5 shrink-0 text-red-600 mt-0.5" />
                      <div>{globalError}</div>
                    </div>
                  ) : null}

                  {/* Items List */}
                  <div className="space-y-4">
                    {items.map((item, index) => {
                      // Filter groups: available for this row are eligibleGroups that are not selected in other rows
                      const availableForThisRow = eligibleGroups.filter(
                        (g) => g.groupId === item.groupId || !selectedGroupIds.has(g.groupId)
                      );
                      const selectedGroup = eligibleGroups.find((g) => g.groupId === item.groupId);

                      return (
                        <div
                          key={item.id}
                          className={`rounded-2xl border p-4 sm:p-5 transition-colors space-y-4 ${
                            item.status === "completed"
                              ? "border-emerald-300 bg-emerald-50/30"
                              : item.status === "uploading"
                                ? "border-blue-400 bg-blue-50/20 shadow-sm"
                                : item.status === "failed"
                                  ? "border-red-300 bg-red-50/30"
                                  : "border-[var(--admin-border)] bg-[var(--admin-surface-raised)]"
                          }`}
                        >
                          {/* Item Top Bar */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">
                                {index + 1}. video
                              </span>
                              {item.status === "completed" ? (
                                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                                  <CheckCircle2 className="size-3" /> Yüklendi
                                </span>
                              ) : item.status === "uploading" ? (
                                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">
                                  <Loader2 className="size-3 animate-spin" /> Yükleniyor (%{item.progress})
                                </span>
                              ) : item.status === "waiting" ? (
                                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                                  <Clock3 className="size-3" /> Sırada Bekliyor
                                </span>
                              ) : item.status === "failed" ? (
                                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 font-medium">
                                  <AlertCircle className="size-3" /> Hata
                                </span>
                              ) : null}
                            </div>

                            {items.length > 1 && !busy && item.status !== "completed" ? (
                              <button
                                aria-label={`${index + 1}. videoyu kaldır`}
                                className="text-[var(--admin-muted)] transition-colors hover:text-red-600 p-1 rounded-lg"
                                onClick={() => removeItem(item.id)}
                                title="Bu videoyu listeden kaldır"
                                type="button"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            ) : null}
                          </div>

                          {/* Item Form Grid */}
                          <div className="grid gap-4 sm:grid-cols-2">
                            {/* Video File Picker */}
                            <div>
                              <label className="admin-label block">Video dosyası</label>
                              <input
                                accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                                className="admin-input mt-1.5"
                                disabled={busy || item.status === "completed"}
                                onChange={(e) => handleFileChange(item.id, e.target.files?.[0] || null)}
                                type="file"
                              />
                              {item.file ? (
                                <div className="mt-2 flex items-center justify-between text-xs text-[var(--admin-muted)]">
                                  <span className="truncate max-w-[200px]" title={item.file.name}>
                                    {item.file.name} · {(item.file.size / 1024 / 1024).toFixed(1)} MB
                                  </span>
                                  {item.previewUrl ? (
                                    <button
                                      className="inline-flex items-center gap-1 text-emerald-700 hover:underline font-medium"
                                      onClick={() => updateItem(item.id, { showPreview: !item.showPreview })}
                                      type="button"
                                    >
                                      {item.showPreview ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                                      {item.showPreview ? "Gizle" : "Önizle"}
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}

                              {item.showPreview && item.previewUrl ? (
                                <div className="mt-2 overflow-hidden rounded-xl bg-black">
                                  <video
                                    className="aspect-video w-full max-h-40 object-contain"
                                    controls
                                    playsInline
                                    preload="metadata"
                                    src={item.previewUrl}
                                  />
                                </div>
                              ) : null}
                            </div>

                            {/* Target Group Selector — Rich Dropdown */}
                            <div className="relative" ref={openDropdownId === item.id ? dropdownRef : undefined}>
                              <label className="admin-label block">Gönderilecek grup</label>

                              {/* Trigger Button */}
                              <button
                                className={`admin-input mt-1.5 flex w-full items-center justify-between gap-2 text-left ${
                                  item.groupId ? "text-[var(--admin-text)]" : "text-[var(--admin-muted)]"
                                }`}
                                disabled={busy || item.status === "completed"}
                                onClick={() => toggleDropdown(item.id)}
                                type="button"
                              >
                                {selectedGroup ? (
                                  <span className="flex items-center gap-2 truncate">
                                    <span className="font-mono font-semibold text-xs">{selectedGroup.groupCode}</span>
                                    <span className="text-xs truncate">— {selectedGroup.campaign}</span>
                                    <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                                      {selectedGroup.confirmedCount} hisse
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-sm">Grup seçin</span>
                                )}
                                <ChevronDown className={`size-4 shrink-0 transition-transform ${openDropdownId === item.id ? "rotate-180" : ""}`} />
                              </button>

                              {/* Dropdown Panel */}
                              {openDropdownId === item.id ? (
                                <div className="mt-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
                                  {/* Search */}
                                  <div className="flex items-center gap-2 border-b border-[var(--admin-border)] px-3 py-2">
                                    <Search className="size-3.5 text-[var(--admin-muted)]" />
                                    <input
                                      autoFocus
                                      className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--admin-muted)]"
                                      onChange={(e) => setGroupSearchTerm(e.target.value)}
                                      placeholder="Grup kodu veya kampanya ara..."
                                      type="text"
                                      value={groupSearchTerm}
                                    />
                                    {groupSearchTerm ? (
                                      <button
                                        className="text-[var(--admin-muted)] hover:text-[var(--admin-text)]"
                                        onClick={() => setGroupSearchTerm("")}
                                        type="button"
                                      >
                                        <X className="size-3.5" />
                                      </button>
                                    ) : null}
                                  </div>

                                  {/* Group Cards List */}
                                  <div className="max-h-72 space-y-1.5 overflow-y-auto p-2">
                                    {(() => {
                                      const searchLower = groupSearchTerm.toLowerCase();
                                      const filtered = availableForThisRow.filter(
                                        (g) =>
                                          !groupSearchTerm ||
                                          g.groupCode.toLowerCase().includes(searchLower) ||
                                          g.campaign.toLowerCase().includes(searchLower) ||
                                          g.recipients.some((r) => r.name.toLowerCase().includes(searchLower))
                                      );
                                      if (!filtered.length) {
                                        return (
                                          <p className="px-2 py-4 text-center text-xs text-[var(--admin-muted)]">
                                            {groupSearchTerm ? "Eşleşen grup bulunamadı." : "Video gönderimine uygun grup yok."}
                                          </p>
                                        );
                                      }
                                      return filtered.map((g) => {
                                        const isSelected = item.groupId === g.groupId;
                                        const confirmedRecipients = g.recipients.filter((r) => r.status === "confirmed");
                                        const firstThree = confirmedRecipients.slice(0, 3);
                                        const remaining = confirmedRecipients.length - 3;

                                        return (
                                          <button
                                            aria-pressed={isSelected}
                                            className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                                              isSelected
                                                ? "border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600/30"
                                                : "border-[var(--admin-border)] hover:border-emerald-500 hover:bg-emerald-50/50"
                                            }`}
                                            key={g.groupId}
                                            onClick={() => {
                                              void handleGroupChange(item.id, g.groupId);
                                              setOpenDropdownId(null);
                                              setGroupSearchTerm("");
                                            }}
                                            type="button"
                                          >
                                            <div className="flex items-center justify-between gap-2">
                                              <span className="font-mono font-bold text-xs">{g.groupCode}</span>
                                              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                                                {g.confirmedCount} hisse
                                              </span>
                                            </div>
                                            <span className="mt-1 block text-xs font-medium text-[var(--admin-text)]">{g.campaign}</span>
                                            <span className="mt-0.5 block text-[10px] text-[var(--admin-muted)]">
                                              {g.videoStatus === "waiting" ? "Video bekliyor" : "Yeniden yükleme"}
                                            </span>

                                            {/* Recipient names */}
                                            {firstThree.length > 0 ? (
                                              <div className="mt-2 flex items-center gap-1 text-[10px] text-[var(--admin-muted)]">
                                                <Users className="size-3 shrink-0" />
                                                <span className="truncate">
                                                  {firstThree.map((r) => r.name).join(", ")}
                                                  {remaining > 0 ? ` ve ${remaining} kişi daha` : ""}
                                                </span>
                                              </div>
                                            ) : null}
                                          </button>
                                        );
                                      });
                                    })()}
                                  </div>

                                  {/* Clear Selection */}
                                  {item.groupId ? (
                                    <div className="border-t border-[var(--admin-border)] px-3 py-2">
                                      <button
                                        className="w-full text-center text-xs text-[var(--admin-muted)] hover:text-red-600 transition-colors"
                                        onClick={() => {
                                          void handleGroupChange(item.id, "");
                                          setOpenDropdownId(null);
                                          setGroupSearchTerm("");
                                        }}
                                        type="button"
                                      >
                                        Seçimi temizle
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}

                              {/* Loading indicator */}
                              {item.loadingDetail ? (
                                <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--admin-muted)]">
                                  <Loader2 className="size-3 animate-spin" /> Grup bilgileri yükleniyor...
                                </p>
                              ) : null}

                              {/* Selected group detail (after selection) */}
                              {selectedGroup && item.detail ? (
                                <div className="mt-2 space-y-1 text-xs">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-[var(--admin-text)]">
                                      {selectedGroup.campaign}
                                    </span>
                                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-emerald-800 font-medium">
                                      {item.detail.recipients.filter((r) => r.status === "confirmed").length} kişi
                                    </span>
                                  </div>
                                  <details className="cursor-pointer text-[var(--admin-muted)] hover:text-[var(--admin-text)]">
                                    <summary>Videoyu alacak kişileri göster</summary>
                                    <ul className="mt-1.5 max-h-28 overflow-y-auto space-y-1 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2">
                                      {item.detail.recipients
                                        .filter((r) => r.status === "confirmed")
                                        .map((r) => (
                                          <li key={r.id} className="text-xs">
                                            {r.unitIndex}. hisse: <span className="font-medium">{r.name}</span>
                                          </li>
                                        ))}
                                    </ul>
                                  </details>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          {/* Schedule Section */}
                          <div className="border-t border-[var(--admin-border)] pt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-4">
                              <span className="font-medium text-[var(--admin-muted)]">Gönderim zamanı:</span>
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  checked={item.mode === "now"}
                                  disabled={busy || item.status === "completed"}
                                  name={`mode-${item.id}`}
                                  onChange={() => updateItem(item.id, { mode: "now" })}
                                  type="radio"
                                />
                                Video hazır olunca gönder
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  checked={item.mode === "later"}
                                  disabled={busy || item.status === "completed"}
                                  name={`mode-${item.id}`}
                                  onChange={() => updateItem(item.id, { mode: "later" })}
                                  type="radio"
                                />
                                Tarih seç
                              </label>
                            </div>

                            {item.mode === "later" ? (
                              <input
                                aria-label="Gönderim tarihi ve saati"
                                className="admin-input text-xs max-w-xs"
                                disabled={busy || item.status === "completed"}
                                onChange={(e) => updateItem(item.id, { schedule: e.target.value })}
                                type="datetime-local"
                                value={item.schedule}
                              />
                            ) : null}
                          </div>

                          {/* Item specific progress or error */}
                          {item.status === "uploading" ? (
                            <div
                              aria-label="Video yükleme ilerlemesi"
                              aria-valuemax={100}
                              aria-valuemin={0}
                              aria-valuenow={item.progress}
                              className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--admin-border)]"
                              role="progressbar"
                            >
                              <div
                                className="h-full bg-emerald-700 transition-all duration-200"
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                          ) : null}

                          {item.error ? (
                            <p className="rounded-lg bg-red-50 p-2.5 text-xs text-red-800" role="alert">
                              {item.error}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  {/* Add Video Button (+) */}
                  {!busy ? (
                    <button
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--admin-border)] p-4 text-sm font-semibold text-[var(--admin-text)] transition-colors hover:border-emerald-600 hover:text-emerald-700 hover:bg-emerald-50/50"
                      onClick={addItem}
                      type="button"
                    >
                      <Plus className="size-4" />
                      Bir video daha ekle
                    </button>
                  ) : null}
                </>
              )}
            </div>

            {/* Modal Footer */}
            {!allDone ? (
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 py-4 sm:px-8 sm:py-5 sm:rounded-b-3xl">
                <p className="text-xs text-[var(--admin-muted)]">
                  {completedCount > 0 ? `${completedCount} / ${items.length} yüklendi · ` : ""}
                  Videolar listedeki sırayla yüklenir.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    className="admin-button-secondary"
                    disabled={busy}
                    onClick={close}
                    type="button"
                  >
                    Vazgeç
                  </button>
                  <button
                    className="admin-action-button"
                    disabled={busy || items.length === 0}
                    onClick={() => void startQueue()}
                    type="button"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Videolar yükleniyor...
                      </>
                    ) : (
                      <>
                        <Upload className="size-4" />
                        {completedCount > 0
                          ? `Kalan videoları yükle (${remainingCount})`
                          : `Videoları yükle (${items.length})`}
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
