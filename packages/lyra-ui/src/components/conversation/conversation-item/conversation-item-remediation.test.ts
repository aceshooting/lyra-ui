import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './conversation-item.js';
import '../thread-list/thread-list.js';
import type { LyraConversationItem } from './conversation-item.js';

for (const legacy of [false, true]) {
  for (const key of ['Enter', 'Escape']) {
    it(`keeps composing ${key} in the thread rename editor (${legacy ? 'legacy' : 'modern'})`, async () => {
      const list = await fixture(html`<lr-thread-list><lr-conversation-item label="Before"></lr-conversation-item></lr-thread-list>`);
      const el = list.querySelector<LyraConversationItem>('lr-conversation-item')!;
      await el.updateComplete;
      el.shadowRoot!.querySelector<HTMLButtonElement>('[part="rename-button"]')!.click();
      await el.updateComplete;
      const input = el.shadowRoot!.querySelector<HTMLInputElement>('[part="label-input"]')!;
      input.value = 'Draft';
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      let renames = 0;
      let selections = 0;
      list.addEventListener('lr-rename', () => { renames += 1; });
      el.addEventListener('lr-select', () => { selections += 1; });
      const composing = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, isComposing: !legacy, keyCode: legacy ? 229 : 0 });
      input.dispatchEvent(composing);
      await el.updateComplete;
      expect(composing.defaultPrevented).to.equal(false);
      expect(renames).to.equal(0);
      expect(selections).to.equal(0);
      expect(el.shadowRoot!.querySelectorAll('[part="label-input"]').length).to.equal(1);
      expect(input.value).to.equal('Draft');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true }));
      await el.updateComplete;
      expect(renames).to.equal(1);
      expect(selections).to.equal(0);
      expect(el.shadowRoot!.querySelectorAll('[part="label-input"]').length).to.equal(0);
    });
  }
}

for (const legacy of [false, true]) {
  for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) {
    it(`contains composing ${key} within a data-mode thread rename (${legacy ? 'legacy' : 'modern'})`, async () => {
      const list = await fixture(html`<lr-thread-list .threads=${[
        { id: 'first', title: 'First' },
        { id: 'second', title: 'Second' },
      ]}></lr-thread-list>`);
      const virtual = list.shadowRoot!.querySelector('lr-virtual-list')!;
      await waitUntil(() => virtual.shadowRoot!.querySelectorAll('lr-conversation-item').length === 2);
      const el = virtual.shadowRoot!.querySelector<LyraConversationItem>('lr-conversation-item')!;
      el.shadowRoot!.querySelector<HTMLButtonElement>('[part="rename-button"]')!.click();
      await el.updateComplete;
      const input = el.shadowRoot!.querySelector<HTMLInputElement>('[part="label-input"]')!;
      input.focus();
      const composing = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, isComposing: !legacy, keyCode: legacy ? 229 : 0 });
      input.dispatchEvent(composing);
      await el.updateComplete;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      expect(composing.defaultPrevented).to.equal(false);
      expect(el.shadowRoot!.activeElement === input).to.equal(true);
      expect(el.shadowRoot!.querySelectorAll('[part="label-input"]').length).to.equal(1);
    });
  }
}
