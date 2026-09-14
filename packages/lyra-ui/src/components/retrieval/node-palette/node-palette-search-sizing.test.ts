import { expect, fixture, html } from '@open-wc/testing';
import './node-palette.js';
import type { LyraNodePalette } from './node-palette.js';

function resolveInShadow(
  el: HTMLElement,
  declarations: readonly (readonly [string, string])[]
): Record<string, string> {
  const probe = document.createElement('div');
  for (const [property, value] of declarations) {
    probe.style.setProperty(property, value);
  }
  el.shadowRoot!.append(probe);
  const computed = getComputedStyle(probe);
  const resolved: Record<string, string> = {};
  for (const [property] of declarations) {
    resolved[property] = computed.getPropertyValue(property);
  }
  probe.remove();
  return resolved;
}

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
