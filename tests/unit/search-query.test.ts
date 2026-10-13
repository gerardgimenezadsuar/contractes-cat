import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalizeNif,
  normalizeForMatch,
  parseSearchQuery,
  rankByMatch,
  rankingKey,
  scoreNameMatch,
  tokenizeSearch,
} from "../../src/lib/search-query.ts";

test("canonicalizeNif accepts dashes, dots, spaces and lowercase", () => {
  assert.equal(canonicalizeNif("A-28037224"), "A28037224");
  assert.equal(canonicalizeNif("a28.037.224"), "A28037224");
  assert.equal(canonicalizeNif(" b 08 112 716 "), "B08112716");
  assert.equal(canonicalizeNif("12345678Z"), "12345678Z");
  assert.equal(canonicalizeNif("X1234567L"), "X1234567L");
});

test("canonicalizeNif rejects names and partial ids", () => {
  assert.equal(canonicalizeNif("ferrovial"), null);
  assert.equal(canonicalizeNif("A2803"), null);
  assert.equal(canonicalizeNif("UTE"), null);
});

test("tokenizeSearch folds accents, punctuation and stop words", () => {
  assert.deepEqual(tokenizeSearch("Departament d'Educació"), ["DEPARTAMENT", "EDUCACIO"]);
  assert.deepEqual(tokenizeSearch("ajuntament de vic"), ["AJUNTAMENT", "VIC"]);
  assert.deepEqual(tokenizeSearch("Acsa, Obras e Infraestructuras"), ["ACSA", "OBRAS", "INFRAESTRUCTURAS"]);
  assert.deepEqual(tokenizeSearch("Ferrovial Construcción, SA"), ["FERROVIAL", "CONSTRUCCION", "SA"]);
  assert.deepEqual(tokenizeSearch("Núñez Çatal·là"), ["NUNEZ", "CATALLA"]);
});

test("parseSearchQuery keeps raw tokens when everything is a stop word", () => {
  const parsed = parseSearchQuery("de la");
  assert.deepEqual(parsed.tokens, ["DE", "LA"]);
  assert.equal(parsed.nif, null);
});

test("parseSearchQuery detects a NIF and still tokenizes", () => {
  const parsed = parseSearchQuery("A-28037224");
  assert.equal(parsed.nif, "A28037224");
  assert.equal(parsed.normalized, "A28037224");
});

test("normalizeForMatch strips everything but letters and digits", () => {
  assert.equal(normalizeForMatch("SOREA, SOCIEDAD REGIONAL DE ABASTECIMIENTO\nDE AGUA, S.AU"), "SOREASOCIEDADREGIONALDEABASTECIMIENTODEAGUASAU");
});

test("scoreNameMatch prefers exact, then prefix or whole words, then word prefixes, then containment", () => {
  const q = parseSearchQuery("acsa obras");
  assert.equal(scoreNameMatch("ACSA OBRAS", q), 4);
  assert.equal(scoreNameMatch("ACSA OBRAS E INFRAESTRUCTURAS, SAU", q), 3);
  assert.equal(scoreNameMatch("UTE SORIGUÉ ACSA CONSERVACIÓN - ACSA OBRAS E INFRAESTRUCTURAS", q), 3);
  assert.equal(scoreNameMatch("UTE SORIGUÉ ACSAX CONSERVACIÓN - OBRASY", q), 2);
  assert.equal(scoreNameMatch("FACSAOBRASX", q), 1);
  assert.equal(scoreNameMatch("TELEFONICA", q), 0);
});

test("scoreNameMatch is accent and punctuation insensitive", () => {
  const q = parseSearchQuery("educacio");
  assert.equal(scoreNameMatch("Departament d'Educació", q), 3);
  const ics = parseSearchQuery("ics");
  assert.equal(scoreNameMatch("Institut Català de la Salut (ICS)", ics), 3);
  assert.equal(scoreNameMatch("Aeroports Públics de Catalunya, SLU", ics), 1);
});

test("rankingKey prefers the company itself over a long UTE name containing it", () => {
  const q = parseSearchQuery("ferrovial construccion");
  const company = rankingKey("FERROVIAL CONSTRUCCION, SA", q, 14_176_163);
  const ute = rankingKey(
    "FERROVIAL CONSTRUCCIÓN, SA Y CLIMAVA, SL UNIÓN TEMPORAL DE EMPRESAS, LEY 18/1982",
    q,
    48_292_128
  );
  assert.ok(company > ute, `${company} should beat ${ute}`);
  assert.equal(rankingKey("DAVID FARRE VILLARROYA", parseSearchQuery("ferrovial"), 8203), 0);
});

test("rankByMatch puts the ICS before its departments and drops wildcard false positives", () => {
  const q = parseSearchQuery("ics");
  const rows = [
    { name: "Aeroports Públics de Catalunya, SLU", total: 72e6 },
    { name: "ICS - Gerència de compres", total: 98e6 },
    { name: "Institut Català de la Salut (ICS)", total: 2842e6 },
    { name: "Fundació TicSalut i Social", total: 16e6 },
    { name: "Totally Unrelated Name", total: 999e6 },
  ];
  const ranked = rankByMatch(rows, q, (r) => r.name, (r) => r.total).map((r) => r.name);
  assert.deepEqual(ranked, [
    "Institut Català de la Salut (ICS)",
    "ICS - Gerència de compres",
    "Aeroports Públics de Catalunya, SLU",
    "Fundació TicSalut i Social",
  ]);
});

test("rankByMatch keeps the backend rows when nothing scores", () => {
  const q = parseSearchQuery("zzzz");
  const rows = [{ name: "A", total: 1 }, { name: "B", total: 2 }];
  assert.deepEqual(rankByMatch(rows, q, (r) => r.name, (r) => r.total), rows);
});
