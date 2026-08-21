import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './browser-frame.js';
import type { LyraBrowserFrame } from './browser-frame.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

function sinkTexts(doc: Document = document): string[] {
  return Array.from(
    doc.querySelectorAll<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"] > div`),
    (node) => node.textContent ?? '',
  );
}

describe('lr-browser-frame', () => {
  it('defaults to phase=idle, controller=agent, controls=true', async () => {
    const el = (await fixture(html`<lr-browser-frame></lr-browser-frame>`)) as LyraBrowserFrame;
    expect(el.phase).to.equal('idle');
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
      html`<lr-browser-frame phase="stalled"></lr-browser-frame>`,
    )) as LyraBrowserFrame;
    await el.updateComplete;
    const status = el.shadowRoot!.querySelector('[part="status"]')!;
    expect(status.getAttribute('role')).to.equal(null);
    expect(status.textContent).to.be.a('string').and.not.equal('');
  });

  it('announces only post-mount status transitions through the shared light-DOM sink', async () => {
    const el = (await fixture(
      html`<lr-browser-frame phase="stalled"></lr-browser-frame>`,
    )) as LyraBrowserFrame;
    expect(sinkTexts(), 'mounting with a status is not a live change').to.deep.equal([]);
    expect(el.shadowRoot!.querySelector('[part="status"]')!.hasAttribute('role')).to.be.false;

    el.phase = 'streaming';
    await el.updateComplete;
    el.phase = 'stalled';
    await el.updateComplete;
    expect(sinkTexts()).to.deep.equal(['Live', 'Stalled']);

    el.remove();
    expect(
      document.querySelectorAll(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`).length,
      'the last holder releases the shared sink',
    ).to.equal(0);
  });

  it('re-targets status announcements when adopted into another document', async () => {
    const el = (await fixture(html`<lr-browser-frame></lr-browser-frame>`)) as LyraBrowserFrame;
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const frameDocument = iframe.contentDocument!;

    try {
      frameDocument.body.append(el);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      el.phase = 'connecting';
      await el.updateComplete;

      expect(sinkTexts(), 'the old document no longer owns the adopted component sink').to.deep.equal([]);
      expect(sinkTexts(frameDocument)).to.deep.equal(['Connecting…']);
    } finally {
      el.remove();
      iframe.remove();
    }
  });

  it('recreates its viewport observer in the adopted owner realm and disconnects the old one', async () => {
    const el = (await fixture(html`<lr-browser-frame></lr-browser-frame>`)) as LyraBrowserFrame;
    await el.updateComplete;
    el.remove();
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const frameDocument = iframe.contentDocument;
    const frameWindow = iframe.contentWindow;
    if (!frameDocument || !frameWindow) {
      iframe.remove();
      throw new Error('The iframe realm was unavailable.');
    }
    const originalResizeObserver = frameWindow.ResizeObserver;
    let constructions = 0;
    let disconnects = 0;
    class OwnerResizeObserver implements ResizeObserver {
      constructor(_callback: ResizeObserverCallback) {
        constructions += 1;
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {
        disconnects += 1;
      }
    }
    frameWindow.ResizeObserver = OwnerResizeObserver;

    try {
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      expect(constructions, 'the adopted window constructs the viewport observer').to.equal(1);

      document.adoptNode(el);
      expect(disconnects, 'adoption tears down the previous realm observer').to.equal(1);
    } finally {
      frameWindow.ResizeObserver = originalResizeObserver;
      if (el.ownerDocument !== document) document.adoptNode(el);
      el.remove();
      iframe.remove();
    }
  });

  it('treats a phase write queued while detached as a silent reconnect baseline', async () => {
    const el = (await fixture(html`<lr-browser-frame></lr-browser-frame>`)) as LyraBrowserFrame;
    const parent = el.parentNode!;

    el.remove();
    el.phase = 'stalled';
    parent.appendChild(el);
    await el.updateComplete;
    expect(sinkTexts(), 'the detached phase is resting content when reconnected').to.deep.equal([]);

    el.phase = 'streaming';
    await el.updateComplete;
    expect(sinkTexts(), 'the next connected transition still announces').to.deep.equal(['Live']);
  });

  it('rejects an unsafe frameSrc scheme via the shared safe-URL gate', async () => {
    const el = (await fixture(
      html`<lr-browser-frame frame-src="javascript:alert(1)"></lr-browser-frame>`,
    )) as LyraBrowserFrame;
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="frame"]')) == null).to.be.true;
  });

  it('renders an <img> for a safe frameSrc, ignored once the default slot is populated', async () => {
    const el = (await fixture(
      html`<lr-browser-frame frame-src="https://example.com/shot.png"
        ><video slot=""></video
      ></lr-browser-frame>`,
    )) as LyraBrowserFrame;
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="frame"]')) == null).to.be.true;
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
    expect((el.shadowRoot!.querySelector('[part="frame"]')) == null).to.be.true;
    expect(pingLeft()).to.equal('50%');

    el.frameSrc = 'javascript:alert(1)';
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="frame"]')) == null).to.be.true;
    expect(pingLeft()).to.equal('50%');
  });

  it('keeps ping geometry finite when the image loads before its viewport has an allocation', async () => {
    const el = await fixture<LyraBrowserFrame>(html`
      <lr-browser-frame
        frame-src="https://example.com/shot.png"
        .pings=${[{ id: 'p1', x: 50, y: 50, kind: 'click' }]}
      ></lr-browser-frame>
    `);
    const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
    const img = el.shadowRoot!.querySelector('[part="frame"]') as HTMLImageElement;
    Object.defineProperty(viewport, 'clientWidth', { value: 0, configurable: true });
    Object.defineProperty(viewport, 'clientHeight', { value: 0, configurable: true });
    Object.defineProperty(img, 'naturalWidth', { value: 800, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 450, configurable: true });

    img.dispatchEvent(new Event('load'));
    await el.updateComplete;
    const ping = el.shadowRoot!.querySelector('[part="ping"]') as HTMLElement;
    expect(ping.style.left).to.equal('0px');
    expect(ping.style.top).to.equal('0px');
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

      const disconnectedPing = pingLeft();
      el.remove();
      expect(observers[0]!.disconnected).to.be.true;
      observers[0]!.trigger();
      await el.updateComplete;
      expect(pingLeft(), 'the disconnected observer is stale').to.equal(disconnectedPing);
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
        phase="stalled"
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
        phase="streaming"
        .pings=${[{ id: 'p1', x: 10, y: 10, kind: 'click' }]}
      ></lr-browser-frame>
    `)) as LyraBrowserFrame;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('paints rendered hover feedback on take-over and stop buttons', async () => {
    const el = await fixture<LyraBrowserFrame>(html`
      <lr-browser-frame style="--lr-color-brand-quiet: rgb(1, 2, 3)"></lr-browser-frame>
    `);
    try {
      for (const part of ['take-over-button', 'stop-button']) {
        const button = el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLButtonElement;
        const rect = button.getBoundingClientRect();
        await sendMouse({
          type: 'move',
          position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
        });
        await waitUntil(() => getComputedStyle(button).backgroundColor === 'rgb(1, 2, 3)');
        expect(getComputedStyle(button).backgroundColor, part).to.equal('rgb(1, 2, 3)');
      }
    } finally {
      await resetMouse();
    }
  });

  it('renders a visible focus-visible outline on the take-over and stop buttons', async () => {
    const el = (await fixture(html`<lr-browser-frame></lr-browser-frame>`)) as LyraBrowserFrame;
    await el.updateComplete;
    const takeOverButton = el.shadowRoot!.querySelector('[part="take-over-button"]') as HTMLButtonElement;
    const stopButton = el.shadowRoot!.querySelector('[part="stop-button"]') as HTMLButtonElement;

    takeOverButton.focus();
    const takeOverOutline = getComputedStyle(takeOverButton).outlineStyle;
    stopButton.focus();
    const stopOutline = getComputedStyle(stopButton).outlineStyle;

    expect(takeOverOutline).to.equal('solid');
    expect(stopOutline).to.equal('solid');
  });
});

