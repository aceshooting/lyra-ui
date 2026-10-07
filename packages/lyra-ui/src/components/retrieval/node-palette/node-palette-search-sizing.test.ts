import { resolveDeclarationsInShadow as resolveInShadow } from '../../../../test/shadow-style.js';
import { expect, fixture, html } from '@open-wc/testing';
import './node-palette.js';
import type { LyraNodePalette } from './node-palette.js';


function fieldGeometry(el: LyraNodePalette): Record<string, string> {
  const computed = getComputedStyle(
    el.shadowRoot!.querySelector<HTMLInputElement>('[part="search"]')!
  );
  return {
    'min-block-size': computed.getPropertyValue('min-block-size'),
    'font-size': computed.getPropertyValue('font-size'),
    'padding-inline-start': computed.getPropertyValue('padding-inline-start'),
    'padding-block-start': computed.getPropertyValue('padding-block-start'),
    'border-start-start-radius': computed.getPropertyValue(
      'border-start-start-radius'
    ),
  };
}

async function palette(): Promise<LyraNodePalette> {
  const el = await fixture<LyraNodePalette>(
    html`<lr-node-palette></lr-node-palette>`
  );
  await el.updateComplete;
  return el;
}

describe('lr-node-palette search-field sizing', () => {
  it('renders the search field on exactly its pre-hook geometry when no hook is set', async () => {
    const el = await palette();
    const expected = resolveInShadow(el, [
      ['min-block-size', 'var(--lr-icon-button-size)'],
      ['padding-inline-start', 'var(--lr-space-s)'],
      ['padding-block-start', 'var(--lr-space-xs)'],
      ['border-start-start-radius', 'var(--lr-radius)'],
    ]);
    const geometry = fieldGeometry(el);

    expect(geometry['min-block-size']).to.equal(expected['min-block-size']);
    expect(geometry['font-size']).to.equal(getComputedStyle(el).fontSize);
    expect(geometry['padding-inline-start']).to.equal(
      expected['padding-inline-start']
    );
    expect(geometry['padding-block-start']).to.equal(
      expected['padding-block-start']
    );
    expect(geometry['border-start-start-radius']).to.equal(
      expected['border-start-start-radius']
    );
  });

  it('sizes the search field through --lr-node-palette-search-*', async () => {
    const el = await palette();
    el.style.setProperty('--lr-node-palette-search-min-height', '57px');
    el.style.setProperty('--lr-node-palette-search-font-size', '9px');
    el.style.setProperty('--lr-node-palette-search-padding-inline', '21px');
    el.style.setProperty('--lr-node-palette-search-padding-block', '23px');
    el.style.setProperty('--lr-node-palette-search-radius', '3px');
    await el.updateComplete;

    const geometry = fieldGeometry(el);
    expect(geometry['min-block-size']).to.equal('57px');
    expect(geometry['font-size']).to.equal('9px');
    expect(geometry['padding-inline-start']).to.equal('21px');
    expect(geometry['padding-block-start']).to.equal('23px');
    expect(geometry['border-start-start-radius']).to.equal('3px');
  });

  it('refuses to let the height hook shrink the field below the shared tap-target floor', async () => {
    const el = await palette();
    const floor = resolveInShadow(el, [
      ['min-block-size', 'var(--lr-icon-button-size)'],
    ]);
    el.style.setProperty('--lr-node-palette-search-min-height', '2px');
    await el.updateComplete;

    expect(fieldGeometry(el)['min-block-size']).to.equal(
      floor['min-block-size']
    );
  });
});


describe('shared search theme', () => {
  it('uses shared input geometry and lets component aliases override it', async () => {
    const el = await palette();
    el.style.setProperty('--lr-input-control-min-height', '53px');
    el.style.setProperty('--lr-input-padding-inline', '17px');
    el.style.setProperty('--lr-input-font-size', '19px');
    el.style.setProperty('--lr-input-radius', '7px');
    const field = el.shadowRoot!.querySelector<HTMLInputElement>('[part="search"]')!;
    expect(getComputedStyle(field).minBlockSize).to.equal('53px');
    expect(getComputedStyle(field).paddingInlineStart).to.equal('17px');
    expect(getComputedStyle(field).fontSize).to.equal('19px');
    expect(getComputedStyle(field).borderStartStartRadius).to.equal('7px');
    el.style.setProperty('--lr-node-palette-search-min-height', '59px');
    el.style.setProperty('--lr-node-palette-search-padding-inline', '23px');
    expect(getComputedStyle(field).minBlockSize).to.equal('59px');
    expect(getComputedStyle(field).paddingInlineStart).to.equal('23px');
  });

  it('uses icon-button paint hooks on the native clear action', async () => {
    const el = await palette();
    const field = el.shadowRoot!.querySelector<HTMLInputElement>('[part="search"]')!;
    field.value = 'query';
    field.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    await el.updateComplete;
    el.style.setProperty('--lr-icon-button-bg', 'rgb(12, 34, 56)');
    el.style.setProperty('--lr-icon-button-color', 'rgb(65, 43, 21)');
    el.style.setProperty('--lr-icon-button-radius', '11px');
    const clear = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="search-clear"]')!;
    expect(getComputedStyle(clear).backgroundColor).to.equal('rgb(12, 34, 56)');
    expect(getComputedStyle(clear).color).to.equal('rgb(65, 43, 21)');
    expect(getComputedStyle(clear).borderStartStartRadius).to.equal('11px');
    clear.click();
    expect(field.value).to.equal('');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="search-clear"]') === null).to.equal(true);
  });
});
