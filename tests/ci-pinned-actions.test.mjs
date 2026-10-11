import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

/* A tag like `actions/checkout@v6` is a pointer the action's owner can move,
   so a compromised or retagged action runs here with this repo's secrets.
   Every `uses:` names a full commit SHA instead, with the release it was cut
   from in a trailing comment so a person bumping it knows what they are
   replacing. Resolve a new pin with
   `git ls-remote --tags https://github.com/<owner>/<action> '<tag>*'`
   (the `^{}` line is the commit for an annotated tag). */
const dir = new URL('../.github/workflows/', import.meta.url);

test('every workflow pins its actions to a commit SHA', () => {
  const files = readdirSync(dir).filter((f) => f.endsWith('.yml'));
  assert.ok(files.length > 0, 'no workflows found');
  for (const file of files) {
    const src = readFileSync(new URL(file, dir), 'utf8');
    for (const [, ref] of src.matchAll(/^\s*(?:-\s*)?uses:\s*(\S+)/gm)) {
      if (ref.startsWith('./')) continue;
      assert.match(ref, /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/, `${file}: ${ref} is not pinned to a commit SHA`);
    }
    for (const line of src.split('\n').filter((l) => /uses:\s*\S+@[0-9a-f]{40}/.test(l))) {
      assert.match(line, /# v\d+\.\d+\.\d+\s*$/, `${file}: "${line.trim()}" does not name the release it pins`);
    }
  }
});
