import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyAvailability } from '../scripts/product-availability.mjs';

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
