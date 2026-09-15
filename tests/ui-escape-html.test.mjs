import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../js/ui.js';

// escapeHtml feeds attribute contexts too (e.g. href="${escapeHtml(url)}"), where
// an unescaped single quote can break out of a single-quoted attribute.
test('escapeHtml escapes single quotes as well as the other HTML-sensitive characters', () => {
  assert.equal(escapeHtml(`O'Brien <b>"hi"</b> & co`), 'O&#39;Brien &lt;b&gt;&quot;hi&quot;&lt;/b&gt; &amp; co');
});
