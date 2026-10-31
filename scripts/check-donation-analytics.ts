import assert from "node:assert/strict";

console.log("Starting donation analytics tests...");

// 1. Test slice builder logic
type DummyDonation = {
  id: string;
  netConfirmedAmount: number;
  groupType: "slaughter_video" | "standard_video" | "none";
  groupTypeLabel: string;
  paymentMethod: "card" | "bank_transfer" | "manual";
};

const sampleDonations: DummyDonation[] = [
  { id: "1", netConfirmedAmount: 5000, groupType: "slaughter_video", groupTypeLabel: "Kesim Videosu", paymentMethod: "card" },
  { id: "2", netConfirmedAmount: 5000, groupType: "slaughter_video", groupTypeLabel: "Kesim Videosu", paymentMethod: "card" },
  { id: "3", netConfirmedAmount: 2000, groupType: "standard_video", groupTypeLabel: "Standart Video", paymentMethod: "bank_transfer" },
  { id: "4", netConfirmedAmount: 1000, groupType: "none", groupTypeLabel: "Genel Bağış", paymentMethod: "manual" },
];

const totalRevenue = sampleDonations.reduce((sum, d) => sum + d.netConfirmedAmount, 0);
assert.equal(totalRevenue, 13000);

// Group type breakdown
const groupTypeMap = new Map<string, { label: string; count: number; totalAmount: number }>();
for (const d of sampleDonations) {
  const existing = groupTypeMap.get(d.groupType) || { label: d.groupTypeLabel, count: 0, totalAmount: 0 };
  existing.count++;
  existing.totalAmount += d.netConfirmedAmount;
  groupTypeMap.set(d.groupType, existing);
}

const slaughter = groupTypeMap.get("slaughter_video")!;
assert.equal(slaughter.count, 2);
assert.equal(slaughter.totalAmount, 10000);
const slaughterPct = (slaughter.totalAmount / totalRevenue) * 100;
assert.equal(Number(slaughterPct.toFixed(1)), 76.9);

// Payment method breakdown
const paymentMap = new Map<string, { count: number; totalAmount: number }>();
for (const d of sampleDonations) {
  const existing = paymentMap.get(d.paymentMethod) || { count: 0, totalAmount: 0 };
  existing.count++;
  existing.totalAmount += d.netConfirmedAmount;
  paymentMap.set(d.paymentMethod, existing);
}

const card = paymentMap.get("card")!;
assert.equal(card.count, 2);
assert.equal(card.totalAmount, 10000);

// Tier breakdown
function getTier(amount: number) {
  if (amount >= 10000) return "tier_4";
  if (amount >= 2500) return "tier_3";
  if (amount >= 500) return "tier_2";
  return "tier_1";
}

assert.equal(getTier(5000), "tier_3");
assert.equal(getTier(2000), "tier_2");
assert.equal(getTier(1000), "tier_2");

console.log("PASS: Donation analytics calculation and breakdown tests succeeded.");
