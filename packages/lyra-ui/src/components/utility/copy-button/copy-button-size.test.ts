import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { forceCoarsePointer } from '../../../../test/coarse-pointer-media.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraSize } from '../../../internal/variants.js';
import type { LyraCopyButton } from './copy-button.js';
import './copy-button.js';

function trigger(el: LyraCopyButton): HTMLElement {
  return el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
}

function control(el: LyraCopyButton): HTMLButtonElement {
  return trigger(el).shadowRoot!.querySelector<HTMLButtonElement>('[part~="button"]')!;
}

function expectBox(el: LyraCopyButton, size: number): void {
  const rect = control(el).getBoundingClientRect();
  expect(rect.width, 'native control width').to.equal(size);
  expect(rect.height, 'native control height').to.equal(size);
}

describe('lr-copy-button optional size', () => {
  it('preserves the unset footprint, inherited glyph font, and ancestor hit-area override', async () => {
    const el = await fixture<LyraCopyButton>(html`<lr-copy-button style="font-size: 19px" value="metadata"></lr-copy-button>`);
    expect(el.size).to.equal(undefined);
    expect(el.hasAttribute('size')).to.equal(false);
    expectBox(el, 36);
    expect(getComputedStyle(control(el)).fontSize).to.equal('19px');

    el.style.setProperty('--lr-icon-button-size-scope', '1.5rem');
    expectBox(el, 24);
    el.size = 'xl';
    await el.updateComplete;
    expectBox(el, 56);
    el.size = undefined;
    await el.updateComplete;
    expect(el.hasAttribute('size')).to.equal(false);
    expectBox(el, 24);
    expect(getComputedStyle(control(el)).fontSize).to.equal('19px');
  });

  const tiers: readonly (readonly [LyraSize, number, number])[] = [
    ['2xs', 20, 10], ['xs', 24, 12], ['s', 32, 13], ['m', 36, 14],
    ['l', 40, 18], ['xl', 56, 20], ['small', 32, 13],
    ['medium', 36, 14], ['large', 40, 18],
  ];
  for (const [size, pixels, fontSize] of tiers) {
    it(`reflects ${size} and renders the shared height and glyph font`, async () => {
      const el = await fixture<LyraCopyButton>(html`<lr-copy-button .size=${size} value="metadata"></lr-copy-button>`);
      expect(el.size).to.equal(size);
      expect(el.getAttribute('size')).to.equal(size);
      expectBox(el, pixels);
      expect(getComputedStyle(control(el)).fontSize).to.equal(`${fontSize}px`);
      const glyph = el.shadowRoot!.querySelector<SVGElement>('[part="copy-icon"] svg')!;
      expect(glyph.getBoundingClientRect().width, 'fallback glyph follows the tier font').to.equal(fontSize);
    });
  }

  it('accepts a size attribute and restores the original footprint when it is removed', async () => {
    const el = await fixture<LyraCopyButton>(html`<lr-copy-button size="xs" value="metadata"></lr-copy-button>`);
    expect(el.size).to.equal('xs');
    expectBox(el, 24);
    el.removeAttribute('size');
    await el.updateComplete;
    expect(el.size).to.equal(undefined);
    expectBox(el, 36);
  });

  it('normalizes unsupported attributes and property writes back to the unset geometry', async () => {
    const el = await fixture<LyraCopyButton>(html`<lr-copy-button size="huge" value="metadata"></lr-copy-button>`);
    expect(el.size).to.equal(undefined);
    expect(el.hasAttribute('size')).to.equal(false);
    expectBox(el, 36);
    for (const value of ['', 'huge', null, 123, {}]) {
      el.size = 'xs';
      await el.updateComplete;
      el.size = value as LyraSize;
      await el.updateComplete;
      expect(el.size).to.equal(undefined);
      expect(el.hasAttribute('size')).to.equal(false);
      expectBox(el, 36);
    }
    el.size = 'xl';
    await el.updateComplete;
    el.setAttribute('size', 'huge');
    await el.updateComplete;
    expect(el.size).to.equal(undefined);
    expect(el.hasAttribute('size')).to.equal(false);
    expectBox(el, 36);
  });

  it('keeps shared tier heights, font sizes and radii live while retaining icon-button overrides', async () => {
    const el = await fixture<LyraCopyButton>(html`
      <lr-copy-button data-lr-theme-scope size="xs" value="metadata" style="--lr-theme-form-control-height-xs: 1.75rem; --lr-theme-font-size-xs: 0.6875rem; --lr-theme-form-control-radius: 7px"></lr-copy-button>
    `);
    expectBox(el, 28);
    expect(getComputedStyle(control(el)).fontSize).to.equal('11px');
    expect(getComputedStyle(control(el)).borderTopLeftRadius).to.equal('7px');
    el.style.setProperty('--lr-theme-form-control-height-xs', '1.875rem');
    expectBox(el, 30);
    el.style.setProperty('--lr-icon-button-radius', '9px');
    expect(getComputedStyle(control(el)).borderTopLeftRadius).to.equal('9px');
  });

  it('allows a larger custom glyph to grow beyond the selected tier floor', async () => {
    const el = await fixture<LyraCopyButton>(html`
      <lr-copy-button size="2xs" value="metadata"><span slot="copy-icon" style="display: block; inline-size: 5rem; block-size: 3rem"></span></lr-copy-button>
    `);
    expect(control(el).getBoundingClientRect().width).to.equal(80);
    expect(control(el).getBoundingClientRect().height).to.equal(48);
  });

  for (const [size, pixels] of tiers) {
    it(`retains the coarse-pointer hit-area floor for ${size}`, async () => {
      const el = await fixture<LyraCopyButton>(html`<lr-copy-button .size=${size} value="metadata"></lr-copy-button>`);
      expectBox(el, pixels);
      // The copy host owns the shared size ladder's media rules. Its resolved height crosses
      // into the child through the scope input, so forcing this sheet exercises the real floor.
      const restoreParent = forceCoarsePointer(el);
      try {
        expectBox(el, Math.max(pixels, 44));
      } finally {
        restoreParent();
      }
    });
  }

  it('leaves custom trigger geometry and naming under the caller’s control', async () => {
    const el = await fixture<LyraCopyButton>(html`
      <lr-copy-button size="2xs" value="metadata" style="font-size: 19px">
        <button style="inline-size: 7rem; block-size: 3rem; font-size: inherit" aria-label="Copy reference">Copy</button>
      </lr-copy-button>
    `);
    await waitUntil(() => el.shadowRoot!.querySelector('[part~="base"]') === null);
    const custom = el.querySelector('button')!;
    expect(custom.getBoundingClientRect().width).to.equal(112);
    expect(custom.getBoundingClientRect().height).to.equal(48);
    expect(getComputedStyle(custom).fontSize).to.equal('19px');
    expect(custom.getAttribute('aria-label')).to.equal('Copy reference');
    el.size = 'xl';
    await el.updateComplete;
    expect(custom.getBoundingClientRect().width).to.equal(112);
    expect(custom.getBoundingClientRect().height).to.equal(48);
    expect(getComputedStyle(custom).fontSize).to.equal('19px');
  });

  it('keeps localized naming, focused keyboard copy and disabled gating at the smallest tier', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const writes: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (text: string) => { writes.push(text); return Promise.resolve(); } },
    });
    try {
      const el = await fixture<LyraCopyButton>(html`
        <lr-copy-button size="2xs" tooltip="none" value="metadata" .strings=${{ copy: 'Copy reference', copied: 'Reference copied' }}></lr-copy-button>
      `);
      expect(control(el).getAttribute('aria-label')).to.equal('Copy reference');
      await focusByKeyboard(trigger(el));
      expect(trigger(el).shadowRoot!.activeElement === control(el)).to.equal(true);
      const copied = oneEvent(el, 'lr-copy');
      await sendKeys({ press: 'Enter' });
      await copied;
      await el.updateComplete;
      await waitUntil(() => control(el).getAttribute('aria-label') === 'Reference copied');
      expect(writes).to.deep.equal(['metadata']);
      expectBox(el, 20);
      await expect(el).to.be.accessible();
      el.disabled = true;
      await el.updateComplete;
      expect(control(el).disabled).to.equal(true);
      el.click();
      expect(writes).to.deep.equal(['metadata']);
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });
});
