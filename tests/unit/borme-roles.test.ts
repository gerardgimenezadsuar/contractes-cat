import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyControlRole, mergePeriods } from "../../src/lib/borme-roles.ts";

test("sole shareholders are owners", () => {
  assert.equal(classifyControlRole("SOCIO_UNICO", null), "OWNER");
  assert.equal(classifyControlRole("ACCIONISTA_UNICO", ""), "OWNER");
});

test("administrators count, except insolvency, judicial and substitute ones", () => {
  assert.equal(classifyControlRole("ADMINISTRADOR", "ADM_UNICO"), "ADMIN");
  assert.equal(classifyControlRole("ADMINISTRADOR", "ADM_SOLIDAR"), "ADMIN");
  assert.equal(classifyControlRole("ADMINISTRADOR", "BOE_ES_ADM_UNICO"), "ADMIN");
  assert.equal(classifyControlRole("ADMINISTRADOR", "ADM_CONCURS"), null);
  assert.equal(classifyControlRole("ADMINISTRADOR", "REP_ADM_CONC"), null);
  assert.equal(classifyControlRole("ADMINISTRADOR", "ADM_JUDICIAL"), null);
  assert.equal(classifyControlRole("ADMINISTRADOR", "ADM_SUPLENTE"), null);
});

test("only board control roles count; plain board members and secretaries do not", () => {
  assert.equal(classifyControlRole("ORGANO_GOBIERNO", "PRESIDENTE"), "ADMIN");
  assert.equal(classifyControlRole("ORGANO_GOBIERNO", "L_PRESIDENTE"), "ADMIN");
  assert.equal(classifyControlRole("ORGANO_GOBIERNO", "VICEPRESIDEN"), "ADMIN");
  assert.equal(classifyControlRole("ORGANO_GOBIERNO", "CONS_DEL_SOL"), "ADMIN");
  assert.equal(classifyControlRole("ORGANO_GOBIERNO", "CONSEJERO"), null);
  assert.equal(classifyControlRole("ORGANO_GOBIERNO", "SECRETARIO"), null);
});

test("apoderats, liquidators and partners are not control roles", () => {
  assert.equal(classifyControlRole("APODERADO", "APODERADO"), null);
  assert.equal(classifyControlRole("LIQUIDADOR", null), null);
  assert.equal(classifyControlRole("SOCIO", null), null);
});

test("mergePeriods joins overlapping and open-ended periods", () => {
  assert.deepEqual(
    mergePeriods([
      { start: "20150101", end: "20180101" },
      { start: "20100101", end: "20120101" },
      { start: "20170601", end: null },
    ]),
    [
      { start: "20100101", end: "20120101" },
      { start: "20150101", end: null },
    ]
  );
  assert.deepEqual(
    mergePeriods([
      { start: "20100101", end: null },
      { start: "20120101", end: "20130101" },
    ]),
    [{ start: "20100101", end: null }]
  );
  assert.deepEqual(mergePeriods([]), []);
});
