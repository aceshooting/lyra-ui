import { fixture, expect, html } from '@open-wc/testing';
import { setReducedMotion } from '../../../../test/wtr-media.js';
import './typing-indicator.js';
import type { LyraTypingIndicator } from './typing-indicator.js';

it('defaults to the dots variant, m size, and a "Thinking…" label', async () => {
  const el = (await fixture(html`<lr-typing-indicator></lr-typing-indicator>`)) as LyraTypingIndicator;
  expect(el.variant).to.equal('dots');
  expect(el.size).to.equal('m');
  expect(el.label).to.equal('Thinking…');
});

it('reflects variant and size onto the host attributes', async () => {
  const el = (await fixture(
    html`<lr-typing-indicator variant="pulse" size="s"></lr-typing-indicator>`,
  )) as LyraTypingIndicator;
  expect(el.getAttribute('variant')).to.equal('pulse');
  expect(el.getAttribute('size')).to.equal('s');

  el.variant = 'cursor';
  el.size = 'm';
  await el.updateComplete;
  expect(el.getAttribute('variant')).to.equal('cursor');
  expect(el.getAttribute('size')).to.equal('m');
});

describe('shared size ladder', () => {
  const dotDiameter = async (size?: string): Promise<number> => {
    const el = (await fixture(
      size == null
        ? html`<lr-typing-indicator></lr-typing-indicator>`
        : html`<lr-typing-indicator size=${size}></lr-typing-indicator>`,
    )) as LyraTypingIndicator;
    await el.updateComplete;
    const dot = el.shadowRoot!.querySelector('[part="dot"]') as HTMLElement;
    return Number.parseFloat(getComputedStyle(dot).inlineSize);
  };

  it('renders three tiers across the ladder, with the unset default on the middle one', async () => {
    const compact = await dotDiameter('s');
    const middle = await dotDiameter('m');
    const roomy = await dotDiameter('l');
    expect(compact, 's < m').to.be.lessThan(middle);
    expect(roomy, 'l > m').to.be.greaterThan(middle);
    expect(await dotDiameter(), 'the unset default is the middle tier').to.equal(middle);
  });

  it('matches a rule for every step of the ladder, in both spellings', async () => {
    // A step the type accepts and no selector matches would silently render at the default tier.
    const compact = await dotDiameter('s');
    const roomy = await dotDiameter('l');
    for (const size of ['2xs', 'xs', 's', 'small'] as const) {
      expect(await dotDiameter(size), `${size} is the compact tier`).to.equal(compact);
    }
    for (const size of ['l', 'large', 'xl'] as const) {
      expect(await dotDiameter(size), `${size} is the roomy tier`).to.equal(roomy);
    }
    expect(await dotDiameter('medium'), 'medium is the default tier').to.equal(await dotDiameter('m'));
  });

  it('no longer answers to the retired sm/md spellings', async () => {
    // `sm`/`md` were this component's own private scale; they are not part of LyraSize, and the
    // rename is not aliased, so they fall through to the default tier rather than half-working.
    const middle = await dotDiameter('m');
    expect(await dotDiameter('sm'), 'sm is inert').to.equal(middle);
    expect(await dotDiameter('md'), 'md is inert').to.equal(middle);
  });
});

it('exposes role="status" and aria-label derived from label on the host', async () => {
  const el = (await fixture(html`<lr-typing-indicator></lr-typing-indicator>`)) as LyraTypingIndicator;
  expect(el.getAttribute('role')).to.equal('status');
  expect(el.getAttribute('aria-label')).to.equal('Thinking…');

  el.label = 'Generating response…';
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('Generating response…');
});

it('preserves an explicit host aria-label instead of clobbering it with the label-derived default on first render', async () => {
  const el = (await fixture(
    html`<lr-typing-indicator aria-label="Generating response"></lr-typing-indicator>`,
  )) as LyraTypingIndicator;
  expect(el.getAttribute('aria-label')).to.equal('Generating response');
  expect(el.shadowRoot!.querySelector('.sr-only')!.textContent).to.equal('Generating response');

  // A later `label` update must not override the host's own explicit choice.
  el.label = 'Thinking harder…';
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('Generating response');
});

