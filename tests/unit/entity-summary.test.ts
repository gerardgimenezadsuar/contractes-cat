import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCompanySeoDescription,
  buildCompanySeoTitle,
  buildPersonAnswer,
  buildPersonSeoDescription,
  buildPersonSeoTitle,
  cleanEntityName,
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

test("company title carries NIF and the administrators angle when BORME data exists", () => {
  assert.equal(
    buildCompanySeoTitle({ name: "ACME, S.L.,", nif: "B12345678", hasBorme: true }),
    "ACME, S.L. (B12345678): contractes públics i administradors"
  );
  assert.equal(
    buildCompanySeoTitle({ name: "ACME SL", nif: null, hasBorme: false }),
    "ACME SL: contractes públics a Catalunya"
  );
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

test("currentControllers keeps active owners and admins, deduplicated, skipping junk and ended roles", () => {
  const result = currentControllers([
    { person_name: "GARCIA PUIG JOAN", date_end: null, control: "ADMIN" },
    { person_name: "GARCIA PUIG JOAN", date_end: null, control: "ADMIN" },
    { person_name: "ROCA MARIA", date_end: null, control: "OWNER" },
    { person_name: "OLD ADMIN", date_end: "20200101", control: "ADMIN" },
    { person_name: "APODERAT", date_end: null, control: null },
    { person_name: "PEREZ Presidente: X", date_end: null, control: "ADMIN" },
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
