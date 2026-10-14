import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compareToBaseline,
  concentrationShare,
  discountShare,
  formatCompactEuros,
  formatDecimal,
  formatPercent,
  lastCompleteYear,
  minorShare,
  perInhabitant,
  singleOfferShare,
  sumSince,
  type CompetitionAggregate,
  type YearlyRow,
} from "../../src/lib/indicators.ts";

const barcelona: CompetitionAggregate = {
  contracts: 1639,
  avgOffers: 3.29,
  singleOfferContracts: 483,
  awardedCapped: 725268656.74,
  budgetCapped: 763519484.03,
  contractsCapped: 1616,
};

test("single-offer share and discount come from the capped sums", () => {
  assert.equal(Math.round(singleOfferShare(barcelona)! * 1000) / 1000, 0.295);
  assert.equal(Math.round(discountShare(barcelona)! * 1000) / 1000, 0.05);
  assert.equal(discountShare({ ...barcelona, budgetCapped: 0 }), null);
  assert.equal(singleOfferShare({ ...barcelona, contracts: 0 }), null);
});

test("per-inhabitant spending needs both sides", () => {
  assert.equal(Math.round(perInhabitant(176325385.88, 1713247)!), 103);
  assert.equal(perInhabitant(0, 1000), null);
  assert.equal(perInhabitant(1000, null), null);
});

const yearly: YearlyRow[] = [
  { year: 2021, total: 5_001_677_500, contracts: 265 },
  { year: 2024, total: 328_114_867, contracts: 6340, minorsTotal: 24_993_583, minorsContracts: 5832 },
  { year: 2025, total: 176_325_385, contracts: 5998, minorsTotal: 22_862_090, minorsContracts: 5481 },
  { year: 2026, total: 364_546_430, contracts: 775, minorsTotal: 4_018_519, minorsContracts: 383 },
];

test("the headline year is the last complete one", () => {
  const row = lastCompleteYear(yearly, new Date("2026-10-14"));
  assert.equal(row?.year, 2025);
  assert.equal(lastCompleteYear([{ year: 2026, total: 1, contracts: 1 }], new Date("2026-10-14")), null);
});

test("minor-contract share by amount and by count", () => {
  const share = minorShare(yearly[2]);
  assert.equal(Math.round(share.byAmount! * 100), 13);
  assert.equal(Math.round(share.byCount! * 100), 91);
  assert.deepEqual(minorShare({ year: 2025, total: 10, contracts: 1 }), { byAmount: null, byCount: null });
});

test("supplier concentration uses the top five over the period total", () => {
  const since = sumSince(yearly, 2024);
  assert.equal(since, 328_114_867 + 176_325_385 + 364_546_430);
  const share = concentrationShare([141.8e6, 34.8e6, 25.7e6, 25.6e6, 24.7e6, 24.6e6], 1_046.8e6);
  assert.equal(Math.round(share! * 100), 24);
  assert.equal(concentrationShare([1, 2], 0), null);
});

test("baseline comparison tones", () => {
  assert.equal(compareToBaseline(0.29, 0.34, false), "good");
  assert.equal(compareToBaseline(0.047, 0.065, true), "warn");
  assert.equal(compareToBaseline(3.3, 3.1, true), "neutral");
  assert.equal(compareToBaseline(null, 3.1, true), "neutral");
});

test("catalan number formatting", () => {
  assert.equal(formatDecimal(1713247, 0), "1.713.247");
  assert.equal(formatDecimal(3.2934, 1), "3,3");
  assert.equal(formatPercent(0.295), "30 %");
  assert.equal(formatPercent(0.047, 1), "4,7 %");
  assert.equal(formatCompactEuros(6414867765.94), "6,41 mil M€");
  assert.equal(formatCompactEuros(176325385.88), "176,3 M€");
  assert.equal(formatCompactEuros(86597.8), "86,6 k€");
  assert.equal(formatCompactEuros(950), "950 €");
});

test("minor shares never exceed 100 %", () => {
  const share = minorShare({ year: 2025, total: 10, contracts: 2, minorsTotal: 50, minorsContracts: 5 });
  assert.equal(share.byAmount, 1);
  assert.equal(share.byCount, 1);
});
