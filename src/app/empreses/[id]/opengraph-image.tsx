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
          background: "#ffffff",
          color: "#0a0a0a",
          padding: "44px 52px",
          fontFamily:
            "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700 }}>contractes.cat</div>
          <div
            style={{
              display: "flex",
              fontSize: 18,
              color: "#404040",
              border: "1px solid #d4d4d4",
              borderRadius: 999,
              padding: "8px 14px",
            }}
          >
            Perfil empresa
          </div>
        </div>

        <div style={{ display: "flex", gap: 20, marginTop: 28 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              background: "#fafafa",
              border: "1px solid #e5e5e5",
              borderRadius: 16,
              padding: "20px 22px",
            }}
          >
            <div style={{ display: "flex", fontSize: 21, color: "#404040" }}>Import total adjudicat</div>
            <div style={{ display: "flex", marginTop: 10, fontSize: 52, fontWeight: 700, lineHeight: 1 }}>
              {formatCompactNumber(totalAmount)}
            </div>
            <div style={{ display: "flex", marginTop: 10, fontSize: 18, color: "#737373" }}>
              Dades agregades del perfil compartit
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 230,
              background: "#fafafa",
              border: "1px solid #e5e5e5",
              borderRadius: 16,
              padding: "20px 22px",
            }}
          >
            <div style={{ display: "flex", fontSize: 21, color: "#404040" }}>Contractes</div>
            <div style={{ display: "flex", marginTop: 10, fontSize: 52, fontWeight: 700, lineHeight: 1 }}>
              {formatNumber(totalContracts)}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "auto",
            height: 245,
            border: "1px solid #d4d4d4",
            borderRadius: 16,
            padding: "18px 16px 14px 16px",
          }}
        >
          <div style={{ display: "flex", fontSize: 20, color: "#404040", marginBottom: 12 }}>
            Evolució anual (últims 6 anys)
          </div>
          {yearlyPoints.length > 0 ? (
            <div
              style={{
                display: "flex",
                gap: 16,
                alignItems: "flex-end",
                height: 165,
                borderLeft: "2px solid #0a0a0a",
                borderBottom: "2px solid #0a0a0a",
                padding: "8px 10px 10px 12px",
              }}
            >
              {yearlyPoints.map((row) => {
                const pct = maxYearly > 0 ? row.total / maxYearly : 0;
                const barHeight = Math.max(10, Math.round(pct * 132));
                return (
                  <div key={row.year} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        display: "flex",
                        width: 44,
                        height: barHeight,
                        background: "#111111",
                      }}
                    />
                    <div style={{ display: "flex", fontSize: 15, color: "#525252" }}>{row.year}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: "flex", fontSize: 18, color: "#525252" }}>
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
