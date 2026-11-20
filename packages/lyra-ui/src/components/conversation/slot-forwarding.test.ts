import { expect, fixture, html } from '@open-wc/testing';
import '../lr-chat-message.js';
import '../lr-conversation-item.js';
import '../lr-handoff-divider.js';
import '../lr-stream-status.js';
import '../lr-chat-composer.js';
import '../lr-avatar.js';
import '../lr-app-rail-item.js';

/** A component markup string, its forwarded slot name, and the wrapper part that slot toggles. */
interface ForwardingCase {
  readonly markup: (forwarder: string) => string;
  readonly slot: string;
  readonly part: string;
}

const CASES: readonly ForwardingCase[] = [
  { markup: (f) => `<lr-chat-message>Hi${f}</lr-chat-message>`, slot: 'actions', part: 'actions' },
  { markup: (f) => `<lr-chat-message>Hi${f}</lr-chat-message>`, slot: 'avatar', part: 'avatar' },
  { markup: (f) => `<lr-chat-message>Hi${f}</lr-chat-message>`, slot: 'badges', part: 'badges' },
  { markup: (f) => `<lr-conversation-item label="Plan">${f}</lr-conversation-item>`, slot: 'actions', part: 'actions' },
  { markup: (f) => `<lr-conversation-item label="Plan">${f}</lr-conversation-item>`, slot: 'meta', part: 'meta' },
  { markup: (f) => `<lr-conversation-item label="Plan">${f}</lr-conversation-item>`, slot: 'start', part: 'start' },
  { markup: (f) => `<lr-handoff-divider to-agent="Billing">${f}</lr-handoff-divider>`, slot: 'avatar', part: 'avatar' },
  { markup: (f) => `<lr-stream-status connection-state="streaming">${f}</lr-stream-status>`, slot: 'actions', part: 'actions' },
  { markup: (f) => `<lr-chat-composer>${f}</lr-chat-composer>`, slot: 'chips', part: 'chips' },
  { markup: (f) => `<lr-app-rail-item href="/inbox">Inbox${f}</lr-app-rail-item>`, slot: 'end', part: 'end' },
];

async function settle(el: HTMLElement & { updateComplete?: Promise<unknown> }): Promise<void> {
  await el.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await el.updateComplete;
}

/** Mounts `markup` inside a wrapper shadow root that forwards `slot` from the wrapper's light DOM. */
async function mountForwarded(c: ForwardingCase): Promise<{ wrapper: HTMLElement; el: HTMLElement }> {
  const wrapper = await fixture<HTMLElement>(html`<div></div>`);
  const root = wrapper.attachShadow({ mode: 'open' });
  root.innerHTML = c.markup(`<slot name="${c.slot}" slot="${c.slot}"></slot>`);
  const el = root.firstElementChild as HTMLElement;
  await settle(el);
  return { wrapper, el };
}

function partHidden(el: HTMLElement, part: string): boolean {
  const node = el.shadowRoot?.querySelector<HTMLElement>(`[part~="${part}"]`);
  if (!node) return true;
  return node.hidden || node.closest('[hidden]') !== null;
}

describe('forwarded slots', () => {
  for (const c of CASES) {
    const name = c.markup('').match(/^<([a-z-]+)/)![1];
    it(`${name}: an empty forwarded "${c.slot}" slot renders no ${c.part} chrome; forwarded content does`, async () => {
      const { wrapper, el } = await mountForwarded(c);
      expect(partHidden(el, c.part), 'empty forwarder').to.equal(true);

      const content = document.createElement('span');
      content.slot = c.slot;
      content.textContent = 'x';
      wrapper.append(content);
      await settle(el);
      expect(partHidden(el, c.part), 'forwarded content').to.equal(false);

      content.remove();
      await settle(el);
      expect(partHidden(el, c.part), 'forwarded content removed').to.equal(true);
    });
  }

  it('lr-avatar: an empty forwarded icon slot keeps the initials fallback', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div></div>`);
    const root = wrapper.attachShadow({ mode: 'open' });
    root.innerHTML = '<lr-avatar initials="AB"><slot name="icon" slot="icon"></slot></lr-avatar>';
    const el = root.firstElementChild as HTMLElement;
    await settle(el);
    expect(partHidden(el, 'icon')).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="initials"]')?.textContent?.trim()).to.equal('AB');
  });
});
