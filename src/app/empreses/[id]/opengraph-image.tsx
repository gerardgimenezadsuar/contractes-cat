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

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

export default async function Image({ params }: Props) {
  const { id } = await Promise.resolve(params);
  const decodedId = decodeURIComponent(id);
  const { company, yearly } = await fetchCompanyDetail(decodedId);

  const companyName = company?.denominacio_adjudicatari || decodedId;
  const totalAmount = parseFloat(company?.total || "0");
  const totalContracts = parseInt(company?.num_contracts || "0", 10);

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
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #0f172a 0%, #111827 42%, #1d4ed8 100%)",
          color: "#f8fafc",
          padding: "48px",
          fontFamily:
            "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700 }}>contractes.cat</div>
          <div
            style={{
              display: "flex",
              fontSize: 20,
              color: "#cbd5e1",
              border: "1px solid rgba(203, 213, 225, 0.4)",
              borderRadius: 999,
              padding: "8px 16px",
            }}
          >
            Perfil empresa
          </div>
        </div>

        <div style={{ display: "flex", marginTop: 30, fontSize: 56, fontWeight: 700, lineHeight: 1.08 }}>
          {truncate(companyName, 52)}
        </div>
        <div style={{ display: "flex", marginTop: 8, fontSize: 24, color: "#cbd5e1" }}>
          NIF: {decodedId}
        </div>

        <div style={{ display: "flex", gap: 20, marginTop: 36 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              background: "rgba(15, 23, 42, 0.5)",
              border: "1px solid rgba(148, 163, 184, 0.35)",
              borderRadius: 18,
              padding: "22px 24px",
            }}
          >
            <div style={{ display: "flex", fontSize: 20, color: "#93c5fd" }}>Import total adjudicat</div>
            <div style={{ display: "flex", marginTop: 8, fontSize: 44, fontWeight: 700 }}>
              {formatCompactNumber(totalAmount)}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 320,
              background: "rgba(15, 23, 42, 0.5)",
              border: "1px solid rgba(148, 163, 184, 0.35)",
              borderRadius: 18,
              padding: "22px 24px",
            }}
          >
            <div style={{ display: "flex", fontSize: 20, color: "#93c5fd" }}>Contractes</div>
            <div style={{ display: "flex", marginTop: 8, fontSize: 44, fontWeight: 700 }}>
              {formatNumber(totalContracts)}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: "auto",
            alignItems: "flex-end",
            height: 120,
          }}
        >
          {yearlyPoints.length > 0 ? (
            yearlyPoints.map((row) => {
              const pct = maxYearly > 0 ? row.total / maxYearly : 0;
              const barHeight = Math.max(12, Math.round(pct * 88));
              return (
                <div key={row.year} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      display: "flex",
                      width: 34,
                      height: barHeight,
                      borderRadius: 8,
                      background: "linear-gradient(180deg, #60a5fa 0%, #1d4ed8 100%)",
                    }}
                  />
                  <div style={{ display: "flex", fontSize: 14, color: "#bfdbfe" }}>{row.year}</div>
                </div>
              );
            })
          ) : (
            <div style={{ display: "flex", fontSize: 18, color: "#cbd5e1" }}>
              Sense prou dades anuals per visualitzar la sèrie.
            </div>
          )}
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
