import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Publish only the reviewed static build; local credentials and source stay here.
const root = process.cwd();
const output = path.resolve(root, '.vercel/output');
if (path.relative(root, output) !== path.join('.vercel', 'output')) throw new Error('Unexpected output directory');
await readFile(path.join(root, 'dist/index.html'));
const sourceConfig = JSON.parse(await readFile(path.join(root, 'vercel.json'), 'utf8'));
const headers = Object.fromEntries(sourceConfig.headers[0].headers.map(({ key, value }) => [key, value]));
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, 'dist'), path.join(output, 'static'), { recursive: true });
await writeFile(path.join(output, 'config.json'), JSON.stringify({
  version: 3,
  routes: [
    { src: '/(.*)', headers, continue: true },
    { handle: 'filesystem' },
    { src: '/(.*)', dest: '/index.html' },
  ],
}, null, 2) + '\n');
console.log('Prepared .vercel/output from dist with SPA routes and security headers.');
