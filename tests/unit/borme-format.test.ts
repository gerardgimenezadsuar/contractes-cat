import { test } from "node:test";
import assert from "node:assert/strict";
import { isEntityName } from "../../src/lib/borme-format.ts";

test("isEntityName recognises organisations with and without legal suffixes", () => {
  assert.ok(isEntityName("ACME SERVEIS SL"));
  assert.ok(isEntityName("FUTBOL CLUB BARCELONA"));
  assert.ok(isEntityName("AJUNTAMENT DE GIRONA"));
  assert.ok(!isEntityName("LAPORTA ESTRUCH JOAN"));
  assert.ok(!isEntityName("CLUBERT PUIG ANNA"));
});
