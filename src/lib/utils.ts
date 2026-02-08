export function formatCurrency(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("ca-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatCurrencyFull(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("ca-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatNumber(value: number | string): string {
  const num = typeof value === "string" ? parseInt(value, 10) : value;
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("ca-ES").format(num);
}

export function formatCompactNumber(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  // European convention: 10^9 = "mil M" (not "B" which means 10^12 in Europe)
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)} mil M €`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)} M €`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)} k €`;
  return `${num.toFixed(0)} €`;
}

export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat("ca-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return "—";
  }
}

export function getBestAvailableContractDate(
  adjudicationDate?: string,
  formalizationDate?: string,
  publicationDate?: string
): { date?: string; source: "adjudicacio" | "formalitzacio" | "publicacio" | "none" } {
  if (adjudicationDate) return { date: adjudicationDate, source: "adjudicacio" };
  if (formalizationDate) return { date: formalizationDate, source: "formalitzacio" };
  if (publicationDate) return { date: publicationDate, source: "publicacio" };
  return { source: "none" };
}

export function isSuspiciousContractDate(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return true;

  const year = date.getFullYear();
  const currentYear = new Date().getFullYear();
  return year < 2000 || year > currentYear + 1;
}

export function getPublicationUrl(
  enllac: { url: string } | string | undefined
): string | null {
  if (!enllac) return null;
  if (typeof enllac === "string") return enllac;
  return enllac.url || null;
}

export function parseAmount(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/\|.*$/, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
