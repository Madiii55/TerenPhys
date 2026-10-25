import { useLayoutEffect, useRef } from 'react';
import { PAGE_EXIT_MS, PAGE_ENTER_MS } from './usePageTransition.ts';

/** Native compositor animations keep a filled entry from suppressing the exit. */
export function usePageFade(phase: string, requestId: number, onClosed: (id: number) => void) {
  const surface = useRef<HTMLDivElement>(null);
  const animation = useRef<Animation | null>(null);
  const previousPhase = useRef(phase);
  const finish = useRef(onClosed);
  finish.current = onClosed;
  useLayoutEffect(() => {
    const wasClosed = previousPhase.current === 'travelling' && phase === 'leaving';
    previousPhase.current = phase;
    const element = surface.current;
    if (!element || !element.animate) return;
    element.dataset.nativeFade = 'true';
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Sample the still-running animation before cancellation, so an interrupted
    // fade continues from what is actually on screen instead of restarting.
    // During travel CSS already holds the page closed. Never revive it to
    // opacity 1 when a destination changes before the current flight ends.
    const samplePresentation = animation.current || wasClosed;
    const opacity = samplePresentation ? getComputedStyle(element).opacity : phase === 'entering' ? '0' : '1';
    const transform = samplePresentation ? getComputedStyle(element).transform : 'translateY(0px)';
    animation.current?.cancel();
    animation.current = null;
    if (preference.matches || phase === 'travelling' || (phase === 'idle' && Number(opacity) >= .999)) return;
    const leaving = phase === 'leaving';
    const motion = element.animate([
      { opacity, transform: !leaving && Number(opacity) < .01 ? 'translateY(6px)' : transform },
      { opacity: leaving ? 0 : 1, transform: leaving ? 'translateY(-4px)' : 'translateY(0px)' },
    ], { duration: leaving ? PAGE_EXIT_MS : PAGE_ENTER_MS, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards' });
    animation.current = motion;
    if (leaving) motion.onfinish = () => finish.current(requestId);
    return () => { motion.onfinish = null; };
  }, [phase, requestId]);
  useLayoutEffect(() => () => { animation.current?.cancel(); animation.current = null; }, []);
  return surface;
}
