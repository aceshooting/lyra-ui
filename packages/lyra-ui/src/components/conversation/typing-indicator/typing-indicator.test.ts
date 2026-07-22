import { fixture, expect, html } from '@open-wc/testing';
import './typing-indicator.js';
import type { LyraTypingIndicator } from './typing-indicator.js';
import { styles } from './typing-indicator.styles.js';

it('defaults to the dots variant, md size, and a "Thinking…" label', async () => {
  const el = (await fixture(html`<lr-typing-indicator></lr-typing-indicator>`)) as LyraTypingIndicator;
  expect(el.variant).to.equal('dots');
  expect(el.size).to.equal('md');
  expect(el.label).to.equal('Thinking…');
});

it('reflects variant and size onto the host attributes', async () => {
  const el = (await fixture(
    html`<lr-typing-indicator variant="pulse" size="sm"></lr-typing-indicator>`,
  )) as LyraTypingIndicator;
  expect(el.getAttribute('variant')).to.equal('pulse');
  expect(el.getAttribute('size')).to.equal('sm');

  el.variant = 'cursor';
  el.size = 'md';
  await el.updateComplete;
  expect(el.getAttribute('variant')).to.equal('cursor');
  expect(el.getAttribute('size')).to.equal('md');
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
  expect(srText).to.exist;
  expect(srText!.textContent).to.equal('Working on it…');
});

it('marks the decorative shape aria-hidden and renders three dots for the dots variant', async () => {
  const el = (await fixture(html`<lr-typing-indicator></lr-typing-indicator>`)) as LyraTypingIndicator;
  const base = el.shadowRoot!.querySelector('[part="base"]');
  expect(base).to.exist;
  expect(base!.getAttribute('aria-hidden')).to.equal('true');
  expect(el.shadowRoot!.querySelectorAll('[part="dot"]').length).to.equal(3);
  expect(el.shadowRoot!.querySelector('[part="pulse"]')).to.not.exist;
  expect(el.shadowRoot!.querySelector('[part="cursor"]')).to.not.exist;
});

it('renders a single pulse element for the pulse variant', async () => {
  const el = (await fixture(
    html`<lr-typing-indicator variant="pulse"></lr-typing-indicator>`,
  )) as LyraTypingIndicator;
  expect(el.shadowRoot!.querySelectorAll('[part="dot"]').length).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="pulse"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="cursor"]')).to.not.exist;
});

it('renders a single cursor element for the cursor variant', async () => {
  const el = (await fixture(
    html`<lr-typing-indicator variant="cursor"></lr-typing-indicator>`,
  )) as LyraTypingIndicator;
  expect(el.shadowRoot!.querySelectorAll('[part="dot"]').length).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="pulse"]')).to.not.exist;
  expect(el.shadowRoot!.querySelector('[part="cursor"]')).to.exist;
});

it('swaps the rendered shape when variant changes on an already-mounted instance', async () => {
  const el = (await fixture(html`<lr-typing-indicator></lr-typing-indicator>`)) as LyraTypingIndicator;
  expect(el.shadowRoot!.querySelectorAll('[part="dot"]').length).to.equal(3);
  expect(el.shadowRoot!.querySelector('[part="pulse"]')).to.not.exist;
  expect(el.shadowRoot!.querySelector('[part="cursor"]')).to.not.exist;

  el.variant = 'pulse';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="dot"]').length).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="pulse"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="cursor"]')).to.not.exist;

  el.variant = 'cursor';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="dot"]').length).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="pulse"]')).to.not.exist;
  expect(el.shadowRoot!.querySelector('[part="cursor"]')).to.exist;
});

it('gives every variant a looping animation that is disabled under reduced motion', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.include("animation: lr-typing-dot-bounce var(--lr-typing-duration) infinite;");
  expect(css).to.include("animation: lr-typing-pulse var(--lr-typing-duration) infinite;");
  expect(css).to.include("animation: lr-typing-cursor-blink var(--lr-typing-duration) infinite;");
  expect(css).to.match(/@media \(prefers-reduced-motion: reduce\) \{[^}]*animation: none !important;/);
});

it('does not dispatch any lr-* events (purely presentational)', async () => {
  const el = (await fixture(html`<lr-typing-indicator></lr-typing-indicator>`)) as LyraTypingIndicator;
  let sawEvent = false;
  el.addEventListener('lr-typing-indicator-change', () => (sawEvent = true));
  el.variant = 'pulse';
  await el.updateComplete;
  el.size = 'sm';
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
    html`<lr-typing-indicator variant="cursor" size="sm"></lr-typing-indicator>`,
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

  it('keeps the reduced-motion override intact (branch unaffected by the new token)', () => {
    // The centralized `@media (prefers-reduced-motion: reduce)` override in
    // tokens.styles.ts collapses --lr-transition-ambient itself, and this
    // component's own reduced-motion rule below unconditionally forces
    // `animation: none`, regardless of --lr-typing-duration. There is no way
    // to force the browser's actual prefers-reduced-motion media feature from
    // inside a wtr test (no launcher/browser-context option is configured for
    // it in this repo -- see spinner.test.ts/progress.test.ts for the same
    // stylesheet-level assertion pattern used for a pure-CSS reduced-motion
    // branch), so this asserts the override rule is still present verbatim.
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/@media \(prefers-reduced-motion: reduce\) \{[^}]*animation: none !important;/);
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
