import assert from 'node:assert/strict';
import { test } from 'node:test';
import React, { act, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { usePageScroll } from '../src/motion/usePageScroll.ts';

async function scrollFixture(initialPosition = 0) {
  const dom = new JSDOM('<div id="root"></div>');
  const previous = new Map<string, PropertyDescriptor | undefined>();
  let y = initialPosition;
  let maximum = 3000;
  const calls: Array<{ y: number; phase: string | undefined; tab: string | undefined; behavior: string | undefined }> = [];
  const observers: Array<{ disconnected: boolean; fire(): void }> = [];
  const listeners = new Set<EventListenerOrEventListenerObject>();
  Object.defineProperties(dom.window, { scrollY: { get: () => y }, scrollX: { get: () => 0 } });
  dom.window.scrollTo = ((options: ScrollToOptions) => {
    const surface = dom.window.document.querySelector<HTMLElement>('[data-tab]');
    calls.push({ y: options.top!, phase: surface?.dataset.phase, tab: surface?.dataset.tab, behavior: options.behavior });
    y = Math.max(0, Math.min(options.top!, maximum));
    dom.window.dispatchEvent(new dom.window.Event('scroll'));
  }) as typeof dom.window.scrollTo;
  class MockResizeObserver {
    disconnected = false;
    private readonly callback: () => void;
    constructor(callback: () => void) { this.callback = callback; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
    // Allow queued callbacks even after disconnect, to exercise stale guards.
    fire() { this.callback(); }
  }
  const add = dom.window.addEventListener.bind(dom.window);
  const remove = dom.window.removeEventListener.bind(dom.window);
  const trackedEvents = new Set(['scroll', 'wheel', 'touchstart', 'keydown']);
  dom.window.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions) => {
    // React installs a permanent bound scroll-polyfill listener separately
    // from the hook's plain listeners; this fixture does not own that one.
    if (trackedEvents.has(type) && (typeof listener !== 'function' || !listener.toString().includes('[native code]'))) listeners.add(listener);
    add(type, listener, options);
  }) as typeof dom.window.addEventListener;
  dom.window.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject) => {
    listeners.delete(listener); remove(type, listener);
  }) as typeof dom.window.removeEventListener;
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, ResizeObserver: MockResizeObserver,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const root = createRoot(document.getElementById('root')!);
  let cancelRestore: () => void = () => {};
  function Probe({ tab, phase }: { tab: string; phase: string }) {
    const surface = useRef<HTMLDivElement>(null);
    cancelRestore = usePageScroll(tab, phase, surface);
    return React.createElement('div', { ref: surface, 'data-tab': tab, 'data-phase': phase });
  }
  return {
    calls, observers,
    cancelRestore: () => cancelRestore(),
    position: () => y,
    render: (tab: string, phase: string) => act(() => root.render(React.createElement(Probe, { tab, phase }))),
    height: (value: number) => { maximum = value; y = Math.min(y, maximum); },
    userScroll: (value: number) => { y = value; dom.window.dispatchEvent(new dom.window.Event('scroll')); },
    interact: (type: string, key?: string) => dom.window.dispatchEvent(key
      ? new dom.window.KeyboardEvent(type, { key }) : new dom.window.Event(type)),
    cleanup: async () => {
      await act(() => root.unmount());
      dom.window.close();
      for (const [key, value] of previous) {
        if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key);
      }
      assert.equal(listeners.size, 0, 'all hook scroll/interaction listeners are removed');
      assert.ok(observers.every(observer => observer.disconnected));
    },
  };
}

test('new tabs open at top only when revealed; returning preserves the outgoing cached position despite DOM clamping', async () => {
  const browser = await scrollFixture(160);
  try {
    await browser.render('study', 'idle');
    assert.equal(browser.position(), 160, 'initial native/auth-return scroll is not reset');
    browser.userScroll(840);
    await browser.render('study', 'leaving');
    await browser.render('study', 'travelling');
    assert.equal(browser.calls.length, 0, 'closing and camera travel never move the outgoing page');
    browser.height(40); // Browser clamps scroll during shorter target DOM commit.
    await browser.render('home', 'entering');
    assert.equal(browser.position(), 0);
    assert.deepEqual(browser.calls[0], { y: 0, phase: 'entering', tab: 'home', behavior: 'instant' });
    await browser.render('home', 'leaving');
    await browser.render('home', 'travelling');
    browser.height(2000);
    await browser.render('study', 'entering');
    assert.equal(browser.position(), 840, 'the clamp to 40 never overwrote Study’s saved 840');
    assert.equal(browser.observers.length, 0, 'already-mounted visited content needs no observer');
  } finally { await browser.cleanup(); }
});

