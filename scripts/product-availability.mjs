/* Reads a retailer page and says whether the product on it can still be
   bought. Pure: no fetch, no filesystem, so the node test suite can pin the
   wording. check-product-links.mjs does the fetching.

   Verdicts:
   - ok           the page loaded and nothing on it says the product is gone
   - unavailable  the page loaded and says so ("Currently unavailable", "Sold out")
   - dead         404 or 410, or a retailer's own "we couldn't find that page"
   - moved        the request ended on another retailer's host (or none), so
                  whatever loaded is not the listing the catalog links to
   - blocked      a bot wall, a 403/429/503, an empty or non-HTML body: the
                  page could not be read, which is not the same as the product
                  being fine
   - error        the request itself failed (timeout, DNS, reset)

   Page scraping is a best effort. A retailer can reword a button, and a
   "Sold out" badge on a recommendation carousel can land on a page whose own
   product is fine. So an `unavailable` here is a prompt to look, not a fact:
   the catalog's own `available` flag is what the site trusts, and a person
   sets it. */

const PHRASES = {
  'amazon.com': {
    blocked: [
      'type the characters you see in this image',
      'enter the characters you see below',
      'to discuss automated access to amazon data',
      'robot check',
    ],
    dead: ["we couldn't find that page", 'looking for something?'],
    unavailable: [
      'currently unavailable',
      "we don't know when or if this item will be back in stock",
      'this item cannot be shipped to your selected delivery location',
    ],
  },
  'target.com': {
    blocked: ['access denied'],
    unavailable: ['sold out', 'this item is not available', 'out of stock online'],
  },
  'walmart.com': {
    blocked: ['robot or human?', 'activate and hold the button', 'verify your identity'],
    unavailable: ['this item is no longer available', 'out of stock', 'currently unavailable'],
  },
  'containerstore.com': {
    unavailable: ['out of stock', 'sold out', 'no longer available'],
  },
  'ikea.com': {
    unavailable: ['this product is not available for purchase', 'out of stock', 'not available for delivery'],
  },
};

export function retailerHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return Object.keys(PHRASES).find(h => host === h || host.endsWith('.' + h)) || host;
  } catch (_) {
    return '';
  }
}

export function classifyAvailability({ status = 0, body = '', url = '', finalUrl = '', contentType = '', error = null } = {}) {
  if (error) return { state: 'error', reason: String(error) };
  if (status === 404 || status === 410) return { state: 'dead', reason: `http ${status}` };
  if (status === 403 || status === 429 || status === 503 || status === 0) return { state: 'blocked', reason: `http ${status}` };
  if (status >= 400) return { state: 'error', reason: `http ${status}` };
  // Redirects are followed, so the page in hand may not be the retailer's at
  // all; its wording would then be judged by the wrong phrase table, and a
  // search page or a parked domain would read "ok".
  if (finalUrl && retailerHost(finalUrl) !== retailerHost(url)) {
    return { state: 'moved', reason: `redirected to ${retailerHost(finalUrl) || 'an unknown host'}` };
  }
  if (contentType && !/html|xml/i.test(contentType)) return { state: 'blocked', reason: `not a page (${contentType.split(';')[0].trim()})` };
  const text = String(body || '').toLowerCase();
  if (!text.trim()) return { state: 'blocked', reason: 'empty body' };
  const rules = PHRASES[retailerHost(url)] || {};
  const hit = (list) => (list || []).find(phrase => text.includes(phrase));
  let phrase = hit(rules.blocked);
  if (phrase) return { state: 'blocked', reason: `page says "${phrase}"` };
  phrase = hit(rules.dead);
  if (phrase) return { state: 'dead', reason: `page says "${phrase}"` };
  phrase = hit(rules.unavailable);
  if (phrase) return { state: 'unavailable', reason: `page says "${phrase}"` };
  return { state: 'ok', reason: null };
}

/* The run fails only on products the catalog still calls available: a product
   already marked unavailable is known, and a blocked page is unknown rather
   than bad. A link that no longer lands on the retailer is a failure too: the
   plan would be sending someone somewhere else. */
const FAILING = new Set(['dead', 'unavailable', 'moved']);
export function summarize(results) {
  const counts = {};
  for (const r of results) counts[r.verdict] = (counts[r.verdict] || 0) + 1;
  const failing = results.filter(r => r.catalogSays === 'available' && FAILING.has(r.verdict));
  const backInStock = results.filter(r => r.catalogSays === 'unavailable' && r.verdict === 'ok');
  return { counts, failing, backInStock };
}
