import { expect, fixture, html } from '@open-wc/testing';
import { animateRegistered, type RegisteredAnimationSpec } from './registered-animation.js';
import { setAnimation } from '../utilities/animation-registry.js';

function stubReducedMotion(reduce: boolean): () => void {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: reduce && query === '(prefers-reduced-motion: reduce)',
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

function showSpec(): RegisteredAnimationSpec {
  return {
    keyframes: [{ opacity: 0 }, { opacity: 1 }],
    durationProperties: ['--show-duration', '--lr-duration-base'],
    easingProperties: ['--lr-easing-standard'],
  };
}

// Never hand chai a DOM node or a live Animation as `actual` — a failing deep comparison against
// one hangs the whole test file. Assert booleans, then read the plain timing record.
function timingOf(animation: Animation | undefined): EffectTiming {
  expect(animation !== undefined, 'animateRegistered() returned no Animation').to.be.true;
  const effect = animation?.effect ?? undefined;
  expect(effect !== undefined, 'the Animation carries no effect').to.be.true;
  return (effect as AnimationEffect).getTiming();
}

describe('animateRegistered()', () => {
  it('honours a public duration custom property when motion is not reduced', async () => {
    const restore = stubReducedMotion(false);
    const host = await fixture<HTMLElement>(
      html`<div style="--show-duration: 400ms"></div>`,
    );

    try {
      const animation = animateRegistered(host, host, 'test.show.full', 'ltr', showSpec());
      expect(timingOf(animation).duration).to.equal(400);
      animation?.cancel();
    } finally {
      restore();
    }
  });

  it('clamps a public --show-duration override to zero under prefers-reduced-motion', async () => {
    const restore = stubReducedMotion(true);
    const host = await fixture<HTMLElement>(
      html`<div style="--show-duration: 400ms"></div>`,
    );

    try {
      const animation = animateRegistered(host, host, 'test.show.reduced', 'ltr', showSpec());
      expect(timingOf(animation).duration).to.equal(0);
      animation?.cancel();
    } finally {
      restore();
    }
  });

  it('clamps a registry override carrying an explicit duration, delay and iterations', async () => {
    const restore = stubReducedMotion(true);
    const host = await fixture<HTMLElement>(html`<div></div>`);
    const cleanup = setAnimation(host, 'test.show.registry', {
      keyframes: [{ opacity: 0 }, { opacity: 1 }],
      options: { duration: 750, delay: 250, endDelay: 250, iterations: 3 },
    });

    try {
      const animation = animateRegistered(host, host, 'test.show.registry', 'ltr', showSpec());
      const timing = timingOf(animation);
      expect(timing.duration).to.equal(0);
      expect(timing.delay ?? 0).to.equal(0);
      expect(timing.endDelay ?? 0).to.equal(0);
      expect(timing.iterations ?? 1).to.equal(1);
      animation?.cancel();
    } finally {
      cleanup();
      restore();
    }
  });

  it('clamps the malformed-override recovery path too', async () => {
    const restore = stubReducedMotion(true);
    const host = await fixture<HTMLElement>(
      html`<div style="--show-duration: 400ms"></div>`,
    );
    // A keyframe object the Web Animations API rejects forces animateRegistered() into its
    // `catch` recovery branch, which re-runs the component-owned fallback timing.
    const cleanup = setAnimation(host, 'test.show.broken', {
      keyframes: [{ offset: 5, opacity: 0 }, { offset: 9, opacity: 1 }],
    });

    try {
      const animation = animateRegistered(host, host, 'test.show.broken', 'ltr', showSpec());
      expect(timingOf(animation).duration).to.equal(0);
      animation?.cancel();
    } finally {
      cleanup();
      restore();
    }
  });

  it('falls through malformed duration tokens and parses compound seconds safely', async () => {
    const restore = stubReducedMotion(false);
    const host = await fixture<HTMLElement>(html`
      <div style="--good-duration: -.25s ease-in"></div>
    `);
    host.style.setProperty('--bad-duration', `${'9'.repeat(400)}ms`);
    const spec: RegisteredAnimationSpec = {
      keyframes: [{ opacity: 0 }, { opacity: 1 }],
      durationProperties: ['--bad-duration', '--good-duration'],
      easingProperties: ['--missing-easing'],
      fallbackDuration: 900,
      fallbackEasing: 'ease-out',
    };

    try {
      const animation = animateRegistered(host, host, 'test.show.compound', 'ltr', spec);
      const timing = timingOf(animation);
      expect(timing.duration).to.equal(0);
      expect(timing.easing).to.equal('ease-in');
      animation?.cancel();
    } finally {
      restore();
    }
  });

  it('accepts a nonempty easing on browsers without CSS.supports()', async function () {
    const supportsDescriptor = Object.getOwnPropertyDescriptor(CSS, 'supports');
    if (supportsDescriptor && !supportsDescriptor.configurable) this.skip();
    const restore = stubReducedMotion(false);
    const host = await fixture<HTMLElement>(html`
      <div style="--show-duration: 20ms ease-in"></div>
    `);
    Object.defineProperty(CSS, 'supports', {
      configurable: true,
      value: undefined,
    });

    try {
      const animation = animateRegistered(host, host, 'test.show.legacy-css', 'ltr', showSpec());
      expect(timingOf(animation).easing).to.equal('ease-in');
      animation?.cancel();
    } finally {
      if (supportsDescriptor) Object.defineProperty(CSS, 'supports', supportsDescriptor);
      else Reflect.deleteProperty(CSS, 'supports');
      restore();
    }
  });

  it('uses the RTL fallback after an override throws and contains a second animation failure', async () => {
    const restore = stubReducedMotion(false);
    const host = await fixture<HTMLElement>(html`<div></div>`);
    const fallbackFrames: Keyframe[] = [{ transform: 'translateX(1px)' }];
    const rtlFrames: Keyframe[] = [{ transform: 'translateX(-1px)' }];
    const cleanup = setAnimation(host, 'test.show.fallback-failure', {
      keyframes: [{ opacity: 0 }, { opacity: 1 }],
      options: { duration: 20 },
    });
    const calls: Keyframe[][] = [];
    const originalAnimate = host.animate;
    host.animate = ((keyframes: Keyframe[] | PropertyIndexedKeyframes | null) => {
      calls.push(keyframes as Keyframe[]);
      throw new DOMException('animation unavailable', 'NotSupportedError');
    }) as typeof host.animate;

    try {
      const animation = animateRegistered(host, host, 'test.show.fallback-failure', 'rtl', {
        keyframes: fallbackFrames,
        rtlKeyframes: rtlFrames,
        durationProperties: ['--missing-duration'],
      });
      expect(animation).to.equal(undefined);
      expect(calls).to.have.length(2);
      expect(calls[0]).to.deep.equal([{ opacity: 0 }, { opacity: 1 }]);
      expect(calls[1]).to.deep.equal(rtlFrames);
      expect(calls[1] === rtlFrames).to.equal(false);
    } finally {
      host.animate = originalAnimate;
      cleanup();
      restore();
    }
  });
});
