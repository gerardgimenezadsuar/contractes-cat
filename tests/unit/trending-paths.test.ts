import { test } from "node:test";
import assert from "node:assert/strict";
import { companyNifsFromPaths, organNamesFromPaths } from "../../src/lib/trending-paths.ts";

test("company NIFs: real ids only, most visited first", () => {
  const nifs = companyNifsFromPaths([
    { requestPath: "/empreses/B64958838", visitors: 8 },
    { requestPath: "/empreses/***%206718%20**", visitors: 7 }, // masked self-employed person
    { requestPath: "/empreses/a28541639", visitors: 7 },
    { requestPath: "/empreses/B12345678/nom/FOO", visitors: 7 }, // name sub-page
    { requestPath: "/empreses/B64958838", visitors: 6 }, // duplicate
    { requestPath: "/empreses/B60487360", visitors: 2 }, // below the minimum
  ]);
  assert.deepEqual(nifs, ["B64958838", "A28541639"]);
});

test("public-body names are decoded", () => {
  const names = organNamesFromPaths([
    { requestPath: "/organismes/Ajuntament%20de%20Barcelona", visitors: 9 },
    { requestPath: "/organismes/Ajuntament%20d'Organy%C3%A0", visitors: 5 },
    { requestPath: "/organismes/Bad%E0%A4%A", visitors: 5 }, // malformed escape: kept raw, not thrown
  ]);
  assert.deepEqual(names.slice(0, 2), ["Ajuntament de Barcelona", "Ajuntament d'Organyà"]);
});
