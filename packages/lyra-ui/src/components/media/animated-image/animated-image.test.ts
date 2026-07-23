import { fixture, expect, html, oneEvent, aTimeout } from '@open-wc/testing';
import './animated-image.js';
import type { LyraAnimatedImage } from './animated-image.js';

// A real, valid 1x1 pixel PNG -- loaded through a genuine <img> decode in the
// Chromium `wtr` launches (not mocked), so `load`/`naturalWidth`/etc. are all
// real browser-produced values, without depending on external network access.
const DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const BROKEN_DATA_URI = 'data:image/png;base64,not-a-valid-png';

/** Sets `el.src` and awaits the resulting real `lr-load`, registering the
 *  listener before the assignment per this repo's `oneEvent`-races-dispatch
 *  convention. */
async function loaded(el: LyraAnimatedImage, src = DATA_URI): Promise<void> {
  const ev = oneEvent(el, 'lr-load');
  el.src = src;
  await ev;
  await el.updateComplete;
}

/** Stubs `window.matchMedia('(prefers-reduced-motion: reduce)')` with a
 *  controllable fake `MediaQueryList` so reduced-motion arbitration is
 *  deterministic instead of depending on the ambient CI environment. Restore
 *  via `.restore()` in a `finally` block. */
function stubReducedMotion(initialMatches: boolean) {
  const original = window.matchMedia;
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const fakeList = {
    get matches() {
      return matches;
    },
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (_type: string, cb: (event: MediaQueryListEvent) => void) => listeners.add(cb),
    removeEventListener: (_type: string, cb: (event: MediaQueryListEvent) => void) => listeners.delete(cb),
  } as unknown as MediaQueryList;

  window.matchMedia = ((query: string) =>
    query === '(prefers-reduced-motion: reduce)' ? fakeList : original(query)) as typeof window.matchMedia;

  return {
    restore(): void {
      window.matchMedia = original;
    },
    fire(nextMatches: boolean): void {
      matches = nextMatches;
      const event = { matches: nextMatches, media: fakeList.media } as MediaQueryListEvent;
      listeners.forEach((cb) => cb(event));
    },
  };
}

describe('default render / freeze-frame state', () => {
  it('defaults to not playing; once loaded, canvas is exposed and image is aria-hidden', async () => {
    const el = (await fixture(html`<lr-animated-image alt="Pixel"></lr-animated-image>`)) as LyraAnimatedImage;
    expect(el.playing).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="control-box"]')).to.be.null;

    await loaded(el);

    const img = el.shadowRoot!.querySelector('[part="image"]') as HTMLImageElement;
    const canvas = el.shadowRoot!.querySelector('[part="canvas"]') as HTMLCanvasElement;
    expect(img.getAttribute('aria-hidden')).to.equal('true');
    expect(canvas.getAttribute('aria-hidden')).to.be.null;
    expect(el.shadowRoot!.querySelector('[part="control-box"]')).to.not.be.null;
  });

  it('does not render an img src attribute for an empty src, and never fires lr-error for it', async () => {
    const el = (await fixture(html`<lr-animated-image alt="Pixel"></lr-animated-image>`)) as LyraAnimatedImage;
    let errorFired = false;
    el.addEventListener('lr-error', () => {
      errorFired = true;
    });
    el.src = '';
    await el.updateComplete;
    await aTimeout(20);
    expect(errorFired).to.be.false;
    const img = el.shadowRoot!.querySelector('[part="image"]') as HTMLImageElement;
    expect(img.hasAttribute('src')).to.be.false;
  });

  it('resets and re-arms capture on every src change (independent load cycles)', async () => {
    const el = (await fixture(html`<lr-animated-image alt="Pixel"></lr-animated-image>`)) as LyraAnimatedImage;
    await loaded(el);
    expect(el.shadowRoot!.querySelector('[part="control-box"]')).to.not.be.null;

    el.src = '';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="control-box"]')).to.be.null;

    await loaded(el);
    expect(el.shadowRoot!.querySelector('[part="control-box"]')).to.not.be.null;
  });
});

