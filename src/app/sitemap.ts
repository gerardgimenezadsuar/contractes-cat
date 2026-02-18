import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/constants";

const ROUTES = [
  "",
  "/about",
  "/analisi",
  "/contractes",
  "/empreses",
  "/organismes",
  "/legal",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : 0.7,
  }));
}
