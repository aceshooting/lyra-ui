import { expect, fixture, html, waitUntil, aTimeout } from '@open-wc/testing';
import './chat-viewport.js';
import type { LyraChatViewport } from './chat-viewport.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';

class DeferredMessage extends HTMLElement {
  updateComplete: PromiseLike<unknown> = Promise.resolve();
}
customElements.define('deferred-conversation-message', DeferredMessage);
let lazyMessageId = 0;

function announcements(): string[] {
  const sink = document.querySelector(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`);
  return Array.from(sink?.children ?? [], node => node.textContent ?? '');
}

describe('deferred conversation announcements', () => {
  it('waits for a genuinely unupgraded message definition before observing its first render', async () => {
    const viewport = await fixture<LyraChatViewport>(html`<lr-chat-viewport live="polite"></lr-chat-viewport>`);
    const tagName = `lazy-conversation-message-${++lazyMessageId}`;
    const message = document.createElement(tagName);
    viewport.append(message);
    await aTimeout(0);
    expect(message.matches(':defined')).to.equal(false);
    expect(announcements()).to.deep.equal([]);
    let complete: () => void = () => {};
    customElements.define(tagName, class extends HTMLElement {
      readonly updateComplete: Promise<void>;
      constructor() {
        super();
        const text = document.createElement('span');
        this.attachShadow({ mode: 'open' }).append(text);
        this.updateComplete = new Promise<void>(resolve => {
          complete = () => { text.textContent = 'Completed lazy reply'; resolve(); };
        });
      }
    });
    await aTimeout(0);
    expect(message.matches(':defined')).to.equal(true);
    expect(announcements()).to.deep.equal([]);
    complete();
    await waitUntil(() => announcements().includes('Completed lazy reply'), 'the lazy reply is announced after rendering');
    expect(announcements()).to.deep.equal(['Completed lazy reply']);
  });

  it('announces an already-upgraded foreign message after adopting it into this document', async () => {
    const frame = await fixture<HTMLIFrameElement>(html`<iframe title="Custom element realm"></iframe>`);
    const foreignWindow = frame.contentWindow as Window & typeof globalThis;
    const tagName = 'adopted-conversation-message';
    let complete: () => void = () => {};
    foreignWindow.customElements.define(tagName, class extends foreignWindow.HTMLElement {
      readonly updateComplete: Promise<void>;
      constructor() {
        super();
        const text = foreignWindow.document.createElement('span');
        this.attachShadow({ mode: 'open' }).append(text);
        this.updateComplete = new foreignWindow.Promise<void>(resolve => {
          complete = () => { text.textContent = 'Completed adopted reply'; resolve(); };
        });
      }
    });
    const message = frame.contentDocument!.createElement(tagName);
    expect(message.matches(':defined')).to.equal(true);
    expect(customElements.get(tagName)).to.equal(undefined);
    const viewport = await fixture<LyraChatViewport>(html`<lr-chat-viewport live="polite"></lr-chat-viewport>`);
    viewport.append(message);
    expect(message.ownerDocument === document).to.equal(true);
    await aTimeout(0);
    complete();
    await waitUntil(() => announcements().includes('Completed adopted reply'), 'the upgraded adopted reply is announced');
    expect(announcements()).to.deep.equal(['Completed adopted reply']);
  });

  it('announces an ordinary native completion once and stays silent when that message is moved', async () => {
    const viewport = await fixture<LyraChatViewport>(html`<lr-chat-viewport live="polite"></lr-chat-viewport>`);
    const message = document.createElement('deferred-conversation-message') as DeferredMessage;
    const text = document.createElement('span');
    message.attachShadow({ mode: 'open' }).append(text);
    let complete: () => void = () => {};
    message.updateComplete = new Promise<void>(resolve => {
      complete = () => { text.textContent = 'Completed native reply'; resolve(); };
    });
    viewport.append(message);
    await aTimeout(0);
    complete();
    await waitUntil(() => announcements().includes('Completed native reply'), 'the completed reply is announced');
    viewport.append(message);
    await aTimeout(0);
    expect(announcements()).to.deep.equal(['Completed native reply']);
  });

  it('announces a rendered child after a foreign-realm update promise settles', async () => {
    const frame = await fixture<HTMLIFrameElement>(html`<iframe title="Promise realm"></iframe>`);
    const foreignWindow = frame.contentWindow as Window & typeof globalThis;
    const viewport = await fixture<LyraChatViewport>(html`<lr-chat-viewport live="polite"></lr-chat-viewport>`);
    const message = document.createElement('deferred-conversation-message') as DeferredMessage;
    const text = document.createElement('span');
    message.attachShadow({ mode: 'open' }).append(text);
    let complete: () => void = () => {};
    message.updateComplete = new foreignWindow.Promise<void>(resolve => {
      complete = () => { text.textContent = 'Completed foreign reply'; resolve(); };
    });
    viewport.append(message);
    await aTimeout(0);
    expect(announcements()).to.deep.equal([]);
    complete();
    await waitUntil(() => announcements().includes('Completed foreign reply'), 'the completed reply reaches the announcement sink');
    expect(announcements()).to.deep.equal(['Completed foreign reply']);
  });

  it('suppresses a rejected child render and remains able to announce the next message', async () => {
    const viewport = await fixture<LyraChatViewport>(html`<lr-chat-viewport live="polite"></lr-chat-viewport>`);
    const message = document.createElement('deferred-conversation-message') as DeferredMessage;
    message.attachShadow({ mode: 'open' });
    let reject: (reason: Error) => void = () => {};
    message.updateComplete = new Promise<void>((_resolve, rejectPromise) => { reject = rejectPromise; });
    viewport.append(message);
    await aTimeout(0);
    reject(new Error('Message rendering failed'));
    await aTimeout(0);
    expect(announcements()).to.deep.equal([]);
    const next = document.createElement('div');
    next.textContent = 'Following successful reply';
    viewport.append(next);
    await waitUntil(() => announcements().includes(next.textContent!), 'a later reply remains announceable');
    expect(announcements()).to.deep.equal(['Following successful reply']);
  });

  for (const property of ['updateComplete', 'then'] as const) {
    it(`contains a throwing ${property} getter without preventing later announcements`, async () => {
      const viewport = await fixture<LyraChatViewport>(html`<lr-chat-viewport live="polite"></lr-chat-viewport>`);
      const message = document.createElement('deferred-conversation-message') as DeferredMessage;
      message.attachShadow({ mode: 'open' });
      const target = property === 'updateComplete' ? message : {};
      Object.defineProperty(target, property, { get() { throw new Error('Completion unavailable'); } });
      if (property === 'then') message.updateComplete = target as PromiseLike<unknown>;
      viewport.append(message);
      await aTimeout(0);
      expect(announcements()).to.deep.equal([]);
      const next = document.createElement('div');
      next.textContent = 'Recovered reply';
      viewport.append(next);
      await waitUntil(() => announcements().includes('Recovered reply'), 'the next reply is announced');
      expect(announcements()).to.deep.equal(['Recovered reply']);
    });
  }

  for (const cancellation of ['remove-message', 'disconnect-viewport', 'disable-live'] as const) {
    it(`keeps a completed reply silent after ${cancellation}`, async () => {
      const viewport = await fixture<LyraChatViewport>(html`<lr-chat-viewport live="polite"></lr-chat-viewport>`);
      const message = document.createElement('deferred-conversation-message') as DeferredMessage;
      const text = document.createElement('span');
      message.attachShadow({ mode: 'open' }).append(text);
      let complete: () => void = () => {};
      message.updateComplete = new Promise<void>(resolve => {
        complete = () => { text.textContent = 'Cancelled reply'; resolve(); };
      });
      viewport.append(message);
      await aTimeout(0);
      if (cancellation === 'remove-message') message.remove();
      else if (cancellation === 'disconnect-viewport') viewport.remove();
      else { viewport.live = 'off'; await viewport.updateComplete; }
      complete();
      await message.updateComplete;
      await aTimeout(0);
      expect(announcements()).to.deep.equal([]);
    });
  }
});