describe('lr-load / DPR-aware frame capture', () => {
  it('fires lr-load and captures a DPR-aware frozen frame matching the loaded image', async () => {
    const el = (await fixture(html`<lr-animated-image alt="Pixel"></lr-animated-image>`)) as LyraAnimatedImage;
    await loaded(el);

    const img = el.shadowRoot!.querySelector('[part="image"]') as HTMLImageElement;
    const canvas = el.shadowRoot!.querySelector('[part="canvas"]') as HTMLCanvasElement;
    const dpr = window.devicePixelRatio || 1;
    expect(img.naturalWidth).to.be.greaterThan(0);
    expect(canvas.width).to.equal(img.naturalWidth * dpr);
    expect(canvas.height).to.equal(img.naturalHeight * dpr);
  });
});

describe('lr-error', () => {
  it('fires for a real broken image and does not render control-box', async () => {
    const el = (await fixture(html`<lr-animated-image alt="Pixel"></lr-animated-image>`)) as LyraAnimatedImage;
    const errorEvent = oneEvent(el, 'lr-error');
    el.src = BROKEN_DATA_URI;
    await errorEvent;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="control-box"]')).to.be.null;
  });

  it('fires for a src that fails safeMediaSrc(), with no request ever attempted', async () => {
    const el = (await fixture(html`<lr-animated-image alt="Pixel"></lr-animated-image>`)) as LyraAnimatedImage;
    const errorEvent = oneEvent(el, 'lr-error');
    el.src = 'javascript:alert(1)';
    await errorEvent;
    await el.updateComplete;
    const img = el.shadowRoot!.querySelector('[part="image"]') as HTMLImageElement;
    expect(img.hasAttribute('src')).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="control-box"]')).to.be.null;
  });
});

describe('play / playing / reduced-motion arbitration', () => {
  it('plays when play=true and the platform does not prefer reduced motion', async () => {
    const stub = stubReducedMotion(false);
    try {
      const el = (await fixture(
        html`<lr-animated-image play alt="Pixel"></lr-animated-image>`,
      )) as LyraAnimatedImage;
      expect(el.playing).to.be.true;
      await loaded(el);
      const img = el.shadowRoot!.querySelector('[part="image"]') as HTMLImageElement;
      const canvas = el.shadowRoot!.querySelector('[part="canvas"]') as HTMLCanvasElement;
      expect(img.getAttribute('aria-hidden')).to.be.null;
      expect(canvas.getAttribute('aria-hidden')).to.equal('true');
    } finally {
      stub.restore();
    }
  });

  it('toggles .play when the rendered play-button is clicked, firing lr-play/lr-pause', async () => {
    const stub = stubReducedMotion(false);
    try {
      const el = (await fixture(html`<lr-animated-image alt="Pixel"></lr-animated-image>`)) as LyraAnimatedImage;
      await loaded(el);
      const button = el.shadowRoot!.querySelector('[part="play-button"]') as HTMLButtonElement;

      const playEvent = oneEvent(el, 'lr-play');
      button.click();
      await playEvent;
      expect(el.play).to.be.true;
      expect(el.playing).to.be.true;

      const pauseEvent = oneEvent(el, 'lr-pause');
      button.click();
      await pauseEvent;
      expect(el.play).to.be.false;
      expect(el.playing).to.be.false;
    } finally {
      stub.restore();
    }
  });

  it('stays frozen and disables the play button under OS reduced motion (respectReducedMotion defaults to true)', async () => {
    const stub = stubReducedMotion(true);
    try {
      const el = (await fixture(html`<lr-animated-image alt="Pixel"></lr-animated-image>`)) as LyraAnimatedImage;
      await loaded(el);
      const button = el.shadowRoot!.querySelector('[part="play-button"]') as HTMLButtonElement;
      expect(button.disabled).to.be.true;

      let playFired = false;
      el.addEventListener('lr-play', () => {
        playFired = true;
      });
      el.play = true;
      await el.updateComplete;

      expect(el.playing).to.be.false;
      expect(playFired).to.be.false;
    } finally {
      stub.restore();
    }
  });

  it('respectReducedMotion=false (property binding) lets play take effect even under OS reduced motion', async () => {
    const stub = stubReducedMotion(true);
    try {
      // `?respect-reduced-motion=${false}` can never drive this true-defaulting
      // boolean property back to false -- a property binding is required.
      const el = (await fixture(
        html`<lr-animated-image alt="Pixel" .respectReducedMotion=${false}></lr-animated-image>`,
      )) as LyraAnimatedImage;
      await loaded(el);
      el.play = true;
      await el.updateComplete;

      expect(el.playing).to.be.true;
      const button = el.shadowRoot!.querySelector('[part="play-button"]') as HTMLButtonElement;
      expect(button.disabled).to.be.false;
    } finally {
      stub.restore();
    }
  });

  it('respect-reduced-motion="false" (plain HTML attribute) also lets play take effect under OS reduced motion', async () => {
    const stub = stubReducedMotion(true);
    try {
      // Unlike `?respect-reduced-motion=${false}` (a boolean directive -- see the comment above),
      // a plain literal attribute value must drive this true-defaulting boolean property back to
      // false without requiring a JS property binding.
      const el = (await fixture(
        html`<lr-animated-image alt="Pixel" respect-reduced-motion="false"></lr-animated-image>`,
      )) as LyraAnimatedImage;
      expect(el.respectReducedMotion).to.be.false;
      await loaded(el);
      el.play = true;
      await el.updateComplete;

      expect(el.playing).to.be.true;
      const button = el.shadowRoot!.querySelector('[part="play-button"]') as HTMLButtonElement;
      expect(button.disabled).to.be.false;
    } finally {
      stub.restore();
    }
  });

  it('reacts live to an OS-level reduced-motion preference change while already connected', async () => {
    const stub = stubReducedMotion(false);
    try {
      const el = (await fixture(
        html`<lr-animated-image play alt="Pixel"></lr-animated-image>`,
      )) as LyraAnimatedImage;
      await el.updateComplete;
      expect(el.playing).to.be.true;

      const pauseEvent = oneEvent(el, 'lr-pause');
      stub.fire(true);
      await pauseEvent;
      expect(el.playing).to.be.false;
    } finally {
      stub.restore();
    }
  });

  it('el.playing = x has no defined effect -- read-only, control playback via .play', async () => {
    const el = (await fixture(html`<lr-animated-image alt="Pixel"></lr-animated-image>`)) as LyraAnimatedImage;
    expect(() => {
      (el as unknown as { playing: boolean }).playing = true;
    }).to.not.throw();
    expect(el.playing).to.be.false;
  });
});

