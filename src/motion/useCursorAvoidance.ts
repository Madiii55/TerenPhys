import { useEffect, useRef } from 'react';

type Bounds = { left: number; top: number; width: number; height: number };

/** Repulsion from the nearest point on the text, bounded in screen pixels. */
export function cursorRepulsion(x: number, y: number, rect: Bounds, strength = 4) {
  const nearestX = Math.max(rect.left, Math.min(x, rect.left + rect.width));
  const nearestY = Math.max(rect.top, Math.min(y, rect.top + rect.height));
  const outside = Math.hypot(x - nearestX, y - nearestY);
  const proximity = Math.max(0, 1 - outside / 72);
  const influence = proximity * proximity * (3 - 2 * proximity);
  if (!influence) return { x: 0, y: 0 };
  const dx = rect.left + rect.width / 2 - x;
  const dy = rect.top + rect.height / 2 - y - 4;
  // A soft centre prevents the direction flipping when the pointer crosses a word.
  const length = Math.hypot(dx, dy, 12);
  const distance = Math.min(4.5, Math.max(0, strength)) * influence;
  return { x: dx / length * distance, y: dy / length * distance };
}

export function useCursorAvoidance(resetKey?: unknown) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const allowed = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
    let frame = 0;
    let previousTime = 0;
    let pointer: { x: number; y: number } | null = null;
    let needsBounds = true;
    let words: Array<{ element: HTMLElement; rect: Bounds; strength: number; x: number; y: number }> | null = null;
    const clear = () => {
      cancelAnimationFrame(frame); frame = 0; previousTime = 0; pointer = null; words = null; needsBounds = true;
      element.querySelectorAll<HTMLElement>('[data-cursor-avoid]').forEach(text => {
        text.style.removeProperty('--avoid-x'); text.style.removeProperty('--avoid-y');
      });
    };
    const render = (time: number) => {
      frame = 0;
      if (!allowed.matches || document.hidden) { clear(); return; }
      words ??= Array.from(element.querySelectorAll<HTMLElement>('[data-cursor-avoid]'), text => ({
        element: text, rect: { left: 0, top: 0, width: 0, height: 0 },
        strength: Number(text.dataset.cursorAvoid) || 4, x: 0, y: 0,
      }));
      if (pointer && needsBounds) {
        // Read once, before any writes. Subtract the applied translation so the
        // repulsion is always measured from the original text position.
        for (const word of words) {
          const bounds = word.element.getBoundingClientRect();
          word.rect = { left: bounds.left - word.x, top: bounds.top - word.y, width: bounds.width, height: bounds.height };
        }
        needsBounds = false;
      }
      const elapsed = previousTime ? Math.min(48, Math.max(1, time - previousTime)) : 16.67;
      previousTime = time;
      const easing = 1 - Math.exp(-elapsed / 290);
      let moving = false;
      for (const word of words) {
        const target = pointer ? cursorRepulsion(pointer.x, pointer.y, word.rect, word.strength) : { x: 0, y: 0 };
        const settled = Math.hypot(target.x - word.x, target.y - word.y) < .018;
        const nextX = settled ? target.x : word.x + (target.x - word.x) * easing;
        const nextY = settled ? target.y : word.y + (target.y - word.y) * easing;
        if (Math.abs(nextX - word.x) >= .005 || Math.abs(nextY - word.y) >= .005 || settled) {
          if (!pointer && settled) {
            word.element.style.removeProperty('--avoid-x'); word.element.style.removeProperty('--avoid-y');
          } else if (!settled || nextX !== word.x || nextY !== word.y) {
            word.element.style.setProperty('--avoid-x', `${nextX.toFixed(3)}px`);
            word.element.style.setProperty('--avoid-y', `${nextY.toFixed(3)}px`);
          }
        }
        word.x = nextX; word.y = nextY;
        moving ||= !settled;
      }
      if (moving) frame = requestAnimationFrame(render);
      else previousTime = 0;
    };
    const schedule = () => {
      if (!frame && allowed.matches && !document.hidden) frame = requestAnimationFrame(render);
    };
    const returnHome = () => { pointer = null; schedule(); };
    const invalidate = () => { needsBounds = true; returnHome(); };
    const availability = () => {
      if (!allowed.matches || document.hidden) clear();
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !allowed.matches) return;
      pointer = { x: event.clientX, y: event.clientY };
      schedule();
    };
    element.addEventListener('pointermove', move, { passive: true });
    element.addEventListener('pointerleave', returnHome);
    window.addEventListener('scroll', invalidate, { passive: true });
    window.addEventListener('resize', invalidate, { passive: true });
    allowed.addEventListener('change', availability);
    document.addEventListener('visibilitychange', availability);
    return () => {
      clear(); element.removeEventListener('pointermove', move); element.removeEventListener('pointerleave', returnHome);
      window.removeEventListener('scroll', invalidate); window.removeEventListener('resize', invalidate);
      allowed.removeEventListener('change', availability); document.removeEventListener('visibilitychange', availability);
    };
  }, [resetKey]);
  return root;
}
