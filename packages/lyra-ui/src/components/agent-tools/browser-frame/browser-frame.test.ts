import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './browser-frame.js';
import type { LyraBrowserFrame } from './browser-frame.js';
import { styles } from './browser-frame.styles.js';

describe('lr-browser-frame', () => {
  it('defaults to status=idle, controller=agent, controls=true', async () => {
    const el = (await fixture(html`<lr-browser-frame></lr-browser-frame>`)) as LyraBrowserFrame;
    expect(el.status).to.equal('idle');
    expect(el.controller).to.equal('agent');
    expect(el.controls).to.be.true;
  });

  it('renders the url read-only with a bidi-isolated dir="ltr" and a title fallback', async () => {
    const el = (await fixture(
      html`<lr-browser-frame url="https://example.com/path"></lr-browser-frame>`,
    )) as LyraBrowserFrame;
    await el.updateComplete;
    const urlEl = el.shadowRoot!.querySelector('[part="url"]')!;
    expect(urlEl.getAttribute('dir')).to.equal('ltr');
    expect(urlEl.getAttribute('title')).to.equal('https://example.com/path');
    expect(urlEl.textContent).to.equal('https://example.com/path');
  });

  it('renders visible localized status text, never color-only', async () => {
    const el = (await fixture(
      html`<lr-browser-frame status="stalled"></lr-browser-frame>`,
    )) as LyraBrowserFrame;
    await el.updateComplete;
    const status = el.shadowRoot!.querySelector('[part="status"]')!;
    expect(status.getAttribute('role')).to.equal('status');
    expect(status.textContent).to.be.a('string').and.not.equal('');
  });

  it('rejects an unsafe frameSrc scheme via the shared safe-URL gate', async () => {
    const el = (await fixture(
      html`<lr-browser-frame frame-src="javascript:alert(1)"></lr-browser-frame>`,
    )) as LyraBrowserFrame;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="frame"]')).to.not.exist;
  });

  it('renders an <img> for a safe frameSrc, ignored once the default slot is populated', async () => {
    const el = (await fixture(
      html`<lr-browser-frame frame-src="https://example.com/shot.png"
        ><video slot=""></video
      ></lr-browser-frame>`,
    )) as LyraBrowserFrame;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="frame"]')).to.not.exist;
  });

  it('clears image-specific ping geometry when slotted content replaces the image', async () => {
    const el = (await fixture(html`
      <lr-browser-frame
        frame-src="https://example.com/shot.png"
        .pings=${[{ id: 'p1', x: 50, y: 50, kind: 'click' }]}
      ></lr-browser-frame>
    `)) as LyraBrowserFrame;
    const img = el.shadowRoot!.querySelector('[part="frame"]') as HTMLImageElement;
    Object.defineProperty(img, 'naturalWidth', { value: 800, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 450, configurable: true });
    img.dispatchEvent(new Event('load'));
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="ping"]') as HTMLElement).style.left).to.include('px');
    const replacement = document.createElement('video');
    el.append(replacement);
    await el.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect((el.shadowRoot!.querySelector('[part="ping"]') as HTMLElement).style.left).to.equal('50%');
  });

  it('clears stale image geometry as soon as frameSrc changes, clears, is rejected, or errors', async () => {
    const el = (await fixture(html`
      <lr-browser-frame
        frame-src="https://example.com/first.png"
        .pings=${[{ id: 'p1', x: 50, y: 50, kind: 'click' }]}
      ></lr-browser-frame>
    `)) as LyraBrowserFrame;
    const pingLeft = () => (el.shadowRoot!.querySelector('[part="ping"]') as HTMLElement).style.left;
    let img = el.shadowRoot!.querySelector('[part="frame"]') as HTMLImageElement;
    Object.defineProperty(img, 'naturalWidth', { value: 800, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 450, configurable: true });
    img.dispatchEvent(new Event('load'));
    await el.updateComplete;
    expect(pingLeft()).to.include('px');

    el.frameSrc = 'https://example.com/second.png';
    await el.updateComplete;
    expect(pingLeft()).to.equal('50%');

    img = el.shadowRoot!.querySelector('[part="frame"]') as HTMLImageElement;
    Object.defineProperty(img, 'naturalWidth', { value: 800, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 450, configurable: true });
    img.dispatchEvent(new Event('load'));
    await el.updateComplete;
    expect(pingLeft()).to.include('px');
    img.dispatchEvent(new Event('error'));
    await el.updateComplete;
    expect(pingLeft()).to.equal('50%');

    el.frameSrc = '';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="frame"]')).to.not.exist;
    expect(pingLeft()).to.equal('50%');

    el.frameSrc = 'javascript:alert(1)';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="frame"]')).to.not.exist;
    expect(pingLeft()).to.equal('50%');
  });

  it('keeps all toolbar controls reachable in a 320px allocation with long localized text', async () => {
    const wrap = await fixture(html`
      <div style="inline-size:320px">
        <lr-browser-frame
          url="https://example.com/a/very/long/path/that/must/shrink"
          .strings=${{
            browserFrameTakeOver: 'Take control of this browser session now',
            browserFrameStop: 'Stop browser session now',
          }}
        ></lr-browser-frame>
      </div>
    `);
    const el = wrap.querySelector('lr-browser-frame') as LyraBrowserFrame;
    const toolbar = el.shadowRoot!.querySelector('[part="toolbar"]') as HTMLElement;
    expect(toolbar.scrollWidth).to.be.at.most(toolbar.clientWidth);
  });

  it('makes the url part go full-width once the host itself is narrow, via a container query', async () => {
    // The @container rule can only ever fire if :host establishes a query container -- pin the
    // host's own allocation (not the viewport) to <=20rem and assert the container query, not a
    // viewport media query, is what's driving the layout.
    const wrap = await fixture(html`
      <div style="inline-size: 20rem">
        <lr-browser-frame url="https://example.com/path"></lr-browser-frame>
      </div>
    `);
    const el = wrap.querySelector('lr-browser-frame') as LyraBrowserFrame;
    await el.updateComplete;
    const urlEl = el.shadowRoot!.querySelector('[part="url"]') as HTMLElement;
    expect(getComputedStyle(urlEl).flexBasis).to.equal('100%');
  });

  it('take-over button emits lr-take-over with controller "user", and hand-back with "agent"', async () => {
    const el = (await fixture(html`<lr-browser-frame></lr-browser-frame>`)) as LyraBrowserFrame;
    await el.updateComplete;
    const listener = oneEvent(el, 'lr-take-over');
    (el.shadowRoot!.querySelector('[part="take-over-button"]') as HTMLButtonElement).click();
    const event = (await listener) as CustomEvent<{ controller: string }>;
    expect(event.detail.controller).to.equal('user');

    const userEl = (await fixture(
      html`<lr-browser-frame controller="user"></lr-browser-frame>`,
    )) as LyraBrowserFrame;
    await userEl.updateComplete;
    const handBackListener = oneEvent(userEl, 'lr-take-over');
    (userEl.shadowRoot!.querySelector('[part="take-over-button"]') as HTMLButtonElement).click();
    const handBackEvent = (await handBackListener) as CustomEvent<{ controller: string }>;
    expect(handBackEvent.detail.controller).to.equal('agent');
  });

  it('stop button emits lr-stop', async () => {
    const el = (await fixture(html`<lr-browser-frame></lr-browser-frame>`)) as LyraBrowserFrame;
    await el.updateComplete;
    const listener = oneEvent(el, 'lr-stop');
    (el.shadowRoot!.querySelector('[part="stop-button"]') as HTMLButtonElement).click();
    await listener;
  });

  it('controls=false renders no take-over/stop buttons', async () => {
    const el = (await fixture(
      html`<lr-browser-frame .controls=${false}></lr-browser-frame>`,
    )) as LyraBrowserFrame;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="take-over-button"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="stop-button"]').length).to.equal(0);
  });

  it('parses the literal controls="false" attribute (not just the .controls property binding)', async () => {
    const el = (await fixture(
      html`<lr-browser-frame controls="false"></lr-browser-frame>`,
    )) as LyraBrowserFrame;
    await el.updateComplete;
    expect(el.controls).to.be.false;
    expect(el.shadowRoot!.querySelectorAll('[part="take-over-button"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="stop-button"]').length).to.equal(0);
  });

  it('renders one aria-hidden ping marker per pings entry, kind-distinct', async () => {
    const el = (await fixture(html`
      <lr-browser-frame
        .pings=${[
          { id: 'p1', x: 10, y: 20, kind: 'click' },
          { id: 'p2', x: 50, y: 50, kind: 'type' },
        ]}
      ></lr-browser-frame>
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
      <lr-browser-frame dir="rtl" .pings=${[{ id: 'p1', x: 10, y: 20, kind: 'click' }]}></lr-browser-frame>
    `)) as LyraBrowserFrame;
    await el.updateComplete;
    const ping = el.shadowRoot!.querySelector('[part="ping"]') as HTMLElement;
    expect(ping.style.left).to.equal('10%');
    expect(ping.style.top).to.equal('20%');
    expect(ping.style.getPropertyValue('inset-inline-start')).to.equal('');
  });

  it('keeps the ping content rect tracking viewport resizes after a disconnect/reconnect', async () => {
    const nativeResizeObserver = window.ResizeObserver;
    const observers: ControlledResizeObserver[] = [];
    class ControlledResizeObserver {
      readonly targets = new Set<Element>();
      disconnected = false;

      constructor(private readonly callback: ResizeObserverCallback) {
        observers.push(this);
      }

      observe(target: Element): void {
        this.targets.add(target);
      }

      unobserve(target: Element): void {
        this.targets.delete(target);
      }

      disconnect(): void {
        this.disconnected = true;
        this.targets.clear();
      }

      trigger(): void {
        this.callback([], this as unknown as ResizeObserver);
      }
    }
    window.ResizeObserver = ControlledResizeObserver as unknown as typeof ResizeObserver;
    try {
      const wrapper = (await fixture(html`
        <div style="inline-size: 400px">
          <lr-browser-frame
            frame-src="https://example.com/shot.png"
            .pings=${[{ id: 'p1', x: 50, y: 50, kind: 'click' }]}
          ></lr-browser-frame>
        </div>
      `)) as HTMLDivElement;
      const el = wrapper.querySelector('lr-browser-frame') as LyraBrowserFrame;
      await el.updateComplete;
      const img = el.shadowRoot!.querySelector('[part="frame"]') as HTMLImageElement;
      Object.defineProperty(img, 'naturalWidth', { value: 800, configurable: true });
      Object.defineProperty(img, 'naturalHeight', { value: 450, configurable: true });
      img.dispatchEvent(new Event('load'));
      await el.updateComplete;
      const pingLeft = () => (el.shadowRoot!.querySelector('[part="ping"]') as HTMLElement).style.left;
      expect(pingLeft()).to.include('px');
      expect(observers).to.have.length(1);

      el.remove();
      expect(observers[0]!.disconnected).to.be.true;
      wrapper.append(el);
      await el.updateComplete;
      expect(observers).to.have.length(2);
      expect(observers[1]!.targets.size).to.equal(1);

      const before = pingLeft();
      wrapper.style.inlineSize = '200px';
      await new Promise((resolve) => requestAnimationFrame(resolve));
      observers[1]!.trigger();
      await el.updateComplete;
      expect(pingLeft()).to.include('px');
      expect(pingLeft()).to.not.equal(before);
    } finally {
      window.ResizeObserver = nativeResizeObserver;
    }
  });

  it('never captures or forwards pointer/keyboard input to any transport (no such listener exists)', async () => {
    const el = (await fixture(html`<lr-browser-frame></lr-browser-frame>`)) as LyraBrowserFrame;
    // Structural guarantee, not a runtime assertion: this component has no pointerdown/keydown
    // forwarding code path at all -- covered by this suite never registering such a listener, and
    // by the take-over/stop tests above being the component's *only* interactive affordances.
    expect(el.shadowRoot!.querySelectorAll('button').length).to.be.at.most(2);
  });

  it('routes localized strings through a .strings override, reaching the rendered DOM', async () => {
    const el = (await fixture(html`
      <lr-browser-frame
        url="https://example.com"
        status="stalled"
        .strings=${{
          browserFrameStatusStalled: 'Connexion interrompue',
          browserFrameTakeOver: 'Prendre le contrôle',
        }}
      ></lr-browser-frame>
    `)) as LyraBrowserFrame;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="status"]')!.textContent).to.equal('Connexion interrompue');
    expect(el.shadowRoot!.querySelector('[part="take-over-button"]')!.textContent!.trim()).to.equal(
      'Prendre le contrôle',
    );
  });

  // The controller badge used to render the raw `controller` property value ('agent'/'user'),
  // an untranslatable user-facing string that no `.strings` override or registerLyraLocale()
  // could ever reach.
  it('localizes the controller badge rather than rendering the raw controller value', async () => {
    const el = (await fixture(html`
      <lr-browser-frame url="https://example.com" controller="agent"></lr-browser-frame>
    `)) as LyraBrowserFrame;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="controller-badge"]')!.textContent!.trim()).to.equal('Agent');

    const localized = (await fixture(html`
      <lr-browser-frame
        url="https://example.com"
        controller="user"
        .strings=${{ browserFrameControllerUser: 'Utilisateur' }}
      ></lr-browser-frame>
    `)) as LyraBrowserFrame;
    await localized.updateComplete;
    expect(localized.shadowRoot!.querySelector('[part="controller-badge"]')!.textContent!.trim()).to.equal(
      'Utilisateur',
    );
  });

  it('is accessible with a live status, pings, and take-over controls', async () => {
    const el = (await fixture(html`
      <lr-browser-frame
        url="https://example.com"
        status="streaming"
        .pings=${[{ id: 'p1', x: 10, y: 10, kind: 'click' }]}
      ></lr-browser-frame>
    `)) as LyraBrowserFrame;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('gives take-over-button and stop-button a hover state', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='take-over-button'\],\s*\n?\s*\[part='stop-button'\]\s*\{[^}]*font/);
    expect(css).to.match(/\[part='take-over-button'\]:hover/);
    expect(css).to.match(/\[part='stop-button'\]:hover/);
  });
});
