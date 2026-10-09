import { load } from 'cheerio';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const CHANNEL = 'nisphysicshub';

export function parsePublicPage(html) {
  const $ = load(html);
  const posts = [];
  $('.tgme_widget_message[data-post]').each((_, element) => {
    const item = $(element);
    const match = item.attr('data-post')?.match(/^nisphysicshub\/(\d+)$/);
    const date = item.find('.tgme_widget_message_date time').attr('datetime');
    if (!match || !date || Number.isNaN(Date.parse(date))) return;
    const message_id = Number(match[1]);
    const textElement = item.find('.tgme_widget_message_text').first();
    let text = '';
    const entities = [];
    function walk(node) {
      if (node.type === 'text') { text += node.data; return; }
      if (node.name === 'br') { text += '\n'; return; }
      if (['script','style','svg'].includes(node.name)) return;
      const offset = text.length;
      for (const child of node.children || []) walk(child);
      const type = ({ b:'bold', strong:'bold', i:'italic', em:'italic', u:'underline', s:'strikethrough', del:'strikethrough', code:'code', pre:'pre', blockquote:'blockquote', a:'text_link' })[node.name];
      if (type && text.length > offset && !$(node).hasClass('emoji')) entities.push({ type, offset, length: text.length-offset, ...(type === 'text_link' ? { url: $(node).attr('href') || '' } : {}) });
    }
    for (const node of textElement.contents()) walk(node);
    const attachments = [];
    item.find('.tgme_widget_message_photo_wrap').each((_, node) => {
      const source_url = $(node).attr('style')?.match(/background-image:\s*url\(['"]?([^'"()]+)['"]?\)/)?.[1];
      if (source_url) attachments.push({ kind:'photo', source_url });
    });
    item.find('video').each((_, node) => {
      const source_url = $(node).attr('src') || $(node).find('source').attr('src');
      if(source_url) attachments.push({ kind:'video', source_url });
    });
    item.find('.tgme_widget_message_document_wrap').each((_, node) => {
      attachments.push({ kind:'document', name:$(node).find('.tgme_widget_message_document_title').text().trim(), external:true });
    });
    if (item.find('.tgme_widget_message_poll').length || item.find('.tgme_widget_message_media_not_supported').length || (!text.trim() && !attachments.length)) {
      attachments.push({kind:'unsupported',external:true});
    }
    posts.push({ channel_username:CHANNEL, message_id, text, entities, attachments, published_at:new Date(date).toISOString(), source_revision_at:new Date(date).toISOString(), source_kind:'public', media_group_id:null });
  });
  const before = Number($('a[data-before]').first().attr('data-before')) || null;
  return { posts, before, title:$('.tgme_channel_info_header_title').first().text().trim() };
}

export async function collectPublicHistory(outputDirectory) {
  const posts = new Map();
  const seen = new Set();
  let before = null, pages = 0, title = '';
  for (;;) {
    const url = `https://t.me/s/${CHANNEL}${before ? '?before='+before : ''}`;
    const response = await fetch(url, {signal:AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error(`Telegram responded ${response.status}`);
    const page = parsePublicPage(await response.text());
    if (!page.posts.length && pages === 0) throw new Error('Public history is unavailable');
    title ||= page.title;
    for (const post of page.posts) posts.set(post.message_id, post);
    pages++;
    console.log(JSON.stringify({pages,collected:posts.size,oldest:Math.min(...posts.keys()),newest:Math.max(...posts.keys())}));
    if (!page.before || seen.has(page.before) || page.before === before) break;
    seen.add(page.before); before = page.before;
    if(pages >= 1000) throw new Error('Safety page limit reached; history is not complete');
    await new Promise(resolve => setTimeout(resolve,350));
  }
  const result = { channel:CHANNEL,title,public_history_complete:true,collected_at:new Date().toISOString(),pages,posts:[...posts.values()].sort((a,b)=>a.message_id-b.message_id) };
  await mkdir(outputDirectory,{recursive:true});
  await writeFile(resolve(outputDirectory,'public-history.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({complete:true,count:posts.size,attachments:result.posts.reduce((count,post)=>count+post.attachments.length,0),pendingFiles:result.posts.reduce((count,post)=>count+post.attachments.filter(file=>file.external).length,0)}));
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const output = process.argv[2];
  if (!output) throw new Error('Pass an output directory outside the public bundle');
  await collectPublicHistory(resolve(output));
}
