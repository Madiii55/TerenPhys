import assert from 'node:assert/strict';
import { test } from 'node:test';
import React, { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { usePageFade } from '../src/motion/usePageFade.ts';

type MockAnimation = {
  frames: Keyframe[];
  options: KeyframeAnimationOptions;
  cancelled: boolean;
  onfinish: (() => void) | null;
  presentation: { opacity: string; transform: string };
  sample(opacity: string, transform: string): void;
  finish(): void;
  cancel(): void;
};

/** Model compositor presentation separately from the CSS phase underneath it.
 * Cancelling removes that presentation immediately, as a browser does. */
async function fadeFixture(strict = false, native = true) {
  const dom = new JSDOM(`<style>
    .page-reveal { opacity: 1; transform: translateY(0px); }
    .page-reveal[data-page-phase="leaving"], .page-reveal[data-page-phase="travelling"] {
      opacity: 0; transform: translateY(-4px);
    }
  </style><div id="root"></div>`);
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const active = new WeakMap<Element, MockAnimation>();
  const animations: MockAnimation[] = [];
  let reduced = false;
  const cssStyle = dom.window.getComputedStyle.bind(dom.window);
  dom.window.matchMedia = () => ({ get matches() { return reduced; } } as MediaQueryList);
  if (native) dom.window.HTMLElement.prototype.animate = function (frames, options) {
    const element = this;
    const keyframes = frames as Keyframe[];
    const motion: MockAnimation = {
      frames: keyframes, options: options as KeyframeAnimationOptions,
      cancelled: false, onfinish: null,
      presentation: { opacity: String(keyframes[0].opacity), transform: String(keyframes[0].transform) },
      sample(opacity, transform) { this.presentation = { opacity, transform }; },
      finish() {
        if (this.cancelled) return;
        const end = this.frames.at(-1)!;
        this.sample(String(end.opacity), String(end.transform));
        this.onfinish?.();
      },
      cancel() {
        this.cancelled = true;
        if (active.get(element) === this) active.delete(element);
      },
    };
    animations.push(motion);
    active.set(element, motion);
    return motion as unknown as Animation;
  };
  const computed = (element: Element) => {
    const presentation = active.get(element)?.presentation;
    return presentation ?? cssStyle(element);
  };
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, getComputedStyle: computed,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const root = createRoot(document.getElementById('root')!);
  function Probe({ phase, request, closed }: { phase: string; request: number; closed: (id: number) => void }) {
    const ref = usePageFade(phase, request, closed);
    return React.createElement('div', { ref, className: 'page-reveal', 'data-page-phase': phase }, 'Page text');
  }
  return {
    animations,
    surface: () => document.querySelector<HTMLDivElement>('.page-reveal')!,
    presentation: () => computed(document.querySelector('.page-reveal')!),
    reduce: () => { reduced = true; },
    render: async (phase: string, request: number, closed: (id: number) => void = () => {}) => {
      const probe = React.createElement(Probe, { phase, request, closed });
      await act(() => root.render(strict ? React.createElement(StrictMode, null, probe) : probe));
    },
    cleanup: async () => {
      await act(() => root.unmount());
      assert.ok(animations.every(animation => animation.cancelled), 'unmount releases every native animation');
      dom.window.close();
      for (const [key, value] of previous) {
        if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

test('a filled entrance cannot suppress the next exit; camera travel stays fully closed', async () => {
  const browser = await fadeFixture();
  const closed: number[] = [];
  try {
    await browser.render('entering', 0);
    const entrance = browser.animations[0];
    assert.equal(Number(entrance.frames[0].opacity), 0);
    await act(() => entrance.finish());
    assert.equal(browser.presentation().opacity, '1');
    await browser.render('leaving', 1, id => { closed.push(id); });
    const exit = browser.animations.at(-1)!;
    assert.equal(entrance.cancelled, true);
    assert.equal(Number(exit.frames[0].opacity), 1, 'close from the fully visible filled entrance');
    assert.equal(Number(exit.frames.at(-1)!.opacity), 0);
    assert.equal(exit.options.fill, 'forwards');
    assert.equal(browser.surface().dataset.nativeFade, 'true');
    exit.sample('.46', 'matrix(1, 0, 0, 1, 0, -2)');
    assert.equal(browser.presentation().opacity, '.46', 'the text remains partly visible while closing');
    assert.deepEqual(closed, [], 'the camera cannot start during the fade');
    await act(() => exit.finish());
    assert.deepEqual(closed, [1]);
    await browser.render('travelling', 1);
    assert.equal(exit.cancelled, true);
    assert.equal(browser.presentation().opacity, '0', 'CSS holds zero opacity after compositor cancellation');
    const countDuringTravel = browser.animations.length;
    await browser.render('entering', 1);
    assert.equal(browser.animations.length, countDuringTravel + 1);
    const opening = browser.animations.at(-1)!;
    assert.equal(Number(opening.frames[0].opacity), 0);
    assert.equal(Number(opening.frames.at(-1)!.opacity), 1);
    await act(() => opening.finish());
    await browser.render('idle', 1);
    assert.equal(browser.presentation().opacity, '1');
    assert.equal(browser.animations.length, countDuringTravel + 1, 'settling does not replay the opening');
  } finally { await browser.cleanup(); }
});

test('a new destination and a return during closing both continue from the displayed mid-fade state', async () => {
  const browser = await fadeFixture();
  const closed: number[] = [];
  try {
    await browser.render('idle', 0);
    await browser.render('leaving', 1, id => { closed.push(id); });
    const first = browser.animations.at(-1)!;
    const midwayTransform = 'matrix(1, 0, 0, 1, 0, -1.6)';
    first.sample('.61', midwayTransform);
    await browser.render('leaving', 2, id => { closed.push(id); });
    const second = browser.animations.at(-1)!;
    assert.equal(first.cancelled, true);
    assert.equal(first.onfinish, null, 'superseded closures lose their completion callback');
    assert.equal(second.frames[0].opacity, '.61', 'sample before cancellation restores the underlying CSS zero');
    assert.equal(second.frames[0].transform, midwayTransform);
    second.sample('.37', 'matrix(1, 0, 0, 1, 0, -2.52)');
    await browser.render('idle', 3, id => { closed.push(id); });
    const returning = browser.animations.at(-1)!;
    assert.equal(second.cancelled, true);
    assert.equal(second.onfinish, null);
    assert.equal(returning.frames[0].opacity, '.37');
    assert.equal(returning.frames[0].transform, 'matrix(1, 0, 0, 1, 0, -2.52)');
    assert.equal(Number(returning.frames.at(-1)!.opacity), 1);
    await act(() => { first.finish(); second.finish(); returning.finish(); });
    assert.deepEqual(closed, [], 'abandoned closes cannot start any old camera flight');
  } finally { await browser.cleanup(); }
});

test('starting another close during an entrance preserves its current opacity and uses the newest callback', async () => {
  const browser = await fadeFixture();
  const closed: string[] = [];
  try {
    await browser.render('entering', 1);
    browser.animations.at(-1)!.sample('.23', 'matrix(1, 0, 0, 1, 0, 4.6)');
    await browser.render('leaving', 2, id => { closed.push(`old:${id}`); });
    const exit = browser.animations.at(-1)!;
    assert.equal(exit.frames[0].opacity, '.23');
    assert.equal(exit.frames[0].transform, 'matrix(1, 0, 0, 1, 0, 4.6)');
    const animationCount = browser.animations.length;
    await browser.render('leaving', 2, id => { closed.push(`latest:${id}`); });
    assert.equal(browser.animations.length, animationCount, 'callback changes alone never restart visual motion');
    await act(() => exit.finish());
    assert.deepEqual(closed, ['latest:2']);
  } finally { await browser.cleanup(); }
});

test('an already-closed surface cannot flash back to full opacity if another close is requested during travel', async () => {
  const browser = await fadeFixture();
  try {
    await browser.render('idle', 0);
    await browser.render('leaving', 1);
    await act(() => browser.animations.at(-1)!.finish());
    await browser.render('travelling', 1);
    assert.equal(browser.presentation().opacity, '0');
    await browser.render('leaving', 2);
    const redirected = browser.animations.at(-1)!;
    assert.equal(Number(redirected.frames[0].opacity), 0, 'the closed CSS surface is sampled rather than replaced by an assumed opacity 1');
    assert.equal(Number(redirected.frames.at(-1)!.opacity), 0);
    assert.equal(browser.presentation().opacity, '0', 'a redirected close never makes the old text visible again');
  } finally { await browser.cleanup(); }
});

test('StrictMode replay still starts an entrance from zero and unmount detaches a pending close', async () => {
  const browser = await fadeFixture(true);
  const closed: number[] = [];
  try {
    await browser.render('entering', 0);
    assert.ok(browser.animations.length >= 2, 'the fixture exercises StrictMode effect replay');
    assert.equal(browser.animations[0].cancelled, true);
    const entrance = browser.animations.at(-1)!;
    assert.equal(Number(entrance.frames[0].opacity), 0, 'replayed entry must not sample the cancelled animation as opacity one');
    await act(() => entrance.finish());
    await browser.render('leaving', 1, id => { closed.push(id); });
    const pending = browser.animations.at(-1)!;
    await browser.cleanup();
    assert.equal(pending.onfinish, null);
    pending.finish();
    assert.deepEqual(closed, []);
    return;
  } catch (error) {
    await browser.cleanup();
    throw error;
  }
});

test('reduced motion cancels the displayed fade, and a host without WAAPI keeps the CSS fallback', async () => {
  const browser = await fadeFixture();
  try {
    await browser.render('leaving', 1);
    const exit = browser.animations.at(-1)!;
    exit.sample('.5', 'translateY(-2px)');
    browser.reduce();
    await browser.render('idle', 2);
    assert.equal(exit.cancelled, true);
    assert.equal(exit.onfinish, null);
    assert.equal(browser.presentation().opacity, '1');
    assert.equal(browser.animations.length, 1);
  } finally { await browser.cleanup(); }
  const fallback = await fadeFixture(false, false);
  try {
    await fallback.render('idle', 0);
    await fallback.render('leaving', 1);
    assert.equal(fallback.surface().dataset.nativeFade, undefined, 'CSS transition is not disabled without native animations');
    assert.equal(fallback.animations.length, 0);
    assert.equal(fallback.presentation().opacity, '0');
    await fallback.render('entering', 1);
    assert.equal(fallback.presentation().opacity, '1');
  } finally { await fallback.cleanup(); }
});