it('falls back to the default accessible name when label is empty or whitespace-only', async () => {
  const empty = (await fixture(html`<lr-typing-indicator label=""></lr-typing-indicator>`)) as LyraTypingIndicator;
  expect(empty.getAttribute('aria-label')).to.equal('Thinking…');
  expect(empty.shadowRoot!.querySelector('.sr-only')!.textContent).to.equal('Thinking…');

  const whitespace = (await fixture(
    html`<lr-typing-indicator label="   "></lr-typing-indicator>`,
  )) as LyraTypingIndicator;
  expect(whitespace.getAttribute('aria-label')).to.equal('Thinking…');
  expect(whitespace.shadowRoot!.querySelector('.sr-only')!.textContent).to.equal('Thinking…');
});

it('resolves the accessible name through a .strings override for thinking when label is left at its default', async () => {
  // label stays at its untouched 'Thinking…' default, so localize() must fall
  // through to the .strings/registry path rather than the prop-derived
  // fallback -- both name surfaces (host aria-label and sr-only text) carry
  // the translation.
  const el = (await fixture(
    html`<lr-typing-indicator .strings=${{ thinking: 'Réflexion…' }}></lr-typing-indicator>`,
  )) as LyraTypingIndicator;
  expect(el.getAttribute('aria-label')).to.equal('Réflexion…');
  expect(el.shadowRoot!.querySelector('.sr-only')!.textContent).to.equal('Réflexion…');
});

it('renders a visually-hidden text node carrying the label, independent of aria-label', async () => {
  const el = (await fixture(
    html`<lr-typing-indicator label="Working on it…"></lr-typing-indicator>`,
  )) as LyraTypingIndicator;
  const srText = el.shadowRoot!.querySelector('.sr-only');
  expect((srText) != null).to.equal(true);
  expect(srText!.textContent).to.equal('Working on it…');
});

it('marks the decorative shape aria-hidden and renders three dots for the dots variant', async () => {
  const el = (await fixture(html`<lr-typing-indicator></lr-typing-indicator>`)) as LyraTypingIndicator;
  const base = el.shadowRoot!.querySelector('[part="base"]');
  expect((base) != null).to.equal(true);
  expect(base!.getAttribute('aria-hidden')).to.equal('true');
  expect(el.shadowRoot!.querySelectorAll('[part="dot"]').length).to.equal(3);
  expect((el.shadowRoot!.querySelector('[part="pulse"]')) == null).to.be.true;
  expect((el.shadowRoot!.querySelector('[part="cursor"]')) == null).to.be.true;
});

it('renders a single pulse element for the pulse variant', async () => {
  const el = (await fixture(
    html`<lr-typing-indicator variant="pulse"></lr-typing-indicator>`,
  )) as LyraTypingIndicator;
  expect(el.shadowRoot!.querySelectorAll('[part="dot"]').length).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="pulse"]')).to.exist;
  expect((el.shadowRoot!.querySelector('[part="cursor"]')) == null).to.be.true;
});

it('renders a single cursor element for the cursor variant', async () => {
  const el = (await fixture(
    html`<lr-typing-indicator variant="cursor"></lr-typing-indicator>`,
  )) as LyraTypingIndicator;
  expect(el.shadowRoot!.querySelectorAll('[part="dot"]').length).to.equal(0);
  expect((el.shadowRoot!.querySelector('[part="pulse"]')) == null).to.be.true;
  expect(el.shadowRoot!.querySelector('[part="cursor"]')).to.exist;
});

it('swaps the rendered shape when variant changes on an already-mounted instance', async () => {
  const el = (await fixture(html`<lr-typing-indicator></lr-typing-indicator>`)) as LyraTypingIndicator;
  expect(el.shadowRoot!.querySelectorAll('[part="dot"]').length).to.equal(3);
  expect((el.shadowRoot!.querySelector('[part="pulse"]')) == null).to.be.true;
  expect((el.shadowRoot!.querySelector('[part="cursor"]')) == null).to.be.true;

  el.variant = 'pulse';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="dot"]').length).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="pulse"]')).to.exist;
  expect((el.shadowRoot!.querySelector('[part="cursor"]')) == null).to.be.true;

  el.variant = 'cursor';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="dot"]').length).to.equal(0);
  expect((el.shadowRoot!.querySelector('[part="pulse"]')) == null).to.be.true;
  expect(el.shadowRoot!.querySelector('[part="cursor"]')).to.exist;
});

