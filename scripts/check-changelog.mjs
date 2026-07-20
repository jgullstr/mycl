// The changelog publish gate: fails unless CHANGELOG.md has a non-empty
// section for the version in package.json. Runs as a package's prepublishOnly
// (cwd = the package dir) and from the repo root in CI with the package dir
// as the argument.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.argv[2] ?? '.');
const { name, version } = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
const changelog = readFileSync(path.join(dir, 'CHANGELOG.md'), 'utf8');

const lines = changelog.split('\n');
const start = lines.findIndex((l) => l.trim() === `## ${version}` || l.startsWith(`## ${version} `));
if (start === -1) {
  console.error(`${name}: CHANGELOG.md has no "## ${version}" section. Write the entry before publishing.`);
  process.exit(1);
}
const next = lines.findIndex((l, i) => i > start && l.startsWith('## '));
const body = lines.slice(start + 1, next === -1 ? lines.length : next).join('\n').trim();
if (body === '') {
  console.error(`${name}: the CHANGELOG.md "## ${version}" section is empty. Write the entry before publishing.`);
  process.exit(1);
}
console.log(`${name}: CHANGELOG.md covers ${version} ("${lines[start].trim()}")`);
