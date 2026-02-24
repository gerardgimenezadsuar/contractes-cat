import { ImageResponse } from "next/og";
import { fetchOrganDetail } from "@/lib/api";
import { formatCompactNumber, formatCompactShort, formatNumber, niceAxisTicks } from "@/lib/utils";

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
  const { organ, yearly } = await fetchOrganDetail(decodedId);

  const organName = organ?.nom_organ || decodedId;
  const totalAmount = parseFloat(organ?.total || "0");
  const numContracts = parseInt(String(organ?.num_contracts || "0"), 10);

  const yearlyPoints = yearly
    .map((row) => ({
      year: row.year,
      total: parseFloat(row.total || "0"),
    }))
    .filter((row) => Number.isFinite(row.total) && row.total > 0)
    .slice(-6);

  const maxYearly = yearlyPoints.reduce((max, row) => Math.max(max, row.total), 0);
  const numYears = yearlyPoints.length;
  const { ticks, niceMax } = niceAxisTicks(maxYearly, 3);
  const CHART_HEIGHT = 130;

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
          {/* Top: label + organ name */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              style={{
                display: "flex",
                fontSize: 18,
                color: "#7C3AED",
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Organisme contractant
            </div>
            <div
              style={{
                display: "flex",
                fontSize: organName.length > 40 ? 36 : 46,
                fontWeight: 700,
                lineHeight: 1.1,
                color: "#111827",
              }}
            >
              {organName.length > 60 ? organName.slice(0, 57) + "..." : organName}
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
              <div style={{ display: "flex", flex: 1, position: "relative" }}>
                {/* Grid lines + bars */}
                <div style={{ display: "flex", flex: 1, position: "relative" }}>
                  {ticks.map((tick, idx) => {
                    const bottomPct = niceMax > 0 ? (tick / niceMax) * 100 : 0;
                    return (
                      <div
                        key={`grid-${idx}`}
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          bottom: `${bottomPct}%`,
                          height: 1,
                          background: "#E5E7EB",
                          opacity: 0.6,
                          display: "flex",
                        }}
                      />
                    );
                  })}
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
                      const pct = niceMax > 0 ? row.total / niceMax : 0.3;
                      const barHeight = Math.max(6, Math.round(pct * CHART_HEIGHT));
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
                              background: "#7C3AED",
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
                {/* Y-axis labels (right) */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    width: 44,
                    paddingLeft: 8,
                    height: CHART_HEIGHT,
                  }}
                >
                  {[...ticks].reverse().map((tick, idx) => (
                    <div
                      key={`y-${idx}`}
                      style={{ display: "flex", fontSize: 11, color: "#9CA3AF", justifyContent: "flex-start" }}
                    >
                      {formatCompactShort(tick)}
                    </div>
                  ))}
                </div>
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#7C3AED",
                color: "#ffffff",
                fontSize: 20,
                fontWeight: 600,
                padding: "10px 24px",
                borderRadius: 50,
              }}
            >
              Veure contractes a contractes.cat →
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
