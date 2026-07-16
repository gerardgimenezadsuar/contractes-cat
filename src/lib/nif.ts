// Validación de NIF (DNI), NIE y CIF españoles con dígito/letra de control.

const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

export function normalizeNif(value: string): string {
  return value.toUpperCase().replace(/[\s.-]/g, "");
}

function isValidDni(nif: string): boolean {
  if (!/^\d{8}[A-Z]$/.test(nif)) return false;
  const num = parseInt(nif.slice(0, 8), 10);
  return DNI_LETTERS[num % 23] === nif[8];
}

function isValidNie(nif: string): boolean {
  if (!/^[XYZ]\d{7}[A-Z]$/.test(nif)) return false;
  const prefix = { X: "0", Y: "1", Z: "2" }[nif[0] as "X" | "Y" | "Z"];
  const num = parseInt(prefix + nif.slice(1, 8), 10);
  return DNI_LETTERS[num % 23] === nif[8];
}

function isValidCif(cif: string): boolean {
  if (!/^[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]$/.test(cif)) return false;
  const digits = cif.slice(1, 8);
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const d = parseInt(digits[i], 10);
    if (i % 2 === 0) {
      const double = d * 2;
      sum += Math.floor(double / 10) + (double % 10);
    } else {
      sum += d;
    }
  }
  const control = (10 - (sum % 10)) % 10;
  const controlChar = cif[8];
  const org = cif[0];
  const asLetter = "JABCDEFGHI"[control];
  const asDigit = String(control);
  if ("PQRSNW".includes(org)) return controlChar === asLetter;
  if ("ABEH".includes(org)) return controlChar === asDigit;
  return controlChar === asDigit || controlChar === asLetter;
}

/** Valida NIF (DNI), NIE o CIF. Devuelve true si el identificador es válido. */
export function isValidTaxId(value: string): boolean {
  const nif = normalizeNif(value);
  return isValidDni(nif) || isValidNie(nif) || isValidCif(nif);
}
