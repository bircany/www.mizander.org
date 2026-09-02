"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ImageUp,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { uploadMedia, type MediaActionState } from "@/lib/admin/media-actions";
import {
  deleteUnifiedCampaign,
  saveUnifiedCampaign,
  type CampaignActionState,
} from "@/lib/admin/unified-campaign-actions";
import {
  DELIVERY_TEMPLATE_TOKENS,
  extractEditableDeliveryMessage,
  sanitizeEditableDeliveryMessage,
} from "@/lib/delivery/template";

export type CampaignEditorRecord = {
  id: string;
  title: string;
  description: string;
  category: string;
  currency: string;
  pricingModel: string;
  targetAmount: number | null;
  unitPrice: number | null;
  unitLabel: string;
  totalStock: number | null;
  videoDelivery: string;
  operationType: string;
  groupCapacity: number | null;
  participantRequired: boolean;
  publishStartAt: string;
  publishEndAt: string;
  messageTemplate: string;
  slaughterScript: string;
  slaughterScriptVersion: number | null;
  status: string;
  closeReason: string;
  image: string;
};

type Option = { label: string; value: string };

const initialState: CampaignActionState = {
  success: false,
  message: null,
};

const steps = [
  { title: "Temel bilgiler", short: "Bilgiler" },
  { title: "Fiyatlandırma", short: "Fiyat" },
  { title: "Teslimat", short: "Teslimat" },
  { title: "Yayınlama", short: "Yayın" },
] as const;

function DeleteForm({ id }: { id: string }) {
  const [state, action] = useActionState(deleteUnifiedCampaign, initialState);
  return (
    <form action={action} className="border-t border-[var(--admin-border)] px-5 py-4">
      <input name="id" type="hidden" value={id} />
      <button
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-300 px-3 text-xs font-semibold text-red-700"
        type="submit"
      >
        <Trash2 className="size-4" />
        Boş taslağı sil
      </button>
      {state.message ? (
        <p className="mt-2 text-xs text-[var(--admin-muted)]">{state.message}</p>
      ) : null}
    </form>
  );
}

function CampaignCoverPicker({
  defaultValue,
  initialOptions,
}: {
  defaultValue: string;
  initialOptions: Option[];
}) {
  const [options, setOptions] = useState(initialOptions);
  const [selected, setSelected] = useState(defaultValue);
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [preview, setPreview] = useState("");
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadState, setUploadState] = useState<MediaActionState>({
    message: null,
    success: false,
  });
  const previewRef = useRef("");

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  function chooseFile(nextFile?: File) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const nextPreview = nextFile ? URL.createObjectURL(nextFile) : "";
    previewRef.current = nextPreview;
    setPreview(nextPreview);
    setFile(nextFile || null);
    setDimensions(null);
    setUploadState({ message: null, success: false });
    if (!nextFile) return;
    setAlt(nextFile.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));

    const probe = new window.Image();
    probe.onload = () =>
      setDimensions({ width: probe.naturalWidth, height: probe.naturalHeight });
    probe.src = nextPreview;
  }

  async function handleUpload() {
    if (!file || !alt.trim()) {
      setUploadState({
        success: false,
        message: "Yüklenecek görsel ve alternatif metin zorunludur.",
      });
      return;
    }
    setUploading(true);
    const body = new FormData();
    body.set("file", file);
    body.set("alt", alt.trim());
    try {
      const result = await uploadMedia(
        { message: null, success: false },
        body,
      );
      setUploadState(result);
      if (result.success && result.media) {
        setOptions((current) => [
          result.media!,
          ...current.filter((option) => option.value !== result.media!.value),
        ]);
        setSelected(result.media.value);
        chooseFile();
        setUploadState(result);
      }
    } catch {
      setUploadState({
        success: false,
        message: "Görsel yüklenirken beklenmeyen bir hata oluştu.",
      });
    } finally {
      setUploading(false);
    }
  }

  const ratioWarning =
    dimensions && Math.abs(dimensions.width / dimensions.height - 16 / 9) > 0.03;
  const sizeWarning =
    dimensions && (dimensions.width < 1200 || dimensions.height < 675);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="space-y-3">
        <select
          className="admin-input"
          name="image"
          onChange={(event) => setSelected(event.target.value)}
          value={selected}
        >
          <option value="">Görsel seçilmedi</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <p className="text-[11px] leading-5 text-[var(--admin-muted)]">
          Kapak oranı: <strong>16:9</strong> · önerilen <strong>1600 × 900 px</strong> ·
          minimum 1200 × 675 px · JPG, PNG veya WebP · en fazla 10 MB
        </p>
        <label className="flex min-h-28 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-center transition hover:border-[var(--admin-primary)]">
          <input
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => chooseFile(event.target.files?.[0])}
            type="file"
          />
          <span>
            <ImageUp className="mx-auto size-6 text-[var(--admin-primary)]" />
            <strong className="mt-2 block text-xs">Bilgisayardan kapak seç</strong>
          </span>
        </label>
        {file ? (
          <div className="space-y-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-raised)] p-3">
            <label>
              <span className="admin-label">Alternatif metin *</span>
              <input
                className="admin-input"
                onChange={(event) => setAlt(event.target.value)}
                value={alt}
              />
            </label>
            {dimensions ? (
              <p className={ratioWarning || sizeWarning ? "text-xs text-amber-700" : "text-xs text-emerald-700"}>
                Dosya: {dimensions.width} × {dimensions.height} px
                {ratioWarning ? " · Görsel 16:9 değil; kartlarda kırpılabilir." : ""}
                {sizeWarning ? " · Önerilen minimum ölçünün altında." : ""}
              </p>
            ) : null}
            <button
              className="admin-action-button"
              disabled={uploading}
              onClick={handleUpload}
              type="button"
            >
              {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {uploading ? "Yükleniyor" : "Yükle ve kapak olarak seç"}
            </button>
          </div>
        ) : null}
        {uploadState.message ? (
          <p
            aria-live="polite"
            className={uploadState.success ? "text-xs text-emerald-700" : "text-xs text-red-700"}
          >
            {uploadState.message}
          </p>
        ) : null}
      </div>
      <div className="relative aspect-video overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        {preview ? (
          <Image
            alt="Yüklenecek kapak önizlemesi"
            className="object-cover"
            fill
            sizes="256px"
            src={preview}
            unoptimized
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center px-3 text-center text-xs text-[var(--admin-muted)]">
            Yeni görsel önizlemesi
          </span>
        )}
      </div>
    </div>
  );
}

