import { expect, fixture, html, nextFrame, oneEvent, waitUntil } from '@open-wc/testing';
import { COPY_FEEDBACK_MS } from '../../../internal/copy-feedback.js';
import type { LyraMarkdown } from './markdown.js';
import './markdown.js';
import './markdown-core.js';

for (const name of ['lr-markdown', 'lr-markdown-core'] as const) {
  for (const outcome of ['success', 'failure'] as const) {
    for (const retirement of ['disconnect', 'disable', 'new copy'] as const) {
      it(`${name} retires ${outcome} copy feedback when its outcome listener causes ${retirement}`, async () => {
        const wrapper = await fixture<HTMLElement>(html`<div></div>`);
        const el = document.createElement(name) as LyraMarkdown;
        el.codeBlockHeader = true;
        el.withoutSyntaxHighlighting = true;
        el.content = '```js\nsource();\n```';
        wrapper.append(el);
        const button = () => el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="code-block-copy"]')!;
        await waitUntil(() => Boolean(button()));
        const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
        let writes = 0, outcomes = 0;
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {
          writes++;
          if (writes === 1 && outcome === 'failure') throw new DOMException('Denied', 'NotAllowedError');
        } } });
        const owner: Window = window;
        const nativeSetTimeout = owner.setTimeout, nativeClearTimeout = owner.clearTimeout;
        const active = new Set<number>();
        owner.setTimeout = (callback, delay, ...args) => {
          const handle = nativeSetTimeout.call(owner, callback, delay, ...args);
          if (delay === COPY_FEEDBACK_MS) active.add(handle);
          return handle;
        };
        owner.clearTimeout = handle => {
          if (handle !== undefined) active.delete(handle);
          nativeClearTimeout.call(owner, handle);
        };
        const eventName = outcome === 'success' ? 'lr-copy' : 'lr-copy-error';
        el.addEventListener('lr-copy', () => { outcomes++; });
        el.addEventListener('lr-copy-error', () => { outcomes++; });
        el.addEventListener(eventName, () => {
          if (retirement === 'disconnect') el.remove();
          else if (retirement === 'disable') el.codeBlockHeader = false;
          else button().click();
        }, { once: true });
        try {
          const delivered = oneEvent(el, eventName);
          button().click();
          await delivered;
          if (retirement === 'new copy') await waitUntil(() => outcomes === 2);
          await nextFrame();
          expect(writes).to.equal(retirement === 'new copy' ? 2 : 1);
          expect(active.size, 'only the current copy may retain a confirmation timer').to.equal(retirement === 'new copy' ? 1 : 0);
          if (retirement === 'disconnect') wrapper.append(el);
          if (retirement === 'disable') el.codeBlockHeader = true;
          await el.updateComplete;
          await waitUntil(() => Boolean(button()));
          const recovered = oneEvent(el, 'lr-copy');
          button().click();
          await recovered;
          await el.updateComplete;
          expect(button().part.contains('code-block-copy-success')).to.equal(true);
          expect(active.size).to.equal(1);
          el.remove();
          expect(active.size, 'disconnect releases the current confirmation timer').to.equal(0);
        } finally {
          el.remove();
          for (const handle of active) nativeClearTimeout.call(owner, handle);
          owner.setTimeout = nativeSetTimeout;
          owner.clearTimeout = nativeClearTimeout;
          if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
          else Reflect.deleteProperty(navigator, 'clipboard');
        }
      });
    }
  }
}
