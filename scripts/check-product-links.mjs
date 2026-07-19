/* Opt-in live checker for the product catalog's retailer URLs.
   Run manually with `npm run check:links`. NOT part of CI: retailer sites
   bot-block datacenter IPs, so live checks from CI produce false failures.
   The E2E suite asserts link shape (https + known retailer) instead. */
import { readFileSync } from 'node:fs';

const catalog = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));
const urls = [...new Set(catalog.products.flatMap((p) => (p.url ? [p.url] : [])))];

let bad = 0;
for (const url of urls) {
  try {
    // GET, not HEAD: several retailers 405 on HEAD.
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; TidyMap link check)' },
      signal: AbortSignal.timeout(15_000),
    });
    // 403/429 = bot-blocked, indistinguishable from alive; only flag hard 404/410.
    if (res.status === 404 || res.status === 410) {
      bad++;
      console.log(`DEAD ${res.status} ${url}`);
    } else {
      console.log(`ok   ${res.status} ${url}`);
    }
  } catch (e) {
    console.log(`ERR  ${url} (${e.name})`);
  }
}
console.log(`\n${urls.length} links checked, ${bad} hard-dead`);
process.exit(bad ? 1 : 0);
