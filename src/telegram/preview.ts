import type { TelegramAttachment } from './model.ts';

export type PreviewKind = 'pdf' | 'docx' | 'image' | 'video' | 'audio';
export const MAX_PREVIEW_BYTES = 16 * 1024 * 1024;
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function attachmentPreviewKind(item: TelegramAttachment): PreviewKind | undefined {
  if (!item.path || item.external) return undefined;
  if (item.kind === 'photo') return 'image';
  if (item.kind === 'video' || item.kind === 'audio') return item.kind;
  if (item.kind !== 'document') return undefined;
  if (item.mime === 'application/pdf' || (!item.mime && /\.pdf$/i.test(item.name || item.path))) return 'pdf';
  if (item.mime === DOCX_MIME || (!item.mime && /\.docx$/i.test(item.name || item.path))) return 'docx';
}

export function attachmentFormat(item: TelegramAttachment) {
  const extension = (item.name || item.path || '').match(/\.([a-z0-9]{1,8})$/i)?.[1];
  return extension?.toUpperCase() || ({ photo: 'IMG', video: 'VIDEO', audio: 'AUDIO', document: 'FILE', unsupported: 'FILE' })[item.kind];
}

export async function readPreviewBytes(response: Response): Promise<ArrayBuffer> {
  if (!response.ok || !response.body) throw new Error('Preview unavailable');
  if (Number(response.headers.get('content-length')) > MAX_PREVIEW_BYTES) { await response.body.cancel(); throw new Error('Preview too large'); }
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PREVIEW_BYTES) throw new Error('Preview too large');
      chunks.push(value);
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes.buffer;
}

// Check the ZIP central directory before decompressing DOCX. Reject ZIP64,
// encrypted archives and oversized expanded content instead of freezing the UI.
export function assertDocxBudget(buffer: ArrayBuffer) {
  const data = new DataView(buffer), length = buffer.byteLength;
  if (length < 22 || length > MAX_PREVIEW_BYTES || data.getUint32(0, true) !== 0x04034b50) throw new Error('Invalid DOCX');
  let end = -1;
  for (let at = length - 22; at >= Math.max(0, length - 65557); at--) {
    if (data.getUint32(at, true) === 0x06054b50 && at + 22 + data.getUint16(at + 20, true) === length) { end = at; break; }
  }
  if (end < 0 || data.getUint16(end + 4, true) || data.getUint16(end + 6, true)) throw new Error('Invalid DOCX directory');
  const count = data.getUint16(end + 10, true), start = data.getUint32(end + 16, true), directorySize = data.getUint32(end + 12, true);
  if (!count || count > 2000 || start + directorySize > end || data.getUint16(end + 8, true) !== count) throw new Error('DOCX budget exceeded');
  let expanded = 0, cursor = start;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || data.getUint32(cursor, true) !== 0x02014b50) throw new Error('Invalid DOCX entry');
    const size = data.getUint32(cursor + 24, true), compression = data.getUint16(cursor + 10, true);
    expanded += size;
    if ((data.getUint16(cursor + 8, true) & 1) || ![0, 8].includes(compression)
      || size > 16 * 1024 * 1024 || expanded > 48 * 1024 * 1024) throw new Error('DOCX budget exceeded');
    cursor += 46 + data.getUint16(cursor + 28, true) + data.getUint16(cursor + 30, true) + data.getUint16(cursor + 32, true);
  }
  if (cursor !== start + directorySize) throw new Error('Invalid DOCX directory');
}
