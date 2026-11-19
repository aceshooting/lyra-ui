import { expect, fixture, waitUntil } from '@open-wc/testing';
import jsonGrammar from 'shiki/langs/json.mjs';
import './code-block.js';
import './code-block-core.js';
import type { LyraCodeBlock } from './code-block.js';

for (const name of ['lr-code-block', 'lr-code-block-core']) {
  for (const syntax of [false, true]) {
    it(`${name} describes highlighted and active lines with syntax highlighting ${syntax}`, async () => {
      const el = await fixture<LyraCodeBlock>(`<${name} line-numbers activatable-lines></${name}>`);
      el.code = '1\n2\n3';
      if (syntax) {
        el.languages = { json: jsonGrammar };
        el.language = 'json';
      }
      el.highlightLines = '1';
      el.highlights = [{ id: 'target', anchor: { kind: 'line-range', start: 2 } }];
      el.activeHighlightId = 'target';
      await el.updateComplete;
      if (syntax) await waitUntil(() => Boolean(el.shadowRoot!.querySelector('pre.shiki')), 'syntax highlighting', { timeout: 10000 });
      const lines = el.shadowRoot!.querySelectorAll<HTMLElement>('.line');
      expect(lines[0]!.getAttribute('role')).to.equal('mark');
      expect(lines[0]!.getAttribute('aria-roledescription')).to.equal('Highlighted line');
      expect(lines[1]!.querySelector('button')!.getAttribute('aria-description')).to.equal('Active highlighted line');
      expect(lines[2]!.hasAttribute('role')).to.equal(false);
      expect(getComputedStyle(lines[0]!, '::before').borderInlineStartStyle).to.equal('solid');
      el.strings = { codeBlockActiveLine: 'Current annotation' };
      await el.updateComplete;
      expect(lines[1]!.getAttribute('aria-roledescription')).to.equal('Current annotation');
      el.activeHighlightId = null;
      el.highlights = [];
      await el.updateComplete;
      expect(lines[1]!.querySelector('button')!.hasAttribute('aria-description')).to.equal(false);
      expect(lines[1]!.getAttribute('role')).to.equal(null);
    });
  }

  it(`${name} leaves browser shortcuts and IME keys alone and activates once per press`, async () => {
    const el = await fixture<LyraCodeBlock>(`<${name} line-numbers activatable-lines></${name}>`);
    el.code = '1\n2';
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('button.line-gutter')!;
    let activations = 0;
    el.addEventListener('lr-line-activate', () => activations++);
    for (const init of [{ key: 'End', ctrlKey: true }, { key: 'ArrowDown', altKey: true },
      { key: 'Enter', isComposing: true }, { key: ' ', metaKey: true }]) {
      const event = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true });
      button.dispatchEvent(event);
      expect(event.defaultPrevented, init.key).to.equal(false);
    }
    const consumed = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    consumed.preventDefault();
    button.dispatchEvent(consumed);
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, cancelable: true }));
    expect(activations).to.equal(0);
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(activations).to.equal(1);
  });
}

for (const name of ['lr-code-block', 'lr-code-block-core']) {
  it(`${name} numbers mixed line endings including an empty trailing line`, async () => {
    const el = await fixture<LyraCodeBlock>(`<${name} line-numbers activatable-lines></${name}>`);
    el.code = 'one\r\ntwo\rthree\n';
    await el.updateComplete;
    const rows = el.shadowRoot!.querySelectorAll<HTMLElement>('.line');
    expect(Array.from(rows, row => row.querySelector('.line-source')?.textContent)).to.deep.equal(['one', 'two', 'three', '']);
    expect(rows[3]!.querySelector('button')?.getAttribute('aria-label')).to.equal('Line 4');
  });
}
