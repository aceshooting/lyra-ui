import { expect, fixture, html } from '@open-wc/testing';
import { resolvedColorToken, toRgba } from '../../test/color-contrast.js';
import '../components/forms/button/button.js';
import '../components/overlays/overlay/popover.js';
import type { LyraButton } from '../components/forms/button/button.class.js';
import type { LyraPopover } from '../components/overlays/overlay/popover.class.js';

describe('intrinsic built-in profile without document theme stylesheets', () => {
  let previous: CSSStyleSheet[];
  beforeEach(() => { previous = document.adoptedStyleSheets; document.adoptedStyleSheets = []; });
  afterEach(() => { document.adoptedStyleSheets = previous; });

  for (const mode of ['light', 'dark']) {
    it(`paints Shadcn surfaces and Emerald with coherent neutral aliases in ${mode}`, async () => {
      const button = await fixture<LyraButton>(html`<lr-button data-lr-theme=${mode} appearance="accent" variant="brand">Action</lr-button>`);
      expect(toRgba(resolvedColorToken(button, '--lr-color-surface'))).to.deep.equal(mode === 'light' ? [255, 255, 255, 255] : [10, 10, 10, 255]);
      const accent = toRgba(resolvedColorToken(button, '--lr-color-brand-fill-loud'));
      expect(accent[1], 'Emerald has a green dominant fill').to.be.greaterThan(accent[0]);
      expect(accent[1]).to.be.greaterThan(accent[2]);
      expect(resolvedColorToken(button, '--lr-color-neutral-fill-loud')).to.equal(resolvedColorToken(button, '--lr-color-brand-fill-loud'));
      expect(resolvedColorToken(button, '--lr-color-neutral-on-loud')).to.equal(resolvedColorToken(button, '--lr-color-brand-on-loud'));
    });
  }

  it('defaults standalone popup chrome to Glass and respects its explicit Solid host', async function () {
    if (!CSS.supports('backdrop-filter', 'blur(1px)')) this.skip();
    const popover = await fixture<LyraPopover>(html`<lr-popover open aria-label="Settings"><button slot="trigger">Settings</button>Content</lr-popover>`);
    await popover.updateComplete;
    const popup = popover.shadowRoot!.querySelector('[part~="popup"]')!;
    expect(toRgba(getComputedStyle(popup).backgroundColor)[3]).to.be.within(203, 205);
    popover.setAttribute('data-lr-surface', 'solid');
    expect(toRgba(getComputedStyle(popup).backgroundColor)[3]).to.equal(255);
    const layer = popup.querySelector('.glass-scroll-layer') ?? popup;
    expect(getComputedStyle(layer, '::before').content).to.equal('none');
  });
});
