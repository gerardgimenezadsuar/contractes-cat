import { ImageResponse } from "next/og";
import { fetchTotalAmount, fetchTotalContracts, fetchUniqueCompanies } from "@/lib/api";
import { formatCompactNumber, formatNumber } from "@/lib/utils";

export const alt = "contractes.cat - Contractació pública a Catalunya";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  let totalContracts = 0;
  let totalAmount = 0;
  let uniqueCompanies = 0;

  try {
    [totalContracts, totalAmount, uniqueCompanies] = await Promise.all([
      fetchTotalContracts(),
      fetchTotalAmount(),
      fetchUniqueCompanies(),
    ]);
  } catch (error) {
    console.error("Error generating homepage OG image:", error);
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(145deg, #eef2ff 0%, #ffffff 55%, #f8fafc 100%)",
          color: "#111827",
          padding: "46px",
          fontFamily:
            "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            border: "1px solid #e5e7eb",
            borderRadius: 24,
            background: "#ffffff",
            padding: "40px",
            boxShadow: "0 16px 40px rgba(15, 23, 42, 0.08)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", fontSize: 64, fontWeight: 700, letterSpacing: "-0.04em" }}>
              contractes.cat
            </div>
            <div style={{ display: "flex", fontSize: 34, color: "#334155", lineHeight: 1.25 }}>
              Contractació pública a Catalunya
            </div>
            <div style={{ display: "flex", fontSize: 24, color: "#64748b", marginTop: 4 }}>
              Dades obertes, anàlisi independent i visualitzacions clares.
            </div>
          </div>

          <div style={{ display: "flex", gap: 18, marginTop: "auto" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                width: "33%",
                border: "1px solid #dbeafe",
                borderRadius: 16,
                padding: "20px",
                background: "#eff6ff",
              }}
            >
              <div style={{ display: "flex", fontSize: 21, color: "#1e3a8a" }}>Contractes totals</div>
              <div style={{ display: "flex", fontSize: 48, fontWeight: 700, color: "#1e293b" }}>
                {formatNumber(totalContracts)}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                width: "33%",
                border: "1px solid #dcfce7",
                borderRadius: 16,
                padding: "20px",
                background: "#f0fdf4",
              }}
            >
              <div style={{ display: "flex", fontSize: 21, color: "#166534" }}>Import adjudicat</div>
              <div style={{ display: "flex", fontSize: 48, fontWeight: 700, color: "#1e293b" }}>
                {formatCompactNumber(totalAmount)}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                width: "33%",
                border: "1px solid #e9d5ff",
                borderRadius: 16,
                padding: "20px",
                background: "#faf5ff",
              }}
            >
              <div style={{ display: "flex", fontSize: 21, color: "#6b21a8" }}>Empreses úniques</div>
              <div style={{ display: "flex", fontSize: 48, fontWeight: 700, color: "#1e293b" }}>
                {formatNumber(uniqueCompanies)}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
