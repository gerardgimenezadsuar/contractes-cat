import type { Municipality } from "@/lib/idescat";
import { formatDecimal } from "@/lib/indicators";

interface Item {
  label: string;
  value: string;
  note?: string;
}

/** Socio-economic context of the municipality behind an organ, from Idescat. */
export default function ContextBand({ municipality }: { municipality: Municipality }) {
  const items: Item[] = [];
  if (municipality.rfdbPerCapita !== null) {
    items.push({
      label: "Renda per habitant",
      value: `${formatDecimal(municipality.rfdbPerCapita, 0)} €`,
      note: municipality.rfdbYear ? `RFDB ${municipality.rfdbYear}` : undefined,
    });
  }
  if (municipality.pibPerCapita !== null) {
    items.push({
      label: "PIB per habitant",
      value: `${formatDecimal(municipality.pibPerCapita, 0)} €`,
      note: municipality.pibYear ?? undefined,
    });
  }
  if (municipality.ist !== null) {
    items.push({
      label: "Índex socioeconòmic",
      value: formatDecimal(municipality.ist, 1),
      note: `IST ${municipality.istYear ?? ""}, Catalunya = 100`.trim(),
    });
  }
  if (municipality.atur !== null) {
    items.push({
      label: "Atur registrat",
      value: formatDecimal(municipality.atur, 0),
      note: municipality.aturYear ? `mitjana ${municipality.aturYear}` : undefined,
    });
  }
  if (municipality.density !== null) {
    items.push({
      label: "Densitat",
      value: `${formatDecimal(municipality.density, 0)} hab./km²`,
      note: municipality.populationYear ?? undefined,
    });
  }
  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg bg-accent-soft px-4 py-3 md:grid-cols-4">
      {items.slice(0, 4).map((item) => (
        <div key={item.label} className="min-w-0">
          <p className="text-xs text-gray-600">{item.label}</p>
          <p className="font-semibold text-gray-900 tabular-nums">{item.value}</p>
          {item.note ? <p className="text-xs text-gray-500">{item.note}</p> : null}
        </div>
      ))}
      <p className="col-span-full text-xs text-gray-600">
        Context del municipi de {municipality.name} ({municipality.comarca}). Font: Idescat, El municipi en xifres.
      </p>
    </div>
  );
}
