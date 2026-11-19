import { expect, fixture, oneEvent, waitUntil } from '@open-wc/testing';
import { setForcedColors } from '../../../../test/wtr-media.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import './markdown.js';
import './markdown-core.js';
import type { LyraMarkdown } from './markdown.js';

for (const name of ['lr-markdown', 'lr-markdown-core']) {
  it(`${name} reads the resolved syntax palette on its first render`, async () => {
    const wrapper = await fixture<HTMLElement>(`<div data-lr-theme-scope style="--lr-theme-color-text-normal:white;--lr-theme-color-surface-default:black"><${name}></${name}></div>`);
    const el = wrapper.firstElementChild as LyraMarkdown;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="content"]')!.getAttribute('data-dark-theme')).to.equal('true');
  });

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

  it(`${name} keeps feedback independent across fences and ignores superseded writes`, async () => {
    const el = await fixture<LyraMarkdown>(`<${name} code-block-header without-syntax-highlighting></${name}>`);
    el.content = ['~~~', 'first', '~~~', '', '~~~', 'second', '~~~'].join('\n');
    await waitUntil(() => el.shadowRoot!.querySelectorAll('button').length === 2);
    const [first, second] = el.shadowRoot!.querySelectorAll('button');
    const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const writes: Array<{ text: string; finish: () => void }> = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: (text: string) => new Promise<void>(finish => writes.push({ text, finish })),
    } });
    const copied: string[] = [];
    el.addEventListener('lr-copy', event => copied.push(event.detail.text));
    try {
      first!.click();
      second!.click();
      first!.click();
      await waitUntil(() => writes.length === 3);
      expect(writes.map(write => write.text)).to.deep.equal(['first', 'second', 'first']);
      for (const index of [1, 2]) {
        const done = oneEvent(el, 'lr-copy');
        writes[index]!.finish();
        await done;
      }
      writes[0]!.finish();
      await el.updateComplete;
      expect(copied).to.deep.equal(['second', 'first']);
      expect(el.shadowRoot!.querySelectorAll('[part~="code-block-copy-success"]').length).to.equal(2);
      const stale = writes.length;
      first!.click();
      await waitUntil(() => writes.length === stale + 1);
      el.remove();
      writes[stale]!.finish();
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(copied).to.deep.equal(['second', 'first']);
    } finally {
      if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard);
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

  it(`${name} honors a minimum content size independent of icon buttons`, async () => {
    const el = await fixture<LyraMarkdown>(`<${name}></${name}>`);
    el.style.cssText = '--lr-markdown-content-min-size:47px;--lr-icon-button-size:29px';
    const content = el.shadowRoot!.querySelector('[part="content"]')!;
    const style = getComputedStyle(content);
    expect(style.minInlineSize).to.equal('47px');
    expect(style.minBlockSize).to.equal('47px');
  });

  it(`${name} paints neutral highlights against the ordinary surface`, async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'Highlight');
    Object.defineProperty(window, 'Highlight', { configurable: true, value: undefined });
    try {
      const el = await fixture<LyraMarkdown>(`<${name}></${name}>`);
      el.style.cssText = '--lr-color-surface:white;--lr-color-surface-raised:tan;';
      el.content = 'Marked words.';
      el.highlights = [{ id: 'quote', tone: 'neutral', anchor: { kind: 'text-quote', quote: 'words' } }];
      await waitUntil(() => Boolean(el.shadowRoot!.querySelector('p mark')));
      const mark = el.shadowRoot!.querySelector('p mark')!;
      expect(getComputedStyle(mark).backgroundColor).to.equal('rgb(210, 180, 140)');
      el.style.setProperty('--lr-markdown-highlight-neutral-bg', 'teal');
      expect(getComputedStyle(mark).backgroundColor).to.equal('rgb(0, 128, 128)');
    } finally {
      if (descriptor) Object.defineProperty(window, 'Highlight', descriptor);
      else Reflect.deleteProperty(window, 'Highlight');
    }
  });

  it(`${name} themes fenced copy independently in each pointer state`, async () => {
    const el = await fixture<LyraMarkdown>(`<${name} code-block-header without-syntax-highlighting></${name}>`);
    el.content = '\x60\x60\x60\nsource\n\x60\x60\x60';
    await waitUntil(() => Boolean(el.shadowRoot!.querySelector('button')));
    const button = el.shadowRoot!.querySelector('button')!;
    el.style.cssText = '--lr-markdown-code-copy-bg:red;--lr-markdown-code-copy-bg-hover:green;--lr-markdown-code-copy-bg-active:blue';
    const background = () => getComputedStyle(button).backgroundColor;
    try {
      await resetMouse();
      await waitUntil(() => background() === 'rgb(255, 0, 0)');
      await hoverUntilMatched(button, 'hovering the fenced copy control');
      await waitUntil(() => background() === 'rgb(0, 128, 0)');
      await sendMouse({ type: 'down' });
      await waitUntil(() => background() === 'rgb(0, 0, 255)');
    } finally {
      await resetMouse();
    }
  });

  for (const progressive of [false, true]) {
    it(`${name} settles ${progressive ? 'progressive' : 'plain'} streaming when animation frames stop`, async () => {
      const el = await fixture<LyraMarkdown>(`<${name}></${name}>`);
      el.content = '# Initial';
      await waitUntil(() => el.shadowRoot!.querySelector('h1')?.textContent === 'Initial');
      const originalRequest = window.requestAnimationFrame;
      const originalCancel = window.cancelAnimationFrame;
      let frames = 0;
      let deadline: number | undefined;
      window.requestAnimationFrame = () => ++frames;
      window.cancelAnimationFrame = () => {};
      try {
        el.streamingRender = progressive ? 'progressive' : 'plain';
        el.streaming = true;
        el.content = '# Updated\n\nFollowing text.';
        const completed = await Promise.race([
          el.updateComplete.then(() => true),
          new Promise<false>(resolve => { deadline = window.setTimeout(() => resolve(false), 700); }),
        ]);
        expect(completed).to.be.true;
        expect(el.shadowRoot!.querySelector('[part="content"]')!.textContent).to.include('Following text.');
        expect(el.shadowRoot!.querySelector('h1')?.textContent).to.equal(progressive ? 'Updated' : undefined);
        if (!progressive) expect(frames).to.equal(0);
      } finally {
        window.clearTimeout(deadline);
        el.remove();
        window.requestAnimationFrame = originalRequest;
        window.cancelAnimationFrame = originalCancel;
      }
    });
  }
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