test('a lazy shorter fallback retries only until the saved position is available and survives entering to idle', async () => {
  const browser = await scrollFixture();
  try {
    await browser.render('study', 'idle');
    browser.userScroll(900);
    await browser.render('study', 'leaving');
    browser.height(30);
    await browser.render('home', 'entering');
    await browser.render('home', 'leaving');
    await browser.render('study', 'entering');
    assert.equal(browser.position(), 30);
    const observer = browser.observers.at(-1)!;
    assert.equal(observer.disconnected, false);
    await browser.render('study', 'idle');
    assert.equal(observer.disconnected, false, 'settling the entrance does not cancel a still-needed height retry');
    browser.height(500);
    observer.fire();
    assert.equal(browser.position(), 500);
    browser.height(1500);
    observer.fire();
    assert.equal(browser.position(), 900);
    assert.equal(observer.disconnected, true);
    const calls = browser.calls.length;
    observer.fire();
    assert.equal(browser.calls.length, calls, 'completed/stale observer callbacks cannot scroll again');
  } finally { await browser.cleanup(); }
});

test('wheel, touch and scrolling keys stop delayed restoration so growing content cannot fight the user', async () => {
  const interactions: Array<[string, string | undefined]> = [['wheel', undefined], ['touchstart', undefined], ['keydown', 'PageDown'], ['keydown', 'Home']];
  for (const [event, key] of interactions) {
    const browser = await scrollFixture();
    try {
      await browser.render('study', 'idle');
      browser.userScroll(700);
      await browser.render('study', 'leaving');
      browser.height(20);
      await browser.render('home', 'entering');
      await browser.render('study', 'entering');
      const observer = browser.observers.at(-1)!;
      browser.interact(event, key);
      assert.equal(observer.disconnected, true);
      browser.userScroll(10);
      const calls = browser.calls.length;
      browser.height(2000);
      observer.fire();
      assert.equal(browser.calls.length, calls);
      assert.equal(browser.position(), 10, `the ${event} user remains in control`);
    } finally { await browser.cleanup(); }
  }
});

test('navigation cancels an incomplete restore, and pending ResizeObserver callbacks cannot move the next tab', async () => {
  const browser = await scrollFixture();
  try {
    await browser.render('study', 'idle');
    browser.userScroll(1200);
    await browser.render('study', 'leaving');
    browser.height(20);
    await browser.render('home', 'entering');
    await browser.render('study', 'entering');
    const observer = browser.observers.at(-1)!;
    await browser.render('study', 'leaving');
    assert.equal(observer.disconnected, true);
    await browser.render('study', 'travelling');
    browser.height(2000);
    await browser.render('posts', 'entering');
    assert.equal(browser.position(), 0);
    const calls = browser.calls.length;
    observer.fire();
    assert.equal(browser.calls.length, calls);
    assert.equal(browser.position(), 0);
  } finally { await browser.cleanup(); }
});

test('a guide can explicitly cancel lazy restoration before its controlled scroll', async () => {
  const browser = await scrollFixture();
  try {
    await browser.render('study', 'idle');
    browser.userScroll(1000);
    await browser.render('study', 'leaving');
    browser.height(20);
    await browser.render('home', 'entering');
    await browser.render('study', 'entering');
    const observer = browser.observers.at(-1)!;
    browser.cancelRestore();
    assert.equal(observer.disconnected, true);
    browser.height(2000);
    browser.userScroll(300); // A controlled guide scroll also dispatches scroll.
    const calls = browser.calls.length;
    observer.fire();
    assert.equal(browser.calls.length, calls);
    assert.equal(browser.position(), 300, 'late content cannot pull the user away from the guide target');
  } finally { await browser.cleanup(); }
});

test('lazy restoration stops after three seconds and unmount releases an active observer', async t => {
  const browser = await scrollFixture();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  try {
    await browser.render('study', 'idle');
    browser.userScroll(900);
    await browser.render('study', 'leaving');
    browser.height(10);
    await browser.render('home', 'entering');
    await browser.render('study', 'entering');
    const observer = browser.observers.at(-1)!;
    await act(() => t.mock.timers.tick(2999));
    assert.equal(observer.disconnected, false);
    await act(() => t.mock.timers.tick(1));
    assert.equal(observer.disconnected, true);
    const calls = browser.calls.length;
    browser.height(2000);
    observer.fire();
    assert.equal(browser.calls.length, calls);
    await browser.render('home', 'entering');
    browser.userScroll(600);
    await browser.render('study', 'entering');
    browser.height(5);
    await browser.render('home', 'entering');
    assert.equal(browser.observers.at(-1)!.disconnected, false);
  } finally { await browser.cleanup(); t.mock.timers.reset(); }
});
