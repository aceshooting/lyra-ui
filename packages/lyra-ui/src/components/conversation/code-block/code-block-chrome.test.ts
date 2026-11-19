import { expect, fixture, oneEvent } from '@open-wc/testing';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import './code-block.js';
import './code-block-core.js';
import type { LyraCodeBlock } from './code-block.js';

for (const name of ['lr-code-block', 'lr-code-block-core']) {
  it(`${name} keeps code rows aligned when line numbers become activatable`, async () => {
    const el = await fixture<LyraCodeBlock>(`<${name} line-numbers></${name}>`);
    el.style.setProperty('--lr-icon-button-size', '52px');
    el.code = '1\n2\n3';
    await el.updateComplete;
    const lineHeight = () => el.shadowRoot!.querySelector('.line')!.getBoundingClientRect().height;
    const before = lineHeight();
    expect(before).to.be.greaterThan(0);
    el.activatableLines = true;
    await el.updateComplete;
    expect(lineHeight()).to.be.closeTo(before, 1);
    expect(el.shadowRoot!.querySelector('button.line-gutter')!.getBoundingClientRect().width).to.be.at.least(52);
  });

  it(`${name} exposes padding, radius, header colors and line-number color for theming`, async () => {
    const el = await fixture<LyraCodeBlock>(`<${name} line-numbers filename="a.js"></${name}>`);
    el.style.cssText = '--lr-code-block-padding:11px;--lr-code-block-radius:9px;--lr-code-block-header-bg:tan;--lr-code-block-header-color:navy;--lr-code-block-line-number-color:teal';
    const css = (selector: string) => getComputedStyle(el.shadowRoot!.querySelector(selector)!);
    expect(css('pre').paddingTop).to.equal('11px');
    expect(css('[part="base"]').borderTopLeftRadius).to.equal('9px');
    expect(css('[part="header"]').backgroundColor).to.equal('rgb(210, 180, 140)');
    expect(css('[part="filename"]').color).to.equal('rgb(0, 0, 128)');
    expect(css('.line-number').color).to.equal('rgb(0, 128, 128)');
  });

  for (const ok of [true, false]) {
    it(`${name} announces the localized clipboard result when success=${ok}`, async () => {
      const el = await fixture<LyraCodeBlock>(`<${name} code="source"></${name}>`);
      el.strings = { copiedToClipboard: 'Write complete', copyFailed: 'Write failed' };
      const previous = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: async () => { if (!ok) throw new Error(); },
      } });
      try {
        const completion = oneEvent(el, ok ? 'lr-copy' : 'lr-copy-error');
        el.shadowRoot!.querySelector<HTMLElement>('[part~="copy-button"]')!.click();
        await completion;
        const entries = Array.from(document.querySelectorAll(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}] > *`), entry => entry.textContent);
        expect(entries).to.include(ok ? 'Write complete' : 'Write failed');
      } finally {
        if (previous) Object.defineProperty(navigator, 'clipboard', previous);
        else Reflect.deleteProperty(navigator, 'clipboard');
      }
    });
  }
}

for (const name of ['lr-code-block', 'lr-code-block-core']) {
  it(`${name} uses its default region name for whitespace-only labels`, async () => {
    const el = await fixture<LyraCodeBlock>(`<${name} filename="main.ts" aria-label="   "></${name}>`);
    expect(el.shadowRoot!.querySelector('[role="group"]')!.getAttribute('aria-label')).to.equal('main.ts');
  });
}

for (const name of ['lr-code-block', 'lr-code-block-core']) {
  it(`${name} keeps a short language legible beside a long filename`, async () => {
    const el = await fixture<LyraCodeBlock>(`<${name} filename="application.ts" language="typescript" without-copy-button></${name}>`);
    el.style.inlineSize = '240px';
    el.filename = 'application'.repeat(30) + '.ts';
    await el.updateComplete;
    const language = el.shadowRoot!.querySelector<HTMLElement>('[part="language"]')!;
    expect(language.clientWidth).to.be.at.least(language.scrollWidth);
    const filename = el.shadowRoot!.querySelector<HTMLElement>('[part="filename"]')!;
    expect(filename.scrollWidth).to.be.greaterThan(filename.clientWidth);
  });

  it(`${name} paints a header divider only while the body is visible`, async () => {
    const el = await fixture<LyraCodeBlock>(`<${name} collapsible collapsed></${name}>`);
    const divider = () => getComputedStyle(el.shadowRoot!.querySelector('[part="header"]')!).borderBlockEndWidth;
    expect(divider()).to.equal('0px');
    el.collapsed = false;
    await el.updateComplete;
    expect(parseFloat(divider())).to.be.greaterThan(0);
    el.collapsible = false;
    el.collapsed = true;
    await el.updateComplete;
    expect(parseFloat(divider())).to.be.greaterThan(0);
  });
}

it('reports a copy of empty source after the code attribute is removed', async () => {
  const el = await fixture<LyraCodeBlock>('<lr-code-block code="initial"></lr-code-block>');
  el.removeAttribute('code');
  await el.updateComplete;
  const previous = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
  try {
    const done = oneEvent(el, 'lr-copy');
    el.shadowRoot!.querySelector<HTMLElement>('[part~="copy-button"]')!.click();
    expect((await done as CustomEvent<{ text: string }>).detail.text).to.equal('');
  } finally {
    if (previous) Object.defineProperty(navigator, 'clipboard', previous);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
});
