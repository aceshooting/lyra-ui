import { fixture, expect, html } from '@open-wc/testing';
import { LitElement, css } from 'lit';
import { tag } from './prefix.js';
import { sizes } from './sizes.styles.js';
import { tokens } from './tokens.styles.js';
import { palette } from './tokens/palette.styles.js';
import { forceCoarsePointer } from '../../test/coarse-pointer-media.js';

const boxStyles = css`
  [part='box'] {
    display: block;
    block-size: var(--lr-form-control-height);
  }
`;

/**
 * A minimal ladder consumer: `[part="box"]` renders at `--lr-form-control-height`, mirroring how
 * every real ladder consumer (`lr-button`, `lr-input`, `lr-select`, ...) points its own
 * `--lr-<name>-min-height` at that one shared knob. Kept in this internal test file rather than
 * added to a real component's own test file, since `sizes.styles.ts` -- not any one consumer -- is
 * what this task (0.10, size-ladder extension) owns.
 */
class SizeLadderProbe extends LitElement {
  static override styles = [palette, tokens, sizes, boxStyles];
  static override properties = { size: { type: String, reflect: true } };
  declare size?: string;
  override render() {
    return html`<div part="box"></div>`;
  }
}
customElements.define(tag('size-ladder-probe'), SizeLadderProbe);

// This probe composes BOTH tokens.styles.ts's baseTokens (--lr-icon-button-size) and
// sizes.styles.ts (--lr-form-control-height), each with its own copy of the coarse-pointer rule --
// exactly why the shared `forceCoarsePointer` helper (test/coarse-pointer-media.ts) forces every
// matching rule it finds, not just the first.

const TIERS = [
  { size: '2xs', px: 20 },
  { size: 'xs', px: 24 },
  { size: 's', px: 32 },
  { size: 'small', px: 32 },
  { size: 'medium', px: 36 },
  { size: 'l', px: 40 },
  { size: 'large', px: 40 },
  { size: 'xl', px: 56 },
] as const;

it('renders the default Shadcn height ladder and its tier aliases with no coarse pointer', async () => {
  for (const tier of TIERS) {
    const el = (await fixture(
      html`<lr-size-ladder-probe size=${tier.size}></lr-size-ladder-probe>`,
    )) as SizeLadderProbe;
    const box = el.shadowRoot!.querySelector('[part="box"]') as HTMLElement;
    expect(getComputedStyle(box).blockSize, `size=${tier.size}`).to.equal(`${tier.px}px`);
  }
});

it('renders the unset medium Shadcn height with no coarse pointer', async () => {
  const el = (await fixture(html`<lr-size-ladder-probe></lr-size-ladder-probe>`)) as SizeLadderProbe;
  const box = el.shadowRoot!.querySelector('[part="box"]') as HTMLElement;
  expect(getComputedStyle(box).blockSize).to.equal('36px');
});

it('floors every tier at the platform touch-target size under a coarse pointer', async () => {
  // Every tier below 44px grows; the 56px xl tier remains above the touch floor.
  for (const tier of TIERS) {
    const el = (await fixture(
      html`<lr-size-ladder-probe size=${tier.size}></lr-size-ladder-probe>`,
    )) as SizeLadderProbe;
    const box = el.shadowRoot!.querySelector('[part="box"]') as HTMLElement;
    const restore = forceCoarsePointer(el);
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      expect(getComputedStyle(box).blockSize, `size=${tier.size}`).to.equal(
        `${Math.max(tier.px, 44)}px`,
      );
    } finally {
      restore();
    }
  }
});

it('floors the unset (m) default at the platform touch-target size under a coarse pointer', async () => {
  const el = (await fixture(html`<lr-size-ladder-probe></lr-size-ladder-probe>`)) as SizeLadderProbe;
  const box = el.shadowRoot!.querySelector('[part="box"]') as HTMLElement;
  const restore = forceCoarsePointer(el);
  try {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(getComputedStyle(box).blockSize).to.equal('44px');
  } finally {
    restore();
  }
});
