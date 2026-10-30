import assert from "node:assert/strict";
import { parseParticipantCsv } from "../lib/donations/participant-csv";

assert.deepEqual(parseParticipantCsv("\uFEFFAd Soyad;Telefon;Ülke\r\nAyşe Yılmaz;532 123 45 67;TR\r\nAli Demir;533 123 45 67;TR"),[
  {name:"Ayşe Yılmaz",phone:"532 123 45 67",country:"TR"},
  {name:"Ali Demir",phone:"533 123 45 67",country:"TR"},
]);
assert.deepEqual(parseParticipantCsv('Name,Phone\n"Doe, Jane","+49 151 23456789"'),[
  {name:"Doe, Jane",phone:"+49 151 23456789",country:"TR"},
]);
assert.throws(()=>parseParticipantCsv("Ad Soyad;Telefon\nAyşe;"),/1. kişide/);
assert.throws(()=>parseParticipantCsv("Ad Soyad;Telefon\n\"Ayşe;532"),/tırnak/);
console.log("PASS: participant CSV header, BOM, delimiters, quoted values and missing cells.");
