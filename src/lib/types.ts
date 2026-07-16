export interface Profile {
  user_id: string;
  full_name: string;
  nif: string;
  address: string;
  city: string;
  postal_code: string;
  province: string;
  irpf_rate: number;
  invoice_prefix: string;
  next_invoice_number: number;
}

export interface Client {
  id: string;
  name: string;
  nif: string;
  address: string;
  city: string;
  postal_code: string;
}

export interface Template {
  id: string;
  name: string;
  concept: string;
  unit_price: number;
  irpf_applies: boolean;
}

export interface InvoiceLine {
  concept: string;
  qty: number;
  price: number;
}

export interface IssuerSnapshot {
  full_name: string;
  nif: string;
  address: string;
  city: string;
  postal_code: string;
  province: string;
}

export interface ClientSnapshot {
  name: string;
  nif: string;
  address: string;
  city: string;
  postal_code: string;
}

export interface Invoice {
  id: string;
  number: string;
  issue_date: string;
  issuer: IssuerSnapshot;
  client: ClientSnapshot;
  lines: InvoiceLine[];
  subtotal: number;
  vat_exempt: boolean;
  vat_rate: number;
  vat_amount: number;
  irpf_rate: number;
  irpf_amount: number;
  total: number;
}

export const VAT_EXEMPT_NOTE =
  "Operación exenta de IVA según el art. 20.Uno.3º de la Ley 37/1992, del Impuesto sobre el Valor Añadido.";

export function formatEur(amount: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function computeTotals(
  lines: InvoiceLine[],
  vatExempt: boolean,
  vatRate: number,
  irpfRate: number
) {
  const subtotal = round2(
    lines.reduce((acc, l) => acc + (l.qty || 0) * (l.price || 0), 0)
  );
  const vatAmount = vatExempt ? 0 : round2((subtotal * vatRate) / 100);
  const irpfAmount = round2((subtotal * irpfRate) / 100);
  const total = round2(subtotal + vatAmount - irpfAmount);
  return { subtotal, vatAmount, irpfAmount, total };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
