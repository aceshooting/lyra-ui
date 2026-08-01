import { fixture, expect, html } from '@open-wc/testing';
import { LitElement } from 'lit';
import { tag } from '../prefix.js';
import { tokens } from '../tokens.styles.js';
import { palette } from './palette.styles.js';

/** The same two layers, in the same order, that every `LyraElement` adopts. */
class PaletteProbe extends LitElement {
  static styles = [palette, tokens];
  render() {
    return html`<div part="probe"></div>`;
  }
}
customElements.define(tag('palette-probe'), PaletteProbe);

async function probe(markup = html`<lr-palette-probe></lr-palette-probe>`): Promise<PaletteProbe> {
  return (await fixture(markup)) as PaletteProbe;
}

const read = (el: Element, name: string): string => getComputedStyle(el).getPropertyValue(name).trim();

describe('the semantic grid is live, not inert', () => {
  const VARIANTS = ['brand', 'success', 'warning', 'danger', 'neutral'] as const;

  it('resolves every one of the 45 slots to a real colour', async () => {
    const el = await probe();
    const empty: string[] = [];
    for (const variant of VARIANTS) {
      for (const role of ['fill', 'border', 'on'] as const) {
        for (const emphasis of ['quiet', 'normal', 'loud'] as const) {
          const name = `--lr-color-${variant}-${role}-${emphasis}`;
          const value = read(el, name);
          if (!/^(#|rgb)/.test(value)) empty.push(`${name} -> ${JSON.stringify(value)}`);
        }
      }
    }
    expect(empty, empty.join(', ')).to.have.length(0);
  });

  it('resolves each slot through the ramp, so swapping one ramp step moves the slot', async () => {
    // The whole point of a ramp under a grid: a consumer re-points one step and every slot built on
    // it follows. If a slot inlined a literal instead, this would silently keep the old colour.
    const el = await probe();
    const before = read(el, '--lr-color-brand-fill-loud');
    el.style.setProperty('--lr-ramp-brand-50', 'rgb(1, 2, 3)');
    expect(read(el, '--lr-color-brand-fill-loud')).to.not.equal(before);
    expect(read(el, '--lr-color-brand-fill-loud')).to.equal('rgb(1, 2, 3)');
  });

  it('keeps each flat token and its grid slot the same colour', async () => {
    // `--lr-color-brand` and `--lr-color-brand-fill-loud` are two names for one decision. While
    // they resolved independently, migrating a stylesheet from the flat name to the slot silently
    // changed its colour -- which would have made P3's rename a visual regression.
    const el = await probe();
    for (const [flat, slot] of [
      ['--lr-color-brand', '--lr-color-brand-fill-loud'],
      ['--lr-color-brand-quiet', '--lr-color-brand-fill-quiet'],
      ['--lr-color-success', '--lr-color-success-fill-loud'],
      ['--lr-color-warning', '--lr-color-warning-fill-loud'],
      ['--lr-color-danger', '--lr-color-danger-fill-loud'],
      ['--lr-color-on-brand', '--lr-color-brand-on-loud'],
      ['--lr-color-on-danger', '--lr-color-danger-on-loud'],
    ]) {
      expect(read(el, flat), `${flat} vs ${slot}`).to.equal(read(el, slot));
    }
  });
});

describe('dark mode reaches the grid by every documented route', () => {
  it('switches on the host attribute', async () => {
    const light = await probe();
    const dark = await probe(html`<lr-palette-probe data-lr-theme="dark"></lr-palette-probe>`);
    expect(read(dark, '--lr-color-brand-fill-loud')).to.not.equal(read(light, '--lr-color-brand-fill-loud'));
  });

  it('still switches when a light-mode sibling selector would have invalidated the rule', async () => {
    // `:host-context()` ships in one engine of three. While it shared a selector list with
    // `:host([data-lr-theme='dark'])`, the unsupported selector invalidated the whole list and took
    // the dark grid down with it in Firefox and WebKit. Splitting the rules is what this asserts:
    // the attribute route must resolve to the dark value regardless of `:host-context()` support.
    const dark = await probe(html`<lr-palette-probe data-lr-theme="dark"></lr-palette-probe>`);
    for (const variant of ['brand', 'success', 'warning', 'danger', 'neutral']) {
      const value = read(dark, `--lr-color-${variant}-fill-loud`);
      expect(value, variant).to.match(/^(#|rgb)/);
    }
    // Dark `fill-loud` sits at a lighter ramp step than light `fill-loud`, so the two modes must
    // not agree -- a stale light value would otherwise pass the shape check above.
    const light = await probe();
    expect(read(dark, '--lr-color-neutral-fill-loud')).to.not.equal(read(light, '--lr-color-neutral-fill-loud'));
  });

  it('lets a consumer retheme one slot without forking the ramp', async () => {
    const el = await probe();
    el.style.setProperty('--lr-theme-color-brand-fill-loud', 'rgb(4, 5, 6)');
    expect(read(el, '--lr-color-brand-fill-loud')).to.equal('rgb(4, 5, 6)');
    expect(read(el, '--lr-color-brand')).to.equal('rgb(4, 5, 6)');
  });
});
