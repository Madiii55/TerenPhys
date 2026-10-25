import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_URL = 'https://gotlcaqzrwfitgiwmsnj.supabase.co';
async function prepare(outputDir) {
  await mkdir(outputDir, { recursive: true });
  const token = randomBytes(32).toString('hex');
  const expires = Date.now() + 60 * 60 * 1000;
  await writeFile(resolve(outputDir, 'private.json'), JSON.stringify({ token, expires }), { mode: 0o600, flag: 'wx' });
  // Only the digest is needed to deploy the temporary receiver. Never print the credential.
  console.log(JSON.stringify({ digest: createHash('sha256').update(token).digest('hex'), expires }));
}
async function run(outputDir) {
  const { token, expires } = JSON.parse(await readFile(resolve(outputDir, 'private.json'), 'utf8'));
  if (Date.now() > expires) throw new Error('Import credential expired');
  const history = JSON.parse(await readFile(resolve(outputDir, 'public-history.json'), 'utf8'));
  if (history.channel !== 'nisphysicshub' || !history.public_history_complete) throw new Error('Incomplete or unexpected history');
  let nextPost = 0;
  let completed = 0, copied = 0;
  const failed = [];
  async function worker() {
    while (nextPost < history.posts.length) {
      let batch = history.posts.slice(nextPost, nextPost + 5);
      nextPost += batch.length;
      for (let attempt = 0; batch.length && attempt < 3; attempt++) {
        try {
          const response = await fetch(PROJECT_URL + '/functions/v1/telegram-import', {
            method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify(batch), signal: AbortSignal.timeout(110000),
          });
          if (!response.ok) throw new Error('Import request failed (' + response.status + ')');
          const result = await response.json();
          const good = new Set(result.results.filter(row => row.ok).map(row => row.message_id));
          completed += good.size;
          copied += result.results.filter(row => row.ok).reduce((n, row) => n + row.copied, 0);
          batch = batch.filter(post => !good.has(post.message_id));
          console.log(JSON.stringify({ completed, total: history.posts.length, copied, pending: batch.length }));
        } catch (error) { console.log(JSON.stringify({ retry: attempt + 1, error: error.message })); }
        if (batch.length) await new Promise(resolveWait => setTimeout(resolveWait, 1000 * (attempt + 1)));
      }
      failed.push(...batch.map(post => post.message_id));
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  const result = { completed, total: history.posts.length, copied, failed, finished_at: new Date().toISOString() };
  await writeFile(resolve(outputDir, 'import-result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (failed.length) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, directory] = process.argv.slice(2);
  if (!directory || !['prepare', 'run'].includes(mode)) throw new Error('Usage: node scripts/telegram-import.mjs prepare|run <private-output-directory>');
  if (mode === 'prepare') await prepare(resolve(directory)); else await run(resolve(directory));
}
