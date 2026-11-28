import { fixture, expect, html } from '@open-wc/testing';
import '../../lr-icon.js';
import '../../lr-button.js';
import type { LyraIcon } from '../../lr-icon.js';

const matrixOf = (el: Element): number[] => {
  const { transform } = getComputedStyle(el);
  if (transform === 'none') return [1, 0, 0, 1, 0, 0];
  const m = new DOMMatrixReadOnly(transform);
  // `+ 0` folds a rounded `-0` into `0` so deep equality stays engine-neutral.
  return [m.a, m.b, m.c, m.d, m.e, m.f].map((value) => Math.round(value) + 0);
};

const MIRRORED = [-1, 0, 0, 1, 0, 0];
const IDENTITY = [1, 0, 0, 1, 0, 0];

describe('lr-icon flip="rtl"', () => {
  it('leaves the glyph unmirrored in a left-to-right context', async () => {
    const root = await fixture<HTMLDivElement>(html`<div dir="ltr"><lr-icon name="chevron-right" flip="rtl"></lr-icon></div>`);
    const el = root.querySelector<LyraIcon>('lr-icon')!;
    await el.updateComplete;
    expect(el.flip).to.equal('rtl');
    expect(el.getAttribute('flip')).to.equal('rtl');
    expect(matrixOf(el)).to.deep.equal(IDENTITY);
  });

  it('mirrors on the x axis only under an inherited right-to-left direction', async () => {
    const root = await fixture<HTMLDivElement>(html`<div dir="rtl"><section><lr-icon name="chevron-right" flip="rtl"></lr-icon></section></div>`);
    const el = root.querySelector<LyraIcon>('lr-icon')!;
    await el.updateComplete;
    expect(matrixOf(el)).to.deep.equal(MIRRORED);
  });

  it('tracks live direction changes on an ancestor and on the host', async () => {
    const root = await fixture<HTMLDivElement>(html`<div dir="ltr"><lr-icon name="chevron-right" flip="rtl"></lr-icon></div>`);
    const el = root.querySelector<LyraIcon>('lr-icon')!;
    await el.updateComplete;
    expect(matrixOf(el)).to.deep.equal(IDENTITY);

    root.setAttribute('dir', 'rtl');
    expect(matrixOf(el)).to.deep.equal(MIRRORED);

    root.setAttribute('dir', 'ltr');
    expect(matrixOf(el)).to.deep.equal(IDENTITY);

    el.setAttribute('dir', 'rtl');
    expect(matrixOf(el)).to.deep.equal(MIRRORED);

    el.removeAttribute('dir');
    expect(matrixOf(el)).to.deep.equal(IDENTITY);
  });

  it('composes with rotate exactly like a physical x flip in right-to-left', async () => {
    const root = await fixture<HTMLDivElement>(html`
      <div dir="rtl">
        <lr-icon id="rtl" name="chevron-right" flip="rtl" rotate="90"></lr-icon>
        <lr-icon id="x" name="chevron-right" flip="x" rotate="90"></lr-icon>
      </div>
    `);
    const rtl = root.querySelector<LyraIcon>('#rtl')!;
    const physical = root.querySelector<LyraIcon>('#x')!;
    await rtl.updateComplete;
    await physical.updateComplete;
    expect(matrixOf(rtl)).to.deep.equal([0, -1, -1, 0, 0, 0]);
    expect(matrixOf(rtl)).to.deep.equal(matrixOf(physical));

    root.setAttribute('dir', 'ltr');
    // Left-to-right keeps only the rotation.
    expect(matrixOf(rtl)).to.deep.equal([0, 1, -1, 0, 0, 0]);
  });

  it('mirrors an icon slotted at the start of a button under right-to-left', async () => {
    const root = await fixture<HTMLDivElement>(html`
      <div dir="rtl">
        <lr-button><lr-icon slot="start" name="chevron-left" flip="rtl"></lr-icon>Back</lr-button>
      </div>
    `);
    const button = root.querySelector('lr-button')!;
    await (button as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
    const el = root.querySelector<LyraIcon>('lr-icon')!;
    await el.updateComplete;
    expect(el.assignedSlot?.name).to.equal('start');
    expect(matrixOf(el)).to.deep.equal(MIRRORED);

    root.setAttribute('dir', 'ltr');
    expect(matrixOf(el)).to.deep.equal(IDENTITY);
  });

  it('keeps unset and physical flips unchanged, regardless of direction', async () => {
    const root = await fixture<HTMLDivElement>(html`
      <div dir="rtl">
        <lr-icon id="unset" name="chevron-right"></lr-icon>
        <lr-icon id="x" name="chevron-right" flip="x"></lr-icon>
        <lr-icon id="y" name="chevron-right" flip="y"></lr-icon>
      </div>
    `);
    const unset = root.querySelector<LyraIcon>('#unset')!;
    await unset.updateComplete;
    expect(unset.flip).to.equal(undefined);
    expect(unset.hasAttribute('flip')).to.be.false;
    expect(getComputedStyle(unset).transform).to.equal('none');
    expect(matrixOf(root.querySelector('#x')!)).to.deep.equal(MIRRORED);
    expect(matrixOf(root.querySelector('#y')!)).to.deep.equal([1, 0, 0, -1, 0, 0]);

    root.setAttribute('dir', 'ltr');
    expect(getComputedStyle(unset).transform).to.equal('none');
    expect(matrixOf(root.querySelector('#x')!)).to.deep.equal(MIRRORED);
  });
});
