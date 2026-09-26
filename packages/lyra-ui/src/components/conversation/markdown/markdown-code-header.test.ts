import { fixture, html, expect, oneEvent, waitUntil } from '@open-wc/testing';
import './markdown.js';
import './markdown-core.js';
import type { LyraMarkdown } from './markdown.js';

describe('code-block header', () => {
  for (const name of ['lr-markdown', 'lr-markdown-core'] as const) {
    it(`${name} adds no text and preserves tabs when copying after skipped empty blocks`, async () => {
      const host = await fixture<HTMLElement>(html`<div></div>`);
      const el = document.createElement(name) as LyraMarkdown;
      el.codeBlockHeader = true;
      el.highlightCode = false;
      el.content = '```\n```\n\n```make\n\tbuild\n```';
      host.append(el);
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('[part="code-block-copy"]')));
      const header = el.shadowRoot!.querySelector('[part="code-block-header"]')!;
      expect(header.textContent).to.equal('');
      expect(el.shadowRoot!.querySelectorAll('[part="code-block-frame"]').length).to.equal(1);
      const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
      const writes: string[] = [];
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { writes.push(text); } } });
      try {
        const event = oneEvent(el, 'lr-copy');
        el.shadowRoot!.querySelector<HTMLButtonElement>('[part="code-block-copy"]')!.click();
        const outcome = await event as CustomEvent<{ ok: boolean; text: string }>;
        expect(outcome.detail).to.deep.equal({ ok: true, text: '\tbuild' });
        expect(writes).to.deep.equal(['\tbuild']);
        expect(outcome.composed && outcome.bubbles && !outcome.cancelable).to.equal(true);
        await el.updateComplete;
        expect(el.shadowRoot!.querySelectorAll('[part~="code-block-copy-success"]').length).to.equal(1);
        const previous = el.shadowRoot!.querySelector('[part~="code-block-copy"]');
        el.content = 'Paragraph\n\n' + el.content;
        await el.updateComplete;
        expect(el.shadowRoot!.querySelectorAll('[part~="code-block-copy-success"]').length).to.equal(1);
        expect(el.shadowRoot!.querySelector('[part~="code-block-copy"]') === previous).to.equal(false);
      } finally {
        if (original) Object.defineProperty(navigator, 'clipboard', original);
        else Reflect.deleteProperty(navigator, 'clipboard');
      }
    });
    it(`${name} rejects decoration forgery and strips authored styles only while enabled`, async () => {
      const host = await fixture<HTMLElement>(html`<div></div>`);
      const el = document.createElement(name) as LyraMarkdown;
      el.highlightCode = false;
      el.codeBlockHeader = true;
      el.content = '<style>.line { display:none }</style>\n\n<a part="code-block-copy" data-lr-code-chrome href="/">Decoy</a>\n\n```js\nvisible\n```';
      host.append(el);
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('button')));
      expect(el.shadowRoot!.querySelectorAll('style').length).to.equal(0);
      expect(el.shadowRoot!.querySelector('a')?.hasAttribute('data-lr-code-chrome')).to.equal(false);
      expect(el.shadowRoot!.querySelectorAll('button').length).to.equal(1);
      expect(getComputedStyle(el.shadowRoot!.querySelector('a')!).minBlockSize).to.equal('0px');
      await expect(el).to.be.accessible();
    });
    it(`${name} bounds controls and clips language labels by code point`, async () => {
      const host = await fixture<HTMLElement>(html`<div></div>`);
      const el = document.createElement(name) as LyraMarkdown;
      el.codeBlockHeader = true; el.highlightCode = false;
      el.content = Array.from({ length: 205 }, (_, index) => `\`\`\`${'x'.repeat(40)}\nvalue ${index}\n\`\`\``).join('\n\n');
      host.append(el);
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('button')));
      expect(el.shadowRoot!.querySelectorAll('button').length).to.equal(200);
      expect(el.shadowRoot!.querySelectorAll('pre').length).to.equal(205);
      expect(el.shadowRoot!.querySelector('[part="code-block-language"]')?.getAttribute('data-language')).to.equal('x'.repeat(32));
    });
    it(`${name} localizes existing controls and returns localized clipboard failure`, async () => {
      const host = await fixture<HTMLElement>(html`<div></div>`);
      const el = document.createElement(name) as LyraMarkdown;
      el.codeBlockHeader = true; el.highlightCode = false; el.content = '```js\nsource\n```';
      host.append(el);
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('button')));
      const button = el.shadowRoot!.querySelector('button')!;
      el.strings = { copyCode: 'Copier', copyFailed: 'Échec', codeRegionWithLanguage: 'Code {language}' };
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('button') === button).to.equal(true);
      expect(button.getAttribute('aria-label')).to.equal('Copier');
      expect(el.shadowRoot!.querySelector('[part="code-block-frame"]')?.getAttribute('aria-label')).to.equal('Code js');
      const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new DOMException('denied', 'NotAllowedError'); } } });
      try {
        const event = oneEvent(el, 'lr-copy-error'); button.click();
        const outcome = await event as CustomEvent<{ ok: boolean }>;
        expect(outcome.detail.ok).to.equal(false);
        expect(Object.isFrozen(outcome.detail)).to.equal(true);
        await el.updateComplete;
        expect(button.getAttribute('aria-label')).to.equal('Échec');
        expect(button.part.contains('code-block-copy-error')).to.equal(true);
      } finally {
        if (original) Object.defineProperty(navigator, 'clipboard', original);
        else Reflect.deleteProperty(navigator, 'clipboard');
      }
    });
    it(`${name} suppresses stale clipboard settlement after content replacement and disconnect`, async () => {
      const host = await fixture<HTMLElement>(html`<div></div>`);
      const el = document.createElement(name) as LyraMarkdown;
      el.codeBlockHeader = true; el.highlightCode = false; el.content = '```\none\n```';
      host.append(el);
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('button')));
      let resolveWrite: (() => void) | undefined;
      let copies = 0;
      el.addEventListener('lr-copy', () => copies++);
      const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => new Promise<void>((resolve) => { resolveWrite = resolve; }) } });
      try {
        el.shadowRoot!.querySelector('button')!.click();
        el.content = '```\ntwo\n```'; await el.updateComplete;
        resolveWrite!(); await Promise.resolve(); await Promise.resolve(); await el.updateComplete;
        expect(copies).to.equal(0);
        expect(el.shadowRoot!.querySelector('button')!.part.contains('code-block-copy-success')).to.equal(false);
        el.shadowRoot!.querySelector('button')!.click(); el.remove();
        resolveWrite!(); await Promise.resolve(); await Promise.resolve();
        host.append(el); await el.updateComplete;
        expect(copies).to.equal(0);
      } finally {
        if (original) Object.defineProperty(navigator, 'clipboard', original);
        else Reflect.deleteProperty(navigator, 'clipboard');
      }
    });
  }
});