export function UnifiedCampaignEditor({
  categories,
  media,
  record,
}: {
  categories: Option[];
  media: Option[];
  record?: CampaignEditorRecord;
}) {
  const [state, action] = useActionState(saveUnifiedCampaign, initialState);
  const [step, setStep] = useState(0);
  const [pricingModel, setPricingModel] = useState(record?.pricingModel || "");
  const [videoDelivery, setVideoDelivery] = useState(record?.videoDelivery || "");
  const [operationType, setOperationType] = useState(record?.operationType || "");
  const [status, setStatus] = useState(record?.status || "draft");
  const [closeReason, setCloseReason] = useState(record?.closeReason || "");
  const [messageBody, setMessageBody] = useState(() =>
    extractEditableDeliveryMessage(record?.messageTemplate),
  );
  const [isPending, startTransition] = useTransition();
  const [coverPickerKey, setCoverPickerKey] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const id = record?.id;

  useEffect(() => {
    if (state.success) dialogRef.current?.close();
  }, [state.success]);

  function openDialog() {
    formRef.current?.reset();
    setStep(0);
    setPricingModel(record?.pricingModel || "");
    setVideoDelivery(record?.videoDelivery || "");
    setOperationType(record?.operationType || "");
    setStatus(record?.status || "draft");
    setCloseReason(record?.closeReason || "");
    setMessageBody(extractEditableDeliveryMessage(record?.messageTemplate));
    setCoverPickerKey((current) => current + 1);
    dialogRef.current?.showModal();
  }

  function validateCurrentStep() {
    const panel = formRef.current?.querySelector<HTMLElement>(`[data-step="${step}"]`);
    if (!panel) return true;
    const fields = Array.from(
      panel.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        "input, select, textarea",
      ),
    );
    const invalid = fields.find((field) => !field.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      return false;
    }
    return true;
  }

  function nextStep() {
    if (validateCurrentStep()) {
      setStep((current) => Math.min(current + 1, steps.length - 1));
    }
  }

  return (
    <>
      {record ? (
        <article className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-raised)] p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-[var(--admin-text)]">{record.title}</p>
              <p className="mt-1 text-xs text-[var(--admin-muted)]">
                {record.pricingModel === "fixed" ? "Sabit tutar" : "Serbest tutar"} ·{" "}
                {record.videoDelivery === "video" ? "Videolu" : "Videosuz"}
              </p>
            </div>
            <span className="rounded-full bg-[var(--admin-surface)] px-2.5 py-1 text-[11px] font-semibold uppercase text-[var(--admin-muted)]">
              {record.status === "active" ? "Aktif" : record.status === "draft" ? "Taslak" : record.status === "closed" ? "Kapalı" : "Arşiv"}
            </span>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-[var(--admin-surface)] p-3">
              <dt className="text-[11px] text-[var(--admin-muted)]">
                {record.pricingModel === "fixed" ? "Birim fiyat" : "Hedef"}
              </dt>
              <dd className="mt-1 font-mono text-sm font-semibold">
                {record.pricingModel === "fixed"
                  ? `${record.unitPrice?.toLocaleString("tr-TR") || "—"} ${record.currency}`
                  : `${record.targetAmount?.toLocaleString("tr-TR") || "—"} ${record.currency}`}
              </dd>
            </div>
            <div className="rounded-lg bg-[var(--admin-surface)] p-3">
              <dt className="text-[11px] text-[var(--admin-muted)]">
                {record.pricingModel === "fixed" ? "Toplam stok" : "Teslimat"}
              </dt>
              <dd className="mt-1 text-sm font-semibold">
                {record.pricingModel === "fixed"
                  ? record.totalStock?.toLocaleString("tr-TR") || "Sınırsız"
                  : record.videoDelivery === "video" ? "Videolu" : "Videosuz"}
              </dd>
            </div>
          </dl>
          {record.status === "closed" && record.closeReason ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                Kapatma nedeni
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-amber-950">
                {record.closeReason}
              </p>
            </div>
          ) : null}
          <button className="admin-action-button mt-5 w-full justify-center" onClick={openDialog} type="button">
            <Pencil className="size-4" />
            Kampanyayı düzenle
          </button>
        </article>
      ) : (
        <button className="admin-action-button w-fit" onClick={openDialog} type="button">
          <Plus className="size-4" />
          Yeni bağış kampanyası
        </button>
      )}

      <dialog
        aria-labelledby={`campaign-dialog-title-${id || "new"}`}
        className="m-auto max-h-[92vh] w-[min(94vw,52rem)] overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-0 text-[var(--admin-text)] shadow-2xl backdrop:bg-slate-950/55"
        onCancel={() => setStep(0)}
        ref={dialogRef}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--admin-border)] px-5 py-4 sm:px-6">
          <div>
            <p className="admin-eyebrow">{record ? "Kampanya düzenle" : "Yeni kampanya"}</p>
            <h2 className="mt-1 text-xl font-semibold" id={`campaign-dialog-title-${id || "new"}`}>
              {record?.title || "Bağış kampanyası oluştur"}
            </h2>
          </div>
          <button
            aria-label="Pencereyi kapat"
            className="grid size-10 shrink-0 place-items-center rounded-lg border border-[var(--admin-border)] text-[var(--admin-muted)] hover:text-[var(--admin-text)]"
            onClick={() => dialogRef.current?.close()}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="border-b border-[var(--admin-border)] px-5 py-4 sm:px-6">
          <ol className="grid grid-cols-4 gap-2">
            {steps.map((item, index) => (
              <li key={item.title}>
                <div
                  aria-current={index === step ? "step" : undefined}
                  className={`h-1.5 rounded-full ${
                    index <= step ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-border)]"
                  }`}
                />
                <p className={`mt-2 text-[11px] font-semibold ${index === step ? "text-[var(--admin-text)]" : "text-[var(--admin-muted)]"}`}>
                  <span className="hidden sm:inline">{index + 1}. </span>{item.short}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <form
          className="flex max-h-[calc(92vh-10rem)] flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            if (step < steps.length - 1) {
              nextStep();
              return;
            }
            if (!validateCurrentStep() || !formRef.current) return;
            const formData = new FormData(formRef.current);
            startTransition(() => action(formData));
          }}
          ref={formRef}
        >
          {id ? <input name="id" type="hidden" value={id} /> : null}

          <div className="overflow-y-auto px-5 py-5 sm:px-6">
            <div data-step="0" hidden={step !== 0}>
              <StepHeading
                description="Bağışçıların göreceği içerik ve kampanyanın yayın tarihlerini belirleyin."
                title="Temel bilgiler"
              />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Başlık *">
                  <input className="admin-input" defaultValue={record?.title} name="title" required />
                </Field>
                <Field label="Kategori *">
                  <select className="admin-input" defaultValue={record?.category || ""} name="category" required>
                    <option disabled value="">Seçiniz</option>
                    {categories.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </Field>
                <Field full label="Açıklama">
                  <textarea className="admin-input min-h-28" defaultValue={record?.description} name="description" />
                </Field>
                <Field label="Para birimi *">
                  <select className="admin-input" defaultValue={record?.currency || "TRY"} name="currency" required>
                    {["TRY", "USD", "EUR", "GBP"].map((currency) => (
                      <option key={currency}>{currency}</option>
                    ))}
                  </select>
                </Field>
                <Field full label="Kapak görseli">
                  <CampaignCoverPicker
                    defaultValue={record?.image || ""}
                    initialOptions={media}
                    key={coverPickerKey}
                  />
                </Field>
                <Field label="Yayın başlangıcı">
                  <input className="admin-input" defaultValue={record?.publishStartAt} name="publishStartAt" type="datetime-local" />
                </Field>
                <Field label="Yayın bitişi">
                  <input className="admin-input" defaultValue={record?.publishEndAt} name="publishEndAt" type="datetime-local" />
                </Field>
              </div>
            </div>

            <div data-step="1" hidden={step !== 1}>
              <StepHeading
                description="Önce bağışın tutar modelini seçin. Yalnız seçtiğiniz modele ait alanlar gösterilir."
                title="Fiyatlandırma"
              />
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <ChoiceCard
                  checked={pricingModel === "free"}
                  description="Bağışçı istediği tutarı girer. Su kuyusu ve afet yardımı gibi hedefli kampanyalar."
                  label="Serbest tutar"
                  name="pricingModel"
                  onChange={() => setPricingModel("free")}
                  value="free"
                />
                <ChoiceCard
                  checked={pricingModel === "fixed"}
                  description="Birim fiyat ve adet kullanılır. Kurban hissesi, küçükbaş ve adak gibi bağışlar."
                  label="Sabit tutar"
                  name="pricingModel"
                  onChange={() => setPricingModel("fixed")}
                  value="fixed"
                />
              </div>
              {!pricingModel ? (
                <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Devam etmek için bir fiyatlandırma modeli seçin.
                </p>
              ) : null}
              {pricingModel === "free" ? (
                <div className="mt-5">
                  <Field label="Toplanacak hedef tutar *">
                    <input className="admin-input" defaultValue={record?.targetAmount ?? ""} min="0.01" name="targetAmount" required step="0.01" type="number" />
                  </Field>
                </div>
              ) : null}
              {pricingModel === "fixed" ? (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field label="Birim fiyat *">
                    <input className="admin-input" defaultValue={record?.unitPrice ?? ""} min="0.01" name="unitPrice" required step="0.01" type="number" />
                  </Field>
                  <Field label="Birim etiketi *">
                    <input className="admin-input" defaultValue={record?.unitLabel || "adet"} name="unitLabel" placeholder="hisse, küçükbaş, adet" required />
                  </Field>
                  <Field full label="Toplam stok (isteğe bağlı)">
                    <input className="admin-input" defaultValue={record?.totalStock ?? ""} min="1" name="totalStock" step="1" type="number" />
                  </Field>
                </div>
              ) : null}
            </div>

            <div data-step="2" hidden={step !== 2}>
              <StepHeading
                description="Bağış sonrasında yalnız teşekkür ekranı mı, kişiye özel video teslimatı mı kullanılacağını seçin."
                title="Teslimat ve katılımcılar"
              />
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <ChoiceCard
                  checked={videoDelivery === "none"}
                  description="Ödeme sonrası düzenlenebilir teşekkür içeriği gösterilir."
                  label="Videosuz"
                  name="videoDelivery"
                  onChange={() => {
                    setVideoDelivery("none");
                    setOperationType("");
                  }}
                  value="none"
                />
                <ChoiceCard
                  checked={videoDelivery === "video"}
                  description="Video işlenir, WhatsApp taslağı hazırlanır ve kontrollü gönderilir."
                  label="Videolu"
                  name="videoDelivery"
                  onChange={() => setVideoDelivery("video")}
                  value="video"
                />
              </div>
              {!videoDelivery ? (
                <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Devam etmek için teslimat türünü seçin.
                </p>
              ) : null}
              {videoDelivery === "video" ? (
                <div className="mt-5 space-y-5">
                  <div>
                    <p className="mb-3 text-xs font-semibold text-[var(--admin-muted)]">Operasyon tipi *</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <ChoiceCard
                        checked={operationType === "standard_video"}
                        description="Kesim adımı olmadan standart bağış videosu hazırlanır."
                        label="Standart video"
                        name="operationType"
                        onChange={() => setOperationType("standard_video")}
                        value="standard_video"
                      />
                      <ChoiceCard
                        checked={operationType === "slaughter_video"}
                        description="Grup dolumu, kesim planı ve grup kodu doğrulaması uygulanır."
                        label="Kesim videosu"
                        name="operationType"
                        onChange={() => setOperationType("slaughter_video")}
                        value="slaughter_video"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {pricingModel === "fixed" ? (
                      <Field label="Video grup kapasitesi *">
                        <input className="admin-input" defaultValue={record?.groupCapacity ?? ""} min="1" name="groupCapacity" required step="1" type="number" />
                      </Field>
                    ) : null}
                    <Field full label="WhatsApp mesaj şablonu">
                      <textarea
                        className="admin-input min-h-28"
                        maxLength={600}
                        name="messageBody"
                        onChange={(event) =>
                          setMessageBody(
                            sanitizeEditableDeliveryMessage(event.target.value),
                          )
                        }
                        value={messageBody}
                      />
                      <span className="mt-2 flex items-center justify-between gap-3 text-[11px] text-[var(--admin-muted)]">
                        <span>Yalnız mesaj metnini düzenleyebilirsiniz.</span>
                        <span>{messageBody.length} / 600</span>
                      </span>
                      <span className="mt-3 block rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3">
                        <span className="block text-[11px] font-semibold text-[var(--admin-muted)]">
                          Sistem tarafından korunan alanlar
                        </span>
                        <span className="mt-2 flex flex-wrap gap-2">
                          {DELIVERY_TEMPLATE_TOKENS.map((token) => (
                            <span
                              className="rounded-md bg-[var(--admin-surface-raised)] px-2 py-1 font-mono text-[11px] font-semibold text-[var(--admin-primary)]"
                              key={token}
                            >
                              {token}
                            </span>
                          ))}
                        </span>
                      </span>
                    </Field>
                  </div>
                  {operationType === "slaughter_video" ? (
                    <Field full label="Kesim sırasında okunacak metin *">
                      <textarea
                        className="admin-input min-h-28"
                        defaultValue={record?.slaughterScript}
                        name="slaughterScript"
                        required
                      />
                      <span className="mt-2 block text-[11px] leading-5 text-[var(--admin-muted)]">
                        Bu metin kesim kaydı sırasında sürümlenerek operasyon grubuna sabitlenir.
                      </span>
                    </Field>
                  ) : null}
                </div>
              ) : null}
              {pricingModel === "fixed" ? (
                <label className="mt-5 flex items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-raised)] p-4 text-sm font-medium">
                  <input defaultChecked={record?.participantRequired} name="participantRequired" type="checkbox" />
                  <span>
                    Katılımcı / vekâlet bilgisi zorunlu
                    <span className="mt-1 block text-xs font-normal leading-5 text-[var(--admin-muted)]">
                      Her adet veya hisse için kişi bilgisi alınır. Bu seçenek videolu ve videosuz sabit bağışlarda kullanılabilir.
                    </span>
                  </span>
                </label>
              ) : null}
            </div>

            <div data-step="3" hidden={step !== 3}>
              <StepHeading
                description="Kampanyayı taslak olarak saklayabilir veya kontrolleriniz tamamsa doğrudan yayına alabilirsiniz."
                title="Son kontrol ve yayınlama"
              />
              <div className="mt-5 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-raised)] p-4">
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-[var(--admin-muted)]">Fiyatlandırma</dt>
                    <dd className="mt-1 font-semibold">{pricingModel === "fixed" ? "Sabit tutar" : "Serbest tutar"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--admin-muted)]">Teslimat</dt>
                    <dd className="mt-1 font-semibold">{videoDelivery === "video" ? "Videolu" : "Videosuz"}</dd>
                  </div>
                  {videoDelivery === "video" ? (
                    <div>
                      <dt className="text-xs text-[var(--admin-muted)]">Operasyon tipi</dt>
                      <dd className="mt-1 font-semibold">
                        {operationType === "slaughter_video" ? "Kesim videosu" : "Standart video"}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
              <div className="mt-5">
                <Field label="Kampanya durumu *">
                  <select
                    className="admin-input"
                    name="status"
                    onChange={(event) => setStatus(event.target.value)}
                    required
                    value={status}
                  >
                    <option value="draft">Taslak olarak kaydet</option>
                    <option value="active">Aktif — bağışa aç</option>
                    <option value="closed">Kapalı</option>
                    <option value="archived">Arşiv</option>
                  </select>
                </Field>
                <div
                  className={`mt-4 rounded-xl border p-4 ${
                    status === "closed"
                      ? "border-amber-300 bg-amber-50/70"
                      : "border-[var(--admin-border)] bg-[var(--admin-surface-raised)]"
                  }`}
                >
                  <Field label={`Kapatma nedeni${status === "closed" ? " *" : ""}`}>
                    <textarea
                      className="admin-input min-h-24 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={status !== "closed"}
                      name="closeReason"
                      onChange={(event) => setCloseReason(event.target.value)}
                      placeholder={
                        status === "closed"
                          ? "Kampanyanın neden kapatıldığını yazın."
                          : "Kapatma nedeni yazmak için kampanya durumunu Kapalı seçin."
                      }
                      required={status === "closed"}
                      value={closeReason}
                    />
                  </Field>
                  <p className="mt-2 text-xs leading-5 text-[var(--admin-muted)]">
                    Kampanya kapatıldığında bu açıklama tarih ve işlemi yapan yöneticiyle birlikte kaydedilir.
                  </p>
                </div>
              </div>
              {state.message && !state.success ? (
                <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.message}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--admin-border)] px-5 py-4 sm:px-6">
            <button
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--admin-border)] px-4 text-sm font-semibold disabled:opacity-40"
              disabled={step === 0}
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              type="button"
            >
              <ChevronLeft className="size-4" />
              Geri
            </button>
            <p className="hidden text-xs text-[var(--admin-muted)] sm:block">
              {step + 1} / {steps.length}
            </p>
            {step < steps.length - 1 ? (
              <button key="next-step" className="admin-action-button" onClick={nextStep} type="button">
                İleri
                <ChevronRight className="size-4" />
              </button>
            ) : (
              <button key="save-campaign" className="admin-action-button" disabled={isPending} type="submit">
                {isPending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : record ? (
                  <Pencil className="size-4" />
                ) : (
                  <Plus className="size-4" />
                )}
                {isPending ? "Kaydediliyor" : record ? "Değişiklikleri kaydet" : "Kampanyayı oluştur"}
              </button>
            )}
          </div>
        </form>
        {record ? <DeleteForm id={record.id} /> : null}
      </dialog>
    </>
  );
}

