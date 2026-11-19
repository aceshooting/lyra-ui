import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import { sinkTexts } from '../../../../test/announcements.js';
import './browser-frame.js';
import type { LyraBrowserFrame } from './browser-frame.js';
import { SLOT_PRESENCE_UNRESOLVED } from '../../../internal/lyra-element.js';

const GIF = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

describe('lr-browser-frame remediation', () => {
  it('limits pings to the last 500 distinct markers and announces overflow once', async () => {
    const pings = Array.from({ length: 501 }, (_, i) => ({
      id: `ping-${i}`, x: 1, y: 1, kind: i === 0 ? 'scroll' as const : i === 500 ? 'type' as const : 'move' as const,
    }));
    const el = await fixture<LyraBrowserFrame>(html`<lr-browser-frame></lr-browser-frame>`);
    const markers = () => [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="ping"]')];
    const notice = () => el.shadowRoot!.querySelector('[part="limit"][role="note"]')?.textContent;
    const text = 'Showing the last 500 action markers.';

    el.pings = pings;
    await el.updateComplete;
    expect(markers().length).to.equal(500);
    expect(markers()[0]!.dataset['kind']).to.equal('move');
    expect(markers()[499]!.dataset['kind']).to.equal('type');
    expect(el.pings.length).to.equal(501);
    expect(notice()).to.equal(text);
    await waitUntil(() => sinkTexts().includes(text), 'ping-limit announcement');
    el.pings = [...pings, { ...pings[500]!, kind: 'scroll' }];
    await el.updateComplete;
    expect(markers()[499]!.dataset['kind']).to.equal('type');
    expect(sinkTexts().filter(message => message === text).length).to.equal(1);
    el.pings = pings.slice(0, 500);
    await el.updateComplete;
    expect(notice()).to.equal(undefined);
  });

  it('never paints the screenshot fallback over default-slot content present at connect', async () => {
    const el = await fixture<LyraBrowserFrame>(html`<lr-browser-frame frame-src=${GIF}><p>live view</p></lr-browser-frame>`);
    expect(el.shadowRoot!.querySelectorAll('[part="frame"]').length).to.equal(0);
  });

  it('keeps the screenshot fallback out while slot presence is unresolved', async () => {
    const el = document.createElement('lr-browser-frame') as LyraBrowserFrame & Record<symbol, () => boolean>;
    el[SLOT_PRESENCE_UNRESOLVED] = () => true;
    el.frameSrc = GIF;
    document.body.append(el);
    try {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelectorAll('[part="frame"]').length).to.equal(0);
    } finally {
      el.remove();
    }
  });

  it('styles its toolbar actions with the shared action recipe and its button tokens', async () => {
    const el = await fixture<LyraBrowserFrame>(html`<lr-browser-frame style="--lr-button-fill: rgb(4, 5, 6)"></lr-browser-frame>`);
    for (const part of ['take-over-button', 'stop-button']) {
      const button = el.shadowRoot!.querySelector<HTMLButtonElement>(`[part="${part}"]`)!;
      expect(button.dataset['agentAction'], part).to.equal('neutral');
      expect(getComputedStyle(button).backgroundColor, part).to.equal('rgb(4, 5, 6)');
    }
  });

  it('keeps first-wins ping identity when the same pings array re-renders', async () => {
    const pings = [{ id: 'a', x: 1, y: 1, kind: 'click' as const }, { id: 'a', x: 2, y: 2, kind: 'click' as const }, { id: 'b', x: 3, y: 3, kind: 'move' as const }];
    const el = await fixture<LyraBrowserFrame>(html`<lr-browser-frame .pings=${pings}></lr-browser-frame>`);
    expect(el.shadowRoot!.querySelectorAll('[part="ping"]').length).to.equal(2);
    el.url = 'https://example.com';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="ping"]').length).to.equal(2);
  });
});