describe('accessible name on the play button', () => {
  it('uses the localized playWithContext/pauseWithContext text keyed off alt, in both states', async () => {
    const stub = stubReducedMotion(false);
    try {
      const el = (await fixture(
        html`<lr-animated-image alt="Site tour"></lr-animated-image>`,
      )) as LyraAnimatedImage;
      await loaded(el);
      const button = () => el.shadowRoot!.querySelector('[part="play-button"]') as HTMLButtonElement;
      expect(button().getAttribute('aria-label')).to.equal('Play Site tour');

      el.play = true;
      await el.updateComplete;
      expect(button().getAttribute('aria-label')).to.equal('Pause Site tour');
    } finally {
      stub.restore();
    }
  });

  it('lets a host aria-label (accessibleLabel) win verbatim over the per-state label, in both states', async () => {
    const stub = stubReducedMotion(false);
    try {
      const el = (await fixture(html`
        <lr-animated-image alt="Site tour" aria-label="Toggle hero animation"></lr-animated-image>
      `)) as LyraAnimatedImage;
      await loaded(el);
      const button = () => el.shadowRoot!.querySelector('[part="play-button"]') as HTMLButtonElement;
      expect(button().getAttribute('aria-label')).to.equal('Toggle hero animation');

      el.play = true;
      await el.updateComplete;
      expect(button().getAttribute('aria-label')).to.equal('Toggle hero animation');
    } finally {
      stub.restore();
    }
  });

  it('keeps a non-empty accessible name on the play button while disabled by reduced motion', async () => {
    const stub = stubReducedMotion(true);
    try {
      const el = (await fixture(html`<lr-animated-image alt="Pixel"></lr-animated-image>`)) as LyraAnimatedImage;
      await loaded(el);
      const button = el.shadowRoot!.querySelector('[part="play-button"]') as HTMLButtonElement;
      expect(button.disabled).to.be.true;
      expect(button.getAttribute('aria-label')).to.equal('Play Pixel');
    } finally {
      stub.restore();
    }
  });
});

