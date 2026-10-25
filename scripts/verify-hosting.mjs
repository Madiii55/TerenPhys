import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = path.resolve('dist');
const host = new URL(process.argv[2]);
if (host.protocol !== 'https:' || host.username || host.password || host.pathname !== '/' || host.search || host.hash) {
  throw new Error('Provide a public HTTPS origin, without credentials or URL parameters.');
}
const output = process.argv[3];
const verification = Date.now();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function publishedFile(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      const bytes = Buffer.from(await response.arrayBuffer());
      return { response, bytes };
    } catch (error) {
      if (attempt === 1) throw new Error(`Cannot verify ${url.pathname}: ${error.name}`);
    }
  }
}
async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const batches = await Promise.all(entries.map(entry => {
    const filename = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Unexpected symbolic link in build');
    return entry.isDirectory() ? collect(filename) : filename;
  }));
  return batches.flat();
}
const files = await collect(root), results = [];
for (let start = 0; start < files.length; start += 6) {
  results.push(...await Promise.all(files.slice(start, start + 6).map(async filename => {
    const relative = path.relative(root, filename).split(path.sep).join('/');
    const local = await readFile(filename);
    const url = new URL(relative.split('/').map(encodeURIComponent).join('/'), host);
    url.searchParams.set('verify', String(verification));
    const { response, bytes: remote } = await publishedFile(url);
    return { file: relative, status: response.status, bytes: local.length, sha256: hash(local),
      publishedSha256: hash(remote), matches: response.ok && hash(local) === hash(remote),
      contentType: response.headers.get('content-type') };
  })));
}
const indexHash = hash(await readFile(path.join(root, 'index.html'))), routes = [];
for (const route of ['/', '/auth/confirm', '/auth/reset-password', '/auth/callback']) {
  const url = new URL(route, host);
  url.searchParams.set('verify', String(verification));
  const { response, bytes } = await publishedFile(url);
  routes.push({ route, status: response.status, matchesIndex: hash(bytes) === indexHash,
    noReferrer: response.headers.get('referrer-policy') === 'no-referrer',
    noSniff: response.headers.get('x-content-type-options') === 'nosniff' });
}
const report = { checkedAt: new Date().toISOString(), host: host.origin, files: results, routes,
  fileCount: results.length, totalBytes: results.reduce((sum, file) => sum + file.bytes, 0),
  success: results.every(file => file.matches) && routes.every(route => route.status === 200 && route.matchesIndex && route.noReferrer && route.noSniff) };
if (output) await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ host: report.host, fileCount: report.fileCount, totalBytes: report.totalBytes,
  success: report.success, routes, mismatches: results.filter(file => !file.matches) }, null, 2));
if (!report.success) process.exitCode = 1;
