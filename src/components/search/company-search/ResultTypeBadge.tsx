type ResultKind = "empresa" | "organisme" | "persona";

const badgeClassByKind: Record<ResultKind, string> = {
  empresa: "inline-flex shrink-0 items-center rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600",
  organisme: "inline-flex shrink-0 items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700",
  persona: "inline-flex shrink-0 items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700",
};

const badgeLabelByKind: Record<ResultKind, string> = {
  empresa: "Empresa",
  organisme: "Organisme",
  persona: "Persona",
};

interface Props {
  kind: ResultKind;
}

export default function ResultTypeBadge({ kind }: Props) {
  return (
    <span className={badgeClassByKind[kind]}>
      {badgeLabelByKind[kind]}
    </span>
  );
}
