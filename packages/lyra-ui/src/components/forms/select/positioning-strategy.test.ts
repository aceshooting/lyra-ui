import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './select.js';
import '../color-picker/color-picker.js';
import type { LyraSelect } from './select.js';
import type { LyraColorPicker } from '../color-picker/color-picker.js';

/** The positioner writes `position` on the popup itself, so the RENDERED value -- never the
 *  stylesheet text -- is what these assertions read. */
const renderedPosition = (host: Element, part: string): string => {
  const popup = host.shadowRoot!.querySelector<HTMLElement>(`[part~="${part}"]`)!;
  return getComputedStyle(popup).position;
};

const buildSelect = (attrs: string) =>
  fixture<LyraSelect>(`<lr-select ${attrs}>
    <lr-option value="a">A</lr-option>
    <lr-option value="b">B</lr-option>
  </lr-select>`);

describe('positioning-strategy on lr-select', () => {
  it('defaults to absolute, agreeing with an unset hoist', async () => {
    const el = await buildSelect('');
    expect(el.positioningStrategy).to.equal('absolute');
    expect(el.hoist).to.equal(false);
  });

  it('behaves identically to hoist when the attribute asks for fixed', async () => {
    const authored = await buildSelect('positioning-strategy="fixed"');
    const hoisted = await buildSelect('hoist');
    authored.open = true;
    hoisted.open = true;
    await authored.updateComplete;
    await hoisted.updateComplete;
    await waitUntil(
      () => renderedPosition(authored, 'listbox') === 'fixed',
      'the authored strategy hoists the listbox'
    );
    await waitUntil(
      () => renderedPosition(hoisted, 'listbox') === 'fixed',
      'hoist still hoists the listbox'
    );
    expect(renderedPosition(authored, 'listbox')).to.equal(
      renderedPosition(hoisted, 'listbox')
    );
  });

  it('keeps the two spellings agreeing in both directions', async () => {
    const el = await buildSelect('');
    el.positioningStrategy = 'fixed';
    await el.updateComplete;
    expect(el.hoist).to.equal(true);
    expect(el.hasAttribute('hoist')).to.equal(true);
    el.hoist = false;
    await el.updateComplete;
    expect(el.positioningStrategy).to.equal('absolute');
    expect(el.getAttribute('positioning-strategy')).to.equal('absolute');
  });

  it('normalizes an unsupported attribute value back to its own default', async () => {
    const el = await buildSelect('positioning-strategy="sticky"');
    expect(el.positioningStrategy).to.equal('absolute');
    expect(el.hoist).to.equal(false);
  });

  it('repositions live when the strategy changes while open', async () => {
    const el = await buildSelect('');
    el.open = true;
    await el.updateComplete;
    await waitUntil(
      () => renderedPosition(el, 'listbox') === 'absolute',
      'opens absolute'
    );
    el.positioningStrategy = 'fixed';
    await waitUntil(
      () => renderedPosition(el, 'listbox') === 'fixed',
      'switches live to fixed'
    );
    expect(el.open).to.equal(true);
  });
});

describe('positioning-strategy on lr-color-picker', () => {
  it('defaults to absolute and follows either spelling', async () => {
    const el = await fixture<LyraColorPicker>(
      html`<lr-color-picker value="#ff0000"></lr-color-picker>`
    );
    expect(el.positioningStrategy).to.equal('absolute');
    expect(el.hoist).to.equal(false);
    el.hoist = true;
    await el.updateComplete;
    expect(el.positioningStrategy).to.equal('fixed');
    expect(el.getAttribute('positioning-strategy')).to.equal('fixed');
    el.positioningStrategy = 'absolute';
    await el.updateComplete;
    expect(el.hoist).to.equal(false);
  });

  it('applies the fixed strategy to the open panel', async () => {
    const el = await fixture<LyraColorPicker>(
      html`<lr-color-picker value="#ff0000" positioning-strategy="fixed"></lr-color-picker>`
    );
    el.open = true;
    await el.updateComplete;
    await waitUntil(
      () => renderedPosition(el, 'panel') === 'fixed',
      'the panel follows the authored strategy'
    );
  });
});

describe('the cascading --lr-positioning-strategy custom property', () => {
  it('lr-select: clips absolutely by default inside a card, and escapes when the card opts in', async () => {
    const clipped = await fixture(html`<div style="overflow: hidden">
      <lr-select>
        <lr-option value="a">A</lr-option>
        <lr-option value="b">B</lr-option>
      </lr-select>
    </div>`);
    const clippedEl = clipped.querySelector('lr-select') as LyraSelect;
    clippedEl.open = true;
    await clippedEl.updateComplete;
    await waitUntil(
      () => renderedPosition(clippedEl, 'listbox') === 'absolute',
      'the select stays absolute (and thus clippable) by default',
    );

    const escaping = await fixture(html`<div style="overflow: hidden; --lr-positioning-strategy: fixed">
      <lr-select>
        <lr-option value="a">A</lr-option>
        <lr-option value="b">B</lr-option>
      </lr-select>
    </div>`);
    const escapingEl = escaping.querySelector('lr-select') as LyraSelect;
    escapingEl.open = true;
    await escapingEl.updateComplete;
    await waitUntil(
      () => renderedPosition(escapingEl, 'listbox') === 'fixed',
      'the card-level override escapes the clipping ancestor',
    );
  });

  it('lr-select: an explicit positioning-strategy on the instance still wins over the card', async () => {
    const wrapper = await fixture(html`<div style="--lr-positioning-strategy: fixed">
      <lr-select positioning-strategy="absolute">
        <lr-option value="a">A</lr-option>
      </lr-select>
    </div>`);
    const el = wrapper.querySelector('lr-select') as LyraSelect;
    el.open = true;
    await el.updateComplete;
    await waitUntil(
      () => renderedPosition(el, 'listbox') === 'absolute',
      'the explicit instance value wins over the card override',
    );
  });

  it('lr-select: an unset ancestor never changes the default rendered strategy', async () => {
    const wrapper = await fixture(html`<div>
      <lr-select>
        <lr-option value="a">A</lr-option>
      </lr-select>
    </div>`);
    const el = wrapper.querySelector('lr-select') as LyraSelect;
    el.open = true;
    await el.updateComplete;
    await waitUntil(
      () => renderedPosition(el, 'listbox') === 'absolute',
      'the unset default is unchanged',
    );
  });

  it('lr-color-picker: honors the same cascading override as the anchored surfaces', async () => {
    const wrapper = await fixture(html`<div style="--lr-positioning-strategy: fixed">
      <lr-color-picker value="#ff0000"></lr-color-picker>
    </div>`);
    const el = wrapper.querySelector('lr-color-picker') as LyraColorPicker;
    el.open = true;
    await el.updateComplete;
    await waitUntil(
      () => renderedPosition(el, 'panel') === 'fixed',
      'the color picker honors the cascading override too',
    );
  });
});
