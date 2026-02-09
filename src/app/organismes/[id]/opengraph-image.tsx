import { ImageResponse } from "next/og";
import { fetchOrganDetail } from "@/lib/api";
import { formatCompactNumber } from "@/lib/utils";

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

  const totalAmount = parseFloat(organ?.total || "0");

  const yearlyPoints = yearly
    .map((row) => ({
      year: row.year,
      total: parseFloat(row.total || "0"),
    }))
    .filter((row) => Number.isFinite(row.total) && row.total > 0)
    .slice(-6);

  const maxYearly = yearlyPoints.reduce((max, row) => Math.max(max, row.total), 0);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#ffffff",
          color: "#111111",
          padding: "24px",
          fontFamily:
            "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial",
        }}
      >
        <div style={{ display: "flex", flex: 1, gap: 24 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "68%",
              border: "2px solid #111111",
              borderRadius: 16,
              padding: "18px 18px 14px 18px",
            }}
          >
            <div style={{ display: "flex", fontSize: 24, fontWeight: 600, marginBottom: 16 }}>
              Evolucio anual
            </div>
            <div
              style={{
                display: "flex",
                flex: 1,
                gap: 18,
                alignItems: "flex-end",
                justifyContent: yearlyPoints.length <= 3 ? "center" : "space-between",
                borderLeft: "3px solid #111111",
                borderBottom: "3px solid #111111",
                padding: "12px 16px 14px 14px",
              }}
            >
              {(yearlyPoints.length > 0
                ? yearlyPoints
                : [
                    { year: "—", total: 1 },
                    { year: "—", total: 1 },
                    { year: "—", total: 1 },
                  ]
              ).map((row, idx) => {
                const pct = maxYearly > 0 ? row.total / maxYearly : 0.4;
                const barHeight = Math.max(18, Math.round(pct * 290));
                return (
                  <div
                    key={`${row.year}-${idx}`}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}
                  >
                    <div
                      style={{
                        display: "flex",
                        width: yearlyPoints.length <= 3 ? 88 : 66,
                        height: barHeight,
                        background: "#111111",
                      }}
                    />
                    <div style={{ display: "flex", fontSize: 22, color: "#2a2a2a" }}>{row.year}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "32%",
              border: "2px solid #111111",
              borderRadius: 16,
              padding: "24px 20px",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", fontSize: 26, color: "#3a3a3a" }}>Import total adjudicat</div>
              <div style={{ display: "flex", fontSize: 92, fontWeight: 700, lineHeight: 0.96 }}>
                {formatCompactNumber(totalAmount)}
              </div>
            </div>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>contractes.cat</div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
