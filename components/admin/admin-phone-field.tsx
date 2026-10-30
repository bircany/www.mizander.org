"use client";

import { useEffect, useId, useRef, useState } from "react";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";
import turkishLabels from "react-phone-number-input/locale/tr.json";

import { PhoneInput } from "@/components/reui/phone-input";
import { normalizeInternationalPhone } from "@/lib/phone";

function phoneError(value: string, country: string, required: boolean) {
  if (!value.trim()) return required ? "Telefon numarası girin." : "";
  try { normalizeInternationalPhone(value, country); return ""; }
  catch { return "Seçilen ülkeye uygun geçerli bir telefon numarası girin."; }
}

export function AdminPhoneField({ name, label, countryName, country = "TR", value, onChange, onCountryChange, onBlur, required = false, compact = false }: {
  name: string; label: string; countryName: string; country?: string; value?: string;
  onChange?: (value: string) => void; onCountryChange?: (country: string) => void;
  onBlur?: () => void; required?: boolean; compact?: boolean;
}) {
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const [localCountry, setLocalCountry] = useState(country);
  const [localValue, setLocalValue] = useState("");
  const [touched, setTouched] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const selected = onCountryChange ? country : localCountry;
  const number = value ?? localValue;
  const error = phoneError(number, selected, required);

  useEffect(() => {
    setPortalContainer(container.current?.closest("dialog") ?? null);
  }, []);

  useEffect(() => {
    container.current?.querySelector<HTMLInputElement>("input[type=tel]")?.setCustomValidity(error);
  }, [error]);

  return <div ref={container} className="min-w-0 text-sm">
    <label htmlFor={id} className={compact ? "sr-only" : "mb-1 block"}>{label}{required ? " *" : ""}</label>
    <PhoneInput
      id={id}
      name={name}
      variant="lg"
      placeholder="Telefon numaranızı giriniz"
      defaultCountry={selected as CountryCode}
      labels={turkishLabels}
      portalContainer={portalContainer}
      value={number}
      onChange={next => {
        const normalized = next || "";
        setLocalValue(normalized);
        onChange?.(normalized);
        const parsedCountry = normalized ? parsePhoneNumberFromString(normalized)?.country : undefined;
        if (parsedCountry && parsedCountry !== selected) {
          setLocalCountry(parsedCountry);
          onCountryChange?.(parsedCountry);
        }
      }}
      onCountryChange={next => {
        if (next) {setLocalCountry(next); onCountryChange?.(next);}
      }}
      onBlur={() => {setTouched(true); if (!error) onBlur?.();}}
      required={required}
      aria-invalid={touched && !!error}
      aria-describedby={`${id}-hint`}
      className="w-full"
    />
    <input type="hidden" name={countryName} value={selected}/>
    <p id={`${id}-hint`} aria-live="polite" className={`mt-1 text-xs ${touched && error ? "text-red-600" : "sr-only"}`}>
      {touched && error ? error : "Ülkeyi seçip telefon numarasını girin."}
    </p>
  </div>;
}
