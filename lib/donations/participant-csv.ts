export type ParticipantCsvRow = { name: string; phone: string; country: string };

function cells(source: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted || !cell) quoted = !quoted;
      else throw new Error("CSV dosyasındaki tırnak işaretlerini kontrol edin.");
    } else if (!quoted && char === delimiter) {
      row.push(cell.trim()); cell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      row.push(cell.trim()); cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
      if (char === "\r" && source[i + 1] === "\n") i++;
    } else cell += char;
  }
  if (quoted) throw new Error("CSV dosyasında kapanmamış tırnak işareti var.");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function heading(value: string) {
  return value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

export function parseParticipantCsv(source: string): ParticipantCsvRow[] {
  const clean = source.replace(/^\uFEFF/, "").trim();
  if (!clean) throw new Error("CSV dosyası boş.");
  const first = clean.split(/\r?\n/, 1)[0];
  const delimiter = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : ",";
  const rows = cells(clean, delimiter);
  if (!rows.length) throw new Error("CSV dosyasında kişi bulunamadı.");
  const headings = rows[0].map(heading);
  const nameIndex = headings.findIndex(value => ["adsoyad", "isimsoyisim", "advesoyad", "name"].includes(value));
  const phoneIndex = headings.findIndex(value => ["telefon", "telefonnumarasi", "whatsapp", "phone"].includes(value));
  const countryIndex = headings.findIndex(value => ["ulke", "ulkekodu", "country"].includes(value));
  const hasHeader = nameIndex >= 0 || phoneIndex >= 0;
  if (hasHeader && (nameIndex < 0 || phoneIndex < 0)) throw new Error("İlk satırda Ad Soyad ve Telefon başlıkları bulunmalı.");
  const data = hasHeader ? rows.slice(1) : rows;
  if (!data.length) throw new Error("CSV dosyasında kişi bulunamadı.");
  if (data.length > 500) throw new Error("Bir seferde en fazla 500 kişi aktarabilirsiniz.");
  return data.map((row, index) => {
    const name = row[hasHeader ? nameIndex : 0] || "";
    const phone = row[hasHeader ? phoneIndex : 1] || "";
    const country = (hasHeader && countryIndex >= 0 ? row[countryIndex] : "TR") || "TR";
    if (!name || !phone) throw new Error(`${index + 1}. kişide ad soyad veya telefon eksik.`);
    return { name, phone, country: country.toUpperCase() };
  });
}
