import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { moneyCents, parseManualDonation, compareManualPayment } from "../lib/donations/manual-validation";
import { validateManualProof } from "../lib/donations/manual-proof";

const now = new Date("2026-09-09T12:00:00Z");
function input(overrides:Record<string,string>={}) {
  const data = new FormData();
  for(const [key,value] of Object.entries({requestId:randomUUID(),campaignId:"1",currency:"TRY",quantity:"3",donorName:"Test Bağışçı",country:"TR",phone:"05551234567",date:"2026-09-08",receivedAmount:"6000",expectedAmount:"6000",contactConsent:"on",...overrides})) data.set(key,value);
  return parseManualDonation(data,now);
}
const campaign = {pricing_model:"fixed",unit_price:"2000",currency:"TRY",video_delivery:"video",operation_type:"standard_video"};
assert.equal(input().phone,"+905551234567");
assert.equal(input().participants[2].phone,"+905551234567");
assert.equal(input({"participantName.1":"Başka İsim"}).participants[1].name,"Başka İsim");
assert.throws(()=>input({participantMode:"different"}),/1. kişi/);
assert.throws(()=>input({participantMode:"different","participantName.0":"Kişi Bir","participantPhone.0":"0532 123 45 67"}),/2. kişi/);
assert.equal(input({participantMode:"different","participantName.0":"Kişi Bir","participantPhone.0":"0532 123 45 67","participantName.1":"Kişi İki","participantPhone.1":"0533 123 45 67","participantName.2":"Kişi Üç","participantPhone.2":"0534 123 45 67"}).participants.length,3);
const international = input({whatsappCountry:"DE", whatsapp:"0151 23456789", "participantCountry.1":"TR", "participantPhone.1":"0532 123 45 67"});
assert.equal(international.whatsapp,"+4915123456789");
assert.equal(international.participants[0].phone,"+4915123456789");
assert.equal(international.participants[1].phone,"+905321234567");
assert.throws(()=>input({whatsappCountry:"TR",whatsapp:"+4915123456789"}));
assert.throws(()=>input({"participantCountry.1":"DE","participantPhone.1":"123"}));
assert.equal(moneyCents("100,25"),10025);
for(const value of ["1e3","NaN","Infinity","-1","0","0.01","1.001","1.000.000","1000000001"]) assert.throws(()=>moneyCents(value));
const invalidInputs:Array<Record<string,string>> = [{requestId:"bad"},{campaignId:"-1"},{quantity:"0"},{quantity:"501"},{quantity:"1.5"},{date:"2026-09-10"},{date:"2026-02-30"},{phone:"123"},{donorName:"a"},{currency:"FAKE"}];
for(const override of invalidInputs) assert.throws(()=>input(override));
assert.throws(()=>compareManualPayment(input({receivedAmount:"5500"}),campaign),/eksik/);
assert.throws(()=>compareManualPayment(input({expectedAmount:"5500",receivedAmount:"5500"}),campaign),/fiyatı değişti/);
assert.throws(()=>compareManualPayment(input({contactConsent:""}),campaign),/onay/);
assert.throws(()=>compareManualPayment(input(),{...campaign,operation_type:"slaughter_video"}),/vekâlet/);
assert.throws(()=>compareManualPayment(input({receivedAmount:"6500"}),campaign),/Fazla/);
assert.equal(compareManualPayment(input({receivedAmount:"6500",excessConfirmed:"on"}),campaign),600000);
const png = await sharp({create:{width:20,height:20,channels:3,background:"white"}}).png().toBuffer();
const valid = await validateManualProof(new File([new Uint8Array(png)],"receipt.png",{type:"image/png"}));
assert.equal(valid.mime,"image/jpeg");
assert.equal((await sharp(valid.bytes).metadata()).format,"jpeg");
for(const file of [
  new File([],"empty.pdf",{type:"application/pdf"}),
  new File(["<script>alert(1)</script>"],"fake.png",{type:"image/png"}),
  new File([new Uint8Array(png)],"receipt.exe",{type:"image/png"}),
  new File([new Uint8Array(png)],"receipt.jpg",{type:"image/jpeg"}),
  new File([new Uint8Array(10*1024*1024+1)],"big.pdf",{type:"application/pdf"}),
  new File(["%PDF-1.4 truncated"],"receipt.pdf",{type:"application/pdf"}),
]) await assert.rejects(validateManualProof(file));
console.log("PASS: money/date/phone/currency/share validation, underpayment, stale price, surplus consent, participant defaults, proof signatures/extensions/MIME/size and image re-encoding.");
