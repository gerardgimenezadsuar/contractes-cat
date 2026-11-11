import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCompanySeoDescription,
  buildCompanySeoTitle,
  buildPersonAnswer,
  buildPersonSeoDescription,
  buildPersonSeoTitle,
  cleanEntityName,
  companyKeyPeople,
  currentControllers,
  isJunkPersonName,
  joinCa,
} from "../../src/lib/seo/entity-summary.ts";

test("joinCa joins lists the Catalan way", () => {
  assert.equal(joinCa([]), "");
  assert.equal(joinCa(["A"]), "A");
  assert.equal(joinCa(["A", "B"]), "A i B");
  assert.equal(joinCa(["A", "B", "C"]), "A, B i C");
});

test("cleanEntityName drops trailing separators and extra spaces", () => {
  assert.equal(cleanEntityName("ACME,  S.L.,"), "ACME, S.L.");
  assert.equal(cleanEntityName(" EUROFINS ANALISIS AGRO, S.A. "), "EUROFINS ANALISIS AGRO, S.A.");
});

test("company title leads with the name, the administrators angle and the amount", () => {
  assert.equal(
    buildCompanySeoTitle({ name: "ACME, S.L.,", hasBorme: true, amountLabel: "12,3 M€" }),
    "ACME, S.L.: administradors i 12,3 M€ en contractes públics"
  );
  assert.equal(
    buildCompanySeoTitle({ name: "ACME SL", hasBorme: false, amountLabel: "850,2 k€" }),
    "ACME SL: 850,2 k€ en contractes públics a Catalunya"
  );
  assert.equal(buildCompanySeoTitle({ name: "ACME SL", hasBorme: false }), "ACME SL: contractes públics a Catalunya");
});

test("company description reads naturally and never ends with a double period", () => {
  const description = buildCompanySeoDescription({
    name: "EUROFINS ANALISIS AGRO, S.A.",
    nif: "A25244849",
    numContracts: 862,
    numContractsLabel: "862",
    amountLabel: "2,2 M€",
    firstYear: 2016,
    lastYear: 2026,
    topClients: ["Ajuntament de Lleida", "Diputació de Lleida", "Third"],
    hasBorme: true,
  });
  assert.equal(
    description,
    "EUROFINS ANALISIS AGRO, S.A. (NIF A25244849) ha guanyat 862 contractes públics a Catalunya per 2,2 M€ entre 2016 i 2026. " +
      "Principals clients: Ajuntament de Lleida i Diputació de Lleida. " +
      "Administradors, propietaris i empreses vinculades segons el BORME. Contratos públicos adjudicados en Cataluña."
  );
  assert.ok(!description.includes(".."));
});

test("company description handles a single contract and no history", () => {
  const description = buildCompanySeoDescription({
    name: "X",
    nif: null,
    numContracts: 1,
    numContractsLabel: "1",
    amountLabel: "5 k€",
    firstYear: 2024,
    lastYear: 2024,
    topClients: [],
    hasBorme: false,
  });
  assert.equal(description, "X ha guanyat 1 contracte públic a Catalunya per 5 k€ el 2024. Contratos públicos adjudicados en Cataluña.");
});

test("currentControllers splits companyKeyPeople by role, skipping junk, ended and stale roles", () => {
  const span = (person_name: string, control: "OWNER" | "ADMIN" | null, date_start: string, date_end: string | null = null, role_title_raw: string | null = "ADM.SOLIDAR.") => ({
    person_name,
    control,
    date_start,
    date_end,
    role_title_raw,
  });
  const result = currentControllers([
    span("GARCIA PUIG JOAN", "ADMIN", "20150101"),
    span("GARCIA PUIG JOAN", "ADMIN", "20180101"),
    span("ROCA MARIA", "OWNER", "20200101", null, null),
    span("OLD OWNER", "OWNER", "20100101", null, null),
    span("OLD ADMIN", "ADMIN", "20100101", "20200101"),
    span("APODERAT", null, "20100101"),
    span("PEREZ Presidente: X", "ADMIN", "20100101"),
  ]);
  assert.deepEqual(result.owners.map((p) => p.personName), ["ROCA MARIA"]);
  assert.deepEqual(result.admins.map((p) => p.personName), ["GARCIA PUIG JOAN"]);
});

test("isJunkPersonName flags BORME parsing artefacts", () => {
  assert.ok(isJunkPersonName("NOM BOLETÍN OFICIAL DEL REGISTRO MERCANTIL Núm"));
  assert.ok(isJunkPersonName("PEREZ Presidente: X"));
  assert.ok(!isJunkPersonName("GARCIA PUIG JOAN"));
});

