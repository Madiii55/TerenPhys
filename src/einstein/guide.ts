import { isGuideActionId, type GuideActionId } from './protocol.ts';

export interface StudyGuideAction { requestId: number; id: GuideActionId }
export interface HighlightBounds { left: number; top: number; width: number; height: number }

const selectors: Record<GuideActionId, string> = {
  'navigate-home': '[data-einstein="navigate-home"]',
  'navigate-study': '[data-einstein="navigate-study"]',
  'navigate-posts': '[data-einstein="navigate-posts"]',
  'navigate-forum': '[data-einstein="navigate-forum"]',
  'navigate-profile': '[data-einstein="navigate-profile"]',
  'select-grade-7': '[data-einstein="grade-7"]',
  'select-grade-8': '[data-einstein="grade-8"]',
  'select-grade-9': '[data-einstein="grade-9"]',
  'select-grade-10': '[data-einstein="grade-10"]',
  'select-grade-11': '[data-einstein="grade-11"]',
  'select-grade-12': '[data-einstein="grade-12"]',
  'select-quarter-1': '[data-einstein="quarter-1"]',
  'select-quarter-2': '[data-einstein="quarter-2"]',
  'select-quarter-3': '[data-einstein="quarter-3"]',
  'select-quarter-4': '[data-einstein="quarter-4"]',
  'show-notes': '[data-einstein="study-notes"]',
  'show-trial': '[data-einstein="study-trial"]',
  'show-quarter-exam': '[data-einstein="study-quarter-exam"]',
  'show-practice': '[data-einstein="study-practice"]',
  'show-post-files': '[data-einstein="post-files"]',
};

/** Model output can choose a known action, never an arbitrary selector. */
export function guideTargetFor(action: unknown, root: ParentNode = document): HTMLElement | null {
  if (!isGuideActionId(action)) return null;
  for (const element of root.querySelectorAll<HTMLElement>(selectors[action])) {
    if (!element.isConnected || element.matches(':disabled, [aria-disabled="true"]')) continue;
    let visible = true;
    for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
      const style = ancestor.ownerDocument.defaultView?.getComputedStyle(ancestor);
      if (ancestor.hidden || ancestor.hasAttribute('inert') || ancestor.getAttribute('aria-hidden') === 'true'
        || style?.display === 'none' || style?.visibility === 'hidden' || style?.visibility === 'collapse') {
        visible = false; break;
      }
    }
    const rect = element.getBoundingClientRect();
    if (visible && [rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)
      && rect.width > 0 && rect.height > 0) return element;
  }
  return null;
}

/** Clamp a visible target to the screen; reject empty/offscreen/invalid bounds. */
export function safeHighlightBounds(rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  viewport: { width: number; height: number }, padding = 8): HighlightBounds | null {
  if (![rect.left, rect.top, rect.width, rect.height, viewport.width, viewport.height, padding].every(Number.isFinite)
    || rect.width <= 0 || rect.height <= 0 || viewport.width <= 0 || viewport.height <= 0) return null;
  const left = Math.max(0, rect.left), top = Math.max(0, rect.top);
  const right = Math.min(viewport.width, rect.left + rect.width), bottom = Math.min(viewport.height, rect.top + rect.height);
  if (right <= left || bottom <= top) return null;
  const inset = Math.min(16, Math.max(0, padding));
  const paddedLeft = Math.max(0, left - inset), paddedTop = Math.max(0, top - inset);
  return { left: paddedLeft, top: paddedTop,
    width: Math.min(viewport.width, right + inset) - paddedLeft,
    height: Math.min(viewport.height, bottom + inset) - paddedTop };
}
