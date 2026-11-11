import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// AGENTS.md's rule 5: every field that holds Siesta's version holds the same one.

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const json = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const plugin = (manifest) => manifest.plugins.find((p) => p.name === 'siesta');

test('the seven version fields hold the same version', async () => {
  const { VERSION } = await import(join(root, 'skills/siesta-sync-github/scripts/sync-github.mjs'));
  const fields = {
    'package.json › version': json('package.json').version,
    '.claude-plugin/plugin.json › version': json('.claude-plugin/plugin.json').version,
    '.claude-plugin/marketplace.json › metadata.version': json('.claude-plugin/marketplace.json').metadata.version,
    ".claude-plugin/marketplace.json › the plugin's version": plugin(json('.claude-plugin/marketplace.json')).version,
    '.codex-plugin/plugin.json › version': json('.codex-plugin/plugin.json').version,
    ".agents/plugins/marketplace.json › the plugin's version": plugin(json('.agents/plugins/marketplace.json')).version,
    'sync-github.mjs › VERSION': VERSION,
  };
  const expected = fields['package.json › version'];
  assert.match(expected, /^\d+\.\d+\.\d+$/, 'package.json holds a version');
  for (const [field, version] of Object.entries(fields)) assert.equal(version, expected, field);
});