it('gives every variant a looping animation that is disabled under reduced motion', async () => {
  await setReducedMotion('no-preference');
  try {
    const variants = [
      ['dots', 'dot', 'lr-typing-dot-bounce'],
      ['pulse', 'pulse', 'lr-typing-pulse'],
      ['cursor', 'cursor', 'lr-typing-cursor-blink'],
    ] as const;
    const shapes: HTMLElement[] = [];
    for (const [variant, part, animationName] of variants) {
      const el = (await fixture(
        html`<lr-typing-indicator variant=${variant}></lr-typing-indicator>`,
      )) as LyraTypingIndicator;
      const shape = el.shadowRoot!.querySelector<HTMLElement>(`[part="${part}"]`)!;
      shapes.push(shape);
      const fullMotion = getComputedStyle(shape);
      expect(fullMotion.animationName, variant).to.equal(animationName);
      expect(fullMotion.animationIterationCount, variant).to.equal('infinite');
    }

    await setReducedMotion('reduce');
    expect(matchMedia('(prefers-reduced-motion: reduce)').matches).to.equal(true);
    for (const shape of shapes) {
      const reducedMotion = getComputedStyle(shape);
      expect(reducedMotion.animationName).to.equal('none');
      expect(reducedMotion.opacity).to.equal('1');
      expect(reducedMotion.transform).to.equal('none');
    }
  } finally {
    await setReducedMotion('no-preference');
  }
});

it('does not dispatch any lr-* events (purely presentational)', async () => {
  const el = (await fixture(html`<lr-typing-indicator></lr-typing-indicator>`)) as LyraTypingIndicator;
  let sawEvent = false;
  el.addEventListener('lr-typing-indicator-change', () => (sawEvent = true));
  el.variant = 'pulse';
  await el.updateComplete;
  el.size = 's';
  await el.updateComplete;
  expect(sawEvent).to.be.false;
});

it('is accessible in the default (dots) state', async () => {
  const el = (await fixture(html`<lr-typing-indicator></lr-typing-indicator>`)) as LyraTypingIndicator;
  await expect(el).to.be.accessible();
});

it('is accessible in the pulse and cursor states', async () => {
  const pulse = (await fixture(
    html`<lr-typing-indicator variant="pulse" label="Generating response…"></lr-typing-indicator>`,
  )) as LyraTypingIndicator;
  await expect(pulse).to.be.accessible();

  const cursor = (await fixture(
    html`<lr-typing-indicator variant="cursor" size="s"></lr-typing-indicator>`,
  )) as LyraTypingIndicator;
  await expect(cursor).to.be.accessible();
});

describe('ambient transition token', () => {
  it('dots variant bounce animation uses the ambient token, with staggered delays scaled to it', async () => {
    const el = (await fixture(html`<lr-typing-indicator variant="dots"></lr-typing-indicator>`)) as LyraTypingIndicator;
    const dots = el.shadowRoot!.querySelectorAll('[part="dot"]');
    expect(getComputedStyle(dots[0]).animationDuration).to.equal('1.8s');
    expect(getComputedStyle(dots[1]).animationDelay).to.equal('0.6s');
    expect(getComputedStyle(dots[2]).animationDelay).to.equal('1.2s');
  });

  it('pulse variant uses the ambient token', async () => {
    const el = (await fixture(html`<lr-typing-indicator variant="pulse"></lr-typing-indicator>`)) as LyraTypingIndicator;
    const pulse = el.shadowRoot!.querySelector('[part="pulse"]') as HTMLElement;
    expect(getComputedStyle(pulse).animationDuration).to.equal('1.8s');
  });

  it('cursor variant uses the ambient token', async () => {
    const el = (await fixture(html`<lr-typing-indicator variant="cursor"></lr-typing-indicator>`)) as LyraTypingIndicator;
    const cursor = el.shadowRoot!.querySelector('[part="cursor"]') as HTMLElement;
    expect(getComputedStyle(cursor).animationDuration).to.equal('1.8s');
  });
});