describe('alt forwarding + fallback', () => {
  it('forwards alt to the image alt and canvas aria-label, falling back to the localized default when empty', async () => {
    const el = (await fixture(
      html`<lr-animated-image alt="Custom alt text"></lr-animated-image>`,
    )) as LyraAnimatedImage;
    await loaded(el);
    let img = el.shadowRoot!.querySelector('[part="image"]') as HTMLImageElement;
    let canvas = el.shadowRoot!.querySelector('[part="canvas"]') as HTMLCanvasElement;
    expect(img.alt).to.equal('Custom alt text');
    expect(canvas.getAttribute('aria-label')).to.equal('Custom alt text');

    el.alt = '';
    await el.updateComplete;
    img = el.shadowRoot!.querySelector('[part="image"]') as HTMLImageElement;
    canvas = el.shadowRoot!.querySelector('[part="canvas"]') as HTMLCanvasElement;
    expect(img.alt).to.equal('Animated image');
    expect(canvas.getAttribute('aria-label')).to.equal('Animated image');
  });
});

describe('string localization', () => {
  it('defaults playWithContext/pauseWithContext/animatedImageDefaultAlt to English with no locale registered', async () => {
    const el = (await fixture(html`<lr-animated-image></lr-animated-image>`)) as LyraAnimatedImage;
    await loaded(el);
    const button = el.shadowRoot!.querySelector('[part="play-button"]') as HTMLButtonElement;
    const img = el.shadowRoot!.querySelector('[part="image"]') as HTMLImageElement;
    expect(img.alt).to.equal('Animated image');
    expect(button.getAttribute('aria-label')).to.equal('Play Animated image');
  });

  it('honors a .strings override for playWithContext/pauseWithContext/animatedImageDefaultAlt', async () => {
    const overrides = {
      playWithContext: 'Lire {name}',
      pauseWithContext: 'Mettre {name} en pause',
      animatedImageDefaultAlt: 'Image animée',
    };
    const el = (await fixture(
      html`<lr-animated-image .strings=${overrides}></lr-animated-image>`,
    )) as LyraAnimatedImage;
    await loaded(el);
    const button = el.shadowRoot!.querySelector('[part="play-button"]') as HTMLButtonElement;
    const img = el.shadowRoot!.querySelector('[part="image"]') as HTMLImageElement;
    expect(img.alt).to.equal('Image animée');
    expect(button.getAttribute('aria-label')).to.equal('Lire Image animée');
  });
});

describe('RTL', () => {
  it('mirrors control-box to the top-start (physically top-left) corner under dir="rtl"', async () => {
    // Chromium resolves both `left` and `right` to used pixel offsets for a
    // `position: absolute` box (never a literal "auto" string once layout has
    // run), so mirroring is asserted by comparing which physical side sits
    // near the edge (the pinned side) rather than checking for "auto".
    const ltrEl = (await fixture(html`
      <lr-animated-image dir="ltr" alt="Pixel" style="inline-size: 12rem;"></lr-animated-image>
    `)) as LyraAnimatedImage;
    await loaded(ltrEl);
    const ltrBox = ltrEl.shadowRoot!.querySelector('[part="control-box"]') as HTMLElement;
    const ltrStyle = getComputedStyle(ltrBox);
    // LTR: inset-inline-end -> physical right, pinned near the edge (small
    // offset); the opposite side resolves to a much larger used value.
    expect(parseFloat(ltrStyle.right)).to.be.lessThan(parseFloat(ltrStyle.left));

    const rtlEl = (await fixture(html`
      <lr-animated-image dir="rtl" alt="Pixel" style="inline-size: 12rem;"></lr-animated-image>
    `)) as LyraAnimatedImage;
    await loaded(rtlEl);
    const rtlBox = rtlEl.shadowRoot!.querySelector('[part="control-box"]') as HTMLElement;
    const rtlStyle = getComputedStyle(rtlBox);
    // RTL: inset-inline-end -> physical left, mirrored to the opposite side.
    expect(parseFloat(rtlStyle.left)).to.be.lessThan(parseFloat(rtlStyle.right));
  });
});

