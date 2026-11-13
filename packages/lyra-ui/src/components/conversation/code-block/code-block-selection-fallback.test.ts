import { expect, fixture, html } from '@open-wc/testing';
import './code-block.js';
import './code-block-core.js';
import type { LyraCodeBlockBase } from './code-block-base.class.js';
import type { TextSelectRect } from '../../viewers/document-viewer/anchors.js';

async function mount(tag: 'lr-code-block' | 'lr-code-block-core'): Promise<LyraCodeBlockBase> {
  const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
  const element = document.createElement(tag);
  element.code = 'alpha\nbeta\ngamma';
  wrapper.append(element);
  await element.updateComplete;
  return element;
}

function dispatchLegacySelection(element: LyraCodeBlockBase, range: Range | null, route: 'window' | 'shadow'): void {
  const root = element.shadowRoot!;
  const windowDescriptor = Object.getOwnPropertyDescriptor(window, 'getSelection');
  const shadowDescriptor = Object.getOwnPropertyDescriptor(root, 'getSelection');
  const native = window.getSelection()!;
  // Keep a real platform Selection and DOM Range behind the legacy capability adapter.
  const selection = new Proxy(native, {
    get(target, key): unknown {
      if (key === 'getComposedRanges') return undefined;
      if (key === 'rangeCount') return range ? 1 : 0;
      if (key === 'isCollapsed') return range?.collapsed ?? true;
      if (key === 'getRangeAt') return () => range;
      const value: unknown = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  try {
    Object.defineProperty(window, 'getSelection', { configurable: true, value: () => route === 'window' ? selection : null });
    Object.defineProperty(root, 'getSelection', { configurable: true, value: route === 'shadow' ? () => selection : undefined });
    root.querySelector('[part="body"]')!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
  } finally {
    if (windowDescriptor) Object.defineProperty(window, 'getSelection', windowDescriptor);
    else Reflect.deleteProperty(window, 'getSelection');
    if (shadowDescriptor) Object.defineProperty(root, 'getSelection', shadowDescriptor);
    else Reflect.deleteProperty(root, 'getSelection');
  }
}

for (const tag of ['lr-code-block', 'lr-code-block-core'] as const) {
  for (const route of ['window', 'shadow'] as const) {
    it(`${tag} anchors element-boundary selections through the legacy ${route} API`, async () => {
      const element = await mount(tag);
      const first = element.shadowRoot!.querySelector('[data-line="1"] .line-source')!;
      const second = element.shadowRoot!.querySelector('[data-line="2"] .line-source')!;
      const range = document.createRange();
      range.setStart(first, 0); range.setEnd(second, second.childNodes.length);
      const details: { text: string; anchor: unknown; rects: readonly TextSelectRect[] }[] = [];
      element.addEventListener('lr-text-select', event => { details.push(event.detail); });
      dispatchLegacySelection(element, range, route);
      expect(details.length).to.equal(1);
      expect(details[0]!.text).to.equal('alpha beta');
      expect(details[0]!.anchor).to.deep.equal({ kind: 'line-range', start: 1, end: 2 });
      expect(details[0]!.rects.length).to.be.greaterThan(0);
      expect(details[0]!.rects.every(rect => [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite))).to.equal(true);
      range.collapse(true);
      dispatchLegacySelection(element, range, route);
      dispatchLegacySelection(element, null, route);
      expect(details.length).to.equal(1);
    });
  }

  it(`${tag} ignores a native selection belonging to another element with line metadata`, async () => {
    const external = await fixture<HTMLSpanElement>(html`<span data-line="99">External text</span>`);
    const element = await mount(tag);
    const selection = window.getSelection()!;
    const range = document.createRange(); range.selectNodeContents(external);
    let events = 0;
    element.addEventListener('lr-text-select', () => { events++; });
    try {
      selection.removeAllRanges(); selection.addRange(range);
      expect(selection.toString()).to.equal('External text');
      element.shadowRoot!.querySelector('[part="body"]')!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
      expect(events).to.equal(0);
    } finally { selection.removeAllRanges(); }
    const line = element.shadowRoot!.querySelector('[data-line="1"] .line-source')!;
    range.selectNodeContents(line);
    dispatchLegacySelection(element, range, 'window');
    expect(events).to.equal(1);
  });
}
