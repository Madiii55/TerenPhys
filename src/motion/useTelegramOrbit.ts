import { useEffect, useRef } from 'react';

export const TELEGRAM_ORBIT_MS = 3200;
type Pose = { x: number; y: number; angle: number };

/** A closed ellipse from the badge, above and below the entire link. */
export function telegramOrbitPose(progress: number, width: number, height: number): Pose {
  const time = Math.min(1, Math.max(0, progress));
  if (time === 0 || time === 1) return { x: 0, y: 0, angle: time * 360 };
  const eased = (1 - Math.cos(Math.PI * time)) / 2;
  const angle = eased * Math.PI * 2;
  return {
    x: Math.max(0, width - 12) / 2 * (1 - Math.cos(angle)),
    y: -(height / 2 + 7) * Math.sin(angle),
    angle: eased * 360 - 180 * eased * (1 - eased),
  };
}

const transform = (pose: Pose) => `translate(${pose.x.toFixed(3)}px, ${pose.y.toFixed(3)}px) rotate(${pose.angle.toFixed(3)}deg)`;

export function useTelegramOrbit() {
  const root = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const link = root.current;
    const plane = link?.querySelector<HTMLElement>('.home-telegram-plane');
    if (!link || !plane || typeof plane.animate !== 'function') return;
    const allowed = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
    let animation: Animation | null = null;
    const stop = () => {
      if (animation) { animation.onfinish = null; animation.cancel(); }
      animation = null;
    };
    const canAnimate = () => allowed.matches && !document.hidden;
    const start = () => {
      if (!canAnimate() || animation) return;
      const bounds = link.getBoundingClientRect();
      const frames = Array.from({ length: 97 }, (_, i) => ({
        offset: i / 96, transform: transform(telegramOrbitPose(i / 96, bounds.width, bounds.height)),
      }));
      animation = plane.animate(frames, { duration: TELEGRAM_ORBIT_MS, easing: 'linear', fill: 'forwards' });
      animation.onfinish = stop;
    };
    // Every flight completes this same closed path, even after pointer leave or
    // blur. Re-entering mid-flight cannot interrupt or shorten the remaining arc.
    const enter = (event: PointerEvent) => { if (event.pointerType === 'mouse') start(); };
    const focus = () => { if (link.matches(':focus-visible')) start(); };
    const availability = () => { if (!canAnimate()) stop(); };
    link.addEventListener('pointerenter', enter);
    link.addEventListener('focus', focus);
    allowed.addEventListener('change', availability);
    document.addEventListener('visibilitychange', availability);
    return () => {
      stop(); link.removeEventListener('pointerenter', enter); link.removeEventListener('focus', focus);
      allowed.removeEventListener('change', availability); document.removeEventListener('visibilitychange', availability);
    };
  }, []);
  return root;
}
