"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminPhoneField } from "./admin-phone-field";
import { Download, Plus, Upload, X } from "lucide-react";
import type { CampaignEditorRecord } from "./unified-campaign-editor";
import { attachManualProof, findManualDonor, saveManualDonation } from "@/lib/admin/manual-donation-actions";
import { amountFromCents, moneyCents } from "@/lib/donations/manual-validation";
import { parseParticipantCsv, type ParticipantCsvRow } from "@/lib/donations/participant-csv";
import { formatAdminPhoneInput } from "@/lib/admin/phone-input";
import { normalizeInternationalPhone } from "@/lib/phone";
import { type CountryCode } from "libphonenumber-js/min";
import { formatCurrency } from "@/lib/utils";

export function ManualDonationForm({campaigns}: {campaigns:CampaignEditorRecord[]}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const locked = useRef(false);
  const lookupVersion = useRef(0);
  const [requestId,setRequestId] = useState("");
  const [campaignId,setCampaignId] = useState("");
  const [quantity,setQuantity] = useState("1");
  const [freeAmount,setFreeAmount] = useState("");
  const [received,setReceived] = useState("");
  const [country,setCountry] = useState("TR");
  const [phone,setPhone] = useState("");
  const [name,setName] = useState("");
  const [differentWhatsapp,setDifferentWhatsapp] = useState(false);
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  const [saved,setSaved] = useState<{id:number;receipt:string}|null>(null);
  const [participantMode,setParticipantMode] = useState<"same"|"different">("same");
  const [participants,setParticipants] = useState<ParticipantCsvRow[]>([]);
  const [importMessage,setImportMessage] = useState("");
  const csvInput = useRef<HTMLInputElement>(null);
  const websiteCampaigns = campaigns.filter(c=>c.status === "active");
  const hiddenCampaigns = campaigns.filter(c=>c.status === "draft");
  const campaign = campaigns.find(c=>c.id === campaignId);
  const fixed = campaign?.pricingModel === "fixed";
  let expected = 0, actual = 0;
  try { expected = fixed ? moneyCents(campaign?.unitPrice) * Number(quantity) : moneyCents(freeAmount); } catch { /* incomplete input */ }
  try { actual = moneyCents(received); } catch { /* incomplete input */ }
  const difference = actual - expected;
  const validQuantity = Number.isInteger(Number(quantity)) && Number(quantity)>0 && Number(quantity)<=500;
  const participantCount = validQuantity ? Number(quantity) : 0;
  const separate = fixed && participantCount > 1 && participantMode === "different";
  const completeCount = separate ? Array.from({length:participantCount},(_,i)=>participants[i]).filter(row=>{
    if (!row?.name.trim() || !row?.phone.trim()) return false;
    try {normalizeInternationalPhone(row.phone,row.country);return true;} catch {return false;}
  }).length : 0;
  function resizeParticipants(count: number) {
    setParticipants(previous=>Array.from({length:Math.max(count,previous.length)},(_,i)=>previous[i] || {name:"",phone:"",country:"TR"}));
  }
  function updateParticipant(index: number, patch: Partial<ParticipantCsvRow>) {
    setParticipants(previous=>{
      const next = [...previous];
      next[index] = {...(next[index] || {name:"",phone:"",country:"TR"}),...patch};
      return next;
    });
  }
  async function importCsv(file: File) {
    if (file.size > 1024 * 1024) {setImportMessage("CSV dosyası en fazla 1 MB olabilir.");return;}
    try {
      const rows = parseParticipantCsv(await file.text());
      if (rows.length !== participantCount) {
        setImportMessage(`Dosyada ${rows.length} kişi var; hisse/adet alanında ${participantCount} seçili. Sayıları eşitleyip yeniden aktarın.`);
        return;
      }
      const formatted = rows.map((row,index)=>{
        const country = row.country as CountryCode;
        const result = formatAdminPhoneInput(row.phone,country);
        if (!result) throw new Error(`${index+1}. kişinin telefonu geçerli değil; dosyayı düzeltin.`);
        let phone: string;
        try {phone=normalizeInternationalPhone(result.number,result.country);} catch {throw new Error(`${index+1}. kişinin telefonu geçerli değil; dosyayı düzeltin.`);}
        return {name:row.name,phone,country:result.country};
      });
      setParticipants(formatted);
      setImportMessage(`${formatted.length} kişi aktarıldı. Kaydetmeden önce listeyi kontrol edin.`);
    } catch(error) {setImportMessage(error instanceof Error ? error.message : "CSV dosyası okunamadı.");}
  }
  function downloadTemplate() {
    const csv = "\uFEFFAd Soyad;Telefon;Ülke\r\nAyşe Yılmaz;532 123 45 67;TR\r\n";
    const url = URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    const link = document.createElement("a"); link.href=url; link.download="hissedar-sablonu.csv";link.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function open() {
    form.current?.reset(); locked.current=false; lookupVersion.current++;
    setRequestId(crypto.randomUUID()); setCampaignId(""); setQuantity("1"); setFreeAmount(""); setReceived(""); setCountry("TR"); setPhone(""); setName(""); setDifferentWhatsapp(false); setMessage(""); setSaved(null); setParticipantMode("same"); setParticipants([]); setImportMessage("");
    dialog.current?.showModal();
  }
  async function lookup() {
    if (!phone.trim()) return;
    const version = ++lookupVersion.current;
    try {
      const result = await findManualDonor(phone,country);
      if (version !== lookupVersion.current) return;
      if (result.success) {
        if (result.name) { setName(result.name); setMessage("Kayıtlı bağışçının adı dolduruldu; değiştirebilirsiniz."); }
        else setMessage("Bu numarayla kayıt bulunamadı. Ad soyad girin.");
      } else setMessage(result.message);
    } catch { setMessage("Bağışçı araması yapılamadı. Bilgileri elle girebilirsiniz."); }
  }
  async function submit() {
    if (locked.current || !form.current || !form.current.reportValidity()) return;
    if (!saved && separate && completeCount !== participantCount) {setMessage("Her kişi için ad soyad ve geçerli bir telefon girin.");return;}
    const data = new FormData(form.current);
    if (!saved && difference>0 && !window.confirm(`${formatCurrency(difference/100,campaign?.currency || "TRY")} fazla ödeme var. Tamamı bu kampanyaya bağış olarak kaydedilecek, hisse/adet değişmeyecek. Emin misiniz?`)) return;
    if (difference>0) data.set("excessConfirmed","on");
    locked.current=true; setBusy(true); setMessage("");
    let committed = saved;
    try {
      if (!committed) {
        // Proof is uploaded separately; never include file bytes in payment creation.
        const recordData = new FormData();
        for (const [key,value] of data.entries()) if (typeof value === "string") recordData.set(key,value);
        const response = await saveManualDonation(recordData);
        if (!response.success) { setMessage(response.message); return; }
        committed = {id:response.id,receipt:response.receipt}; setSaved(committed); setMessage(response.message);
      }
      const file = data.get("file");
      if (file instanceof File && file.size>0) {
        const proofData = new FormData(); proofData.set("donationId",String(committed.id)); proofData.set("file",file);
        const proof = await attachManualProof(proofData);
        setMessage(proof.success ? "Bağış ve dekont kaydedildi." : `Bağış kaydedildi. ${proof.message} Dekontu tekrar deneyebilirsiniz.`);
      } else if (saved) setMessage("Dekont dosyası seçin. Bağış zaten kaydedildi.");
      router.refresh();
    } catch { setMessage(committed ? "Bağış kaydı korunuyor. Dekont yüklemesini tekrar deneyebilirsiniz." : "Sonuç alınamadı. Aynı formdan tekrar deneyin; kayıt kimliği mükerrer işlemi önler."); }
    finally {locked.current=false;setBusy(false);}
  }
  const fieldClass = "admin-input w-full";
  return <>
    <button className="inline-flex min-h-8 w-fit shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300" type="button" onClick={open}><Plus className="size-3.5"/>Bağış kaydı</button>
    <dialog ref={dialog} className="w-[min(1120px,96vw)] max-h-[94dvh] overflow-visible rounded-2xl bg-[var(--admin-surface)] p-0 text-[var(--admin-text)] backdrop:bg-black/50" onCancel={event=>{if(locked.current) event.preventDefault();}}>
      <header className="flex items-center justify-between border-b border-[var(--admin-border)] px-5 py-4 sm:px-7"><div><p className="text-xs font-semibold uppercase tracking-widest text-[var(--admin-muted)]">Bağış yönetimi</p><h2 className="mt-1 text-xl font-bold">IBAN bağış kaydı</h2><p className="mt-1 text-sm text-[var(--admin-muted)]">Ödemeyi ve bağışa katılan kişileri kaydedin.</p></div><button className="admin-icon-button" type="button" disabled={busy} onClick={()=>dialog.current?.close()} aria-label="Pencereyi kapat" title="Pencereyi kapat"><X className="size-5" /></button></header>
      <form ref={form} onSubmit={event=>{event.preventDefault();void submit();}} className="max-h-[calc(94dvh-100px)] overflow-y-auto">
        <div className="space-y-5 px-5 py-5 sm:px-7">
        <input type="hidden" name="requestId" value={requestId}/>
        <input type="hidden" name="currency" value={campaign?.currency || ""}/>
        <input type="hidden" name="expectedAmount" value={expected>0 ? amountFromCents(expected) : ""}/>
        <input type="hidden" name="participantMode" value={separate ? "different" : "same"}/>
        <fieldset disabled={busy || !!saved} className="space-y-4 disabled:opacity-70">
          <label className="block text-sm">Bağış alanı *<select className={fieldClass} name="campaignId" required value={campaignId} onChange={event=>{setCampaignId(event.target.value);setQuantity("1");setReceived("");setParticipants([]);setImportMessage("");setParticipantMode("same");}}><option value="">Bağış alanı seçin</option>{websiteCampaigns.length ? <optgroup label="Web sitesinde görünen bağış alanları">{websiteCampaigns.map(c=><option value={c.id} key={c.id}>{c.title} · {c.currency}</option>)}</optgroup> : null}{hiddenCampaigns.length ? <optgroup label="Web sitesinde görünmeyen bağış alanları">{hiddenCampaigns.map(c=><option value={c.id} key={c.id}>{c.title} · {c.currency} · Yalnız yönetim panelinde</option>)}</optgroup> : null}</select><span className="mt-2 block text-xs leading-5 text-[var(--admin-muted)]">Web sitesinde görünmeyen taslak alanlara da buradan manuel IBAN bağışı kaydedebilirsiniz.</span></label>
          <div className="grid gap-4 sm:grid-cols-2">
            {fixed ? <label className="text-sm">Hisse / adet *<input className={fieldClass} name="quantity" type="number" required min="1" max="500" step="1" value={quantity} onChange={e=>{setQuantity(e.target.value);const count=Number(e.target.value);if(Number.isInteger(count)&&count>0&&count<=500){resizeParticipants(count);if(count>1&&campaign?.groupCapacity===1)setParticipantMode("different");}}}/></label> : <><input type="hidden" name="quantity" value="1"/><label className="text-sm">Bağış tutarı *<input className={fieldClass} type="number" required min="1" step="0.01" value={freeAmount} onChange={e=>setFreeAmount(e.target.value)}/></label></>}
            <label className="text-sm">Alınan ödeme ({campaign?.currency || "—"}) *<input className={fieldClass} name="receivedAmount" required type="number" min="1" step="0.01" value={received} onChange={e=>setReceived(e.target.value)}/></label>
          </div>
          {campaign && expected>0 ? <div className={`rounded-xl border p-4 text-sm ${actual>0 && difference<0 ? "border-red-300 bg-red-50 text-red-800" : "border-[var(--admin-border)]"}`}>
            {fixed ? `${quantity} × ${formatCurrency(Number(campaign.unitPrice),campaign.currency)} = ` : "Beklenen: "}{formatCurrency(expected/100,campaign.currency)}
            {actual>0 ? <p className="mt-2">{difference<0 ? `${formatCurrency(-difference/100,campaign.currency)} eksik. Kayıt yapılamaz.` : difference>0 ? `${formatCurrency(difference/100,campaign.currency)} fazla. Kaydetmeden önce onay istenecek.` : "Alınan ödeme ile tutar eşleşiyor."}</p> : null}
          </div> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminPhoneField key={requestId} name="phone" label="Telefon" countryName="country" country={country} value={phone} onCountryChange={value=>{lookupVersion.current++;setCountry(value);}} onChange={value=>{lookupVersion.current++;setPhone(value);}} onBlur={()=>void lookup()} required />
            <label className="text-sm">Ad soyad *<input className={fieldClass} name="donorName" autoComplete="name" required minLength={2} maxLength={120} value={name} onChange={e=>{lookupVersion.current++;setName(e.target.value);}}/></label>
            <label className="text-sm">Ödeme tarihi *<input className={fieldClass} name="date" required type="date" defaultValue={new Date().toLocaleDateString("en-CA",{timeZone:"Europe/Istanbul"})} max={new Date().toLocaleDateString("en-CA",{timeZone:"Europe/Istanbul"})}/></label>
          </div>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={differentWhatsapp} onChange={e=>setDifferentWhatsapp(e.target.checked)}/>WhatsApp numarası farklı</label>
          {differentWhatsapp ? <AdminPhoneField key={`whatsapp-${requestId}`} name="whatsapp" label="WhatsApp numarası" countryName="whatsappCountry" required /> : null}
          {fixed && participantCount>1 ? <section className="rounded-xl border border-[var(--admin-border)] p-4 sm:p-5" aria-label="Hissedar bilgileri">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">Hissedar bilgileri</h3><p className="mt-1 text-sm text-[var(--admin-muted)]">Her hisse için kimin adına kayıt açılacağını seçin.</p></div>{separate ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">{completeCount}/{participantCount} kişi hazır</span> : null}</div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2"><label className={`flex cursor-pointer gap-2 rounded-lg border p-3 text-sm ${!separate ? "border-emerald-600 bg-emerald-50" : "border-[var(--admin-border)]"}`}><input type="radio" checked={!separate} onChange={()=>setParticipantMode("same")}/>Tüm hisseler bağışçı adına</label><label className={`flex cursor-pointer gap-2 rounded-lg border p-3 text-sm ${separate ? "border-emerald-600 bg-emerald-50" : "border-[var(--admin-border)]"}`}><input type="radio" checked={separate} onChange={()=>{resizeParticipants(participantCount);setParticipantMode("different");}}/>Her hisse farklı kişi adına</label></div>
            {separate ? <>
              <div className="mt-4 flex flex-wrap items-center gap-2"><button className="admin-button-secondary inline-flex items-center gap-2" type="button" onClick={()=>csvInput.current?.click()}><Upload className="size-4"/>CSV’den kişi aktar</button><button className="admin-button-secondary inline-flex items-center gap-2" type="button" onClick={downloadTemplate}><Download className="size-4"/>Örnek CSV indir</button><input ref={csvInput} className="sr-only" type="file" accept=".csv,text/csv" onChange={event=>{const file=event.target.files?.[0];if(file)void importCsv(file);event.target.value="";}}/><p className="text-xs text-[var(--admin-muted)]">Ad Soyad, Telefon, Ülke sütunları · satır sayısı hisse sayısıyla aynı olmalı.</p></div>
              {importMessage ? <p role="status" className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">{importMessage}</p> : null}
              <div className="mt-4 max-h-[min(46dvh,520px)] space-y-2 overflow-y-auto pr-1"><div className="hidden grid-cols-[3rem_minmax(0,1fr)_minmax(0,1.2fr)] gap-3 px-3 text-xs font-semibold text-[var(--admin-muted)] sm:grid"><span>Hisse</span><span>Ad soyad</span><span>WhatsApp telefonu</span></div>{Array.from({length:participantCount},(_,i)=>{const row=participants[i]||{name:"",phone:"",country:"TR"};return <div className="grid gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 sm:grid-cols-[3rem_minmax(0,1fr)_minmax(0,1.2fr)] sm:items-start" key={i}><span className="pt-3 text-sm font-semibold text-[var(--admin-muted)]">{i+1}.</span><label className="min-w-0 text-xs"><span className="sm:sr-only">{i+1}. kişi ad soyad</span><input className={`${fieldClass} mt-1 sm:mt-0`} name={`participantName.${i}`} placeholder="Ad soyad" required minLength={2} maxLength={120} value={row.name} onChange={e=>updateParticipant(i,{name:e.target.value})}/></label><AdminPhoneField compact name={`participantPhone.${i}`} label={`${i+1}. kişi WhatsApp telefonu`} countryName={`participantCountry.${i}`} country={row.country} value={row.phone} onChange={value=>updateParticipant(i,{phone:value})} onCountryChange={value=>updateParticipant(i,{country:value})} required /></div>;})}</div>
              <p className="mt-3 text-xs text-[var(--admin-muted)]">Kayıt sırasında kişiler uygun gruplara sırayla yerleştirilir. Mevcut gruplarda boş yer varsa önce onlar tamamlanır.</p>
            </> : <p className="mt-3 text-xs text-[var(--admin-muted)]">Tüm hisselerde bağışçının adı ve WhatsApp numarası kullanılır.</p>}
          </section> : null}
          {campaign?.videoDelivery === "video" ? <label className="flex gap-2 text-sm"><input type="checkbox" name="contactConsent" required/>Bağışçı/hissedarların WhatsApp ile video bağlantısı almayı kabul ettiğini doğruladım.</label> : null}
          {campaign?.operationType === "slaughter_video" ? <label className="flex gap-2 text-sm"><input type="checkbox" name="proxyConsent" required/>Hissedarların kesim vekâletini aldım.</label> : null}
          <label className="block text-sm">Not (isteğe bağlı)<textarea className={fieldClass} name="note" maxLength={2000}/></label>
        </fieldset>
        <label className="block rounded-xl border border-dashed border-[var(--admin-border)] p-4 text-sm">Dekont ekleyin — önerilir<input className="mt-3 block w-full" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={busy}/><span className="mt-2 block text-xs text-[var(--admin-muted)]">PDF, JPG veya PNG · en fazla 10 MB. Dekontsuz da kaydedebilirsiniz.</span></label>
        {message ? <p role="status" className="rounded-xl border border-[var(--admin-border)] p-3 text-sm">{message}</p> : null}
        {saved ? <p className="break-all text-sm">Kayıt numarası: {saved.receipt}</p> : null}
        </div>
        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 py-4 sm:px-7"><p className="text-xs text-[var(--admin-muted)]">{separate ? `${completeCount}/${participantCount} kişi tamamlandı` : fixed && participantCount>1 ? `${participantCount} hisse bağışçı adına` : "Bilgileri kontrol ederek kaydedin."}</p><div className="flex flex-wrap gap-3"><button className="admin-button-secondary" disabled={busy} type="button" onClick={()=>dialog.current?.close()}>{saved ? "Tamam" : "Vazgeç"}</button><button className="admin-action-button" type="submit" disabled={busy || (!saved && (!campaign || expected<=0 || actual<expected || !validQuantity || (separate && completeCount!==participantCount)))}>{busy ? "İşleniyor…" : saved ? "Dekontu ekle / tekrar dene" : "Ödeme alındı — kaydet"}</button></div></div>
      </form>
    </dialog>
  </>;
}
