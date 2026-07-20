// Renders packages/core/CHANGELOG.md (the file the npm tarball ships) as the
// docs changelog page. Single source: the site can never disagree with the
// published file, and the publish gate (scripts/check-changelog.mjs) keeps
// that file covering every published version.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '../../../packages/core/CHANGELOG.md'), 'utf8');
const body = src.replace(/^# Changelog\s*\n+/, '');

const page = `---
title: Changelog
description: Release history for @mycl/core, one section per published version.
---

${body}`;

writeFileSync(join(here, '../src/content/docs/reference/changelog.md'), page);
console.log('Generated changelog page: src/content/docs/reference/changelog.md');
