import type { Metadata } from "next";
import { buildCompanyMetadata, CompanyDetail } from "./company-detail";

export const revalidate = 86400;

// Empty list + revalidate = on-demand ISR: each company page is rendered on
// its first request and then served from the CDN cache.
export async function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return buildCompanyMetadata(decodeURIComponent(id));
}

export default async function CompanyDetailPage({ params }: Props) {
  const { id } = await params;
  return <CompanyDetail decodedId={decodeURIComponent(id)} />;
}
