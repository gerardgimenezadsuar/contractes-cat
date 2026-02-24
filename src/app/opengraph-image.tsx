import { ImageResponse } from "next/og";
import {
  fetchTotalContracts,
  fetchTotalAmount,
  fetchUniqueCompanies,
} from "@/lib/api";
import { formatCompactNumber, formatNumber } from "@/lib/utils";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image() {
  const [totalContracts, totalAmount, uniqueCompanies] = await Promise.all([
    fetchTotalContracts(),
    fetchTotalAmount(),
    fetchUniqueCompanies(),
  ]);

  const stats = [
    { value: formatNumber(totalContracts), label: "Contractes totals", color: "#16A34A" },
    { value: formatCompactNumber(totalAmount), label: "Import adjudicat", color: "#7C3AED" },
    { value: formatNumber(uniqueCompanies), label: "Empreses úniques", color: "#DB2777" },
  ];

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
            padding: "48px",
            justifyContent: "space-between",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}
        >
          {/* Top: branding + tagline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                display: "flex",
                fontSize: 52,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              contractes.cat
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 26,
                color: "#4B5563",
                fontWeight: 500,
              }}
            >
              Contractació pública a Catalunya
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 20,
                color: "#9CA3AF",
              }}
            >
              Dades obertes, anàlisi independent i visualitzacions clares.
            </div>
          </div>

          {/* Middle: stat cards */}
          <div style={{ display: "flex", gap: 20 }}>
            {stats.map((stat) => (
              <div
                key={stat.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  background: "#F9FAFB",
                  border: "2px solid #E5E7EB",
                  borderRadius: 16,
                  padding: "24px 32px",
                  flex: 1,
                }}
              >
                <div style={{ display: "flex", fontSize: 16, color: stat.color, fontWeight: 600 }}>
                  {stat.label}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: 44,
                    fontWeight: 700,
                    color: "#111827",
                  }}
                >
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom: data source */}
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
              Plataforma de serveis de contractació pública · Dades obertes
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