test("person title and description lead with the companies they control", () => {
  const input = {
    displayName: "Joan Garcia Puig",
    numControlCompanies: 3,
    numControlCompaniesWithContracts: 2,
    numContracts: 40,
    numContractsLabel: "40",
    amountLabel: "1,5 M€",
  };
  assert.equal(buildPersonSeoTitle(input), "Joan Garcia Puig: empreses que controla i contractes públics");
  assert.equal(
    buildPersonSeoDescription(input),
    "Joan Garcia Puig té o ha tingut la propietat o l'administració de 3 empreses segons el BORME, 2 de les quals han guanyat contractes públics a Catalunya. " +
      "Mentre en tenia el càrrec, aquestes empreses van guanyar 40 contractes públics per 1,5 M€ (sense IVA). " +
      "Empresas que controla y contratos públicos."
  );
  assert.equal(
    buildPersonSeoTitle({ displayName: "Maria Roca", numControlCompaniesWithContracts: 0 }),
    "Maria Roca: càrrecs en empreses (BORME)"
  );
});

test("person answer states the negative cases explicitly", () => {
  const base = { displayName: "Maria Roca", numContracts: 0, numContractsLabel: "0", amountLabel: "0 €" };
  assert.equal(
    buildPersonAnswer({ ...base, numControlCompanies: 0, numControlCompaniesWithContracts: 0 }),
    "Maria Roca no consta al BORME com a propietari ni administrador de cap empresa, i per tant no li atribuïm contractes públics."
  );
  assert.equal(
    buildPersonAnswer({ ...base, numControlCompanies: 2, numControlCompaniesWithContracts: 0 }),
    "Maria Roca té o ha tingut la propietat o l'administració de 2 empreses segons el BORME. " +
      "Cap d'aquestes empreses no consta com a adjudicatària de contractes públics a Catalunya."
  );
  assert.equal(
    buildPersonAnswer({ ...base, numControlCompanies: 1, numControlCompaniesWithContracts: 1 }),
    "Maria Roca té o ha tingut la propietat o l'administració de 1 empresa segons el BORME, que ha guanyat contractes públics a Catalunya. " +
      "Cap d'aquests contractes no es va adjudicar mentre Maria Roca en tenia la propietat o l'administració."
  );
});

test("companyKeyPeople puts owners first, then the most decisive admin role, one entry per person", () => {
  const span = (person_name: string, control: "OWNER" | "ADMIN" | null, role_title_raw: string | null, date_start: string, date_end: string | null = null) => ({
    person_name,
    control,
    role_title_raw,
    date_start,
    date_end,
  });
  const people = companyKeyPeople([
    span("SOLIDARI B", "ADMIN", "ADM. SOLIDAR.", "20180101"),
    span("SOLIDARI A", "ADMIN", "ADM. SOLIDAR.", "20150101"),
    span("PRESI", "ADMIN", "PRESIDENTE", "20200101"),
    span("PRESI", "ADMIN", "CONS.DELEG.", "20190301"),
    span("OWNER", "OWNER", null, "20210101"),
    span("VICE", "ADMIN", "VICEPRESIDEN", "20100101"),
    span("OLD", "ADMIN", "ADM. UNICO", "20100101", "20120101"),
    span("APODERAT", null, "APODERADO", "20100101"),
    span("X Presidente: Y", "ADMIN", "PRESIDENTE", "20100101"),
  ]);
  assert.deepEqual(
    people.map((p) => [p.personName, p.title, p.sinceYear]),
    [
      ["OWNER", "Soci únic", 2021],
      ["PRESI", "Conseller/a delegat/da", 2019],
      ["VICE", "Vicepresidència", 2010],
      ["SOLIDARI A", "Administració solidària", 2015],
      ["SOLIDARI B", "Administració solidària", 2018],
    ]
  );
});

test("companyKeyPeople keeps only the latest holder of single-holder roles", () => {
  const people = companyKeyPeople([
    { person_name: "OLD PRESI", control: "ADMIN", role_title_raw: "PRESIDENTE", date_start: "20120101", date_end: null },
    { person_name: "NEW PRESI", control: "ADMIN", role_title_raw: "PRESIDENTE", date_start: "20250101", date_end: null },
    { person_name: "OLD OWNER", control: "OWNER", role_title_raw: null, date_start: "20100101", date_end: null },
    { person_name: "NEW OWNER", control: "OWNER", role_title_raw: null, date_start: "20200101", date_end: null },
    { person_name: "SOLID A", control: "ADMIN", role_title_raw: "ADM.SOLIDAR.", date_start: "20100101", date_end: null },
    { person_name: "SOLID B", control: "ADMIN", role_title_raw: "ADM.SOLIDAR.", date_start: "20200101", date_end: null },
  ]);
  assert.deepEqual(people.map((p) => p.personName), ["NEW OWNER", "NEW PRESI", "SOLID A", "SOLID B"]);
});
