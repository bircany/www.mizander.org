import { normalizeInternationalPhone } from "@/lib/phone";

export class ManualDonationError extends Error {}
export function moneyCents(value: unknown): number {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(raw)) throw new ManualDonationError("Tutar en fazla iki ondalık basamak içermelidir.");
  const [whole, fraction = ""] = raw.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents < 100 || cents > 100_000_000_000) throw new ManualDonationError("Tutar 1 ile 1.000.000.000 arasında olmalıdır.");
  return cents;
}
export function amountFromCents(cents: number) { return (cents / 100).toFixed(2); }
function phone(value: unknown, country: string) {
  try { return normalizeInternationalPhone(value, country); }
  catch { throw new ManualDonationError("Telefon numarası seçilen ülke için geçerli değil."); }
}
function name(value: unknown) {
  const result = String(value || "").trim();
  if (result.length < 2 || result.length > 120 || /[\u0000-\u001f\u007f]/.test(result)) throw new ManualDonationError("Ad soyad 2–120 karakter olmalıdır.");
  return result;
}
export function parseManualDonation(form: FormData, now = new Date()) {
  const requestId = String(form.get("requestId") || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) throw new ManualDonationError("Kayıt kimliği geçersiz. Formu yeniden açın.");
  const campaignId = Number(form.get("campaignId"));
  const currency = String(form.get("currency") || "");
  if (!["TRY","USD","EUR","GBP"].includes(currency)) throw new ManualDonationError("Para birimi geçersiz.");
  const quantity = Number(form.get("quantity"));
  if (!Number.isSafeInteger(campaignId) || campaignId < 1) throw new ManualDonationError("Kampanya seçin.");
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 500) throw new ManualDonationError("Hisse/adet 1–500 arasında tam sayı olmalıdır.");
  const date = String(form.get("date") || "");
  const dateObject = new Date(`${date}T12:00:00+03:00`);
  const today = now.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(dateObject.getTime()) || dateObject.toISOString().slice(0,10) !== date || date > today || date < "2000-01-01") throw new ManualDonationError("Geçerli bir ödeme tarihi girin; gelecek tarih olamaz.");
  const country = String(form.get("country") || "TR");
  const donorName = name(form.get("donorName"));
  const donorPhone = phone(form.get("phone"), country);
  const whatsappCountry = String(form.get("whatsappCountry") || country);
  const whatsapp = form.get("whatsapp") ? phone(form.get("whatsapp"), whatsappCountry) : donorPhone;
  const note = String(form.get("note") || "").trim();
  if (note.length > 2000) throw new ManualDonationError("Not en fazla 2000 karakter olabilir.");
  const separateParticipants = form.get("participantMode") === "different";
  const participants = Array.from({ length: quantity }, (_, i) => {
    const participantName = form.get(`participantName.${i}`);
    const participantPhone = form.get(`participantPhone.${i}`);
    if (separateParticipants && (!String(participantName || "").trim() || !String(participantPhone || "").trim())) {
      throw new ManualDonationError(`${i + 1}. kişi için ad soyad ve telefon girin.`);
    }
    return {
      name: name(participantName || donorName),
      phone: participantPhone ? phone(participantPhone, String(form.get(`participantCountry.${i}`) || country)) : whatsapp,
    };
  });
  return {
    requestId, campaignId, currency, quantity, donorName, phone: donorPhone, whatsapp, country, date, note, participants,
    receivedCents: moneyCents(form.get("receivedAmount")),
    expectedCents: moneyCents(form.get("expectedAmount")),
    excessConfirmed: form.get("excessConfirmed") === "on",
    contactConsent: form.get("contactConsent") === "on",
    proxyConsent: form.get("proxyConsent") === "on",
  };
}
export type ManualDonationInput = ReturnType<typeof parseManualDonation>;

export function compareManualPayment(input: ManualDonationInput, campaign: { pricing_model: string; unit_price: string | number | null; video_delivery: string; operation_type: string | null; currency: string }) {
  if (input.currency !== campaign.currency || !["fixed","free"].includes(campaign.pricing_model)) throw new ManualDonationError("Kampanya para birimi veya fiyatlandırması değişti. Formu yeniden açın.");
  const expected = campaign.pricing_model === "fixed" ? moneyCents(campaign.unit_price) * input.quantity : input.expectedCents;
  if (!Number.isSafeInteger(expected) || expected > 100_000_000_000) throw new ManualDonationError("Toplam tutar sınırı aşıldı.");
  if (campaign.pricing_model === "free" && input.quantity !== 1) throw new ManualDonationError("Serbest tutarlı bağışta adet 1 olmalıdır.");
  if (expected !== input.expectedCents) throw new ManualDonationError("Kampanya fiyatı değişti. Formu yeniden açıp güncel tutarı kontrol edin.");
  if (input.receivedCents < expected) throw new ManualDonationError(`${amountFromCents(expected - input.receivedCents)} ${campaign.currency} eksik ödeme var. Kayıt oluşturulmadı.`);
  if (input.receivedCents > expected && !input.excessConfirmed) throw new ManualDonationError("Fazla ödemeyi kontrol ederek onaylayın.");
  if (campaign.video_delivery === "video" && !input.contactConsent) throw new ManualDonationError("WhatsApp ile video iletimi için bağışçı onayını doğrulayın.");
  if (campaign.operation_type === "slaughter_video" && !input.proxyConsent) throw new ManualDonationError("Kesim bağışında vekâlet alındığını doğrulayın.");
  return expected;
}
