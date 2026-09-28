import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { css } from 'lit';
import { LyraElement } from '../internal/lyra-element.js';
import { tag } from '../internal/prefix.js';
import { applyLyraPreferences, getLyraPreferences, lyraPreferenceAttributes } from './preferences.js';
import { applyLyraStyleScope } from './theme.js';
import { setReducedMotion } from '../../test/wtr-media.js';
import '../components/overlays/spinner/spinner.js';
import '../components/media/animated-image/animated-image.js';
import type { LyraSpinner } from '../components/overlays/spinner/spinner.class.js';
import type { LyraAnimatedImage } from '../components/media/animated-image/animated-image.class.js';

class PreferenceProbe extends LyraElement {
  static override styles = [LyraElement.styles, css`
    :host { color: var(--lr-color-text); background: var(--lr-color-surface); }
    .quiet { color: var(--lr-color-text-quiet); }
    .control { border: 1px solid var(--lr-color-border); outline: var(--lr-focus-ring); }
    .transition { transition: opacity var(--lr-transition-base); }
  `];
  override render() {
    return html`<span class="normal">Normal</span><span class="quiet">Quiet</span>
      <span class="control">Control</span><span class="transition">Transition</span>`;
  }
}
customElements.define(tag('preference-probe'), PreferenceProbe);

