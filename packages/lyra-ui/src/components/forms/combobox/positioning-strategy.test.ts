import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './combobox.js';
import type { LyraCombobox } from './combobox.js';

/** The positioner writes `position` on the popup itself, so the RENDERED value -- never the
 *  stylesheet text -- is what these assertions read. */
const renderedPosition = (host: Element): string => {
  const listbox = host.shadowRoot!.querySelector<HTMLElement>('[part~="listbox"]')!;
  return getComputedStyle(listbox).position;
};

const openCombobox = async (el: LyraCombobox): Promise<void> => {
  el.open = true;
  await el.updateComplete;
};

describe('positioning-strategy on lr-combobox', () => {
  it('defaults to fixed, which is what the listbox has always rendered', async () => {
    const el = await fixture<LyraCombobox>(html`<lr-combobox>
      <lr-option value="a">A</lr-option>
    </lr-combobox>`);
    expect(el.positioningStrategy).to.equal('fixed');
    // Reflected like every other reflected default on this host (placement, size, appearance), and
    // exactly as lr-select reflects its own. Lit does not route its own reflection back through the
    // setter, so the reflected default is never mistaken for an authored value -- the cascade test
    // below proves an ancestor override still reaches this unset instance.
    expect(el.getAttribute('positioning-strategy')).to.equal('fixed');
    await openCombobox(el);
    await waitUntil(() => renderedPosition(el) === 'fixed', 'the listbox stays fixed by default');
  });

  it('honours an explicit absolute strategy on the instance', async () => {
    const el = await fixture<LyraCombobox>(html`<lr-combobox positioning-strategy="absolute">
      <lr-option value="a">A</lr-option>
    </lr-combobox>`);
    expect(el.positioningStrategy).to.equal('absolute');
    await openCombobox(el);
    await waitUntil(() => renderedPosition(el) === 'absolute', 'the authored strategy applies');
  });

  it('resolves an unsupported value back to the default', async () => {
    const el = await fixture<LyraCombobox>(html`<lr-combobox positioning-strategy="sticky">
      <lr-option value="a">A</lr-option>
    </lr-combobox>`);
    expect(el.positioningStrategy).to.equal('fixed');
  });
});

describe('the cascading --lr-positioning-strategy custom property on lr-combobox', () => {
  it('lets an ancestor switch an unset combobox to absolute', async () => {
    const wrapper = await fixture(html`<div style="--lr-positioning-strategy: absolute">
      <lr-combobox><lr-option value="a">A</lr-option></lr-combobox>
    </div>`);
    const el = wrapper.querySelector('lr-combobox') as LyraCombobox;
    await openCombobox(el);
    await waitUntil(
      () => renderedPosition(el) === 'absolute',
      'the ancestor override reaches an unset combobox',
    );
  });

  it('lets an explicit value on the instance win over the ancestor', async () => {
    const wrapper = await fixture(html`<div style="--lr-positioning-strategy: absolute">
      <lr-combobox positioning-strategy="fixed"><lr-option value="a">A</lr-option></lr-combobox>
    </div>`);
    const el = wrapper.querySelector('lr-combobox') as LyraCombobox;
    await openCombobox(el);
    await waitUntil(
      () => renderedPosition(el) === 'fixed',
      'an authored default still counts as authored, so it wins',
    );
  });

  it('ignores an unrecognised ancestor value and keeps the default', async () => {
    const wrapper = await fixture(html`<div style="--lr-positioning-strategy: sticky">
      <lr-combobox><lr-option value="a">A</lr-option></lr-combobox>
    </div>`);
    const el = wrapper.querySelector('lr-combobox') as LyraCombobox;
    await openCombobox(el);
    await waitUntil(() => renderedPosition(el) === 'fixed', 'a typo falls through to the default');
  });
});
