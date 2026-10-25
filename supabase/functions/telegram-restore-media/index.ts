import { CHANNEL, constantTimeEqual, object, readLimited, safeBotPath, sha256 } from '../_shared/telegram.ts';
import { database, json, requestJson, serverConfig, storeMedia, telegramApi, TelegramRequestError } from '../_shared/server.ts';
declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };

// One authorized maintenance run. The checked-in and final deployed version are closed.
const CONTROL_DIGEST: string = '';
const CONTROL_EXPIRES: number = 0;
const OWNER_CHAT_ID: number = 0;
const SOURCE_IDS = new Set([42,43,44,45,46,68,75,80,83,84,95,96,97,98,99,100,101,102,103,104,
  120,121,146,154,160,161,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,185,187,189,191,193]);
const MAX_BYTES = 16 * 1024 * 1024;
const WORD_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export async function handleRestore(request: Request): Promise<Response> {
  if (!CONTROL_DIGEST || !OWNER_CHAT_ID || Date.now() > CONTROL_EXPIRES) return json({ error: 'Restore closed' }, 410);
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const bearer = request.headers.get('Authorization')?.replace(/^Bearer /, '') || '';
  if (!constantTimeEqual(await sha256(bearer), CONTROL_DIGEST)) return json({ error: 'Unauthorized' }, 401);
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN')?.trim();
  if (!token) return json({ error: 'Bot not configured' }, 409);
  let stage = 'payload';
  try {
    const body = object(await requestJson(request, 4096));
    const id = body.message_id;
    if (body.action !== 'status' && (!Number.isSafeInteger(id) || !SOURCE_IDS.has(id))) return json({ error: 'Unsupported source' }, 400);
    stage = 'channel';
    const channel = object(await telegramApi(token, 'getChat', { chat_id: '@' + CHANNEL }));
    if (channel.type !== 'channel' || channel.username?.toLowerCase() !== CHANNEL) return json({ error: 'Unexpected channel' }, 409);
    stage = 'owner';
    const owner = object(await telegramApi(token, 'getChat', { chat_id: OWNER_CHAT_ID }));
    if (owner.type !== 'private' || owner.id !== OWNER_CHAT_ID) return json({ error: 'Owner chat unavailable' }, 409);
    if (body.action === 'status') {
      const me = object(await telegramApi(token, 'getMe'));
      const webhook = object(await telegramApi(token, 'getWebhookInfo'));
      return json({ bot: me.username, channel: channel.username, owner_ready: true,
        webhook_configured: webhook.url === serverConfig().url + '/functions/v1/telegram-sync', pending_updates: webhook.pending_update_count });
    }
    stage = 'record';
    const rows = await database(`telegram_posts?channel_username=eq.${CHANNEL}&message_id=eq.${id}&select=attachments`);
    const row = rows?.[0], attachments = row?.attachments;
    if (!Array.isArray(attachments) || attachments.length !== 1 || attachments[0].kind !== 'document') return json({ error: 'Unexpected attachments' }, 409);
    const original = attachments[0];
    if (original.path && !original.external) return json({ message_id: id, already_stored: true, attachment: original });
    const extension = original.name?.split('.').at(-1)?.toLowerCase();
    if (!['pdf','docx'].includes(extension)) return json({ error: 'Unsupported format' }, 409);
    stage = 'forward';
    // Bot API returns the document's file_id only from a Message. These quiet
    // copies go to the owner's private bot chat; the public channel is untouched.
    const message = object(await telegramApi(token, 'forwardMessage', {
      from_chat_id: channel.id, chat_id: OWNER_CHAT_ID, message_id: id, disable_notification: true,
    }));
    const source = object(message.forward_origin), file = object(message.document);
    // Telegram retains the *original* forward_origin when a channel post was
    // itself forwarded. The authenticated API call above fixes our source ID.
    const wrongChannelMessage = source.type === 'channel' && source.chat?.id === channel.id && source.message_id !== id;
    if (message.chat?.id !== OWNER_CHAT_ID || !['channel','user','hidden_user','chat'].includes(source.type) || wrongChannelMessage
      || typeof file.file_id !== 'string' || file.file_name?.normalize('NFC') !== original.name.normalize('NFC')) return json({ error: 'Document identity mismatch', message_id: id }, 409);
    if (!Number.isSafeInteger(file.file_size) || file.file_size <= 0 || file.file_size > MAX_BYTES) return json({ error: 'Document size unsupported', message_id: id }, 409);
    stage = 'download';
    const info = object(await telegramApi(token, 'getFile', { file_id: file.file_id }));
    if (!safeBotPath(info.file_path)) return json({ error: 'File unavailable', message_id: id }, 409);
    const response = await fetch('https://api.telegram.org/file/bot' + token + '/' + info.file_path,
      { redirect: 'error', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error('Download failed');
    const bytes = await readLimited(response.body, MAX_BYTES);
    if (bytes.length !== file.file_size || (extension === 'pdf' ? new TextDecoder().decode(bytes.subarray(0,5)) !== '%PDF-'
      : bytes[0] !== 80 || bytes[1] !== 75 || bytes[2] !== 3 || bytes[3] !== 4)) return json({ error: 'Invalid document bytes', message_id: id }, 409);
    stage = 'storage';
    const attachment = await storeMedia(bytes, extension === 'pdf' ? 'application/pdf' : WORD_MIME, 'document', original.name);
    stage = 'update';
    // Compare the original JSON so a concurrent live webhook edit cannot be overwritten.
    const changed = await database(`telegram_posts?channel_username=eq.${CHANNEL}&message_id=eq.${id}&attachments=eq.${encodeURIComponent(JSON.stringify(attachments))}`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ attachments: [attachment] }),
    });
    if (changed?.length !== 1) return json({ error: 'Source changed; retry safely', message_id: id }, 409);
    return json({ message_id: id, attachment, bytes: bytes.length, sha256: await sha256(bytes) });
  } catch (error) {
    // Credentials, file_id and token-bearing URLs never appear in logs or responses.
    return json({ error: 'Restore failed', stage, upstream_status: error instanceof TelegramRequestError ? error.status : undefined }, 503);
  }
}
Deno.serve(handleRestore);
