import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
const vite = resolve(root, 'node_modules/vite/bin/vite.js');
const output = resolve(root, 'site-dist');

// Only clean this project's generated site folder; reject links outside the checkout.
if (dirname(output) !== root || basename(output) !== 'site-dist') {
  throw new Error('Unexpected output directory');
}
if (existsSync(output) && (lstatSync(output).isSymbolicLink() || realpathSync(output) !== output)) {
  throw new Error('site-dist must be a regular directory inside this checkout');
}

for (const mode of ['demo', 'room', 'website']) {
  const result = spawnSync(process.execPath, [vite, 'build', '--mode', mode], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
for (const folder of ['demo-dist', 'room-dist', 'website-dist']) {
  cpSync(resolve(root, folder), output, { recursive: true });
}
for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES.txt']) {
  cpSync(resolve(root, file), resolve(output, file));
}
for (const route of ['', 'room', 'website', 'calculator', 'ceo', 'next-gen']) {
  if (!existsSync(resolve(output, route, 'index.html'))) {
    throw new Error(`Missing built route: /${route}`);
  }
}
if (!readFileSync(resolve(output, 'ceo/index.html'), 'utf8').includes('id="next-gen"')) {
  throw new Error('The combined CEO / Next Gen page is missing');
}
console.log('\nComplete V1 site: site-dist/ (6 routes). Run npm run preview:site.');
