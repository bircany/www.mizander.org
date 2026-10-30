"use client";

import { useEffect, useId, useRef, useState } from "react";
import { getCountryCallingCode, type CountryCode } from "libphonenumber-js/min";

import countries from "@/lib/admin/phone-countries.json";

import { adminPhoneError, formatAdminPhoneInput } from "@/lib/admin/phone-input";

// Static labels and order keep server and browser markup identical across ICU versions.
const flag = (code: string) => String.fromCodePoint(...[...code].map(c => 127397 + c.charCodeAt(0)));

export function AdminPhoneField({ name, label, countryName, country = "TR", value, onChange, onCountryChange, onBlur, required = false, compact = false }: {
  name: string; label: string; countryName: string; country?: string; value?: string;
  onChange?: (value: string) => void; onCountryChange?: (country: string) => void;
  onBlur?: () => void; required?: boolean; compact?: boolean;
}) {
  const id = useId();
  const [localCountry, setLocalCountry] = useState(country);
  const [localValue, setLocalValue] = useState("");
  const selected = (onCountryChange ? country : localCountry) as CountryCode;
  const number = value ?? localValue;
  const input = useRef<HTMLInputElement>(null);
  const [touched, setTouched] = useState(false);
  const [editError, setEditError] = useState("");
  const error = adminPhoneError(number, selected, required);
  useEffect(() => { input.current?.setCustomValidity(error); }, [error]);
  const update = (raw: string) => {
    const result = formatAdminPhoneInput(raw, selected);
    if (!result) {
      setEditError("Numara seçilen ülkenin uzunluk sınırını aşıyor veya ülke kodu geçersiz.");
      return;
    }
    setEditError("");
    setLocalCountry(result.country); onCountryChange?.(result.country);
    // Preserve backspace over separators; reformat on blur.
    const next = raw.length < number.length && raw.replace(/\D/g, "") === number.replace(/\D/g, "") ? raw : result.number;
    setLocalValue(next); onChange?.(next);
  };
  const changeCountry = (nextCountry: CountryCode) => {
    const result = formatAdminPhoneInput(number, nextCountry);
    // A number that cannot fit the new country must be entered again.
    const next = result?.number ?? "";
    setLocalCountry(nextCountry); onCountryChange?.(nextCountry);
    setLocalValue(next); onChange?.(next);
    setEditError(""); setTouched(false);
    input.current?.setCustomValidity(adminPhoneError(next, nextCountry, required));
  };
  return <div className="min-w-0 text-sm">
    <label htmlFor={id} className={compact ? "sr-only" : "mb-1 block"}>{label}{required ? " *" : ""}</label>
    <div className="flex min-w-0 items-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
      <div className="relative flex h-11 w-14 shrink-0 items-center justify-center rounded-l-lg border-r border-[var(--admin-border)] focus-within:ring-2 focus-within:ring-blue-400">
        <span aria-hidden="true">{flag(selected)} ▾</span>
        <select aria-label={`${label} ülkesi`} name={countryName} value={selected} onChange={e => changeCountry(e.target.value as CountryCode)} className="absolute inset-0 w-full cursor-pointer opacity-0">
          {countries.map(({ code, name: countryLabel }) => <option key={code} value={code}>{flag(code)} {countryLabel} (+{getCountryCallingCode(code as CountryCode)})</option>)}
        </select>
      </div>
      <span className="pl-3 text-sm text-[var(--admin-muted)]">+{getCountryCallingCode(selected)}</span>
      <input ref={input} aria-invalid={touched && !!error} aria-describedby={`${id}-hint`} onInvalid={() => setTouched(true)} id={id} name={name} type="tel" inputMode="numeric" autoComplete="tel-national" dir="ltr" required={required} value={number} onChange={e => update(e.target.value)} onBlur={() => {
        setTouched(true);
        const result = formatAdminPhoneInput(number, selected);
        if (result) {
          setLocalValue(result.number); onChange?.(result.number);
          input.current?.setCustomValidity(adminPhoneError(result.number, selected, required));
        }
        if (!error) onBlur?.();
      }} placeholder={selected === "TR" ? "532 123 45 67" : "Telefon numarası"} className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm outline-none" />
    </div>
    <p id={`${id}-hint`} aria-live="polite" className={`mt-1 text-xs ${editError || (touched && error) ? "text-red-600" : compact ? "sr-only" : "text-[var(--admin-muted)]"}`}>
      {editError || (touched && error) || (selected === "TR" ? "Başında 0 olmadan 10 rakam · 532 123 45 67" : "Ülke kodunu tekrar yazmadan telefon numarasını girin.")}
    </p>
  </div>;
}