describe('independent accessibility preferences', () => {
  let sheets: CSSStyleSheet[];
  let previous: CSSStyleSheet[];
  before(async () => {
    sheets = await Promise.all(['../theme.css', '../preferences.css', '../looks/material.css', '../looks/shadcn.css', '../styles/tokens-root.css'].map(async path => {
      const response = await fetch(new URL(path, import.meta.url));
      if (!response.ok) throw new Error(`Missing preference fixture: ${path}`);
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(await response.text());
      return sheet;
    }));
  });
  beforeEach(async () => {
    previous = document.adoptedStyleSheets;
    document.adoptedStyleSheets = [...previous, ...sheets];
    await setReducedMotion('no-preference');
  });
  afterEach(async () => {
    document.adoptedStyleSheets = previous;
    await setReducedMotion('no-preference');
  });

  it('serializes sparse server attributes and validates before making any changes', () => {
    expect(lyraPreferenceAttributes({ motion: 'reduce' })).to.deep.equal({ 'data-lr-motion': 'reduce' });
    const scope = document.createElement('section');
    scope.setAttribute('data-lr-contrast', 'system');
    expect(() => applyLyraPreferences(scope, { contrast: 'more', motion: 'full' as 'reduce' })).to.throw(TypeError);
    expect(scope.getAttribute('data-lr-contrast')).to.equal('system');
    expect(scope.hasAttribute('data-lr-motion')).to.equal(false);
  });

  it('restores owned values while retaining a later application write and the five style axes', () => {
    const scope = document.createElement('section');
    scope.setAttribute('data-lr-motion', 'system');
    scope.setAttribute('data-lr-look', 'shadcn');
    applyLyraPreferences(scope, { contrast: 'more', motion: 'reduce' });
    applyLyraPreferences(scope, { motion: 'reduce' });
    expect(scope.hasAttribute('data-lr-contrast')).to.equal(false);
    applyLyraPreferences(scope, null);
    expect(scope.getAttribute('data-lr-motion')).to.equal('system');
    applyLyraPreferences(scope, { motion: 'reduce' });
    scope.setAttribute('data-lr-motion', 'application');
    applyLyraPreferences(scope, null);
    expect(scope.getAttribute('data-lr-motion')).to.equal('application');
    expect(scope.getAttribute('data-lr-look')).to.equal('shadcn');
  });

  for (const look of ['lyra', 'material', 'shadcn'] as const) {
    for (const mode of ['light', 'dark'] as const) {
      it(`strengthens ${look}/${mode} chrome, preserves a wider authored ring, and restores unset styling`, async () => {
        const scope = await fixture<HTMLElement>(html`<section><lr-preference-probe></lr-preference-probe></section>`);
        applyLyraStyleScope(scope, { look, mode });
        const probe = scope.querySelector<PreferenceProbe>('lr-preference-probe')!;
        await probe.updateComplete;
        const normal = probe.shadowRoot!.querySelector<HTMLElement>('.normal')!;
        const quiet = probe.shadowRoot!.querySelector<HTMLElement>('.quiet')!;
        const control = probe.shadowRoot!.querySelector<HTMLElement>('.control')!;
        const original = { quiet: getComputedStyle(quiet).color, border: getComputedStyle(control).borderTopColor, focus: getComputedStyle(control).outlineWidth };
        try {
          applyLyraPreferences(scope, { contrast: 'more' });
          expect(getComputedStyle(quiet).color).to.equal(getComputedStyle(normal).color);
          expect(getComputedStyle(control).borderTopColor).to.equal(getComputedStyle(normal).color);
          expect(Number.parseFloat(getComputedStyle(control).outlineWidth)).to.be.at.least(3);
          probe.style.setProperty('--lr-theme-focus-ring-width', '5px');
          expect(getComputedStyle(control).outlineWidth).to.equal('5px');
          probe.style.removeProperty('--lr-theme-focus-ring-width');
          applyLyraPreferences(scope, null);
          expect(getComputedStyle(quiet).color).to.equal(original.quiet);
          expect(getComputedStyle(control).borderTopColor).to.equal(original.border);
          expect(getComputedStyle(control).outlineWidth).to.equal(original.focus);
        } finally {
          applyLyraPreferences(scope, null);
          applyLyraStyleScope(scope, null);
        }
      });
    }
  }

  it('inherits preferences through shadows while a local system scope resumes the OS floor', async () => {
    const scope = await fixture<HTMLElement>(html`<section><div></div></section>`);
    const host = scope.firstElementChild!;
    const root = host.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [sheets[1]!];
    const child = document.createElement(tag('preference-probe')) as PreferenceProbe;
    root.append(child);
    await child.updateComplete;
    applyLyraPreferences(scope, { contrast: 'more', motion: 'reduce' });
    expect(getLyraPreferences(child).reducedMotion).to.equal(true);
    const transition = child.shadowRoot!.querySelector('.transition')!;
    expect(Number.parseFloat(getComputedStyle(transition).transitionDuration)).to.be.lessThan(0.001);
    applyLyraPreferences(child, { contrast: 'system', motion: 'system' });
    expect(getLyraPreferences(child).reducedMotion).to.equal(false);
    expect(Number.parseFloat(getComputedStyle(transition).transitionDuration)).to.be.greaterThan(0.001);
    await setReducedMotion('reduce');
    expect(getLyraPreferences(child).reducedMotion).to.equal(true);
    expect(Number.parseFloat(getComputedStyle(transition).transitionDuration)).to.be.lessThan(0.001);
  });

  it('rederives application outputs in a nested look and restores a local system preference', async () => {
    const outer = await fixture<HTMLElement>(html`<section>
      <section style="color:var(--lr-color-text)">
        <span class="quiet" style="color:var(--lr-color-text-quiet)">Quiet</span>
        <button style="color:var(--lr-color-text);border:1px solid var(--lr-color-border);outline:var(--lr-focus-ring);transition:opacity var(--lr-transition-base)">Action</button>
      </section>
    </section>`);
    const inner = outer.firstElementChild as HTMLElement;
    applyLyraStyleScope(outer, { look: 'shadcn', mode: 'dark' });
    applyLyraStyleScope(inner, { look: 'material', mode: 'light' });
    const quiet = inner.querySelector('.quiet')!;
    const control = inner.querySelector('button')!;
    const baseline = { quiet: getComputedStyle(quiet).color, border: getComputedStyle(control).borderTopColor, duration: getComputedStyle(control).transitionDuration };
    try {
      applyLyraPreferences(outer, { contrast: 'more', motion: 'reduce' });
      expect(getComputedStyle(quiet).color).to.equal(getComputedStyle(inner).color);
      expect(getComputedStyle(control).borderTopColor).to.equal(getComputedStyle(inner).color);
      expect(Number.parseFloat(getComputedStyle(control).outlineWidth)).to.be.at.least(3);
      expect(Number.parseFloat(getComputedStyle(control).transitionDuration)).to.be.lessThan(0.001);
      applyLyraPreferences(inner, { contrast: 'system', motion: 'system' });
      expect(getComputedStyle(quiet).color).to.equal(baseline.quiet);
      expect(getComputedStyle(control).borderTopColor).to.equal(baseline.border);
      expect(getComputedStyle(control).transitionDuration).to.equal(baseline.duration);
      await setReducedMotion('reduce');
      expect(Number.parseFloat(getComputedStyle(control).transitionDuration)).to.be.lessThan(0.001);
    } finally {
      applyLyraPreferences(inner, null);
      applyLyraPreferences(outer, null);
      applyLyraStyleScope(inner, null);
      applyLyraStyleScope(outer, null);
    }
  });

  it('does not overwrite inherited authored theme inputs at a preference-only boundary', async () => {
    const outer = await fixture<HTMLElement>(html`<section style="--lr-theme-color-text-normal:rgb(17,23,29);--lr-theme-focus-ring-width:5px">
      <section data-lr-motion="system" style="color:var(--lr-color-text)">
        <span style="color:var(--lr-color-text-quiet);outline:var(--lr-focus-ring)">Quiet</span>
      </section>
    </section>`);
    const inner = outer.firstElementChild as HTMLElement;
    const text = inner.firstElementChild!;
    expect(getComputedStyle(inner).color).to.equal('rgb(17, 23, 29)');
    applyLyraPreferences(inner, { contrast: 'more' });
    expect(getComputedStyle(text).color).to.equal('rgb(17, 23, 29)');
    expect(getComputedStyle(text).outlineWidth).to.equal('5px');
    applyLyraPreferences(inner, null);
    expect(getComputedStyle(inner).color).to.equal('rgb(17, 23, 29)');
  });

  it('stops CSS loops and an already-playing image when an ancestor opts into reduction', async () => {
    const scope = await fixture<HTMLElement>(html`<section>
      <lr-spinner></lr-spinner><lr-animated-image play></lr-animated-image>
    </section>`);
    const spinner = scope.querySelector<LyraSpinner>('lr-spinner')!;
    const animated = scope.querySelector<LyraAnimatedImage>('lr-animated-image')!;
    await Promise.all([spinner.updateComplete, animated.updateComplete]);
    const indicator = spinner.shadowRoot!.querySelector('[part~="spinner-indicator"]')!;
    const initialAnimation = getComputedStyle(indicator).animationName;
    expect(animated.playing).to.equal(true);
    applyLyraPreferences(scope, { motion: 'reduce' });
    await waitUntil(() => !animated.playing);
    expect(getComputedStyle(indicator).animationName).to.equal('none');
    applyLyraPreferences(scope, null);
    await waitUntil(() => animated.playing);
    expect(getComputedStyle(indicator).animationName).to.equal(initialAnimation);
    animated.ignoreReducedMotion = true;
    applyLyraPreferences(scope, { motion: 'reduce' });
    await animated.updateComplete;
    expect(animated.playing).to.equal(true);
  });
});
