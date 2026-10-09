import { CHANNEL, botPost, constantTimeEqual, object, validChannelPost, webhookSecret } from '../_shared/telegram.ts';
import { copyMedia, database, json, requestJson, storePost } from '../_shared/server.ts';
declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };

export async function handleWebhook(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN')?.trim();
  if (!token) return json({ error: 'Bot not configured' }, 503);
  const secret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || await webhookSecret(token);
  if (!constantTimeEqual(request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '', secret)) return json({ error: 'Unauthorized' }, 401);
  let update;
  try { update = object(await requestJson(request)); } catch { return json({ error: 'Invalid payload' }, 400); }
  const message = object(update.channel_post || update.edited_channel_post);
  if (!message.message_id) return json({ ignored: true });
  try {
    const sources = await database('telegram_sources?username=eq.' + CHANNEL + '&select=chat_id');
    const chatId = sources?.[0]?.chat_id;
    if (!chatId) return json({ error: 'Channel not configured' }, 503);
    if (!validChannelPost(message, chatId)) return json({ ignored: true });
    const post = botPost(message);
    post.attachments = await Promise.all(post.attachments.map(item => copyMedia(item, token)));
    await storePost(post);
    return json({ ok: true });
  } catch {
    // Never log Telegram file URLs, the bot token, or service keys. Non-2xx makes Telegram retry.
    return json({ error: 'Sync temporarily unavailable' }, 503);
  }
}
Deno.serve(handleWebhook);
