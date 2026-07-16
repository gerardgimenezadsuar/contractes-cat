"use client";

import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { useState } from "react";
import { formatDate, formatEur, VAT_EXEMPT_NOTE, type Invoice } from "@/lib/types";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: "Helvetica", color: "#1e293b" },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#0f766e" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 28 },
  label: { fontSize: 8, color: "#64748b", textTransform: "uppercase", marginBottom: 3 },
  bold: { fontFamily: "Helvetica-Bold" },
  partiesRow: { flexDirection: "row", gap: 24, marginBottom: 28 },
  partyBox: { flex: 1, border: "1 solid #e2e8f0", borderRadius: 4, padding: 10 },
  tableHeader: {
    flexDirection: "row",
    borderBottom: "1 solid #0f766e",
    paddingBottom: 4,
    marginBottom: 4,
  },
  row: { flexDirection: "row", paddingVertical: 4, borderBottom: "0.5 solid #e2e8f0" },
  colConcept: { flex: 1 },
  colQty: { width: 50, textAlign: "right" },
  colPrice: { width: 80, textAlign: "right" },
  colTotal: { width: 80, textAlign: "right" },
  totals: { marginTop: 16, marginLeft: "auto", width: 220 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: "1 solid #0f766e",
    marginTop: 4,
    paddingTop: 6,
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
  },
  note: { marginTop: 28, fontSize: 8, color: "#64748b" },
});

export function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  return (
    <Document title={`Factura ${invoice.number}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>FACTURA</Text>
          <View>
            <Text style={styles.label}>Número</Text>
            <Text style={styles.bold}>{invoice.number}</Text>
            <Text style={[styles.label, { marginTop: 6 }]}>Fecha de emisión</Text>
            <Text>{formatDate(invoice.issue_date)}</Text>
          </View>
        </View>

        <View style={styles.partiesRow}>
          <View style={styles.partyBox}>
            <Text style={styles.label}>Emisor</Text>
            <Text style={styles.bold}>{invoice.issuer.full_name}</Text>
            <Text>NIF: {invoice.issuer.nif}</Text>
            <Text>{invoice.issuer.address}</Text>
            <Text>
              {invoice.issuer.postal_code} {invoice.issuer.city}
              {invoice.issuer.province ? ` (${invoice.issuer.province})` : ""}
            </Text>
          </View>
          <View style={styles.partyBox}>
            <Text style={styles.label}>Cliente</Text>
            <Text style={styles.bold}>{invoice.client.name}</Text>
            <Text>NIF/CIF: {invoice.client.nif}</Text>
            {invoice.client.address ? <Text>{invoice.client.address}</Text> : null}
            {invoice.client.city || invoice.client.postal_code ? (
              <Text>
                {invoice.client.postal_code} {invoice.client.city}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.colConcept, styles.bold]}>Concepto</Text>
          <Text style={[styles.colQty, styles.bold]}>Cant.</Text>
          <Text style={[styles.colPrice, styles.bold]}>Precio</Text>
          <Text style={[styles.colTotal, styles.bold]}>Importe</Text>
        </View>
        {invoice.lines.map((line, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.colConcept}>{line.concept}</Text>
            <Text style={styles.colQty}>{line.qty}</Text>
            <Text style={styles.colPrice}>{formatEur(line.price)}</Text>
            <Text style={styles.colTotal}>{formatEur(line.qty * line.price)}</Text>
          </View>
        ))}

        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text>Base imponible</Text>
            <Text>{formatEur(invoice.subtotal)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>{invoice.vat_exempt ? "IVA (exento)" : `IVA (${invoice.vat_rate}%)`}</Text>
            <Text>{formatEur(invoice.vat_amount)}</Text>
          </View>
          {invoice.irpf_rate > 0 && (
            <View style={styles.totalsRow}>
              <Text>Retención IRPF ({invoice.irpf_rate}%)</Text>
              <Text>−{formatEur(invoice.irpf_amount)}</Text>
            </View>
          )}
          <View style={styles.grandTotal}>
            <Text>TOTAL</Text>
            <Text>{formatEur(invoice.total)}</Text>
          </View>
        </View>

        {invoice.vat_exempt && <Text style={styles.note}>{VAT_EXEMPT_NOTE}</Text>}
      </Page>
    </Document>
  );
}

export default function DownloadPdfButton({ invoice }: { invoice: Invoice }) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const blob = await pdf(<InvoiceDocument invoice={invoice} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Factura-${invoice.number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={download}
      disabled={busy}
      className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
    >
      {busy ? "Generando…" : "⬇ Descargar PDF"}
    </button>
  );
}
