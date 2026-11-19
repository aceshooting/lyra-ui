import { expect, fixture, html } from '@open-wc/testing';
import type { LyraTabGroup } from './tab-group.class.js';
import './tab-group.js';
import './tab.js';
import './tab-panel.js';

const make = (activation: 'auto' | 'manual', closable = false): Promise<LyraTabGroup> =>
  fixture<LyraTabGroup>(html`<lr-tab-group activation=${activation}>
    <lr-tab panel="a" ?closable=${closable}>A</lr-tab>
    <lr-tab panel="b" ?closable=${closable}>B</lr-tab>
    <lr-tab-panel name="a">A body</lr-tab-panel>
    <lr-tab-panel name="b">B body</lr-tab-panel>
  </lr-tab-group>`);
const buttons = (el: LyraTabGroup) => [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="tab"]')];
const send = (target: HTMLElement, init: KeyboardEventInit): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { bubbles: true, composed: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
};

describe('lr-tab-group key guards', () => {
  it('neither cancels nor acts on IME composition or modified navigation keys', async () => {
    const el = await make('manual', true);
    const first = buttons(el)[0]!;
    const events: string[] = [];
    el.addEventListener('lr-close', event => events.push(event.type));
    el.addEventListener('lr-activate', event => events.push(event.type));
    for (const key of ['ArrowRight', 'Enter', ' ', 'Delete']) {
      for (const init of [{ keyCode: 229 }, { isComposing: true }, { altKey: true }, { ctrlKey: true }, { metaKey: true }]) {
        expect(send(first, { key, ...init }).defaultPrevented, key + JSON.stringify(init)).to.equal(false);
      }
    }
    expect(events).to.deep.equal([]);
    expect(el.active).to.equal('a');
  });

  it('activates a manual tab once for a held Enter', async () => {
    const el = await make('manual');
    send(buttons(el)[0]!, { key: 'ArrowRight' });
    await el.updateComplete;
    let shows = 0;
    let activations = 0;
    el.addEventListener('lr-activate', () => { activations++; });
    el.addEventListener('lr-tab-show', () => (shows += 1));
    for (const repeat of [false, true, true]) send(buttons(el)[1]!, { key: 'Enter', repeat });
    await el.updateComplete;
    expect(el.active).to.equal('b');
    expect(shows).to.equal(1);
    expect(activations).to.equal(1);
  });

  it('closes one tab for a held Delete', async () => {
    const el = await make('auto', true);
    let requests = 0;
    el.addEventListener('lr-close', () => (requests += 1));
    const first = buttons(el)[0]!;
    for (const repeat of [false, true, true]) send(first, { key: 'Delete', repeat });
    expect(requests).to.equal(1);
  });
});
