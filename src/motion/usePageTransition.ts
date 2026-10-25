import { useCallback, useEffect, useRef, useState } from 'react';

export const PAGE_EXIT_MS = 620;
export const PAGE_ENTER_MS = 520;
export const PAGE_EXIT_FALLBACK_MS = PAGE_EXIT_MS + 32;
export const SCENE_FALLBACK_MS = 180;
type Scene<T> = { tab: T; id: number };

/** Fade out and camera flight overlap. Reveal waits for both latest completions. */
export function usePageTransition<T>(target: T, requestId: number) {
  const [view, setView] = useState({ tab: target, phase: 'idle' });
  const phase = useRef(view.phase);
  phase.current = view.phase;
  const [scene, setScene] = useState<Scene<T>>({ tab: target, id: requestId });
  const shown = useRef(target);
  const sceneRef = useRef(scene);
  const ready = useRef(false);
  const closed = useRef(false);
  const arrived = useRef<number | null>(null);
  const pending = useRef<Scene<T> | null>(null);
  const latest = useRef(requestId);
  latest.current = requestId;
  const exitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reveal = useCallback((id: number) => {
    const destination = pending.current;
    if (!destination || destination.id !== id || latest.current !== id || !closed.current) return;
    clearTimeout(fallbackTimer.current);
    pending.current = null;
    shown.current = destination.tab;
    closed.current = false;
    setView({ tab: destination.tab, phase: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'idle' : 'entering' });
  }, []);
  const onPageClosed = useCallback((id: number) => {
    if (latest.current !== id || pending.current?.id !== id) return;
    clearTimeout(exitTimer.current);
    closed.current = true;
    if (arrived.current === id) reveal(id);
    else {
      setView(current => ({ ...current, phase: 'travelling' }));
      // A delayed/failed optional 3D module must not trap closed content.
      // A real scene instead opens the page only after its actual final frame.
      if (!ready.current) fallbackTimer.current = setTimeout(() => reveal(id), SCENE_FALLBACK_MS);
    }
  }, [reveal]);
  const onSceneComplete = useCallback((id: number) => {
    if (id !== sceneRef.current.id) return;
    ready.current = true;
    const destination = pending.current;
    if (!destination || destination.id !== id || latest.current !== id) return;
    arrived.current = id;
    if (closed.current) reveal(id);
  }, [reveal]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const destination = { tab: target, id: requestId };
    const instant = () => {
      clearTimeout(exitTimer.current); clearTimeout(fallbackTimer.current);
      pending.current = null;
      closed.current = false;
      arrived.current = requestId;
      shown.current = target;
      sceneRef.current = destination;
      setScene(destination);
      setView({ tab: target, phase: 'idle' });
    };
    if (preference.matches) instant();
    else if (shown.current === target && sceneRef.current.tab === target
      && (phase.current === 'idle' || phase.current === 'entering')) {
      setView({ tab: target, phase: 'idle' });
    } else {
      pending.current = destination;
      arrived.current = null;
      sceneRef.current = destination;
      setScene(destination); // Move immediately while the outgoing text fades.
      if (phase.current === 'travelling') {
        closed.current = true;
        // Keep the content closed while a quick click retargets the flight.
        if (!ready.current) fallbackTimer.current = setTimeout(() => reveal(requestId), SCENE_FALLBACK_MS);
      } else {
        closed.current = false;
        setView(current => ({ ...current, phase: 'leaving' }));
        // Native completion drives the UI; hosts without WAAPI use the same
        // fade duration plus one frame before declaring the page closed.
        exitTimer.current = setTimeout(() => onPageClosed(requestId), PAGE_EXIT_FALLBACK_MS);
      }
    }
    const motionChanged = () => { if (preference.matches) instant(); };
    preference.addEventListener('change', motionChanged);
    return () => {
      clearTimeout(exitTimer.current); clearTimeout(fallbackTimer.current);
      pending.current = null;
      preference.removeEventListener('change', motionChanged);
    };
  }, [target, requestId, onPageClosed, reveal]);
  return { ...view, scene, onSceneComplete, onPageClosed };
}
