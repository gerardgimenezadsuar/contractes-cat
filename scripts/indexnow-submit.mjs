#!/usr/bin/env node
/**
 * Notify IndexNow search engines (Bing, Yandex, Seznam, Naver, …) about site URLs.
 * Bing's index also feeds DuckDuckGo, Yahoo, Ecosia, ChatGPT search and Copilot.
 *
 *   node scripts/indexnow-submit.mjs                   # every URL in the sitemaps
 *   node scripts/indexnow-submit.mjs URL [URL ...]     # specific URLs
 *   node scripts/indexnow-submit.mjs --dry-run         # count only, submit nothing
 *
 * The key is public by design: IndexNow verifies ownership by fetching
 * https://www.contractes.cat/<key>.txt, which must contain the key.
 */

const SITE = "https://www.contractes.cat";
const KEY = "d80f4315c76ec745b437f815ffd4c1f7";
const ENDPOINT = "https://api.indexnow.org/indexnow";
const BATCH = 10000; // IndexNow maximum per request
const UA = "contractes.cat-indexnow/1.0";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const explicitUrls = args.filter((a) => a.startsWith("http"));

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

async function sitemapUrls() {
  const chunks = locs(await fetchText(`${SITE}/sitemap-index.xml`));
  const urls = [];
  for (const chunk of chunks) {
    const pageUrls = locs(await fetchText(chunk));
    console.log(`  ${chunk}: ${pageUrls.length} URLs`);
    urls.push(...pageUrls);
  }
  return urls;
}

async function main() {
  const keyFile = (await fetchText(`${SITE}/${KEY}.txt`)).trim();
  if (keyFile !== KEY) throw new Error(`Key file at ${SITE}/${KEY}.txt does not contain the key`);

  const urls = [...new Set(explicitUrls.length > 0 ? explicitUrls : await sitemapUrls())];
  console.log(`${urls.length} URLs to submit${dryRun ? " (dry run)" : ""}`);
  if (dryRun) return;

  for (let i = 0; i < urls.length; i += BATCH) {
    const urlList = urls.slice(i, i + BATCH);
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", "User-Agent": UA },
      body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList }),
    });
    // 200 = accepted, 202 = accepted while the key is being validated.
    console.log(`  batch ${i / BATCH + 1}: ${urlList.length} URLs → HTTP ${res.status} ${res.status >= 300 ? await res.text() : ""}`);
    if (res.status >= 300) process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
