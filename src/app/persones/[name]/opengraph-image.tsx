import { ImageResponse } from "next/og";
import { loadPersonProfile, getPersonAwardeeTargets } from "@/lib/borme";
import { fetchContractsByAwardeesSummary } from "@/lib/api";
import { formatCompactNumber, formatNumber } from "@/lib/utils";
import { formatPersonDisplayName } from "@/lib/person-utils";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

interface Props {
  params: Promise<{ name: string }> | { name: string };
}

export default async function Image({ params }: Props) {
  const { name } = await Promise.resolve(params);
  const decodedName = decodeURIComponent(name);
  const profile = await loadPersonProfile(decodedName);

  const displayName = formatPersonDisplayName(profile?.person_name || decodedName);
  const numCompanies = profile?.num_companies || 0;

  const targets = profile ? getPersonAwardeeTargets(profile) : { nifs: [], companyNames: [] };
  const contractsSummary =
    targets.nifs.length > 0
      ? await fetchContractsByAwardeesSummary({ nifs: targets.nifs })
      : { total: 0, totalAmount: 0 };

  const stats = [
    { value: formatNumber(numCompanies), label: "Empreses vinculades" },
    { value: formatNumber(contractsSummary.total), label: "Contractes vinculats" },
    { value: formatCompactNumber(contractsSummary.totalAmount), label: "Import total" },
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
          {/* Top: name + subtitle */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              style={{
                display: "flex",
                fontSize: 18,
                color: "#6366F1",
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Perfil societari
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 52,
                fontWeight: 700,
                lineHeight: 1.1,
                color: "#111827",
              }}
            >
              {displayName}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 20,
                color: "#9CA3AF",
                fontWeight: 500,
              }}
            >
              Vinculacions legals i contractació pública a Catalunya
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
                  border: "2px solid #E0E7FF",
                  borderRadius: 16,
                  padding: "24px 32px",
                  flex: 1,
                }}
              >
                <div style={{ display: "flex", fontSize: 18, color: "#6B7280", fontWeight: 500 }}>
                  {stat.label}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: 44,
                    fontWeight: 700,
                    color: "#4F46E5",
                  }}
                >
                  {stat.value}
                </div>
              </div>
            ))}
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
                Dades obertes · BORME + Contractació pública
              </div>
            </div>
            <div style={{ display: "flex", fontSize: 20, fontWeight: 600, color: "#4F46E5" }}>
              Consulta el perfil a contractes.cat →
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