describe('focus / blur', () => {
  it('forwards public focus()/blur() to the play button', async () => {
    const el = (await fixture(html`<lr-animated-image alt="Pixel"></lr-animated-image>`)) as LyraAnimatedImage;
    await loaded(el);
    el.focus();
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('play-button');
    el.blur();
    expect(el.shadowRoot!.activeElement).to.equal(null);
  });

  it('bridges internal play-button focus/blur as bubbling, composed host events', async () => {
    const el = (await fixture(html`<lr-animated-image alt="Pixel"></lr-animated-image>`)) as LyraAnimatedImage;
    await loaded(el);
    const button = el.shadowRoot!.querySelector('[part="play-button"]') as HTMLButtonElement;

    const focusPromise = oneEvent(el, 'focus');
    button.focus();
    const focusEvent = await focusPromise;
    expect(focusEvent.bubbles).to.be.true;
    expect(focusEvent.composed).to.be.true;

    const blurPromise = oneEvent(el, 'blur');
    button.blur();
    const blurEvent = await blurPromise;
    expect(blurEvent.bubbles).to.be.true;
    expect(blurEvent.composed).to.be.true;
  });

  it('forwards host click() to the play button', async () => {
    const el = (await fixture(html`<lr-animated-image alt="Pixel"></lr-animated-image>`)) as LyraAnimatedImage;
    await loaded(el);
    expect(el.play).to.be.false;

    el.click();
    expect(el.play).to.be.true;
  });
});

describe('frozen-frame allocation ceiling', () => {
  it('downscales a very large DPR backing store to a bounded pixel budget', async () => {
    const el = (await fixture(html`<lr-animated-image alt="Large image"></lr-animated-image>`)) as LyraAnimatedImage;
    const img = el.shadowRoot!.querySelector('[part="image"]') as HTMLImageElement;
    const canvas = el.shadowRoot!.querySelector('[part="canvas"]') as HTMLCanvasElement;
    const originalDpr = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    Object.defineProperty(img, 'naturalWidth', { value: 20_000, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 20_000, configurable: true });
    Object.defineProperty(window, 'devicePixelRatio', { value: 4, configurable: true });

    try {
      img.dispatchEvent(new Event('load'));
      await el.updateComplete;
      expect(canvas.width).to.be.at.most(8192);
      expect(canvas.height).to.be.at.most(8192);
      expect(canvas.width * canvas.height).to.be.at.most(16_777_216);
    } finally {
      if (originalDpr) Object.defineProperty(window, 'devicePixelRatio', originalDpr);
      else delete (window as unknown as { devicePixelRatio?: number }).devicePixelRatio;
    }
  });
});

describe('play-button hover specificity', () => {
  it('a ::part(play-button):hover override wins without needing !important', async () => {
    const style = document.createElement('style');
    style.textContent = `lr-animated-image::part(play-button):hover { color: rgb(1, 2, 3); }`;
    document.head.appendChild(style);
    try {
      const el = (await fixture(html`<lr-animated-image alt="Pixel"></lr-animated-image>`)) as LyraAnimatedImage;
      // jsdom/browser test runners don't synthesize a real :hover pseudo-class from a dispatched
      // event, so assert via the internal rule's specificity instead of the actual paint --
      // mirrors lr-attachment-trigger's identical `trigger-button hover specificity` test.
      const internalSheet = (el.shadowRoot!.adoptedStyleSheets ?? [])
        .flatMap((sheet) => Array.from(sheet.cssRules))
        .map((rule) => rule.cssText)
        .find((text) => text.includes(':hover') && text.includes('play-button'));
      expect(internalSheet).to.contain(':where(');
    } finally {
      style.remove();
    }
  });
});

describe('accessibility', () => {
  it('is accessible (default frozen state)', async () => {
    const el = (await fixture(html`<lr-animated-image alt="Pixel"></lr-animated-image>`)) as LyraAnimatedImage;
    await loaded(el);
    await expect(el).to.be.accessible();
  });

  it('is accessible (actively playing state)', async () => {
    const stub = stubReducedMotion(false);
    try {
      const el = (await fixture(
        html`<lr-animated-image alt="Pixel" play></lr-animated-image>`,
      )) as LyraAnimatedImage;
      await loaded(el);
      expect(el.playing).to.be.true;
      await expect(el).to.be.accessible();
    } finally {
      stub.restore();
    }
  });
});
