import { expect, fixture, oneEvent, waitUntil } from '@open-wc/testing';
import { setForcedColors } from '../../../../test/wtr-media.js';
import './markdown.js';
import './markdown-core.js';
import type { LyraMarkdown } from './markdown.js';

for (const name of ['lr-markdown', 'lr-markdown-core']) {
  it(`${name} exposes copy failure to a container in generic and detailed events`, async () => {
    const host = await fixture<HTMLElement>(`<div><${name} code-block-header without-syntax-highlighting></${name}></div>`);
    const el = host.firstElementChild as LyraMarkdown;
    el.content = '\x60\x60\x60\nsource\n\x60\x60\x60';
    await waitUntil(() => Boolean(el.shadowRoot!.querySelector('button')));
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error(); } } });
    try {
      const delivered: string[] = [];
      host.addEventListener('lr-error', (event) => {
        expect((event as CustomEvent).detail).to.equal(null);
        delivered.push(event.type);
      });
      host.addEventListener('lr-copy-error', (event) => delivered.push(event.type));
      const done = oneEvent(host, 'lr-copy-error');
      el.shadowRoot!.querySelector('button')!.click();
      await done;
      expect(delivered).to.deep.equal(['lr-error', 'lr-copy-error']);
    } finally {
      if (descriptor) Object.defineProperty(navigator, 'clipboard', descriptor);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it(`${name} distinguishes highlighted text in forced colors`, async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'Highlight');
    Object.defineProperty(window, 'Highlight', { configurable: true, value: undefined });
    try {
      await setForcedColors('active');
      const el = await fixture<LyraMarkdown>(`<${name}></${name}>`);
      el.content = 'Marked words.';
      el.highlights = [{ id: 'quote', anchor: { kind: 'text-quote', quote: 'words' } }];
      await waitUntil(() => Boolean(el.shadowRoot!.querySelector('p mark')));
      const mark = el.shadowRoot!.querySelector('p mark')!;
      expect(mark.textContent).to.equal('words');
      if (matchMedia('(forced-colors: active)').matches) {
        expect(getComputedStyle(mark).textDecorationLine).to.include('underline');
        el.activeHighlightId = 'quote';
        await el.updateComplete;
        const active = el.shadowRoot!.querySelector('mark[data-lr-highlight-name="lr-highlight-active"]')!;
        expect(getComputedStyle(active).textDecorationStyle).to.equal('double');
      }
    } finally {
      await setForcedColors('none');
      if (descriptor) Object.defineProperty(window, 'Highlight', descriptor);
      else Reflect.deleteProperty(window, 'Highlight');
    }
  });

  it(`${name} omits a blank document name and forwards a meaningful label`, async () => {
    const el = await fixture<LyraMarkdown>(`<${name} aria-label="   " content="Document"></${name}>`);
    const content = el.shadowRoot!.querySelector('[role="document"]')!;
    expect(content.hasAttribute('aria-label')).to.equal(false);
    el.setAttribute('aria-label', '  Notes  ');
    await el.updateComplete;
    expect(content.getAttribute('aria-label')).to.equal('Notes');
  });

  it(`${name} contains an unreadable document focus during header updates`, async () => {
    const el = await fixture<LyraMarkdown>(`<${name} code-block-header></${name}>`);
    const descriptor = Object.getOwnPropertyDescriptor(document, 'activeElement');
    Object.defineProperty(document, 'activeElement', { configurable: true, get() { throw new Error('unavailable'); } });
    try {
      el.content = '# Test';
      await el.updateComplete;
      await waitUntil(() => el.shadowRoot!.querySelector('h1')?.textContent === 'Test');
    } finally {
      if (descriptor) Object.defineProperty(document, 'activeElement', descriptor);
      else Reflect.deleteProperty(document, 'activeElement');
    }
  });
}

for (const name of ['lr-markdown', 'lr-markdown-core']) {
  it(`${name} applies the target policy to rendered forms`, async () => {
    const el = await fixture<LyraMarkdown>(`<${name}></${name}>`);
    el.content = '<form target="results" rel="help"><p>Search</p></form>';
    await waitUntil(() => Boolean(el.shadowRoot!.querySelector('form')));
    const form = el.shadowRoot!.querySelector('form')!;
    expect(form.target).to.equal('results');
    expect([...form.relList].sort()).to.deep.equal(['help', 'noopener', 'noreferrer']);
  });
}
