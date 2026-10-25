import { EINSTEIN_LIMITS } from './protocol.ts';

export interface LessonFragment {
  id: string;
  title: string;
  blocks: readonly { id: string; text: string }[];
}

/** A small window around the reading position, drawn only from native lesson data. */
export function lessonExcerpt(fragment: LessonFragment, blockIndex = 0): string {
  const blocks = fragment.blocks;
  const current = Math.max(0, Math.min(blocks.length - 1, blockIndex));
  const previous = blocks[current - 1]?.text || '';
  // The current formula always wins over an unusually long preceding paragraph.
  const start = previous.length <= 700 && previous.length + (blocks[current]?.text.length || 0) + 2 <= EINSTEIN_LIMITS.excerptCharacters ? Math.max(0, current - 1) : current;
  let result = '';
  for (const block of blocks.slice(start)) {
    const next = result ? result + '\n\n' + block.text : block.text;
    if (next.length > EINSTEIN_LIMITS.excerptCharacters) {
      result = next.slice(0, EINSTEIN_LIMITS.excerptCharacters - 1).trimEnd() + '…';
      break;
    }
    result = next;
  }
  return result;
}
