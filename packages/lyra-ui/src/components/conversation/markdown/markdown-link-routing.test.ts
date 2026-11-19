import { expect, fixture, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { supportsCustomHighlights } from '../../../internal/text-highlights.js';
import './markdown.js';
import './markdown-core.js';
import type { LyraMarkdown } from './markdown.js';

async function clickWithoutNavigation(
  anchor: HTMLAnchorElement,
  activate: () => void | Promise<void>,
): Promise<{ seen: boolean; prevented: boolean }> {
  let seen = false;
  let prevented = false;
  const observe = (event: MouseEvent): void => {
    if (!event.composedPath().includes(anchor)) return;
    seen = true;
    prevented = event.defaultPrevented;
    event.preventDefault();
  };
  document.addEventListener('click', observe);
  try {
    await activate();
    return { seen, prevented };
  } finally {
    document.removeEventListener('click', observe);
  }
}

function pointInText(node: Node): MouseEventInit {
  const range = document.createRange();
  range.selectNodeContents(node);
  const rect = range.getBoundingClientRect();
  return { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
}

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

  it(`${name} activates a painted text highlight at its rendered coordinates`, async () => {
    const el = await fixture<LyraMarkdown>(`<${name}></${name}>`);
    el.content = 'Hello world';
    el.highlights = [{ id: 'h1', anchor: { kind: 'text-quote', quote: 'world' } }];
    await waitUntil(() => Boolean(el.shadowRoot!.querySelector('p')));
    await el.updateComplete;
    const paragraph = el.shadowRoot!.querySelector('p')!;
    const text = paragraph.querySelector('mark')?.firstChild ?? paragraph.firstChild!;
    const range = document.createRange();
    const offset = text.textContent!.indexOf('world');
    range.setStart(text, offset);
    range.setEnd(text, offset + 'world'.length);
    const rect = range.getClientRects()[0]!;
    const activations: unknown[] = [];
    el.addEventListener('lr-highlight-activate', event => activations.push(event.detail));
    paragraph.dispatchEvent(new MouseEvent('click', {
      bubbles: true, composed: true, detail: 1,
      clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
    }));
    expect(activations).to.deep.equal([{ highlightId: 'h1' }]);
  });

  it(`${name} routes a link outside the highlight without activating the highlight`, async () => {
    const el = await fixture<LyraMarkdown>(`<${name} internal-link-prefix="/docs/"></${name}>`);
    el.content = 'Hello [world](/docs/world) and highlighted brown fox';
    el.highlights = [{ id: 'h1', anchor: { kind: 'text-quote', quote: 'brown fox' } }];
    await waitUntil(() => Boolean(el.shadowRoot!.querySelector('a')));
    await el.updateComplete;
    const anchor = el.shadowRoot!.querySelector('a')!;
    const highlights: unknown[] = [];
    const links: unknown[] = [];
    el.addEventListener('lr-highlight-activate', event => highlights.push(event.detail));
    el.addEventListener('lr-link-activate', event => links.push(event.detail));
    expect(await clickWithoutNavigation(anchor, () => anchor.click())).to.deep.equal({ seen: true, prevented: true });
    expect(links).to.deep.equal([{ href: '/docs/world' }]);
    expect(highlights).to.deep.equal([]);
  });

  it(`${name} activates an overlapping highlight before routing native, pointer and keyboard link clicks`, async () => {
    const el = await fixture<LyraMarkdown>(`<${name} internal-link-prefix="/docs/"></${name}>`);
    el.content = '[linked text](/docs/link)';
    el.highlights = [{ id: 'linked-highlight', anchor: { kind: 'text-quote', quote: 'linked text' } }];
    await waitUntil(() => Boolean(el.shadowRoot!.querySelector('a')));
    await waitUntil(() => {
      if (!supportsCustomHighlights()) return Boolean(el.shadowRoot!.querySelector('a mark'));
      const { highlights } = CSS as unknown as { highlights: ReadonlyMap<string, { size: number }> };
      return (highlights.get('lr-highlight-accent')?.size ?? 0) > 0;
    });
    const anchor = el.shadowRoot!.querySelector('a')!;
    const events: Array<[string, unknown]> = [];
    el.addEventListener('lr-highlight-activate', event => events.push([event.type, event.detail]));
    el.addEventListener('lr-link-activate', event => events.push([event.type, event.detail]));

    const expectActivation = async (activate: () => void | Promise<void>) => {
      expect(await clickWithoutNavigation(anchor, activate)).to.deep.equal({ seen: true, prevented: true });
      expect(events).to.deep.equal([
        ['lr-highlight-activate', { highlightId: 'linked-highlight' }],
        ['lr-link-activate', { href: '/docs/link' }],
      ]);
      events.length = 0;
    };
    await expectActivation(() => anchor.click());
    await expectActivation(() => {
      anchor.dispatchEvent(new MouseEvent('click', {
        bubbles: true, cancelable: true, composed: true, detail: 1, ...pointInText(anchor),
      }));
    });
    await focusByKeyboard(anchor);
    await expectActivation(() => sendKeys({ press: 'Enter' }));
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
