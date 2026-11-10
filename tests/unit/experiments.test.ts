import { test } from "node:test";
import assert from "node:assert/strict";
import { pageVariant } from "../../src/lib/experiments.ts";

test("pageVariant is stable for the same page", () => {
  assert.equal(pageVariant("person_strip", "LAPORTA ESTRUCH JOAN"), pageVariant("person_strip", "LAPORTA ESTRUCH JOAN"));
});

test("pageVariant splits pages roughly in half", () => {
  let b = 0;
  const n = 4000;
  for (let i = 0; i < n; i++) if (pageVariant("person_strip", `PERSONA ${i} COGNOM`) === "b") b++;
  assert.ok(Math.abs(b / n - 0.5) < 0.03, `share of b = ${b / n}`);
});

test("pageVariant depends on the experiment name", () => {
  const names = Array.from({ length: 200 }, (_, i) => `NOM ${i}`);
  const differ = names.filter((name) => pageVariant("x", name) !== pageVariant("y", name)).length;
  assert.ok(differ > 50 && differ < 150);
});
