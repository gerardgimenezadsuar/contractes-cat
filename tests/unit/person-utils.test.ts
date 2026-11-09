import { test } from "node:test";
import assert from "node:assert/strict";
import { surnameFirstCandidates } from "../../src/lib/person-utils.ts";

test("surnameFirstCandidates moves one or two given names to the end", () => {
  assert.deepEqual(surnameFirstCandidates("JOAN LAPORTA ESTRUCH"), ["LAPORTA ESTRUCH JOAN", "ESTRUCH JOAN LAPORTA"]);
  assert.deepEqual(surnameFirstCandidates("JOSEP MARIA PUIG ROCA"), ["MARIA PUIG ROCA JOSEP", "PUIG ROCA JOSEP MARIA"]);
  assert.deepEqual(surnameFirstCandidates("ROCA MARIA"), ["MARIA ROCA"]);
  assert.deepEqual(surnameFirstCandidates("ROCA"), []);
});
