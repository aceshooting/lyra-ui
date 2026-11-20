import { resolveDeclarationsInShadow as resolveInShadow } from '../../../../test/shadow-style.js';
import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-tool-select-dialog.js';
import type { LyraToolSelectDialog } from '../../lr-tool-select-dialog.js';


function fieldGeometry(el: LyraToolSelectDialog): Record<string, string> {
  const computed = getComputedStyle(
    el.shadowRoot!.querySelector<HTMLInputElement>('[part="search-input"]')!
  );
  return {
    'min-block-size': computed.getPropertyValue('min-block-size'),
    'font-size': computed.getPropertyValue('font-size'),
    'padding-inline-start': computed.getPropertyValue('padding-inline-start'),
    'padding-inline-end': computed.getPropertyValue('padding-inline-end'),
    'padding-block-start': computed.getPropertyValue('padding-block-start'),
    'border-start-start-radius': computed.getPropertyValue(
      'border-start-start-radius'
    ),
  };
}

async function openDialog(): Promise<LyraToolSelectDialog> {
  const el = await fixture<LyraToolSelectDialog>(
    html`<lr-tool-select-dialog open></lr-tool-select-dialog>`
  );
  await el.updateComplete;
  return el;
}

describe('lr-tool-select-dialog search-field sizing', () => {
  it('falls back to the shared form-control chain when no hook is set', async () => {
    const el = await openDialog();
    const expected = resolveInShadow(el, [
      ['min-block-size', 'var(--lr-form-control-height)'],
      ['padding-inline-start', 'var(--lr-form-control-padding-inline)'],
      ['padding-inline-end', 'var(--lr-icon-button-size)'],
      ['padding-block-start', 'var(--lr-space-xs)'],
      ['border-start-start-radius', 'var(--lr-form-control-radius)'],
      ['font-size', 'var(--lr-form-control-font-size)'],
    ]);
    const geometry = fieldGeometry(el);
    for (const key of ['min-block-size', 'padding-inline-start', 'padding-inline-end', 'border-start-start-radius', 'font-size']) {
      expect(geometry[key], key).to.equal(expected[key]);
      expect(parseFloat(geometry[key]!), `${key} resolves to a real length`).to.be.greaterThan(0);
    }
    // The shared block padding is capped by the control's own line box, never above --lr-space-xs.
    expect(parseFloat(geometry['padding-block-start']!)).to.be.at.most(parseFloat(expected['padding-block-start']!));
  });

  it('sizes the search field through --lr-tool-select-dialog-search-*', async () => {
    const el = await openDialog();
    el.style.setProperty('--lr-tool-select-dialog-search-min-height', '43px');
    el.style.setProperty('--lr-tool-select-dialog-search-font-size', '9px');
    el.style.setProperty(
      '--lr-tool-select-dialog-search-padding-inline',
      '21px'
    );
    el.style.setProperty('--lr-tool-select-dialog-search-padding-block', '23px');
    el.style.setProperty('--lr-tool-select-dialog-search-radius', '3px');
    await el.updateComplete;

    const geometry = fieldGeometry(el);
    expect(geometry['min-block-size']).to.equal('43px');
    expect(geometry['font-size']).to.equal('9px');
    expect(geometry['padding-inline-start']).to.equal('21px');
    expect(geometry['padding-block-start']).to.equal('23px');
    expect(geometry['border-start-start-radius']).to.equal('3px');
  });
});
