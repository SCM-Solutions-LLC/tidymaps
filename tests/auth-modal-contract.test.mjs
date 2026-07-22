import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../js/screens/account.js', import.meta.url), 'utf8');

test('successful verification runs the same modal cleanup as cancellation', () => {
  const verifyBlock = source.slice(source.indexOf('export async function verifyAuthCode'));
  assert.match(verifyBlock, /hideAuthModal\(\)/);
  const helperBlock = source.slice(source.indexOf('function hideAuthModal'), source.indexOf('export function closeAuth'));
  assert.match(helperBlock, /document\.body\.style\.overflow=''/);
  assert.match(helperBlock, /removeEventListener\('keydown'/);
  assert.match(helperBlock, /authTrigger\.focus\(\)/);
  assert.match(helperBlock, /acct-btn/);
});
