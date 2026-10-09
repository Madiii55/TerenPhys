import { CHANNEL, constantTimeEqual, object, sha256, webhookSecret } from '../_shared/telegram.ts';
import { database, json, serverConfig, telegramApi, TelegramRequestError } from '../_shared/server.ts';
declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };

// Closed by default. Enable only for one authorized setup after the user saves a dedicated bot token.
const SETUP_DIGEST: string = '';
const SETUP_EXPIRES: number = 0;
export async function handleSetup(request: Request): Promise<Response> {
  if (!SETUP_DIGEST || Date.now() > SETUP_EXPIRES) return json({ error: 'Setup closed' }, 410);
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const bearer = request.headers.get('Authorization')?.replace(/^Bearer /, '') || '';
  if (!constantTimeEqual(await sha256(bearer), SETUP_DIGEST)) return json({ error: 'Unauthorized' }, 401);
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN')?.trim();
  if (!token) return json({ error: 'Save TELEGRAM_BOT_TOKEN in Edge Function Secrets first' }, 409);
  let stage = 'getMe';
  try {
    const me = object(await telegramApi(token, 'getMe'));
    stage = 'getChat';
    const chat = object(await telegramApi(token, 'getChat', { chat_id: '@' + CHANNEL }));
    if (chat.type !== 'channel' || chat.username?.toLowerCase() !== CHANNEL) return json({ error: 'Unexpected channel' }, 409);
    if (new URL(request.url).searchParams.get('action') === 'identity') return json({ bot: me.username, bot_id: me.id,
      channel: chat.username, channel_id: chat.id, title: chat.title });
    stage = 'getChatMember';
    let member;
    try { member = object(await telegramApi(token, 'getChatMember', { chat_id: chat.id, user_id: me.id })); }
    catch (error) {
      if (!(error instanceof TelegramRequestError) || error.status !== 400) throw error;
      stage = 'getChatAdministrators';
      const admins = await telegramApi(token, 'getChatAdministrators', { chat_id: chat.id, return_bots: true });
      member = Array.isArray(admins) ? admins.find(value => object(object(value).user).id === me.id) : undefined;
    }
    if (!['administrator', 'creator'].includes(object(member).status)) return json({ error: 'Add this exact bot as channel administrator first', bot: me.username, channel: CHANNEL }, 409);
    const target = serverConfig().url + '/functions/v1/telegram-sync';
    stage = 'getWebhookInfo';
    const before = object(await telegramApi(token, 'getWebhookInfo'));
    if (new URL(request.url).searchParams.get('action') === 'status') return json({ configured: before.url === target,
      channel: CHANNEL, bot: me.username, pending_updates: before.pending_update_count,
      has_delivery_error: Boolean(before.last_error_message), last_error_date: before.last_error_date || null });
    // Never take over a bot already serving another integration.
    if (before.url && before.url !== target) return json({ error: 'This bot already has another webhook. Use a dedicated bot.' }, 409);
    stage = 'bindChannel';
    await database('telegram_sources?username=eq.' + CHANNEL, { method: 'PATCH', body: JSON.stringify({ chat_id: chat.id, updated_at: new Date().toISOString() }) });
    const secret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || await webhookSecret(token);
    stage = 'setWebhook';
    await telegramApi(token, 'setWebhook', { url: target, secret_token: secret, allowed_updates: ['channel_post', 'edited_channel_post'], drop_pending_updates: false, max_connections: 4 });
    stage = 'verifyWebhook';
    const after = object(await telegramApi(token, 'getWebhookInfo'));
    return json({ configured: after.url === target, channel: CHANNEL, bot: me.username, pending_updates: after.pending_update_count,
      has_delivery_error: Boolean(after.last_error_message) });
  } catch (error) { return json({ error: 'Setup failed. Check bot membership and server configuration.', stage,
    upstream_status: error instanceof TelegramRequestError ? error.status : undefined }, 503); }
}
Deno.serve(handleSetup);
