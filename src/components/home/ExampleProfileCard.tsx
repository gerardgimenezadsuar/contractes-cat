import ExampleProfiles from "@/components/home/ExampleProfiles";
import { getExampleProfiles } from "@/lib/home-examples";

/**
 * Live examples of a company profile for the home page. Renders nothing if
 * the data sources fail, so the page never shows an empty card.
 */
export default async function ExampleProfileCard() {
  const profiles = await getExampleProfiles().catch(() => []);
  if (profiles.length === 0) return null;
  return <ExampleProfiles profiles={profiles} />;
}
