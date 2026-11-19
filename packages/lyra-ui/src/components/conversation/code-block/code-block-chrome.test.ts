import { expect, fixture, oneEvent, waitUntil } from '@open-wc/testing';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
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

for (const name of ['lr-code-block', 'lr-code-block-core']) {
  it(`${name} uses localized disclosure actions and supports a stable override`, async () => {
    const el = await fixture<LyraCodeBlock>(`<${name} collapsible></${name}>`);
    const toggle = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle"]')!;
    expect(toggle.getAttribute('aria-label')).to.equal('Collapse code');
    toggle.click();
    await el.updateComplete;
    expect(toggle.getAttribute('aria-label')).to.equal('Expand code');
    el.strings = { expandCode: 'Show source', collapseCode: 'Hide source' };
    await el.updateComplete;
    expect(toggle.getAttribute('aria-label')).to.equal('Show source');
    toggle.click();
    await el.updateComplete;
    expect(toggle.getAttribute('aria-label')).to.equal('Hide source');
    expect(toggle.getAttribute('aria-expanded')).to.equal('true');
    el.strings = { codeBlockToggle: 'Show or hide source' };
    toggle.click();
    await el.updateComplete;
    expect(toggle.getAttribute('aria-label')).to.equal('Show or hide source');
    expect(toggle.getAttribute('aria-expanded')).to.equal('false');
    toggle.click();
    await el.updateComplete;
    expect(toggle.getAttribute('aria-label')).to.equal('Show or hide source');
    expect(toggle.getAttribute('aria-expanded')).to.equal('true');
  });

  it(`${name} lets a request listener own collapse state or retire the disclosure`, async () => {
    const el = await fixture<LyraCodeBlock>(`<${name} collapsible></${name}>`);
    const toggle = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle"]')!;
    let commits = 0;
    let requests = 0;
    el.addEventListener('lr-toggle', () => commits++);
    el.addEventListener('lr-toggle-request', () => requests++);
    el.addEventListener('lr-toggle-request', () => { el.collapsed = false; }, { once: true });
    toggle.click();
    expect(el.collapsed).to.be.false;
    expect(commits).to.equal(0);
    el.addEventListener('lr-toggle-request', () => { el.collapsible = false; }, { once: true });
    toggle.click();
    expect(el.collapsed).to.be.false;
    expect(commits).to.equal(0);
    toggle.click();
    expect(requests).to.equal(2);
    el.collapsible = true;
    el.addEventListener('lr-toggle-request', () => el.remove(), { once: true });
    toggle.click();
    expect(el.collapsed).to.be.false;
    expect(commits).to.equal(0);
    toggle.click();
    expect(requests).to.equal(3);
  });

  it(`${name} observes reassigned header actions in the owner document`, async () => {
    const frame = await fixture<HTMLIFrameElement>('<iframe></iframe>');
    const el = document.createElement(name) as LyraCodeBlock;
    el.withoutCopyButton = true;
    const doc = frame.contentDocument!;
    const view = doc.defaultView!;
    const descriptor = Object.getOwnPropertyDescriptor(view, 'MutationObserver')!;
    const NativeObserver = view.MutationObserver;
    let observed = false;
    class RealmObserver extends NativeObserver {
      override observe(target: Node, options?: MutationObserverInit): void {
        if (target === el && options?.attributeFilter?.includes('slot')) observed = true;
        super.observe(target, options);
      }
    }
    Object.defineProperty(view, 'MutationObserver', { ...descriptor, value: RealmObserver });
    try {
      doc.body.append(el);
      await el.updateComplete;
      const action = doc.createElement('button');
      el.append(action);
      action.slot = 'header-actions';
      await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part="header"]')));
      expect(observed).to.be.true;
      action.slot = '';
      await waitUntil(() => !el.shadowRoot!.querySelector('[part="header"]'));
    } finally {
      el.remove();
      Object.defineProperty(view, 'MutationObserver', descriptor);
    }
  });

  for (const [selector, token] of [['[part="toggle"]', 'toggle'], ['.line-gutter', 'gutter']] as const) {
    it(`${name} themes the ${token} background in each pointer state`, async () => {
      const el = await fixture<LyraCodeBlock>(`<${name} collapsible line-numbers activatable-lines code="one"></${name}>`);
      const control = el.shadowRoot!.querySelector(selector)!;
      el.style.setProperty(`--lr-code-block-${token}-bg`, 'red');
      el.style.setProperty(`--lr-code-block-${token}-bg-hover`, 'green');
      el.style.setProperty(`--lr-code-block-${token}-bg-active`, 'blue');
      const background = () => getComputedStyle(control).backgroundColor;
      try {
        await resetMouse();
        expect(background()).to.equal('rgb(255, 0, 0)');
        await hoverUntilMatched(control, `hovering the ${token}`);
        expect(background()).to.equal('rgb(0, 128, 0)');
        await sendMouse({ type: 'down' });
        await waitUntil(() => background() === 'rgb(0, 0, 255)');
      } finally {
        await resetMouse();
      }
    });
  }
}