it('clamps ping coordinates and never lets them reach the declaration list verbatim', async () => {
  const el = (await fixture(html`<lr-browser-frame></lr-browser-frame>`)) as LyraBrowserFrame;
  el.pings = [
    { id: 'injection', x: '0%;position:fixed;inset:0' as unknown as number, y: 10, kind: 'click' },
    { id: 'non-finite', x: Number.NaN, y: Number.POSITIVE_INFINITY, kind: 'move' },
    { id: 'clamped', x: 250, y: -80, kind: 'scroll' },
  ];
  await el.updateComplete;
  const pings = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="ping"]')];
  expect(pings.length).to.equal(3);
  expect(getComputedStyle(pings[0]!).position, 'no injected declaration applies').to.not.equal('fixed');
  for (const ping of pings) {
    expect(ping.style.left).to.match(/^\d+(\.\d+)?%$/);
    expect(ping.style.top).to.match(/^\d+(\.\d+)?%$/);
  }
  // 250 and -80 clamp into the documented 0-100 range.
  expect(pings[2]!.style.left).to.equal('100%');
  expect(pings[2]!.style.top).to.equal('0%');
});

it('normalizes duplicate ping ids first-wins before overlay rendering', async () => {
  const el = await fixture<LyraBrowserFrame>(html`
    <lr-browser-frame .pings=${[
      { id: 'same', x: 10, y: 20, kind: 'click' },
      { id: 'same', x: 80, y: 90, kind: 'type' },
    ]}></lr-browser-frame>
  `);
  const pings = el.shadowRoot!.querySelectorAll<HTMLElement>('[part="ping"]');
  expect(pings).to.have.length(1);
  expect(pings[0]!.dataset['kind']).to.equal('click');
});

describe('a slotted [hidden] viewport child', () => {
  it('is removed from the rendered box, not just from the accessibility tree', async () => {
    const el = (await fixture(html`
      <lr-browser-frame url="https://example.test/">
        <div id="gone" hidden>hidden surface</div>
        <div id="shown">live surface</div>
      </lr-browser-frame>
    `)) as LyraBrowserFrame;
    await el.updateComplete;
    const gone = el.querySelector<HTMLElement>('#gone')!;
    const shown = el.querySelector<HTMLElement>('#shown')!;
    expect(getComputedStyle(gone).display).to.equal('none');
    expect(gone.getClientRects().length).to.equal(0);
    // The companion proves the ::slotted(*) rule itself is still live, so the assertion above
    // cannot pass merely because the frame failed to style its slotted surface at all.
    expect(getComputedStyle(shown).display).to.equal('block');
    expect(shown.getClientRects().length).to.equal(1);
  });
});
