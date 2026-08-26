import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('client UI does not reintroduce decorative eyebrow heading fields', () => {
  assert.doesNotMatch(appSource, /\beyebrow\b/i);
  assert.doesNotMatch(appSource, /\bsection-label\b/i);
  assert.doesNotMatch(appSource, /\bkicker\b/i);
  assert.doesNotMatch(appSource, /\boverline\b/i);
});
