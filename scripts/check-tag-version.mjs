// The tag publish gate: fails unless the pushed tag names the version being
// published AND points at a commit that is actually on main. Runs first in the
// release workflow, with the package dir as the argument.
//
// The second check is the less obvious one. Pushing a tag alone makes GitHub
// accept it and upload every commit it reaches, so a release can fire from a
// commit on no branch. Provenance would then faithfully attest a build of
// history nobody can find. Push main first, then the tag.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const dir = path.resolve(process.argv[2] ?? '.');
const { name, version } = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));

const ref = process.env.GITHUB_REF ?? '';
if (!ref.startsWith('refs/tags/')) {
  console.error(`${name}: no tag in GITHUB_REF ("${ref}"). This gate only runs on a tag push.`);
  process.exit(1);
}
const tag = ref.slice('refs/tags/'.length);

if (tag !== `v${version}`) {
  console.error(`${name}: tag ${tag} does not match package version ${version}. Expected v${version}.`);
  process.exit(1);
}

// stderr is discarded: every git failure here has a message of its own below,
// and git's raw complaint next to it reads as two unrelated errors.
const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

// The checkout is detached at the tag, so main exists only as a remote ref.
let mainSha;
try {
  mainSha = git('rev-parse', 'refs/remotes/origin/main');
} catch {
  console.error(`${name}: cannot resolve origin/main. The release checkout needs fetch-depth: 0.`);
  process.exit(1);
}

const tagged = git('rev-list', '-n', '1', tag);
// merge-base --is-ancestor exits non-zero when the answer is no.
try {
  execFileSync('git', ['merge-base', '--is-ancestor', tagged, mainSha], { stdio: 'ignore' });
} catch {
  console.error(
    `${name}: tag ${tag} (${tagged.slice(0, 7)}) is not reachable from main. `
    + 'Push main before the tag, so the published build corresponds to released history.',
  );
  process.exit(1);
}

console.log(`${name}: tag ${tag} matches version ${version} and is on main (${tagged.slice(0, 7)})`);
