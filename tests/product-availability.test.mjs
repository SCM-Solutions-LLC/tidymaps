import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyAvailability, summarize } from '../scripts/product-availability.mjs';

/* The old checker counted anything but a 404 or 410 as alive, so a product
   Amazon lists as "Currently unavailable" passed as "ok 200" on the very day
   the owner found it unbuyable. The classifier reads the page. */

const amazon = 'https://www.amazon.com/dp/B088N867YS';

test('a 200 whose page says the product is unavailable is unavailable, not ok', () => {
  const v = classifyAvailability({ status: 200, url: amazon, body: '<html>... <span>Currently unavailable.</span> We don\'t know when or if this item will be back in stock. ...' });
  assert.equal(v.state, 'unavailable');
  assert.match(v.reason, /currently unavailable/);
});

test('a plain product page is ok', () => {
  const v = classifyAvailability({ status: 200, url: amazon, body: '<html><title>Copco turntable</title><span id="price">$9.99</span><span>In Stock</span></html>' });
  assert.equal(v.state, 'ok');
});

test('a bot wall is blocked, never ok and never dead', () => {
  for (const body of [
    'Type the characters you see in this image',
    'To discuss automated access to Amazon data please contact api-services-support@amazon.com',
  ]) {
    assert.equal(classifyAvailability({ status: 200, url: amazon, body }).state, 'blocked', body);
  }
  for (const status of [403, 429, 503]) {
    assert.equal(classifyAvailability({ status, url: amazon, body: '' }).state, 'blocked', `http ${status}`);
  }
  assert.equal(classifyAvailability({ status: 200, url: amazon, body: '' }).state, 'blocked', 'an empty body is not a product page');
});

test('a missing page is dead and a network failure is an error', () => {
  assert.equal(classifyAvailability({ status: 404, url: amazon, body: '' }).state, 'dead');
  assert.equal(classifyAvailability({ status: 410, url: amazon, body: '' }).state, 'dead');
  assert.equal(classifyAvailability({ status: 0, url: amazon, body: '', error: 'TimeoutError' }).state, 'error');
});

test('each retailer has its own wording', () => {
  assert.equal(classifyAvailability({ status: 200, url: 'https://www.target.com/p/x/-/A-1', body: '<button disabled>Sold out</button>' }).state, 'unavailable');
  assert.equal(classifyAvailability({ status: 200, url: 'https://www.walmart.com/ip/x/1', body: 'This item is no longer available.' }).state, 'unavailable');
  assert.equal(classifyAvailability({ status: 200, url: 'https://www.containerstore.com/s/x', body: '<span>Out of Stock</span>' }).state, 'unavailable');
});

test('a request that ends on another host is "moved", whatever the page says', () => {
  const v = classifyAvailability({ status: 200, url: amazon, finalUrl: 'https://www.example.com/parked', body: '<html>In Stock</html>' });
  assert.equal(v.state, 'moved');
  assert.match(v.reason, /example\.com/);
  // The retailer's own redirects (to www, to a canonical path) are not a move.
  assert.equal(classifyAvailability({ status: 200, url: 'https://amazon.com/dp/B0', finalUrl: 'https://www.amazon.com/Copco/dp/B0', body: '<html>In Stock</html>' }).state, 'ok');
});

test('a body that is not a page cannot be read for wording', () => {
  assert.equal(classifyAvailability({ status: 200, url: amazon, contentType: 'application/octet-stream', body: 'binary' }).state, 'blocked');
  assert.equal(classifyAvailability({ status: 200, url: amazon, contentType: 'text/html; charset=utf-8', body: '<html>In Stock</html>' }).state, 'ok');
});

/* The weekly run's exit code, and so the owner's email, comes from this. */
test('the run fails only on products the catalog still calls available', () => {
  const { failing, backInStock, counts } = summarize([
    { id: 'a', verdict: 'unavailable', catalogSays: 'available' },
    { id: 'b', verdict: 'unavailable', catalogSays: 'unavailable' },
    { id: 'c', verdict: 'blocked', catalogSays: 'available' },
    { id: 'd', verdict: 'ok', catalogSays: 'unavailable' },
    { id: 'e', verdict: 'dead', catalogSays: 'available' },
    { id: 'f', verdict: 'error', catalogSays: 'available' },
    { id: 'g', verdict: 'moved', catalogSays: 'available' },
    { id: 'h', verdict: 'ok', catalogSays: 'available' },
  ]);
  assert.deepEqual(failing.map(r => r.id), ['a', 'e', 'g'], 'a known-unavailable product, a blocked page and a network error are not failures');
  assert.deepEqual(backInStock.map(r => r.id), ['d'], 'a product marked unavailable whose page loads fine is worth a look');
  assert.deepEqual(counts, { unavailable: 2, blocked: 1, ok: 2, dead: 1, error: 1, moved: 1 });
});
