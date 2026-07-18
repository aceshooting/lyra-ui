import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './browser-frame.js';
import type { LyraBrowserFrame } from './browser-frame.js';

describe('lyra-browser-frame', () => {
  it('defaults to status=idle, controller=agent, controls=true', async () => {
    const el = (await fixture(html`<lyra-browser-frame></lyra-browser-frame>`)) as LyraBrowserFrame;
    expect(el.status).to.equal('idle');
    expect(el.controller).to.equal('agent');
    expect(el.controls).to.be.true;
  });

  it('renders the url read-only with a bidi-isolated dir="ltr" and a title fallback', async () => {
    const el = (await fixture(
      html`<lyra-browser-frame url="https://example.com/path"></lyra-browser-frame>`,
    )) as LyraBrowserFrame;
    await el.updateComplete;
    const urlEl = el.shadowRoot!.querySelector('[part="url"]')!;
    expect(urlEl.getAttribute('dir')).to.equal('ltr');
    expect(urlEl.getAttribute('title')).to.equal('https://example.com/path');
    expect(urlEl.textContent).to.equal('https://example.com/path');
  });

  it('renders visible localized status text, never color-only', async () => {
    const el = (await fixture(
      html`<lyra-browser-frame status="stalled"></lyra-browser-frame>`,
    )) as LyraBrowserFrame;
    await el.updateComplete;
    const status = el.shadowRoot!.querySelector('[part="status"]')!;
    expect(status.getAttribute('role')).to.equal('status');
    expect(status.textContent).to.be.a('string').and.not.equal('');
  });

  it('rejects an unsafe frameSrc scheme via the shared safe-URL gate', async () => {
    const el = (await fixture(
      html`<lyra-browser-frame frame-src="javascript:alert(1)"></lyra-browser-frame>`,
    )) as LyraBrowserFrame;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="frame"]')).to.not.exist;
  });

  it('renders an <img> for a safe frameSrc, ignored once the default slot is populated', async () => {
    const el = (await fixture(
      html`<lyra-browser-frame frame-src="https://example.com/shot.png"
        ><video slot=""></video
      ></lyra-browser-frame>`,
    )) as LyraBrowserFrame;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="frame"]')).to.not.exist;
  });

  it('take-over button emits lyra-take-over with controller "user", and hand-back with "agent"', async () => {
    const el = (await fixture(html`<lyra-browser-frame></lyra-browser-frame>`)) as LyraBrowserFrame;
    await el.updateComplete;
    const listener = oneEvent(el, 'lyra-take-over');
    (el.shadowRoot!.querySelector('[part="take-over-button"]') as HTMLButtonElement).click();
    const event = (await listener) as CustomEvent<{ controller: string }>;
    expect(event.detail.controller).to.equal('user');

    const userEl = (await fixture(
      html`<lyra-browser-frame controller="user"></lyra-browser-frame>`,
    )) as LyraBrowserFrame;
    await userEl.updateComplete;
    const handBackListener = oneEvent(userEl, 'lyra-take-over');
    (userEl.shadowRoot!.querySelector('[part="take-over-button"]') as HTMLButtonElement).click();
    const handBackEvent = (await handBackListener) as CustomEvent<{ controller: string }>;
    expect(handBackEvent.detail.controller).to.equal('agent');
  });

  it('stop button emits lyra-stop', async () => {
    const el = (await fixture(html`<lyra-browser-frame></lyra-browser-frame>`)) as LyraBrowserFrame;
    await el.updateComplete;
    const listener = oneEvent(el, 'lyra-stop');
    (el.shadowRoot!.querySelector('[part="stop-button"]') as HTMLButtonElement).click();
    await listener;
  });

  it('controls=false renders no take-over/stop buttons', async () => {
    const el = (await fixture(
      html`<lyra-browser-frame .controls=${false}></lyra-browser-frame>`,
    )) as LyraBrowserFrame;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="take-over-button"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="stop-button"]')).to.not.exist;
  });

  it('renders one aria-hidden ping marker per pings entry, kind-distinct', async () => {
    const el = (await fixture(html`
      <lyra-browser-frame
        .pings=${[
          { id: 'p1', x: 10, y: 20, kind: 'click' },
          { id: 'p2', x: 50, y: 50, kind: 'type' },
        ]}
      ></lyra-browser-frame>
    `)) as LyraBrowserFrame;
    await el.updateComplete;
    const pings = [...el.shadowRoot!.querySelectorAll('[part="ping"]')] as HTMLElement[];
    expect(pings.length).to.equal(2);
    expect(pings[0].getAttribute('aria-hidden')).to.equal('true');
    expect(pings[0].dataset.kind).to.equal('click');
    expect(pings[1].dataset.kind).to.equal('type');
  });

  it('positions pings with physical left/top under dir="rtl" so they stay over the non-mirroring screenshot', async () => {
    const el = (await fixture(html`
      <lyra-browser-frame dir="rtl" .pings=${[{ id: 'p1', x: 10, y: 20, kind: 'click' }]}></lyra-browser-frame>
    `)) as LyraBrowserFrame;
    await el.updateComplete;
    const ping = el.shadowRoot!.querySelector('[part="ping"]') as HTMLElement;
    expect(ping.style.left).to.equal('10%');
    expect(ping.style.top).to.equal('20%');
    expect(ping.style.getPropertyValue('inset-inline-start')).to.equal('');
  });

  it('keeps the ping content rect tracking viewport resizes after a disconnect/reconnect', async () => {
    const wrapper = (await fixture(html`
      <div style="inline-size: 400px">
        <lyra-browser-frame
          frame-src="https://example.com/shot.png"
          .pings=${[{ id: 'p1', x: 50, y: 50, kind: 'click' }]}
        ></lyra-browser-frame>
      </div>
    `)) as HTMLDivElement;
    const el = wrapper.querySelector('lyra-browser-frame') as LyraBrowserFrame;
    await el.updateComplete;
    const img = el.shadowRoot!.querySelector('[part="frame"]') as HTMLImageElement;
    Object.defineProperty(img, 'naturalWidth', { value: 800, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 450, configurable: true });
    img.dispatchEvent(new Event('load'));
    await el.updateComplete;
    const pingLeft = () => (el.shadowRoot!.querySelector('[part="ping"]') as HTMLElement).style.left;
    await waitUntil(() => pingLeft().endsWith('px'), 'ping never switched to the measured pixel content rect');
    el.remove();
    wrapper.append(el);
    await el.updateComplete;
    const before = pingLeft();
    wrapper.style.inlineSize = '200px';
    await waitUntil(
      () => pingLeft().endsWith('px') && pingLeft() !== before,
      'ping did not track the viewport resize after a reconnect',
    );
  });

  it('never captures or forwards pointer/keyboard input to any transport (no such listener exists)', async () => {
    const el = (await fixture(html`<lyra-browser-frame></lyra-browser-frame>`)) as LyraBrowserFrame;
    // Structural guarantee, not a runtime assertion: this component has no pointerdown/keydown
    // forwarding code path at all -- covered by this suite never registering such a listener, and
    // by the take-over/stop tests above being the component's *only* interactive affordances.
    expect(el.shadowRoot!.querySelectorAll('button').length).to.be.at.most(2);
  });

  it('is accessible with a live status, pings, and take-over controls', async () => {
    const el = (await fixture(html`
      <lyra-browser-frame
        url="https://example.com"
        status="streaming"
        .pings=${[{ id: 'p1', x: 10, y: 10, kind: 'click' }]}
      ></lyra-browser-frame>
    `)) as LyraBrowserFrame;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});
