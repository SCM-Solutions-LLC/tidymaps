/* Availability check for the product catalog's retailer pages.

   Runs weekly from .github/workflows/product-availability.yml and by hand with
   `npm run check:links`. It also runs on every deploy (pages.yml) with
   continue-on-error, because retailer sites bot-block datacenter IPs and a
   blocked page must not stop a deploy; the scheduled run is the signal, and a
   failed scheduled run emails the repository owner.

   The old version counted anything but a 404 or 410 as alive, so a product
   Amazon listed as "Currently unavailable" passed as "ok 200" on the day the
   owner found it unbuyable in a plan. Now the page body is read too
   (scripts/product-availability.mjs). An "unavailable" verdict is a prompt to
   look, not a fact: a person confirms and flips `available` in
   data/catalog.json, and sets `checked` to the date.

   --report=path   also write every verdict as JSON (the workflow uploads it) */
import { readFileSync, writeFileSync } from 'node:fs';
import { classifyAvailability, summarize } from './product-availability.mjs';

const reportPath = (process.argv.find(a => a.startsWith('--report=')) || '').slice('--report='.length) || null;
const catalog = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 (compatible; TidyMap availability check; contact@scmsolutions.org)';

const results = [];
for (const p of catalog.products) {
  if (!p.url) continue;
  let status = 0, body = '', error = null;
  try {
    // GET, not HEAD: several retailers 405 on HEAD, and the body is the point.
    const res = await fetch(p.url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml', 'accept-language': 'en-US,en;q=0.9' },
      signal: AbortSignal.timeout(20_000),
    });
    status = res.status;
    body = status < 400 ? (await res.text()).slice(0, 400_000) : '';
  } catch (e) {
    error = e.name || 'Error';
  }
  const verdict = classifyAvailability({ status, body, url: p.url, error });
  results.push({
    id: p.id, retailer: p.retailer, url: p.url, status,
    verdict: verdict.state, reason: verdict.reason,
    catalogSays: p.available === false ? 'unavailable' : 'available',
    catalogChecked: p.checked || null,
  });
  console.log(`${verdict.state.padEnd(11)} ${String(status || '---').padEnd(3)} ${p.id}${verdict.reason ? `  (${verdict.reason})` : ''}`);
}

const { counts, failing, backInStock } = summarize(results);
console.log(`\n${results.length} products checked: ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}`);
for (const r of failing) console.log(`FAIL  ${r.id} is ${r.verdict} but the catalog says available: ${r.url}`);
for (const r of backInStock) console.log(`NOTE  ${r.id} loads fine now but the catalog says unavailable: worth a look`);
if (counts.blocked) console.log(`NOTE  ${counts.blocked} page(s) could not be read (bot wall or 4xx/5xx); they are neither confirmed nor cleared`);

if (reportPath) {
  writeFileSync(reportPath, JSON.stringify({ checkedAt: new Date().toISOString(), counts, failing: failing.map(r => r.id), results }, null, 2));
  console.log(`report written to ${reportPath}`);
}
process.exit(failing.length ? 1 : 0);
