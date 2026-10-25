import assert from 'node:assert/strict';
import { test } from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { PAGE_EXIT_FALLBACK_MS as PAGE_EXIT_MS, SCENE_FALLBACK_MS, usePageTransition } from '../src/motion/usePageTransition.ts';
import { cursorRepulsion, useCursorAvoidance } from '../src/motion/useCursorAvoidance.ts';
import { telegramOrbitPose, TELEGRAM_ORBIT_MS, useTelegramOrbit } from '../src/motion/useTelegramOrbit.ts';
import { cosmicVisibility, GALAXY_ROTATION_RATE, GALAXY_MATTER_RATE } from '../src/graphics/cosmicScale.ts';

async function browserFixture() {
  const dom = new JSDOM('<div id="root"></div>');
  const previous = new Map<string, PropertyDescriptor | undefined>();
  let reduced = false;
  const listeners = new Map<string, Set<() => void>>();
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  dom.window.matchMedia = (query: string) => ({
    get matches() { return query.includes('no-preference') ? !reduced : reduced; },
    addEventListener: (_: string, fn: () => void) => {
      if (!listeners.has(query)) listeners.set(query, new Set());
      listeners.get(query)!.add(fn);
    },
    removeEventListener: (_: string, fn: () => void) => listeners.get(query)?.delete(fn),
  } as unknown as MediaQueryList);
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true,
    requestAnimationFrame: (fn: FrameRequestCallback) => { frames.set(++nextFrame, fn); return nextFrame; },
    cancelAnimationFrame: (id: number) => frames.delete(id),
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const root = createRoot(document.getElementById('root')!);
  return {
    root, dom, frames,
    motion: async (value: boolean) => {
      reduced = value;
      await act(() => { for (const callbacks of listeners.values()) for (const callback of callbacks) callback(); });
    },
    cleanup: async () => {
      await act(() => root.unmount());
      assert.equal(frames.size, 0);
      assert.ok([...listeners.values()].every(set => set.size === 0));
      dom.window.close();
      for (const [key, value] of previous) {
        if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

test('page exit and camera flight start together, but only the latest closed-and-arrived request opens', async t => {
  const browser = await browserFixture();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let finish: (id: number) => void;
  let id = -1;
  function Probe({ tab, request }: { tab: string; request: number }) {
    const view = usePageTransition(tab, request);
    finish = view.onSceneComplete;
    return React.createElement('output', { 'data-phase': view.phase, 'data-scene': view.scene.tab, 'data-request': view.scene.id }, view.tab);
  }
  const render = (tab: string) => act(() => browser.root.render(React.createElement(Probe, { tab, request: ++id })));
  const output = () => document.querySelector('output')!;
  try {
    await render('home');
    assert.equal(output().textContent, 'home'); // No dependency on WebGL/downloads.
    await act(() => finish(0));
    await render('study');
    assert.equal(output().textContent, 'home');
    assert.equal(output().getAttribute('data-phase'), 'leaving');
    assert.equal(output().getAttribute('data-scene'), 'study', 'the camera moves while outgoing text is still closing');
    await act(() => t.mock.timers.tick(PAGE_EXIT_MS - 20));
    await render('posts');
    assert.equal(output().getAttribute('data-scene'), 'posts', 'changing the destination during closing retargets immediately');
    await act(() => t.mock.timers.tick(20));
    assert.equal(output().textContent, 'home');
    assert.equal(output().getAttribute('data-phase'), 'leaving');
    await act(() => t.mock.timers.tick(PAGE_EXIT_MS - 20));
    assert.equal(output().textContent, 'home');
    assert.equal(output().getAttribute('data-phase'), 'travelling');
    assert.equal(output().getAttribute('data-scene'), 'posts');
    await act(() => t.mock.timers.tick(5000));
    assert.equal(output().textContent, 'home'); // Timers cannot end a real flight.
    await act(() => finish(1));
    assert.equal(output().textContent, 'home'); // Stale completion is ignored.
    await act(() => finish(2));
    assert.equal(output().textContent, 'posts');
    assert.equal(output().getAttribute('data-phase'), 'entering');
    await render('study');
    await render('posts'); // Return during fade-out: the camera still must arrive.
    await act(() => t.mock.timers.tick(PAGE_EXIT_MS));
    assert.equal(output().textContent, 'posts');
    await render('study');
    await act(() => t.mock.timers.tick(PAGE_EXIT_MS));
    const interruptedRequest = id;
    await render('posts'); // Return after the camera has already started.
    await act(() => t.mock.timers.tick(PAGE_EXIT_MS));
    assert.equal(output().getAttribute('data-phase'), 'travelling');
    await act(() => finish(interruptedRequest));
    assert.equal(output().getAttribute('data-phase'), 'travelling');
    await act(() => finish(id));
    assert.equal(output().getAttribute('data-phase'), 'entering');
    assert.equal(output().textContent, 'posts');
    await render('forum');
    await browser.motion(true);
    assert.equal(output().textContent, 'forum');
    assert.equal(output().getAttribute('data-phase'), 'idle');
    await render('home');
    assert.equal(output().textContent, 'home');
  } finally { await browser.cleanup(); t.mock.timers.reset(); }
});

test('an unavailable optional background cannot leave a page closed indefinitely', async t => {
  const browser = await browserFixture();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let staleCompletion: (id: number) => void;
  function Probe({ tab, id }: { tab: string; id: number }) {
    const view = usePageTransition(tab, id);
    staleCompletion = view.onSceneComplete;
    return React.createElement('output', { 'data-phase': view.phase }, view.tab);
  }
  try {
    await act(() => browser.root.render(React.createElement(Probe, { tab: 'home', id: 0 })));
    await act(() => browser.root.render(React.createElement(Probe, { tab: 'study', id: 1 })));
    await act(() => t.mock.timers.tick(SCENE_FALLBACK_MS));
    assert.equal(document.querySelector('output')!.textContent, 'home', 'missing 3D never skips the outgoing visual close');
    assert.equal(document.querySelector('output')!.getAttribute('data-phase'), 'leaving');
    await act(() => t.mock.timers.tick(PAGE_EXIT_MS - SCENE_FALLBACK_MS));
    assert.equal(document.querySelector('output')!.getAttribute('data-phase'), 'travelling');
    await act(() => staleCompletion(0)); // A late old frame cannot cancel the fallback.
    await act(() => t.mock.timers.tick(SCENE_FALLBACK_MS));
    assert.equal(document.querySelector('output')!.textContent, 'study');
  } finally { await browser.cleanup(); t.mock.timers.reset(); }
});

test('an early camera arrival waits for native fade completion, and a completed fade waits for camera arrival', async t => {
  const browser = await browserFixture();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let finish: (id: number) => void;
  let close: (id: number) => void;
  function Probe({ tab, id }: { tab: string; id: number }) {
    const view = usePageTransition(tab, id);
    finish = view.onSceneComplete;
    close = view.onPageClosed;
    return React.createElement('output', { 'data-phase': view.phase, 'data-scene': view.scene.tab }, view.tab);
  }
  const render = (tab: string, id: number) => act(() => browser.root.render(React.createElement(Probe, { tab, id })));
  const output = () => document.querySelector('output')!;
  try {
    await render('home', 0);
    await act(() => finish(0));
    await render('study', 1);
    assert.equal(output().getAttribute('data-scene'), 'study');
    await act(() => finish(1));
    assert.equal(output().textContent, 'home');
    assert.equal(output().getAttribute('data-phase'), 'leaving', 'early arrival never truncates the text fade');
    await act(() => t.mock.timers.tick(PAGE_EXIT_MS / 2));
    assert.equal(output().getAttribute('data-phase'), 'leaving');
    await act(() => close(0));
    assert.equal(output().textContent, 'home', 'a stale close cannot use the current arrival');
    await act(() => close(1));
    assert.equal(output().textContent, 'study');
    assert.equal(output().getAttribute('data-phase'), 'entering');
    await render('posts', 2);
    await act(() => close(2));
    assert.equal(output().textContent, 'study');
    assert.equal(output().getAttribute('data-phase'), 'travelling', 'finished text fade still waits for the camera');
    await act(() => finish(1));
    assert.equal(output().getAttribute('data-phase'), 'travelling');
    await act(() => finish(2));
    assert.equal(output().textContent, 'posts');
    assert.equal(output().getAttribute('data-phase'), 'entering');
  } finally { await browser.cleanup(); t.mock.timers.reset(); }
});

test('retargeting during the close invalidates both old gates without restarting the camera later', async t => {
  const browser = await browserFixture();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let finish: (id: number) => void;
  let close: (id: number) => void;
  function Probe({ tab, id }: { tab: string; id: number }) {
    const view = usePageTransition(tab, id);
    finish = view.onSceneComplete; close = view.onPageClosed;
    return React.createElement('output', { 'data-phase': view.phase, 'data-scene': view.scene.tab, 'data-request': view.scene.id }, view.tab);
  }
  const render = (tab: string, id: number) => act(() => browser.root.render(React.createElement(Probe, { tab, id })));
  const output = () => document.querySelector('output')!;
  try {
    await render('home', 0);
    await act(() => finish(0));
    await render('study', 1);
    await act(() => t.mock.timers.tick(PAGE_EXIT_MS / 3));
    await render('posts', 2);
    assert.equal(output().getAttribute('data-scene'), 'posts');
    assert.equal(output().getAttribute('data-request'), '2');
    await act(() => { finish(1); close(1); });
    assert.equal(output().getAttribute('data-phase'), 'leaving');
    assert.equal(output().textContent, 'home');
    await act(() => finish(2));
    assert.equal(output().getAttribute('data-phase'), 'leaving');
    await act(() => close(2));
    assert.equal(output().getAttribute('data-phase'), 'entering');
    assert.equal(output().textContent, 'posts');
    assert.equal(output().getAttribute('data-request'), '2', 'fade completion cannot start a second camera request');
    await act(() => t.mock.timers.tick(PAGE_EXIT_MS * 3));
    assert.equal(output().textContent, 'posts', 'old fallback/exit timers are cancelled');
  } finally { await browser.cleanup(); t.mock.timers.reset(); }
});

test('changing the destination during camera travel immediately retargets without reopening or closing the old page again', async t => {
  const browser = await browserFixture();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let finish: (id: number) => void;
  function Probe({ tab, id }: { tab: string; id: number }) {
    const view = usePageTransition(tab, id);
    finish = view.onSceneComplete;
    return React.createElement('output', { 'data-phase': view.phase, 'data-scene': view.scene.tab, 'data-request': view.scene.id }, view.tab);
  }
  const render = (tab: string, id: number) => act(() => browser.root.render(React.createElement(Probe, { tab, id })));
  const output = () => document.querySelector('output')!;
  try {
    await render('home', 0);
    await act(() => finish(0));
    await render('study', 1);
    await act(() => t.mock.timers.tick(PAGE_EXIT_MS));
    assert.equal(output().getAttribute('data-phase'), 'travelling');
    await render('posts', 2);
    assert.equal(output().getAttribute('data-phase'), 'travelling', 'already-closed content never repeats the leaving phase');
    assert.equal(output().getAttribute('data-scene'), 'posts', 'retarget happens without waiting for a second exit timer');
    assert.equal(output().getAttribute('data-request'), '2');
    assert.equal(output().textContent, 'home');
    await act(() => finish(1));
    assert.equal(output().getAttribute('data-phase'), 'travelling', 'old arrival cannot reveal the old destination');
    await render('home', 3);
    assert.equal(output().getAttribute('data-scene'), 'home');
    assert.equal(output().getAttribute('data-phase'), 'travelling', 'returning to the old visible tab still waits for its actual camera arrival');
    await act(() => finish(2));
    assert.equal(output().getAttribute('data-phase'), 'travelling');
    await act(() => finish(3));
    assert.equal(output().getAttribute('data-phase'), 'entering');
    assert.equal(output().textContent, 'home');
  } finally { await browser.cleanup(); t.mock.timers.reset(); }
});

test('cursor repulsion is small and has a continuous direction through the word centre', () => {
  const rect = { left: 100, top: 100, width: 300, height: 60 };
  assert.ok(cursorRepulsion(110, 130, rect).x > 0);
  assert.ok(cursorRepulsion(390, 130, rect).x < 0);
  assert.deepEqual(cursorRepulsion(600, 130, rect), { x: 0, y: 0 });
  assert.ok(cursorRepulsion(250, 130, rect).y < 0);
  for (let x = 0; x < 650; x += 3) for (let y = 0; y < 260; y += 3) {
    const offset = cursorRepulsion(x, y, rect, 12);
    assert.ok(Number.isFinite(offset.x) && Number.isFinite(offset.y));
    assert.ok(Math.hypot(offset.x, offset.y) <= 4.500001);
  }
  const left = cursorRepulsion(249.9, 130, rect);
  const right = cursorRepulsion(250.1, 130, rect);
  assert.ok(Math.hypot(left.x - right.x, left.y - right.y) < .08);
});

test('words ease toward small targets and ease back on leave, using one frame only until settled', async () => {
  const browser = await browserFixture();
  function Probe() {
    const ref = useCursorAvoidance();
    return React.createElement('div', { ref }, React.createElement('h1', { 'data-cursor-avoid': '12' }, 'Physics'));
  }
  try {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    await act(() => browser.root.render(React.createElement(Probe)));
    const text = document.querySelector('h1')!;
    let reads = 0;
    text.getBoundingClientRect = () => { reads++; return { left: 100, top: 100, width: 300, height: 60 } as DOMRect; };
    const move = (type = 'mouse') => {
      const event = new browser.dom.window.Event('pointermove', { bubbles: true });
      Object.assign(event, { pointerType: type, clientX: 110, clientY: 130 });
      text.dispatchEvent(event);
    };
    move('touch'); assert.equal(browser.frames.size, 0);
    for (let i = 0; i < 50; i++) move();
    assert.equal(browser.frames.size, 1);
    let time = 0;
    const runFrame = () => {
      time += 16.67;
      // The newly scheduled settling frame belongs to the next refresh.
      for (const [id, callback] of [...browser.frames]) { browser.frames.delete(id); callback(time); }
    };
    runFrame(); assert.equal(reads, 1);
    const first = parseFloat(text.style.getPropertyValue('--avoid-x'));
    assert.ok(first > 0 && first < .4);
    move(); runFrame(); assert.equal(reads, 1);
    const second = parseFloat(text.style.getPropertyValue('--avoid-x'));
    assert.ok(second > first && second < .8);
    for (let i = 0; i < 200 && browser.frames.size; i++) runFrame();
    assert.equal(browser.frames.size, 0);
    const settled = parseFloat(text.style.getPropertyValue('--avoid-x'));
    assert.ok(settled > 3.5 && settled <= 4.5);
    text.parentElement!.dispatchEvent(new browser.dom.window.Event('pointerleave'));
    assert.equal(parseFloat(text.style.getPropertyValue('--avoid-x')), settled);
    assert.equal(browser.frames.size, 1);
    runFrame();
    assert.ok(parseFloat(text.style.getPropertyValue('--avoid-x')) < settled);
    assert.ok(parseFloat(text.style.getPropertyValue('--avoid-x')) > settled * .8);
    for (let i = 0; i < 200 && browser.frames.size; i++) runFrame();
    assert.equal(browser.frames.size, 0);
    assert.equal(text.style.getPropertyValue('--avoid-x'), '');
    assert.equal(reads, 1);
    move(); await browser.motion(true);
    assert.equal(browser.frames.size, 0);
    assert.equal(text.style.getPropertyValue('--avoid-x'), '');
    move(); assert.equal(browser.frames.size, 0);
    await browser.motion(false); move(); // Cleanup must cancel this pending frame.
  } finally { await browser.cleanup(); }
});

test('Telegram follows a full, finite link orbit with soft endpoints', () => {
  assert.equal(TELEGRAM_ORBIT_MS, 3200);
  const start = telegramOrbitPose(0, 200, 60);
  const end = telegramOrbitPose(1, 200, 60);
  assert.equal(start.x, 0); assert.equal(start.y, 0);
  assert.ok(Math.abs(end.x) < .001 && Math.abs(end.y) < .001);
  assert.equal(end.angle, 360);
  const before = telegramOrbitPose(.001, 200, 60);
  const after = telegramOrbitPose(.999, 200, 60);
  assert.ok(Math.hypot(before.x, before.y) < .01);
  assert.ok(Math.hypot(after.x, after.y) < .01);
  const poses = Array.from({ length: 101 }, (_, i) => telegramOrbitPose(i / 100, 200, 60));
  assert.ok(Math.max(...poses.map(pose => pose.x)) > 180);
  assert.ok(Math.min(...poses.map(pose => pose.y)) < -35);
  assert.ok(Math.max(...poses.map(pose => pose.y)) > 35);
});

test('Telegram finishes the same full path after pointer leave, blur and re-entry, and cancels on reduced motion/unmount', async () => {
  const browser = await browserFixture();
  const animations: Array<{ frames: Keyframe[]; options: KeyframeAnimationOptions; currentTime: number; onfinish: (() => void) | null; cancelled: boolean; cancel(): void }> = [];
  browser.dom.window.HTMLElement.prototype.animate = function (frames, options) {
    const animation = { frames: frames as Keyframe[], options: options as KeyframeAnimationOptions, currentTime: 0, onfinish: null as (() => void) | null, cancelled: false, cancel() { this.cancelled = true; } };
    animations.push(animation);
    return animation as unknown as Animation;
  };
  function Probe() {
    const ref = useTelegramOrbit();
    return React.createElement('a', { ref }, React.createElement('span', { className: 'home-telegram-plane' }));
  }
  try {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    await act(() => browser.root.render(React.createElement(Probe)));
    const link = document.querySelector('a')!;
    let reads = 0;
    link.getBoundingClientRect = () => { reads++; return { width: 200, height: 60 } as DOMRect; };
    const enter = (type = 'mouse') => {
      const event = new browser.dom.window.Event('pointerenter');
      Object.assign(event, { pointerType: type });
      link.dispatchEvent(event);
    };
    enter('touch'); assert.equal(animations.length, 0);
    enter(); assert.equal(animations.length, 1); assert.equal(reads, 1);
    for (const progress of [.01, .25, .5, .75, .99]) {
      animations[0].currentTime = TELEGRAM_ORBIT_MS * progress;
      link.dispatchEvent(new browser.dom.window.Event('pointerleave'));
      link.dispatchEvent(new browser.dom.window.Event('blur'));
      enter();
      assert.equal(animations[0].cancelled, false, `flight interrupted at ${progress}`);
      assert.equal(animations[0].currentTime, TELEGRAM_ORBIT_MS * progress);
      assert.equal(animations.length, 1, 'leave and re-entry must not create a shortcut or restart');
    }
    assert.equal(reads, 1);
    for (const frame of animations[0].frames) {
      const pose = telegramOrbitPose(Number(frame.offset), 200, 60);
      assert.equal(frame.transform, `translate(${pose.x.toFixed(3)}px, ${pose.y.toFixed(3)}px) rotate(${pose.angle.toFixed(3)}deg)`);
    }
    animations[0].onfinish!(); assert.equal(animations[0].cancelled, true);
    enter(); assert.equal(animations.length, 2);
    assert.equal(reads, 2);
    await browser.motion(true);
    assert.equal(animations[1].cancelled, true);
    enter(); assert.equal(animations.length, 2);
    await browser.motion(false); enter(); assert.equal(animations.length, 3);
  } finally {
    await browser.cleanup();
    assert.ok(animations.every(animation => animation.cancelled));
  }
});

test('local stars bridge every intermediate scale, with a calm galaxy clock', () => {
  assert.ok(GALAXY_ROTATION_RATE > 0 && GALAXY_ROTATION_RATE <= .01);
  assert.ok(GALAXY_MATTER_RATE > 0 && GALAXY_MATTER_RATE <= .2);
  for (let distance = 100; distance <= 100000; distance *= 1.01) {
    const v = cosmicVisibility(distance);
    assert.ok(Math.max(v.detail, v.nucleus, v.cluster, v.disk) > .1, `empty scale at ${distance}`);
  }
  assert.equal(cosmicVisibility(10.9).nucleus, 0);
  assert.equal(cosmicVisibility(350000).nucleus, 0);
});
