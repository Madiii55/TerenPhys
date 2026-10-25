import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';

type Position = { x: number; y: number };
const scrollKeys = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);

/** Restore each displayed tab before its entrance paints. Lazy content can
 * briefly clamp the scroll range; retry only until it grows or the user acts. */
export function usePageScroll<T>(tab: T, phase: string, surface: RefObject<HTMLElement | null>) {
  const positions = useRef(new Map<T, Position>());
  const displayed = useRef(tab);
  const lastPosition = useRef<Position>({ x: 0, y: 0 });
  const initialized = useRef(false);
  const currentPhase = useRef(phase);
  currentPhase.current = phase;
  const cancelRestore = useRef<(() => void) | null>(null);
  const cancelPageScrollRestore = useCallback(() => { cancelRestore.current?.(); }, []);
  const readPosition = () => ({ x: window.scrollX, y: window.scrollY });

  useLayoutEffect(() => {
    const record = () => {
      if (!surface.current || cancelRestore.current) return;
      lastPosition.current = readPosition();
      positions.current.set(displayed.current, lastPosition.current);
    };
    const interrupt = () => { cancelRestore.current?.(); record(); };
    const keyDown = (event: KeyboardEvent) => { if (scrollKeys.has(event.key)) interrupt(); };
    window.addEventListener('scroll', record, { passive: true });
    window.addEventListener('wheel', interrupt, { passive: true });
    window.addEventListener('touchstart', interrupt, { passive: true });
    window.addEventListener('keydown', keyDown);
    return () => {
      cancelRestore.current?.();
      window.removeEventListener('scroll', record);
      window.removeEventListener('wheel', interrupt);
      window.removeEventListener('touchstart', interrupt);
      window.removeEventListener('keydown', keyDown);
    };
  }, [surface]);

  useLayoutEffect(() => {
    const element = surface.current;
    if (!element) return;
    if (displayed.current !== tab || (phase !== 'entering' && phase !== 'idle')) cancelRestore.current?.();
    if (!initialized.current) {
      initialized.current = true;
      lastPosition.current = readPosition();
      positions.current.set(displayed.current, lastPosition.current);
    }
    if (phase === 'leaving' && displayed.current === tab) {
      // Capture native/browser-restored positions even before a scroll event.
      lastPosition.current = readPosition();
      positions.current.set(tab, lastPosition.current);
    }
    if (displayed.current === tab || (phase !== 'entering' && phase !== 'idle')) return;

    // Reading window.scrollY here can already reflect the new shorter DOM.
    // Preserve the last outgoing event/snapshot instead of that clamped value.
    positions.current.set(displayed.current, lastPosition.current);
    displayed.current = tab;
    const destination = positions.current.get(tab) ?? { x: 0, y: 0 };
    let observer: ResizeObserver | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      observer?.disconnect();
      clearTimeout(timeout);
      if (cancelRestore.current === stop) cancelRestore.current = null;
    };
    cancelRestore.current = stop;
    const restore = () => {
      if (cancelRestore.current !== stop || displayed.current !== tab
        || (currentPhase.current !== 'entering' && currentPhase.current !== 'idle')) return;
      // "instant" also avoids CSS scroll-behavior:smooth during a fade-in.
      window.scrollTo({ left: destination.x, top: destination.y, behavior: 'instant' });
      lastPosition.current = readPosition();
      if (Math.abs(lastPosition.current.x - destination.x) <= 1
        && Math.abs(lastPosition.current.y - destination.y) <= 1) {
        positions.current.set(tab, lastPosition.current);
        stop();
      }
    };
    restore();
    if (cancelRestore.current === stop) {
      if (typeof ResizeObserver === 'undefined') stop();
      else {
        observer = new ResizeObserver(restore);
        observer.observe(element);
        timeout = setTimeout(() => {
          stop();
          positions.current.set(tab, lastPosition.current);
        }, 3000);
      }
    }
  }, [tab, phase, surface]);
  return cancelPageScrollRestore;
}