function StepHeading({ description, title }: { description: string; title: string }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-[var(--admin-text)]">{title}</h3>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--admin-muted)]">{description}</p>
    </div>
  );
}

function ChoiceCard({
  checked,
  description,
  label,
  name,
  onChange,
  value,
}: {
  checked: boolean;
  description: string;
  label: string;
  name: string;
  onChange: () => void;
  value: string;
}) {
  return (
    <label className={`cursor-pointer rounded-xl border p-4 transition ${checked ? "border-[var(--admin-primary)] bg-emerald-50/60" : "border-[var(--admin-border)] bg-[var(--admin-surface-raised)] hover:border-[var(--admin-primary)]"}`}>
      <span className="flex items-center gap-3">
        <input checked={checked} name={name} onChange={onChange} required type="radio" value={value} />
        <span className="font-semibold">{label}</span>
      </span>
      <span className="mt-2 block pl-7 text-xs leading-5 text-[var(--admin-muted)]">{description}</span>
    </label>
  );
}

function Field({
  children,
  full = false,
  label,
}: {
  children: React.ReactNode;
  full?: boolean;
  label: string;
}) {
  return (
    <fieldset className={full ? "sm:col-span-2" : ""}>
      <legend className="mb-2 block text-xs font-semibold text-[var(--admin-muted)]">{label}</legend>
      {children}
    </fieldset>
  );
}
