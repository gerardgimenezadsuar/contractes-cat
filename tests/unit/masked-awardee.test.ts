import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clusterMaskedAwardees,
  maskedDigits,
  pickMaskedCluster,
  profileName,
  sameMaskedAwardee,
  type MaskedNameGroup,
} from "../../src/lib/masked-awardee.ts";

const same = (a: string, b: string) => sameMaskedAwardee(profileName(a), profileName(b));
const group = (id: string, name: string, contracts: number): MaskedNameGroup => ({ id, name, contracts, total: 0 });

test("maskedDigits reads the 4 visible digits from any mask layout", () => {
  assert.equal(maskedDigits("*** 0721 **"), "0721");
  assert.equal(maskedDigits("*****0721****"), "0721");
  assert.equal(maskedDigits("****0721"), "0721");
  assert.equal(maskedDigits("B12345678"), null);
  assert.equal(maskedDigits("*****"), null);
  assert.equal(maskedDigits("***12**"), null);
});

test("same person across order, accents, punctuation and Catalan/Spanish given names", () => {
  assert.ok(same("XALABARDER MIRAMANDA, AVEL·LI", "AVELINO XALABARDER MIRAMANDA"));
  assert.ok(same("XALABARDER MIRAMANDA, AVEL·LI", "XALABARDER MIRAMANDA"));
  assert.ok(same("BENET RAMOS OSCAR", "ÒSCAR BENET RAMOS"));
  assert.ok(same("COSTA PINTO, DÉBORA COIMBRA", "COIMBRA COSTA PINTO DEBORA"));
  assert.ok(same("MICO PALERO,JESUS", "MICO PALERO, JESÚS"));
});

test("different people sharing surnames or the masked digits stay apart", () => {
  assert.ok(!same("JORDI GARCIA MARTINEZ", "ANNA GARCIA MARTINEZ"));
  assert.ok(!same("XALABARDER MIRAMANDA, AVEL·LI", "BENET RAMOS OSCAR"));
  assert.ok(!same("DAVID GARCÍA MARTINO", "JORDI GARCIA MARTINEZ"));
  assert.ok(!same("MARIA GARCIA", "JOAN GARCIA"));
});

test("company spellings merge when either side has a legal form", () => {
  assert.ok(same("Abcam B.V.", "ABCAM (NETHERLANDS) BV"));
  assert.ok(same("ABCAM", "6006375    ABCAM NETHERLANDS, BV"));
  assert.ok(same("GenScript", "GENSCRIPT BIOTECH (NETHERLANDS) B.V."));
  assert.ok(!same("UNISENSOR SA", "GENSCRIPT BIOTECH BV"));
});

test("clusterMaskedAwardees merges layouts and spellings, largest cluster first", () => {
  const clusters = clusterMaskedAwardees("0721", [
    group("*** 0721 **", "XALABARDER MIRAMANDA, AVEL·LI", 591),
    group("*** 0721 **", "AVELINO XALABARDER MIRAMANDA", 19),
    group("*****0721****", "Xalabarder Miramanda Avelino", 4),
    group("*** 0721 **", "BENET RAMOS OSCAR", 2),
    group("*** 0721 **", "Oscar Benet Ramos", 1),
    group("*** 0721 **", "JORDI GARCIA MARTINEZ", 1),
  ]);
  assert.equal(clusters.length, 3);
  assert.equal(clusters[0].name, "XALABARDER MIRAMANDA, AVEL·LI");
  assert.equal(clusters[0].contracts, 614);
  assert.deepEqual(new Set(clusters[0].members.map((m) => m.id)), new Set(["*** 0721 **", "*****0721****"]));
  assert.equal(clusters[1].contracts, 3);
  assert.equal(clusters[2].name, "JORDI GARCIA MARTINEZ");
});

test("pickMaskedCluster finds the requested name, or the largest cluster without one", () => {
  const clusters = clusterMaskedAwardees("0721", [
    group("*** 0721 **", "XALABARDER MIRAMANDA, AVEL·LI", 591),
    group("*** 0721 **", "BENET RAMOS OSCAR", 2),
  ]);
  assert.equal(pickMaskedCluster(clusters, "benet  ramos oscar")?.name, "BENET RAMOS OSCAR");
  assert.equal(pickMaskedCluster(clusters, "Òscar Benet Ramos")?.name, "BENET RAMOS OSCAR");
  assert.equal(pickMaskedCluster(clusters)?.name, "XALABARDER MIRAMANDA, AVEL·LI");
  assert.equal(pickMaskedCluster(clusters, "NOBODY ELSE AT ALL"), null);
  assert.equal(pickMaskedCluster([], "X"), null);
});
