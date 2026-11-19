import { expect, fixture, waitUntil } from '@open-wc/testing';
import './markdown.js';
import './markdown-core.js';
import type { LyraMarkdown } from './markdown.js';

for (const name of ['lr-markdown', 'lr-markdown-core']) {
  it(`${name} routes only an unmodified, unhandled primary link activation`, async () => {
    const el = await fixture<LyraMarkdown>(`<${name} internal-link-prefix="#"></${name}>`);
    el.content = '[Section](#section)';
    await waitUntil(() => Boolean(el.shadowRoot!.querySelector('a')));
    const anchor = el.shadowRoot!.querySelector('a')!;
    let routed = 0;
    el.addEventListener('lr-link-activate', () => routed++);
    for (const init of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      const event = new MouseEvent('click', { ...init, bubbles: true, composed: true, cancelable: true });
      el.addEventListener('click', (click) => click.preventDefault(), { once: true });
      anchor.dispatchEvent(event);
      expect(routed).to.equal(0);
    }
    const event = new MouseEvent('click', { bubbles: true, composed: true, cancelable: true });
    event.preventDefault();
    anchor.dispatchEvent(event);
    expect(routed).to.equal(0);
    anchor.click();
    expect(routed).to.equal(1);
  });

  it(`${name} decorates fences without randomUUID`, async () => {
    const original = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
    Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: undefined });
    try {
      const el = await fixture<LyraMarkdown>(`<${name} code-block-header without-syntax-highlighting></${name}>`);
      el.content = '\x60\x60\x60js\n1\n\x60\x60\x60';
      await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[data-lr-code-frame] button')));
      expect(el.shadowRoot!.querySelector('pre')?.textContent?.trim()).to.equal('1');
    } finally {
      if (original) Object.defineProperty(crypto, 'randomUUID', original);
      else Reflect.deleteProperty(crypto, 'randomUUID');
    }
  });
}
