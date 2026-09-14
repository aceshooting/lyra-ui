import { fixture, expect, html } from '@open-wc/testing';
import { css, LitElement } from 'lit';
import { interactiveTransition } from './interactive-transition.styles.js';
import { tag } from './prefix.js';
import { tokens } from './tokens.styles.js';

// Asserted against rendered results, never against stylesheet text: a `transition` that names an
// undeclared custom property parses, prints perfectly in `cssText`, and then applies to nothing at
// all. `transitionProperty` is read rather than `transitionDuration` throughout, including for the
// negative cases, because the duration is exactly what collapses under `prefers-reduced-motion`:
// tokens.styles.ts flattens every descendant's transition-duration there, so a
// `transitionDuration === '0s'` assertion reads `0.001ms` and fails on a machine (or a CI runner)
// that asks for reduced motion, while the property list is untouched. An element with no
// transition of its own reports the initial `all`, which is what the negative cases assert.

class TransitionProbe extends LitElement {
  static override styles = [tokens, interactiveTransition];
  override render() {
    return html`<button part="base">go</button><span class="unnamed">plain</span>`;
  }
}
customElements.define(tag('interactive-transition-probe'), TransitionProbe);

/**
 * The same probe with a rule of its own placed BEFORE the shared sheet, which is the only ordering
 * that tests what this sheet claims. With the component rule last it wins on cascade order whatever
 * the selectors are, so the assertion would stay green with `:where()` deleted — proving nothing
 * about the zero specificity the sheet's whole safety argument rests on. Ordered this way, only the
 * `:where()` wrapper keeps `[part='base']` (0,1,0) ahead of a later `[part]` rule it would
 * otherwise tie with and lose to.
 */
class OverridingProbe extends LitElement {
  static override styles = [
    tokens,
    css`
      [part='base'] {
        transition: opacity var(--lr-transition-fast);
      }
    `,
    interactiveTransition,
  ];
  override render() {
    return html`<button part="base">go</button>`;
  }
}
customElements.define(tag('interactive-transition-override-probe'), OverridingProbe);

/** A component that never adopts the sheet: the unset-regression control. */
class UnadoptedProbe extends LitElement {
  static override styles = [tokens];
  override render() {
    return html`<button part="base">go</button>`;
  }
}
customElements.define(tag('interactive-transition-unadopted-probe'), UnadoptedProbe);

const transitionedProperties = (node: Element) =>
  getComputedStyle(node)
    .transitionProperty.split(',')
    .map((property) => property.trim());

describe('the shared interactive-transition sheet', () => {
  it('eases fill, text and border colour on every parted element it covers', async () => {
    const el = (await fixture(
      html`<lr-interactive-transition-probe></lr-interactive-transition-probe>`,
    )) as TransitionProbe;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(transitionedProperties(base)).to.deep.equal(['background-color', 'color', 'border-color']);
    expect(getComputedStyle(base).transitionDuration).to.not.equal('0s');
  });

  it('leaves unnamed internal nodes alone, which is why the selector is [part] and not *', async () => {
    const el = (await fixture(
      html`<lr-interactive-transition-probe></lr-interactive-transition-probe>`,
    )) as TransitionProbe;
    await el.updateComplete;
    const unnamed = el.shadowRoot!.querySelector('.unnamed')!;
    expect(transitionedProperties(unnamed)).to.deep.equal(['all']);
  });

  it('carries zero specificity, so a rule the component writes itself wins', async () => {
    const el = (await fixture(
      html`<lr-interactive-transition-override-probe></lr-interactive-transition-override-probe>`,
    )) as OverridingProbe;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(transitionedProperties(base)).to.deep.equal(['opacity']);
  });

  it('changes nothing for a component that does not adopt it', async () => {
    const el = (await fixture(
      html`<lr-interactive-transition-unadopted-probe></lr-interactive-transition-unadopted-probe>`,
    )) as UnadoptedProbe;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(transitionedProperties(base)).to.deep.equal(['all']);
  });
});
