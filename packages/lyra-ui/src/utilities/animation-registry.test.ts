import { expect } from '@open-wc/testing';
import {
  getAnimation,
  setAnimation,
  setDefaultAnimation,
  type ElementAnimation,
} from './animation-registry.js';

function animation(opacity: number, options: KeyframeAnimationOptions = {}): ElementAnimation {
  return { keyframes: [{ opacity: 0 }, { opacity }], options };
}

function stubReducedMotion(matches: boolean): () => void {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) =>
    ({ matches: query === '(prefers-reduced-motion: reduce)' && matches }) as MediaQueryList) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

it('resolves a global default defensively and cleanup removes exactly that registration', () => {
  const el = document.createElement('div');
  const cleanup = setDefaultAnimation('test.global', animation(0.75, { duration: 125 }));
  try {
    const first = getAnimation(el, 'test.global', { dir: 'ltr' });
    expect(first.keyframes[1]?.opacity).to.equal(0.75);
    expect(first.options.duration).to.equal(125);

    first.keyframes[1]!.opacity = 0.1;
    first.options.duration = 999;
    const second = getAnimation(el, 'test.global', { dir: 'ltr' });
    expect(second.keyframes[1]?.opacity).to.equal(0.75);
    expect(second.options.duration).to.equal(125);
  } finally {
    cleanup();
    cleanup();
  }
  expect(getAnimation(el, 'test.global', { dir: 'ltr' }).keyframes).to.deep.equal([]);
});

it('keeps stacked global cleanup order-safe when an older cleanup runs first', () => {
  const el = document.createElement('div');
  const cleanupFirst = setDefaultAnimation('test.stack', animation(0.25));
  const cleanupSecond = setDefaultAnimation('test.stack', animation(0.5));
  cleanupFirst();
  expect(getAnimation(el, 'test.stack', { dir: 'ltr' }).keyframes[1]?.opacity).to.equal(0.5);
  cleanupSecond();
  expect(getAnimation(el, 'test.stack', { dir: 'ltr' }).keyframes).to.deep.equal([]);
});

it('uses a weak per-element override ahead of the global default and preserves it across reconnect', () => {
  const globalCleanup = setDefaultAnimation('test.instance', animation(0.25));
  const el = document.createElement('div');
  const instanceCleanup = setAnimation(el, 'test.instance', animation(0.8));
  document.body.append(el);
  el.remove();
  document.body.append(el);
  try {
    expect(getAnimation(el, 'test.instance', { dir: 'ltr' }).keyframes[1]?.opacity).to.equal(0.8);
    instanceCleanup();
    expect(getAnimation(el, 'test.instance', { dir: 'ltr' }).keyframes[1]?.opacity).to.equal(0.25);
  } finally {
    instanceCleanup();
    globalCleanup();
    el.remove();
  }
});

it('treats a null element override as an explicit disable instead of falling through', () => {
  const globalCleanup = setDefaultAnimation('test.disabled', animation(1, { duration: 500 }));
  const el = document.createElement('div');
  const instanceCleanup = setAnimation(el, 'test.disabled', null);
  try {
    const resolved = getAnimation(el, 'test.disabled', { dir: 'ltr' });
    expect(resolved.keyframes).to.deep.equal([]);
    expect(resolved.options.duration).to.equal(0);
  } finally {
    instanceCleanup();
    globalCleanup();
  }
});

it('selects rtlKeyframes live and merges an override with the component fallback timing', () => {
  const el = document.createElement('div');
  const cleanup = setAnimation(el, 'test.rtl', {
    keyframes: [{ transform: 'translateX(-1px)' }, { transform: 'translateX(0)' }],
    rtlKeyframes: [{ transform: 'translateX(1px)' }, { transform: 'translateX(0)' }],
  });
  const fallback: ElementAnimation = {
    keyframes: [{ opacity: 0 }, { opacity: 1 }],
    options: { duration: 180, easing: 'ease-out', fill: 'both' },
  };
  try {
    const ltr = getAnimation(el, 'test.rtl', { dir: 'ltr', fallback });
    const rtl = getAnimation(el, 'test.rtl', { dir: 'rtl', fallback });
    expect(ltr.keyframes[0]?.transform).to.equal('translateX(-1px)');
    expect(rtl.keyframes[0]?.transform).to.equal('translateX(1px)');
    expect(rtl.options).to.include({ duration: 180, easing: 'ease-out', fill: 'both' });
  } finally {
    cleanup();
  }
});

it('flattens registered motion under reduced motion while retaining the resolved end frame', () => {
  const restore = stubReducedMotion(true);
  const el = document.createElement('div');
  const cleanup = setDefaultAnimation('test.reduced', animation(1, {
    delay: 100,
    duration: 800,
    endDelay: 100,
    iterations: 5,
  }));
  try {
    const reduced = getAnimation(el, 'test.reduced', { dir: 'ltr' });
    expect(reduced.keyframes.at(-1)?.opacity).to.equal(1);
    expect(reduced.options).to.include({ delay: 0, duration: 0, endDelay: 0, iterations: 1 });

    const optedOut = getAnimation(el, 'test.reduced', { dir: 'ltr', respectReducedMotion: false });
    expect(optedOut.options).to.include({ delay: 100, duration: 800, endDelay: 100, iterations: 5 });
  } finally {
    cleanup();
    restore();
  }
});

it('uses an explicit fallback without registering it globally', () => {
  const el = document.createElement('div');
  const fallback = animation(0.6, { duration: 90 });
  expect(getAnimation(el, 'test.fallback', { dir: 'ltr', fallback }).keyframes[1]?.opacity).to.equal(0.6);
  expect(getAnimation(document.createElement('div'), 'test.fallback', { dir: 'ltr' }).keyframes).to.deep.equal([]);
});

it('fails a structurally malformed JavaScript override closed to the caller fallback', () => {
  const el = document.createElement('div');
  const malformed = { keyframes: undefined } as unknown as ElementAnimation;
  const cleanup = setAnimation(el, 'test.malformed', malformed);
  try {
    const resolved = getAnimation(el, 'test.malformed', {
      dir: 'ltr',
      fallback: animation(0.4, { duration: 70 }),
    });
    expect(resolved.keyframes[1]?.opacity).to.equal(0.4);
    expect(resolved.options.duration).to.equal(70);
  } finally {
    cleanup();
  }
});
