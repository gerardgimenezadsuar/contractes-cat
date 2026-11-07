import type { Metadata } from "next";
import { buildCompanyMetadata, CompanyDetail } from "../../company-detail";

// Target of the `/empreses/:id?name=...` rewrite in next.config.ts: one awardee
// behind an anonymised DNI. Canonical URLs keep the ?name= form.
export const revalidate = 21600;

export async function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ id: string; name: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, name } = await params;
  return buildCompanyMetadata(decodeURIComponent(id), decodeURIComponent(name));
}

export default async function MaskedAwardeePage({ params }: Props) {
  const { id, name } = await params;
  return <CompanyDetail decodedId={decodeURIComponent(id)} name={decodeURIComponent(name)} />;
}
