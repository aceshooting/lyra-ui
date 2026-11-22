import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-code-block.js';
import type { LyraCodeBlock } from '../../lr-code-block.js';

it('styles the frame border and fill and the header padding and rule from tokens, keeping the defaults unset', async () => {
  const el = await fixture<LyraCodeBlock>(html`<lr-code-block filename="a.txt" code="hello"></lr-code-block>`);
  const root = el.shadowRoot!;
  const read = () => {
    const base = getComputedStyle(root.querySelector('[part="base"]')!);
    const header = getComputedStyle(root.querySelector('[part="header"]')!);
    return {
      border: `${base.borderTopWidth} ${base.borderTopStyle}`,
      fill: base.backgroundColor,
      padding: header.paddingTop,
      rule: `${header.borderBottomWidth} ${header.borderBottomStyle}`,
    };
  };
  const defaults = read();
  expect(defaults.border).to.equal('1px solid');
  expect(defaults.rule).to.equal('1px solid');
  el.style.cssText = [
    '--lr-code-block-border: 3px dashed rgb(1, 2, 3)',
    '--lr-code-block-bg: rgb(4, 5, 6)',
    '--lr-code-block-header-padding: 9px',
    '--lr-code-block-header-border: 0',
  ].join(';');
  expect(read()).to.deep.equal({ border: '3px dashed', fill: 'rgb(4, 5, 6)', padding: '9px', rule: '0px none' });
});
