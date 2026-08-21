import { expect } from '@open-wc/testing';
import {
  getAnimation,
  setAnimation,
  setDefaultAnimation,
  type LyraElementAnimation,
  type LyraGetAnimationOptions,
} from './animation-registry.js';

function animation(opacity: number, options: KeyframeAnimationOptions = {}): LyraElementAnimation {
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

it('snapshots a global default and resolves defensive copies before exact cleanup', () => {
  const el = document.createElement('div');
  const configured = animation(0.75, { duration: 125 });
  const cleanup = setDefaultAnimation('test.global', configured);
  try {
    const first = getAnimation(el, 'test.global', { dir: 'ltr' });
    expect(first.keyframes[1]?.opacity).to.equal(0.75);
    expect(first.options.duration).to.equal(125);

    (configured.keyframes as Keyframe[])[1]!.opacity = 0.2;
    (configured.options as KeyframeAnimationOptions).duration = 300;
    expect(Object.isFrozen(first)).to.be.true;
    expect(Object.isFrozen(first.keyframes)).to.be.true;
    expect(Object.isFrozen(first.keyframes[1]!)).to.be.true;
    expect(Object.isFrozen(first.options)).to.be.true;
    expect(Reflect.set(first.keyframes[1]!, 'opacity', 0.1)).to.be.false;
    expect(Reflect.set(first.options, 'duration', 999)).to.be.false;
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
  const fallback: LyraElementAnimation = {
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
  const malformed: { keyframes: Keyframe[] | undefined } = { keyframes: undefined };
  const cleanup = setAnimation(el, 'test.malformed', malformed as unknown as LyraElementAnimation);
  try {
    // Registration snapshots validity too: mutating a formerly malformed caller object cannot
    // turn the inert entry into a live cross-instance override later.
    malformed.keyframes = [{ opacity: 0 }, { opacity: 1 }];
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

it('fails oversized logical-direction keyframe collections closed before retaining them', () => {
  const el = document.createElement('div');
  const keyframes = Array.from({ length: 600 }, (_, index) => ({ opacity: index / 600 }));
  const rtlKeyframes = Array.from({ length: 600 }, (_, index) => ({ opacity: 1 - index / 600 }));
  const fallback = animation(0.3, { duration: 55 });
  for (const [name, candidate] of [
    ['base', { keyframes }],
    ['rtl', { keyframes: [{ opacity: 0 }, { opacity: 1 }], rtlKeyframes }],
  ] as const) {
    const cleanup = setDefaultAnimation(`test.bounded.${name}`, candidate);
    try {
      const resolved = getAnimation(el, `test.bounded.${name}`, { dir: 'rtl', fallback });
      expect(resolved.keyframes.length).to.equal(2);
      expect(resolved.keyframes[1]?.opacity).to.equal(0.3);
      expect(resolved.options.duration).to.equal(55);
    } finally {
      cleanup();
    }
  }
});

it('fails an oversized animation-options record closed instead of retaining an unbounded copy', () => {
  const el = document.createElement('div');
  const oversizedOptions = Object.fromEntries(
    Array.from({ length: 65 }, (_, index) => [`option${index}`, index]),
  ) as KeyframeAnimationOptions;
  const cleanup = setAnimation(el, 'test.bounded-options', {
    keyframes: [{ opacity: 1 }],
    options: oversizedOptions,
  });
  try {
    const resolved = getAnimation(el, 'test.bounded-options', {
      dir: 'ltr',
      fallback: animation(0.35, { duration: 60 }),
    });
    expect(resolved.keyframes[1]?.opacity).to.equal(0.35);
    expect(resolved.options.duration).to.equal(60);
  } finally {
    cleanup();
  }
});

it('fails an oversized keyframe record closed instead of retaining an unbounded copy', () => {
  const el = document.createElement('div');
  const oversizedKeyframe = Object.fromEntries(
    Array.from({ length: 257 }, (_, index) => [`property${index}`, index]),
  ) as Keyframe;
  const cleanup = setAnimation(el, 'test.bounded-keyframe', {
    keyframes: [oversizedKeyframe],
  });
  try {
    const resolved = getAnimation(el, 'test.bounded-keyframe', {
      dir: 'ltr',
      fallback: animation(0.25, { duration: 50 }),
    });
    expect(resolved.keyframes[1]?.opacity).to.equal(0.25);
    expect(resolved.options.duration).to.equal(50);
  } finally {
    cleanup();
  }
});

it('fails hostile registration getters and keyframe spreads closed to the caller fallback', () => {
  const el = document.createElement('div');
  const fallback = animation(0.45, { duration: 75 });
  let topLevelReads = 0;
  let keyframeReads = 0;
  let optionReads = 0;
  const hostileTopLevel = Object.create(null) as LyraElementAnimation;
  Object.defineProperty(hostileTopLevel, 'keyframes', {
    enumerable: true,
    get(): never {
      topLevelReads += 1;
      throw new Error('hostile keyframes getter');
    },
  });
  const hostileKeyframe = Object.create(null) as Keyframe;
  Object.defineProperty(hostileKeyframe, 'opacity', {
    enumerable: true,
    get(): never {
      keyframeReads += 1;
      throw new Error('hostile keyframe member');
    },
  });
  const hostileOptions = Object.create(null) as KeyframeAnimationOptions;
  Object.defineProperty(hostileOptions, 'duration', {
    enumerable: true,
    get(): never {
      optionReads += 1;
      throw new Error('hostile options member');
    },
  });

  for (const [name, candidate] of [
    ['top-level', hostileTopLevel],
    ['keyframe', { keyframes: [hostileKeyframe] }],
    ['options', { keyframes: [{ opacity: 1 }], options: hostileOptions }],
  ] as const) {
    let cleanup: (() => void) | undefined;
    expect(() => {
      cleanup = setAnimation(el, `test.hostile.${name}`, candidate);
    }).not.to.throw();
    try {
      const resolved = getAnimation(el, `test.hostile.${name}`, { dir: 'ltr', fallback });
      expect(resolved.keyframes[1]?.opacity).to.equal(0.45);
      expect(resolved.options.duration).to.equal(75);
    } finally {
      cleanup?.();
    }
  }
  expect([topLevelReads, keyframeReads, optionReads]).to.deep.equal([0, 0, 0]);
});

it('does not let inherited animation option keys consume the own-record cap', () => {
  const inherited = Object.create(null) as Record<string, number>;
  for (let index = 0; index < 65; index += 1) inherited[`inherited${index}`] = index;
  const options = Object.create(inherited) as KeyframeAnimationOptions;
  options.duration = 123;
  const cleanup = setDefaultAnimation('test.inherited-options', {
    keyframes: [{ opacity: 0 }, { opacity: 1 }],
    options,
  });
  try {
    const resolved = getAnimation(
      document.createElement('div'),
      'test.inherited-options',
      { respectReducedMotion: false },
    );
    expect(resolved.options.duration).to.equal(123);
  } finally {
    cleanup();
  }
});

it('rejects a non-Element target for setAnimation and getAnimation', () => {
  const notAnElement = {} as unknown as Element;
  expect(() => setAnimation(notAnElement, 'test.non-element', null)).to.throw(
    TypeError,
    'setAnimation() requires an Element.',
  );
  expect(() => getAnimation(notAnElement, 'test.non-element')).to.throw(
    TypeError,
    'getAnimation() requires an Element.',
  );
});

it('rejects a blank or non-string animation name across every entry point', () => {
  const el = document.createElement('div');
  expect(() => setDefaultAnimation('', animation(1))).to.throw(
    TypeError,
    'Animation names must be non-empty strings.',
  );
  expect(() => setDefaultAnimation('   ', animation(1))).to.throw(TypeError);
  expect(() => setAnimation(el, '', null)).to.throw(TypeError);
  expect(() => getAnimation(el, '')).to.throw(TypeError);
});

it('returns the explicit disabled result when no entry exists and the caller fallback is null', () => {
  const el = document.createElement('div');
  const resolved = getAnimation(el, 'test.unregistered-null-fallback', {
    dir: 'ltr',
    fallback: null,
  });
  expect(resolved.keyframes).to.deep.equal([]);
  expect(resolved.options.duration).to.equal(0);
});

it('infers rtl direction from computed style when no explicit dir option is passed', () => {
  const el = document.createElement('div');
  el.setAttribute('dir', 'rtl');
  document.body.append(el);
  const cleanup = setAnimation(el, 'test.inferred-rtl', {
    keyframes: [{ transform: 'translateX(-1px)' }],
    rtlKeyframes: [{ transform: 'translateX(1px)' }],
  });
  try {
    const resolved = getAnimation(el, 'test.inferred-rtl');
    expect(resolved.keyframes[0]?.transform).to.equal('translateX(1px)');
  } finally {
    cleanup();
    el.remove();
  }
});

it('falls back to the dir attribute when the element has no browsing-context window', () => {
  const inertDocument = document.implementation.createHTMLDocument('inert');
  expect(inertDocument.defaultView === null).to.be.true;
  const el = inertDocument.createElement('div');
  el.setAttribute('dir', 'rtl');
  const cleanup = setAnimation(el, 'test.inert-dir', {
    keyframes: [{ opacity: 0 }],
    rtlKeyframes: [{ opacity: 1 }],
  });
  try {
    const resolved = getAnimation(el, 'test.inert-dir');
    expect(resolved.keyframes[0]?.opacity).to.equal(1);
  } finally {
    cleanup();
  }
});

it('fails closed when merging a valid override with a valid fallback exceeds the combined option cap', () => {
  // Each side individually stays under MAX_ANIMATION_OPTION_PROPERTIES and registers cleanly;
  // only the *merged* spread crosses the cap, and resolvedAnimation() re-validates after merging.
  const el = document.createElement('div');
  const fallbackOptions = Object.fromEntries(
    Array.from({ length: 40 }, (_, index) => [`fallbackOption${index}`, index]),
  ) as KeyframeAnimationOptions;
  const overrideOptions = Object.fromEntries(
    Array.from({ length: 40 }, (_, index) => [`overrideOption${index}`, index]),
  ) as KeyframeAnimationOptions;
  const cleanup = setAnimation(el, 'test.merged-oversized-options', {
    keyframes: [{ opacity: 1 }],
    options: overrideOptions,
  });
  try {
    const resolved = getAnimation(el, 'test.merged-oversized-options', {
      dir: 'ltr',
      fallback: { keyframes: [{ opacity: 0 }], options: fallbackOptions },
    });
    expect(resolved.keyframes).to.deep.equal([]);
    expect(resolved.options.duration).to.equal(0);
  } finally {
    cleanup();
  }
});

it('fails hostile fallback getters closed without throwing during resolution', () => {
  const el = document.createElement('div');
  const hostileFallback = Object.create(null) as LyraElementAnimation;
  Object.defineProperty(hostileFallback, 'keyframes', {
    enumerable: true,
    get(): never {
      throw new Error('hostile fallback keyframes getter');
    },
  });
  let resolved: ReturnType<typeof getAnimation> | undefined;
  expect(() => {
    resolved = getAnimation(el, 'test.hostile-fallback', {
      dir: 'ltr',
      fallback: hostileFallback,
    });
  }).not.to.throw();
  expect(resolved?.keyframes).to.deep.equal([]);
  expect(resolved?.options.duration).to.equal(0);
});

it('skips a shadowed inactive middle registration when resolving through a three-level stack', () => {
  const el = document.createElement('div');
  const cleanupA = setDefaultAnimation('test.three-stack', animation(0.1));
  const cleanupB = setDefaultAnimation('test.three-stack', animation(0.2));
  const cleanupC = setDefaultAnimation('test.three-stack', animation(0.3));
  cleanupB();
  try {
    expect(getAnimation(el, 'test.three-stack', { dir: 'ltr' }).keyframes[1]?.opacity).to.equal(0.3);
    cleanupC();
    expect(getAnimation(el, 'test.three-stack', { dir: 'ltr' }).keyframes[1]?.opacity).to.equal(0.1);
  } finally {
    cleanupA();
  }
});

it('reads own enumerable properties from non-plain-object keyframes and options', () => {
  class CustomKeyframe {
    opacity = 0.42;
  }
  class CustomOptions {
    duration = 88;
  }
  const el = document.createElement('div');
  const cleanup = setDefaultAnimation('test.custom-prototype', {
    keyframes: [new CustomKeyframe()],
    options: new CustomOptions(),
  });
  try {
    const resolved = getAnimation(el, 'test.custom-prototype', { dir: 'ltr', respectReducedMotion: false });
    expect(resolved.keyframes[0]?.opacity).to.equal(0.42);
    expect(resolved.options.duration).to.equal(88);
  } finally {
    cleanup();
  }
});

it('fails a sparse keyframe array closed instead of silently compacting the hole', () => {
  const el = document.createElement('div');
  const sparse = [{ opacity: 0 }, , { opacity: 1 }] as unknown as Keyframe[];
  const cleanup = setDefaultAnimation('test.sparse-keyframes', { keyframes: sparse });
  try {
    const resolved = getAnimation(el, 'test.sparse-keyframes', {
      dir: 'ltr',
      fallback: animation(0.15, { duration: 40 }),
    });
    expect(resolved.keyframes[1]?.opacity).to.equal(0.15);
  } finally {
    cleanup();
  }
});

it('accepts exactly the maximum keyframe count without rejecting the animation', () => {
  const el = document.createElement('div');
  const keyframes = Array.from({ length: 512 }, (_, index) => ({ opacity: index / 512 }));
  const cleanup = setDefaultAnimation('test.max-keyframes', { keyframes });
  try {
    const resolved = getAnimation(el, 'test.max-keyframes', { dir: 'ltr' });
    expect(resolved.keyframes.length).to.equal(512);
  } finally {
    cleanup();
  }
});

it('fails a hostile rtlKeyframes or top-level options accessor closed without invoking it', () => {
  const el = document.createElement('div');
  const fallback = animation(0.5, { duration: 80 });
  let rtlReads = 0;
  let optionsReads = 0;
  const hostileRtl = { keyframes: [{ opacity: 0 }, { opacity: 1 }] } as LyraElementAnimation;
  Object.defineProperty(hostileRtl, 'rtlKeyframes', {
    enumerable: true,
    get(): never {
      rtlReads += 1;
      throw new Error('hostile rtlKeyframes getter');
    },
  });
  const hostileOptionsAccessor = { keyframes: [{ opacity: 0 }, { opacity: 1 }] } as LyraElementAnimation;
  Object.defineProperty(hostileOptionsAccessor, 'options', {
    enumerable: true,
    get(): never {
      optionsReads += 1;
      throw new Error('hostile options getter');
    },
  });
  for (const [name, candidate] of [
    ['rtl', hostileRtl],
    ['options', hostileOptionsAccessor],
  ] as const) {
    const cleanup = setDefaultAnimation(`test.hostile-accessor.${name}`, candidate);
    try {
      const resolved = getAnimation(el, `test.hostile-accessor.${name}`, { dir: 'rtl', fallback });
      expect(resolved.keyframes[1]?.opacity).to.equal(0.5);
      expect(resolved.options.duration).to.equal(80);
    } finally {
      cleanup();
    }
  }
  expect([rtlReads, optionsReads]).to.deep.equal([0, 0]);
});

it('does not throw when the caller options object itself has hostile property getters', () => {
  const el = document.createElement('div');
  const cleanup = setDefaultAnimation('test.hostile-options-bag', animation(0.55, { duration: 65 }));
  const hostileOptions = {} as LyraGetAnimationOptions;
  for (const key of ['dir', 'fallback', 'respectReducedMotion'] as const) {
    Object.defineProperty(hostileOptions, key, {
      enumerable: true,
      get(): never {
        throw new Error(`hostile ${key} getter`);
      },
    });
  }
  try {
    let resolved: ReturnType<typeof getAnimation> | undefined;
    expect(() => {
      resolved = getAnimation(el, 'test.hostile-options-bag', hostileOptions);
    }).not.to.throw();
    expect(resolved?.keyframes[1]?.opacity).to.equal(0.55);
  } finally {
    cleanup();
  }
});

it('snapshots hostile animation records inertly and resolves the caller fallback', () => {
  const el = document.createElement('div');
  const fallback = animation(0.61, { duration: 73 });
  const hostileRecord = new Proxy({}, {
    getPrototypeOf(): never {
      throw new Error('hostile keyframe prototype');
    },
  });
  const hostileKeyframes = new Proxy([] as Keyframe[], {
    getOwnPropertyDescriptor(target, property): PropertyDescriptor | undefined {
      if (property === 'length') throw new Error('hostile keyframe descriptor');
      return Reflect.getOwnPropertyDescriptor(target, property);
    },
  });
  const hostileAnimation = new Proxy({ keyframes: [] } as LyraElementAnimation, {
    getOwnPropertyDescriptor(): never {
      throw new Error('hostile animation descriptor');
    },
  });
  const candidates: readonly LyraElementAnimation[] = [
    { keyframes: [null as unknown as Keyframe] },
    { keyframes: [hostileRecord as Keyframe] },
    { keyframes: hostileKeyframes },
    hostileAnimation,
  ];

  candidates.forEach((candidate, index) => {
    const name = `test.hostile-snapshot.${index}`;
    let cleanup: ReturnType<typeof setDefaultAnimation> | undefined;
    expect(() => {
      cleanup = setDefaultAnimation(name, candidate);
    }).not.to.throw();
    try {
      const resolved = getAnimation(el, name, {
        dir: 'ltr',
        fallback,
        respectReducedMotion: false,
      });
      expect(resolved.keyframes[1]?.opacity).to.equal(0.61);
      expect(resolved.options.duration).to.equal(73);
    } finally {
      cleanup?.();
    }
  });
});
