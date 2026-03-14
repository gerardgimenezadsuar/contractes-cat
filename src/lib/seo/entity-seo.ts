import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/config/constants";

type EntitySchemaType = "Person" | "Organization" | "GovernmentOrganization";
type OgType = "website" | "article" | "profile";

interface EntityMetadataConfig {
  title: string;
  description: string;
  path: string;
  imagePath: string;
  imageAlt: string;
  keywords?: string[];
  openGraphType?: OgType;
  /** Override og:title / twitter:title (defaults to title) */
  ogTitle?: string;
  /** Override og:description / twitter:description (defaults to description) */
  ogDescription?: string;
}

interface JsonLdEntityConfig {
  schemaType: EntitySchemaType;
  name: string;
  path: string;
  description: string;
  alternateName?: string;
  extraFields?: Record<string, unknown>;
}

interface BreadcrumbEntry {
  name: string;
  path?: string;
}

function toAbsoluteUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (!path.startsWith("/")) return `${SITE_URL}/${path}`;
  return `${SITE_URL}${path}`;
}

export function buildEntityMetadata(config: EntityMetadataConfig): Metadata {
  const canonicalUrl = toAbsoluteUrl(config.path);
  const imageUrl = toAbsoluteUrl(config.imagePath);
  const socialTitle = config.ogTitle || config.title;
  const socialDescription = config.ogDescription || config.description;

  return {
    title: config.title,
    description: config.description,
    keywords: config.keywords,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: socialTitle,
      description: socialDescription,
      url: canonicalUrl,
      siteName: SITE_NAME,
      type: config.openGraphType || "article",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: config.imageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: socialDescription,
      images: [imageUrl],
    },
  };
}

export function buildEntityPrimaryJsonLd(config: JsonLdEntityConfig): Record<string, unknown> {
  return {
    "@type": config.schemaType,
    name: config.name,
    url: toAbsoluteUrl(config.path),
    description: config.description,
    ...(config.alternateName ? { alternateName: config.alternateName } : {}),
    ...(config.extraFields || {}),
  };
}

export function buildEntityBreadcrumbJsonLd(items: BreadcrumbEntry[]): Record<string, unknown> {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      ...(item.path ? { item: toAbsoluteUrl(item.path) } : {}),
    })),
  };
}

export function buildEntityJsonLdGraph(
  primaryEntity: Record<string, unknown>,
  breadcrumbEntity: Record<string, unknown>
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": [primaryEntity, breadcrumbEntity],
  };
}
