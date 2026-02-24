import { ImageResponse } from "next/og";
import { fetchCompanyDetail } from "@/lib/api";
import { formatCompactNumber, formatNumber } from "@/lib/utils";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

interface Props {
  params: Promise<{ id: string }> | { id: string };
}

export default async function Image({ params }: Props) {
  const { id } = await Promise.resolve(params);
  const decodedId = decodeURIComponent(id);
  const { company, yearly } = await fetchCompanyDetail(decodedId);

  const companyName = company?.denominacio_adjudicatari || decodedId;
  const totalAmount = parseFloat(company?.total || "0");
  const numContracts = parseInt(String(company?.num_contracts || "0"), 10);

  const yearlyPoints = yearly
    .map((row) => ({
      year: row.year,
      total: parseFloat(row.total || "0"),
    }))
    .filter((row) => Number.isFinite(row.total) && row.total > 0)
    .slice(-6);

  const maxYearly = yearlyPoints.reduce((max, row) => Math.max(max, row.total), 0);
  const numYears = yearlyPoints.length;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(135deg, #EEF2FF 0%, #FFFFFF 50%, #F0F9FF 100%)",
          padding: "32px",
          fontFamily:
            "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            background: "#ffffff",
            borderRadius: 24,
            padding: "44px 48px",
            justifyContent: "space-between",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}
        >
          {/* Top: label + company name */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              style={{
                display: "flex",
                fontSize: 18,
                color: "#16A34A",
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Empresa adjudicatària
            </div>
            <div
              style={{
                display: "flex",
                fontSize: companyName.length > 40 ? 36 : 46,
                fontWeight: 700,
                lineHeight: 1.1,
                color: "#111827",
              }}
            >
              {companyName.length > 60 ? companyName.slice(0, 57) + "..." : companyName}
            </div>
          </div>

          {/* Middle: stacked stats left + bar chart right */}
          <div style={{ display: "flex", gap: 20, height: 200 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 280 }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  background: "#F9FAFB",
                  border: "2px solid #E5E7EB",
                  borderRadius: 14,
                  padding: "14px 24px",
                  height: 94,
                  justifyContent: "center",
                }}
              >
                <div style={{ display: "flex", fontSize: 14, color: "#16A34A", fontWeight: 600 }}>
                  Import total
                </div>
                <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: "#111827" }}>
                  {formatCompactNumber(totalAmount)}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  background: "#F9FAFB",
                  border: "2px solid #E5E7EB",
                  borderRadius: 14,
                  padding: "14px 24px",
                  height: 94,
                  justifyContent: "center",
                }}
              >
                <div style={{ display: "flex", fontSize: 14, color: "#7C3AED", fontWeight: 600 }}>
                  Contractes
                </div>
                <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: "#111827" }}>
                  {formatNumber(numContracts)}
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                background: "#F9FAFB",
                border: "2px solid #E5E7EB",
                borderRadius: 14,
                padding: "16px 28px 14px",
                flex: 1,
                height: 200,
              }}
            >
              <div style={{ display: "flex", fontSize: 14, color: "#6B7280", fontWeight: 600, marginBottom: 10 }}>
                Evolució anual
              </div>
              <div
                style={{
                  display: "flex",
                  flex: 1,
                  gap: numYears <= 3 ? 20 : 14,
                  alignItems: "flex-end",
                  justifyContent: "center",
                }}
              >
                {(numYears > 0
                  ? yearlyPoints
                  : [{ year: "—", total: 1 }, { year: "—", total: 1 }, { year: "—", total: 1 }]
                ).map((row, idx) => {
                  const pct = maxYearly > 0 ? row.total / maxYearly : 0.3;
                  const barHeight = Math.max(10, Math.round(pct * 120));
                  return (
                    <div
                      key={`${row.year}-${idx}`}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
                    >
                      <div
                        style={{
                          display: "flex",
                          width: numYears <= 3 ? 44 : 32,
                          height: barHeight,
                          background: "#4F46E5",
                          borderRadius: 4,
                        }}
                      />
                      <div style={{ display: "flex", fontSize: 13, color: "#9CA3AF" }}>
                        {String(row.year).slice(-2)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom: branding */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  display: "flex",
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: "#22C55E",
                }}
              />
              <div style={{ display: "flex", fontSize: 16, color: "#6B7280" }}>
                Dades obertes · Contractació pública de Catalunya
              </div>
            </div>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#111827" }}>
              contractes.cat
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
