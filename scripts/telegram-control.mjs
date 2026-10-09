import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const [operation, directory] = process.argv.slice(2);
if (!['setup', 'status', 'identity', 'closed'].includes(operation) || !directory) throw new Error('Usage: telegram-control.mjs setup|status|identity|closed <private-directory>');
const { token, expires } = JSON.parse(await readFile(resolve(directory, 'private.json'), 'utf8'));
if (Date.now() > expires) throw new Error('Control credential expired');
const response = await fetch('https://gotlcaqzrwfitgiwmsnj.supabase.co/functions/v1/telegram-setup' + (['status','identity'].includes(operation) ? '?action=' + operation : ''), {
  method: 'POST', headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(110000),
});
console.log(JSON.stringify({ status: response.status, result: await response.json() }));
if (operation === 'closed' ? response.status !== 410 : !response.ok) process.exitCode = 1;
