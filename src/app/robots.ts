import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/constants";

// SEO/backlink crawlers send no visitors. They are also denied at the Vercel firewall.
const BLOCKED_CRAWLERS = [
  "SERankingBacklinksBot",
  "SemrushBot",
  "SemrushBot-BA",
  "SemrushBot-SA",
  "SiteAuditBot",
  "AhrefsBot",
  "AhrefsSiteAudit",
  "MJ12bot",
  "DotBot",
  "DataForSeoBot",
  "Barkrowler",
  "serpstatbot",
  "BLEXBot",
  "SeekportBot",
  "SEOJuice",
  "MegaIndex",
  "ZoominfoBot",
  "AwarioBot",
  "Bytespider",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: BLOCKED_CRAWLERS,
        disallow: "/",
      },
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    // The index lists every sitemap chunk (see app/sitemap-index.xml/route.ts).
    sitemap: `${SITE_URL}/sitemap-index.xml`,
    host: SITE_URL,
  };
}
