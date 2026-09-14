import { expect, fixture, html } from '@open-wc/testing';
import './emoji-picker.js';
import type { LyraEmojiPicker } from './emoji-picker.js';

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

function fieldGeometry(el: LyraEmojiPicker): Record<string, string> {
  const computed = getComputedStyle(
    el.shadowRoot!.querySelector<HTMLInputElement>('[part="search"]')!
  );
  return {
    'min-block-size': computed.getPropertyValue('min-block-size'),
    'font-size': computed.getPropertyValue('font-size'),
    'padding-inline-start': computed.getPropertyValue('padding-inline-start'),
    'padding-block-start': computed.getPropertyValue('padding-block-start'),
  };
}

describe('lr-emoji-picker filter-field sizing', () => {
  it('renders the filter field on exactly its pre-hook geometry when no hook is set', async () => {
    const el = await fixture<LyraEmojiPicker>(
      html`<lr-emoji-picker></lr-emoji-picker>`
    );
    await el.updateComplete;
    const expected = resolveInShadow(el, [
      ['padding-inline-start', 'var(--lr-space-s)'],
      ['padding-block-start', 'var(--lr-space-xs)'],
    ]);
    const geometry = fieldGeometry(el);
    const hostFontSize = getComputedStyle(el).fontSize;

    expect(geometry['min-block-size']).to.equal('auto');
    expect(geometry['font-size']).to.equal(hostFontSize);
    expect(geometry['padding-inline-start']).to.equal(
      expected['padding-inline-start']
    );
    expect(geometry['padding-block-start']).to.equal(
      expected['padding-block-start']
    );
  });

  it('sizes the filter field through --lr-emoji-picker-search-*', async () => {
    const el = await fixture<LyraEmojiPicker>(
      html`<lr-emoji-picker></lr-emoji-picker>`
    );
    el.style.setProperty('--lr-emoji-picker-search-min-height', '33px');
    el.style.setProperty('--lr-emoji-picker-search-font-size', '9px');
    el.style.setProperty('--lr-emoji-picker-search-padding-inline', '21px');
    el.style.setProperty('--lr-emoji-picker-search-padding-block', '27px');
    await el.updateComplete;

    const geometry = fieldGeometry(el);
    expect(geometry['min-block-size']).to.equal('33px');
    expect(geometry['font-size']).to.equal('9px');
    expect(geometry['padding-inline-start']).to.equal('21px');
    expect(geometry['padding-block-start']).to.equal('27px');
  });

  it('leaves the filter field untouched by `size`, which scales the emoji grid instead', async () => {
    const untiered = await fixture<LyraEmojiPicker>(
      html`<lr-emoji-picker></lr-emoji-picker>`
    );
    await untiered.updateComplete;
    const before = fieldGeometry(untiered);

    const tiered = await fixture<LyraEmojiPicker>(
      html`<lr-emoji-picker size="l"></lr-emoji-picker>`
    );
    await tiered.updateComplete;

    expect(tiered.size).to.equal('l');
    expect(
      fieldGeometry(tiered),
      'size is documented as the glyph/item scale on this component, not the form-control ladder'
    ).to.deep.equal(before);
  });
});
