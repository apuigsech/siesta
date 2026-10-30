import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Every skill's frontmatter and its agents/openai.yaml, against AGENTS.md's rules 2 and 3.

const here = dirname(fileURLToPath(import.meta.url));
const skillsDir = join(here, '../../skills');
const skills = readdirSync(skillsDir).filter((name) => statSync(join(skillsDir, name)).isDirectory());

// The Agent Skills standard's fields, and those rule 3 allows beside them.
const STANDARD = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'];
const INVOCATION = ['argument-hint', 'user-invocable', 'disable-model-invocation'];

// The top-level keys of a simple YAML block, with their values unquoted. Nested lines are skipped.
function topLevel(text) {
  const keys = {};
  for (const line of text.split('\n')) {
    const match = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (match) keys[match[1]] = match[2].replace(/^"(.*)"$/, '$1');
  }
  return keys;
}

function frontmatter(name) {
  const text = readFileSync(join(skillsDir, name, 'SKILL.md'), 'utf8');
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  assert.ok(match, `${name}: SKILL.md starts with a frontmatter block`);
  return topLevel(match[1]);
}

// The value of `key` under `section` in agents/openai.yaml, or undefined.
function openai(name, section, key) {
  const text = readFileSync(join(skillsDir, name, 'agents', 'openai.yaml'), 'utf8');
  let inside = false;
  for (const line of text.split('\n')) {
    if (/^\S/.test(line)) inside = line.startsWith(`${section}:`);
    const match = new RegExp(`^  ${key}:\\s*(.*)$`).exec(line);
    if (inside && match) return match[1].replace(/^"(.*)"$/, '$1');
  }
  return undefined;
}

test('there are skills to check', () => {
  assert.ok(skills.length > 0);
});

for (const name of skills) {
  test(`${name}: its frontmatter follows the standard and rule 3`, () => {
    const fields = frontmatter(name);
    assert.equal(fields.name, name);
    assert.match(name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok(name.length <= 64);
    assert.ok(fields.description && fields.description.length <= 1024, 'a description of at most 1024 characters');
    for (const key of Object.keys(fields)) {
      assert.ok([...STANDARD, ...INVOCATION].includes(key), `${key} is a field the standard or rule 3 allows`);
    }
    for (const key of ['user-invocable', 'disable-model-invocation']) {
      if (key in fields) assert.match(fields[key], /^(true|false)$/, `${key} is true or false`);
    }
  });

  test(`${name}: agents/openai.yaml matches its frontmatter`, () => {
    assert.ok(existsSync(join(skillsDir, name, 'agents', 'openai.yaml')), 'agents/openai.yaml exists');
    const fields = frontmatter(name);
    const implicit = fields['disable-model-invocation'] === 'true' ? 'false' : 'true';
    assert.equal(openai(name, 'policy', 'allow_implicit_invocation'), implicit);

    assert.ok(openai(name, 'interface', 'display_name'), 'a display name');
    const short = openai(name, 'interface', 'short_description') ?? '';
    assert.ok(short.length >= 25 && short.length <= 64, `a short description of 25 to 64 characters: "${short}"`);

    const prompt = openai(name, 'interface', 'default_prompt');
    if (fields['user-invocable'] === 'false') {
      assert.equal(prompt, undefined, 'a skill only agents use has no default prompt');
    } else {
      assert.ok(prompt?.includes(`$${name}`), `a default prompt that names $${name}`);
    }
  });
}