describe('dedicated duration token', () => {
  it('defaults --lr-typing-duration through the --lr-transition-ambient alias to 1.8s (unset regression)', async () => {
    const el = (await fixture(html`<lr-typing-indicator variant="dots"></lr-typing-indicator>`)) as LyraTypingIndicator;
    const dots = el.shadowRoot!.querySelectorAll('[part="dot"]');
    expect(getComputedStyle(dots[0]).animationDuration).to.equal('1.8s');
  });

  it('honors a --lr-typing-duration override on the host for every variant', async () => {
    const dots = (await fixture(
      html`<lr-typing-indicator variant="dots" style="--lr-typing-duration: 0.9s ease-in-out;"></lr-typing-indicator>`,
    )) as LyraTypingIndicator;
    expect(getComputedStyle(dots.shadowRoot!.querySelector('[part="dot"]')!).animationDuration).to.equal('0.9s');

    const pulse = (await fixture(
      html`<lr-typing-indicator variant="pulse" style="--lr-typing-duration: 0.9s ease-in-out;"></lr-typing-indicator>`,
    )) as LyraTypingIndicator;
    expect(getComputedStyle(pulse.shadowRoot!.querySelector('[part="pulse"]')!).animationDuration).to.equal('0.9s');

    const cursor = (await fixture(
      html`<lr-typing-indicator variant="cursor" style="--lr-typing-duration: 0.9s ease-in-out;"></lr-typing-indicator>`,
    )) as LyraTypingIndicator;
    expect(getComputedStyle(cursor.shadowRoot!.querySelector('[part="cursor"]')!).animationDuration).to.equal('0.9s');
  });

  it('still honors a --lr-transition-ambient override on the host (the alias source, not severed)', async () => {
    const el = (await fixture(
      html`<lr-typing-indicator variant="dots" style="--lr-transition-ambient: 3s ease-in-out;"></lr-typing-indicator>`,
    )) as LyraTypingIndicator;
    const dot = el.shadowRoot!.querySelector('[part="dot"]') as HTMLElement;
    expect(getComputedStyle(dot).animationDuration).to.equal('3s');
  });

  it('keeps a direct duration override from bypassing reduced motion', async () => {
    await setReducedMotion('no-preference');
    try {
      const el = (await fixture(
        html`<lr-typing-indicator
          variant="dots"
          style="--lr-typing-duration: 0.9s ease-in-out;"
        ></lr-typing-indicator>`,
      )) as LyraTypingIndicator;
      const dot = el.shadowRoot!.querySelector<HTMLElement>('[part="dot"]')!;
      expect(getComputedStyle(dot).animationName).to.equal('lr-typing-dot-bounce');

      await setReducedMotion('reduce');
      expect(matchMedia('(prefers-reduced-motion: reduce)').matches).to.equal(true);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      expect(getComputedStyle(dot).animationName).to.equal('none');
    } finally {
      await setReducedMotion('no-preference');
    }
  });
});

describe('themeable stagger delays', () => {
  it('defaults dot stagger delays to 600ms/1200ms', async () => {
    const el = (await fixture(html`<lr-typing-indicator variant="dots"></lr-typing-indicator>`)) as LyraTypingIndicator;
    const dots = el.shadowRoot!.querySelectorAll('[part="dot"]');
    expect(getComputedStyle(dots[1]).animationDelay).to.equal('0.6s');
    expect(getComputedStyle(dots[2]).animationDelay).to.equal('1.2s');
  });

  it('honors --lr-typing-dot-stagger-1/-2 overrides', async () => {
    const el = (await fixture(
      html`<lr-typing-indicator
        variant="dots"
        style="--lr-typing-dot-stagger-1: 300ms; --lr-typing-dot-stagger-2: 600ms;"
      ></lr-typing-indicator>`,
    )) as LyraTypingIndicator;
    const dots = el.shadowRoot!.querySelectorAll('[part="dot"]');
    expect(getComputedStyle(dots[1]).animationDelay).to.equal('0.3s');
    expect(getComputedStyle(dots[2]).animationDelay).to.equal('0.6s');
  });
});
