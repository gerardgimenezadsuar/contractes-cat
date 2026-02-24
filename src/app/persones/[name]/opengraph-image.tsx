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

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
          color: "#111111",
          padding: "48px",
          fontFamily:
            "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", fontSize: 20, color: "#666666", fontWeight: 500 }}>
            Perfil societari
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 56,
              fontWeight: 700,
              lineHeight: 1.1,
              maxWidth: "90%",
            }}
          >
            {displayName}
          </div>
        </div>

        <div style={{ display: "flex", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", fontSize: 48, fontWeight: 700 }}>
              {formatNumber(numCompanies)}
            </div>
            <div style={{ display: "flex", fontSize: 20, color: "#666666" }}>
              Empreses vinculades
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", fontSize: 48, fontWeight: 700 }}>
              {formatNumber(contractsSummary.total)}
            </div>
            <div style={{ display: "flex", fontSize: 20, color: "#666666" }}>
              Contractes vinculats
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", fontSize: 48, fontWeight: 700 }}>
              {formatCompactNumber(contractsSummary.totalAmount)}
            </div>
            <div style={{ display: "flex", fontSize: 20, color: "#666666" }}>
              Import total
            </div>
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>contractes.cat</div>
      </div>
    ),
    { ...size }
  );
}
