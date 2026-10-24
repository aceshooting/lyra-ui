import { expect, fixture, html } from '@open-wc/testing';
import './stack-trace.js';
import type { LyraStackTrace } from './stack-trace.class.js';

const trace = [
  '    at /app/main.js:4:2',
  '    at first (/vendor/first.js:10:2)',
  '    at second (/vendor/second.js:20:3)',
].join('\n');

describe('stack-trace pattern admission boundaries', () => {
  for (const kind of ['non-array', 'unreadable length'] as const) {
    it(`clears ${kind} patterns without losing frame navigation and accepts a later valid binding`, async () => {
      const el = await fixture<LyraStackTrace>(html`<lr-stack-trace .trace=${trace} .internalPatterns=${['/vendor/']}></lr-stack-trace>`);
      expect(el.shadowRoot!.querySelectorAll('[part="frame"]').length).to.equal(1);
      const patterns = kind === 'non-array' ? { 0: '/vendor/', length: 1 } : new Proxy(['/vendor/'], {
        getOwnPropertyDescriptor() { throw new Error('Unreadable patterns'); },
      });
      Reflect.set(el, 'internalPatterns', patterns);
      await el.updateComplete;
      expect(el.internalPatterns).to.deep.equal([]);
      expect(el.shadowRoot!.querySelectorAll('[part="internal-toggle"]').length).to.equal(0);
      expect(el.shadowRoot!.querySelectorAll('[part="frame"]').length).to.equal(3);
      expect(el.shadowRoot!.querySelectorAll('[part="message"]').length).to.equal(0);
      expect(el.shadowRoot!.querySelectorAll('[part="frame-function"]').length).to.equal(2);
      expect(el.shadowRoot!.querySelector('[part="frame-location"]')!.textContent).to.equal('/app/main.js:4:2');
      let selected: unknown;
      el.addEventListener('lr-frame-select', event => { selected = (event as CustomEvent).detail; });
      el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="frame"]')[1]!.click();
      expect(selected).to.deep.equal({ file: '/vendor/first.js', line: 10, column: 2,
        raw: '    at first (/vendor/first.js:10:2)' });
      el.internalPatterns = ['/vendor/'];
      await el.updateComplete;
      expect(el.shadowRoot!.querySelectorAll('[part="frame"]').length).to.equal(1);
      expect(el.shadowRoot!.querySelector('[part="internal-toggle"]')!.getAttribute('aria-expanded')).to.equal('false');
    });
  }

  it('skips inaccessible pattern entries without invoking accessors or suppressing later valid patterns', async () => {
    let accessorReads = 0;
    const input: unknown[] = [undefined, undefined, undefined, '/vendor/'];
    delete input[0];
    Object.defineProperty(input, '1', { get() { accessorReads++; return '/app/'; } });
    const patterns = new Proxy(input, {
      getOwnPropertyDescriptor(target, key) {
        if (key === '2') throw new Error('Unreadable entry');
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    const el = await fixture<LyraStackTrace>(html`<lr-stack-trace .trace=${trace} .internalPatterns=${patterns}></lr-stack-trace>`);
    expect(accessorReads).to.equal(0);
    expect(el.internalPatterns).to.deep.equal(['/vendor/']);
    expect(Object.isFrozen(el.internalPatterns)).to.equal(true);
    const frameCount = () => el.shadowRoot!.querySelectorAll('[part="frame"]').length;
    const toggle = () => el.shadowRoot!.querySelector<HTMLButtonElement>('[part="internal-toggle"]')!;
    expect(frameCount()).to.equal(1);
    toggle().click();
    await el.updateComplete;
    expect(frameCount()).to.equal(3);
    expect(toggle().getAttribute('aria-expanded')).to.equal('true');
    toggle().click();
    await el.updateComplete;
    expect(frameCount()).to.equal(1);
    expect(toggle().getAttribute('aria-expanded')).to.equal('false');
    expect(accessorReads).to.equal(0);
  });
});
