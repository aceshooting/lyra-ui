import { fixture, expect, html } from '@open-wc/testing';
import '../../lr-widget.js';
import type { LyraWidget } from '../../lr-widget.js';

const header = (el: LyraWidget) => getComputedStyle(el.shadowRoot!.querySelector('[part="header"]')!);

describe('lr-widget --lr-widget-header-divider', () => {
  it('keeps the thin subtle rule unset and lets the token restyle or remove it', async () => {
    const plain = await fixture<LyraWidget>(html`<lr-widget label="W">Body</lr-widget>`);
    expect(header(plain).borderBottomWidth).to.equal('1px');
    const coloured = await fixture<LyraWidget>(
      html`<lr-widget label="W" style="--lr-widget-header-divider: 2px solid rgb(1, 2, 3)">Body</lr-widget>`,
    );
    expect([header(coloured).borderBottomWidth, header(coloured).borderBottomColor]).to.deep.equal(['2px', 'rgb(1, 2, 3)']);
    const none = await fixture<LyraWidget>(html`<lr-widget label="W" style="--lr-widget-header-divider: none">Body</lr-widget>`);
    expect(header(none).borderBottomWidth).to.equal('0px');
  });
});
