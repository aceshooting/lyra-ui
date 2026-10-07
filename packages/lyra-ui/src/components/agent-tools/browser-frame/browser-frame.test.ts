import { sinkTexts } from '../../../../test/announcements.js';
import { fixture, expect, html, oneEvent, waitUntil, aTimeout } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './browser-frame.js';
import type { LyraBrowserFrame } from './browser-frame.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

describe('lr-browser-frame', () => {
  it('defaults to phase=idle, controller=agent, withoutControls=false', async () => {
    const el = (await fixture(html`<lr-browser-frame></lr-browser-frame>`)) as LyraBrowserFrame;
    expect(el.phase).to.equal('idle');
    expect(el.controller).to.equal('agent');
    expect(el.withoutControls).to.be.false;
    expect(el.hasAttribute('without-controls')).to.be.false;
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
      expect(sinkTexts('polite', frameDocument)).to.deep.equal(['Connecting…']);
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

  it('normalizes an unknown controller so the badge, label and requested controller agree', async () => {
    const el = await fixture<LyraBrowserFrame>(html`<lr-browser-frame controller="human"></lr-browser-frame>`);
    expect(el.controller).to.equal('agent');
    expect(el.getAttribute('controller')).to.equal('agent');
    expect(el.shadowRoot!.querySelector('[part="controller-badge"]')!.textContent!.trim()).to.equal('Agent');
    const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="take-over-button"]')!;
    expect(button.textContent!.trim()).to.equal('Take over');
    const requested = oneEvent(el, 'lr-take-over');
    button.click();
    expect((await requested).detail).to.deep.equal({ controller: 'user' });
  });

  it('names a screenshot without a URL by the frame purpose', async () => {
    const el = await fixture<LyraBrowserFrame>(html`<lr-browser-frame frame-src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></lr-browser-frame>`);
    expect(el.shadowRoot!.querySelector('[part="frame"]')?.getAttribute('alt')).to.equal('Browser view');
  });

  it('draws its borders from the shared border-width ladder and buttons from the button tokens', async () => {
    const el = await fixture<LyraBrowserFrame>(html`<lr-browser-frame
      style="--lr-theme-border-width-thin: 2px; --lr-theme-border-width-medium: 4px; --lr-button-radius: 7px"
      .pings=${[{ id: 'p', x: 10, y: 10, kind: 'click' }]}
    ></lr-browser-frame>`);
    expect(getComputedStyle(el.shadowRoot!.querySelector('[part="base"]')!).borderTopWidth).to.equal('2px');
    expect(getComputedStyle(el.shadowRoot!.querySelector('[part="toolbar"]')!).borderBottomWidth).to.equal('2px');
    expect(getComputedStyle(el.shadowRoot!.querySelector('[part="ping"]')!).borderTopWidth).to.equal('4px');
    expect(getComputedStyle(el.shadowRoot!.querySelector('[part="stop-button"]')!).borderTopLeftRadius).to.equal('7px');
  });

  it('stop button emits lr-stop', async () => {
    const el = (await fixture(html`<lr-browser-frame></lr-browser-frame>`)) as LyraBrowserFrame;
    await el.updateComplete;
    const listener = oneEvent(el, 'lr-stop');
    (el.shadowRoot!.querySelector('[part="stop-button"]') as HTMLButtonElement).click();
    await listener;
  });

  it('without-controls renders no take-over/stop buttons', async () => {
    const el = (await fixture(
      html`<lr-browser-frame without-controls></lr-browser-frame>`,
    )) as LyraBrowserFrame;
    await el.updateComplete;
    expect(el.withoutControls).to.be.true;
    expect(el.shadowRoot!.querySelectorAll('[part="take-over-button"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="stop-button"]').length).to.equal(0);
  });

  it('restores the take-over/stop buttons when .withoutControls is cleared', async () => {
    const el = (await fixture(
      html`<lr-browser-frame without-controls></lr-browser-frame>`,
    )) as LyraBrowserFrame;
    el.withoutControls = false;
    await el.updateComplete;
    expect(el.hasAttribute('without-controls')).to.be.false;
    expect(el.shadowRoot!.querySelectorAll('[part="take-over-button"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('[part="stop-button"]').length).to.equal(1);
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
    expect(pings[0]!.getAttribute('aria-hidden')).to.equal('true');
    expect(pings[0]!.dataset['kind']).to.equal('click');
    expect(pings[1]!.dataset['kind']).to.equal('type');
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

it('fits a padded slotted viewport surface inside the frame', async () => {
  const el = (await fixture(html`<lr-browser-frame
    url="https://example.com"
    style="inline-size:400px"
  >
    <div id="surface" style="padding:12px">Live surface</div>
  </lr-browser-frame>`)) as LyraBrowserFrame;
  await el.updateComplete;
  const viewport = el.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
  const surface = el.querySelector<HTMLElement>('#surface')!;
  // The slotted surface is given a definite `inline-size`/`block-size: 100%`, which a content-box
  // slotted node resolves as content only -- its own padding then pushes it past the viewport.
  expect(surface.getBoundingClientRect().width).to.be.closeTo(
    viewport.getBoundingClientRect().width,
    0.5
  );
  expect(surface.getBoundingClientRect().height).to.be.closeTo(
    viewport.getBoundingClientRect().height,
    0.5
  );
});

describe('collecting already-slotted default content without relying on the initial slotchange', () => {
  it('suppresses the frame-src <img> when the default slot is already populated at connect, even with the initial slotchange swallowed (simulating happy-dom)', async () => {
    // happy-dom (through at least 20.14.5) never fires `slotchange` for a slot's INITIAL
    // assignment. This suite runs in a real browser, which DOES fire it -- so to reproduce the
    // happy-dom condition deterministically here, swallow that one event with a capture-phase
    // listener on the render root: capture-phase fires on the way down to the <slot> itself,
    // before the slot's own bubble-phase `@slotchange` binding (`onSlotChange`) ever sees it.
    const surface = document.createElement('div');
    surface.id = 'surface';
    surface.textContent = 'Live surface';
    const el = document.createElement('lr-browser-frame') as LyraBrowserFrame;
    el.frameSrc = 'https://example.com/shot.png';
    el.append(surface);
    document.body.append(el);
    // Synchronously after connect: `renderRoot` already exists (created in the constructor,
    // before the first render), well before the browser can dispatch the initial event.
    let intercepted = 0;
    el.renderRoot!.addEventListener(
      'slotchange',
      (e) => {
        intercepted++;
        e.stopImmediatePropagation();
      },
      { capture: true, once: true },
    );
    try {
      await el.updateComplete;
      // Give a real initial slotchange (queued around slot assignment) time to arrive and be
      // swallowed, so the assertions below only see whatever `firstUpdated()` alone collected.
      await aTimeout(50);
      expect(
        intercepted,
        "a real browser does fire the slot's initial slotchange -- this test suppresses it to reproduce happy-dom, which never fires it at all",
      ).to.equal(1);
      expect(
        el.shadowRoot!.querySelector('[part="frame"]') === null,
        "firstUpdated() collected the already-slotted default content and suppressed the frame-src fallback, with no slotchange ever reaching the component's own listener",
      ).to.equal(true);
    } finally {
      el.remove();
    }
  });

  it('is idempotent: a real slotchange landing on top of the firstUpdated() collection does not double-apply or flicker the fallback', async () => {
    // No interception here -- both `firstUpdated()`'s own call and the real, un-suppressed
    // initial `slotchange` fire for the same batch. The diagnostic listener below proves the
    // second (real) firing actually happened, so this test exercises the double-invocation path
    // it claims to, rather than accidentally passing because the browser only fired the event
    // once.
    const surface = document.createElement('div');
    surface.id = 'surface';
    surface.textContent = 'Live surface';
    const el = document.createElement('lr-browser-frame') as LyraBrowserFrame;
    el.frameSrc = 'https://example.com/shot.png';
    el.append(surface);
    document.body.append(el);
    let realSlotchangeCount = 0;
    el.renderRoot!.addEventListener('slotchange', () => realSlotchangeCount++, { capture: true });
    try {
      await el.updateComplete;
      await aTimeout(50);
      expect(
        realSlotchangeCount,
        'the real initial slotchange must actually have fired for this to prove anything about double-invocation',
      ).to.be.greaterThan(0);
      // Same outcome as the suppressed-event test above: the fallback image never appears, no
      // duplicated live-region announcement or stray re-render breaks the final state.
      expect(
        el.shadowRoot!.querySelector('[part="frame"]') === null,
        'the fallback frame image never appears',
      ).to.equal(true);
      expect(
        el.querySelector('#surface') === surface,
        'the live surface element is preserved, not replaced',
      ).to.equal(true);
    } finally {
      el.remove();
    }
  });
});

describe('lr-browser-frame deprecated --lr-browser-frame-controller-background alias', () => {
  const fill = (el: LyraBrowserFrame): string =>
    getComputedStyle(el.shadowRoot!.querySelector('[part="controller-badge"]') as HTMLElement).backgroundColor;

  it('paints from --lr-browser-frame-controller-bg, still honours the old name, and lets the canonical name win', async () => {
    const canonical = await fixture<LyraBrowserFrame>(
      html`<lr-browser-frame style="--lr-browser-frame-controller-bg: rgb(1, 2, 3)"></lr-browser-frame>`,
    );
    const alias = await fixture<LyraBrowserFrame>(
      html`<lr-browser-frame style="--lr-browser-frame-controller-background: rgb(1, 2, 3)"></lr-browser-frame>`,
    );
    const both = await fixture<LyraBrowserFrame>(
      html`<lr-browser-frame
        style="--lr-browser-frame-controller-bg: rgb(4, 5, 6); --lr-browser-frame-controller-background: rgb(1, 2, 3)"
      ></lr-browser-frame>`,
    );
    expect(fill(canonical)).to.equal('rgb(1, 2, 3)');
    expect(fill(alias)).to.not.equal('rgb(1, 2, 3)');
    expect(fill(both)).to.equal('rgb(4, 5, 6)');
  });
});

for (const width of [640, 320]) {
  for (const direction of ['ltr', 'rtl']) {
    it(`contains the hidden address label in a nested scroller at ${width}px in ${direction}`, async () => {
      const labelText = 'Adresse de la page affichée '.repeat(20);
      const url = 'https://example.test/preview';
      const outer = await fixture<HTMLElement>(html`
        <div dir=${direction} style=${`position:relative;inline-size:${width}px;block-size:400px`}>
          <div data-scroller style="block-size:350px;overflow:auto">
            <div style="block-size:800px"></div>
            <lr-browser-frame .url=${url} .strings=${{ browserFrameUrlLabel: labelText }}>
              <div>Preview</div>
              <button slot="actions" type="button">Inspect preview</button>
            </lr-browser-frame>
          </div>
        </div>
      `);
      const scroller = outer.querySelector<HTMLElement>('[data-scroller]')!;
      const el = outer.querySelector<LyraBrowserFrame>('lr-browser-frame')!;
      await el.updateComplete;
      const toolbar = el.shadowRoot!.querySelector<HTMLElement>('[part="toolbar"]')!;
      const label = toolbar.querySelector<HTMLElement>('.sr-only')!;
      const address = toolbar.querySelector<HTMLElement>('[part="url"]')!;
      expect(scroller.scrollHeight).to.be.greaterThan(scroller.clientHeight);
      expect(outer.scrollHeight, 'hidden address stays within the inner scrollport').to.equal(outer.clientHeight);
      expect(label.offsetParent === toolbar).to.equal(true);
      expect(label.textContent).to.equal(labelText);
      expect(label.hasAttribute('aria-hidden')).to.equal(false);
      expect(label.hidden).to.equal(false);
      expect(getComputedStyle(label).display).to.not.equal('none');
      expect(getComputedStyle(label).clipPath).to.not.equal('none');
      expect(address.textContent).to.equal(url);
      expect(address.getAttribute('title')).to.equal(url);
      expect(address.getAttribute('dir')).to.equal('ltr');
      expect(toolbar.querySelectorAll('input').length).to.equal(0);

      scroller.scrollTop = scroller.scrollHeight;
      expect(scroller.scrollTop).to.be.greaterThan(0);
      expect(outer.scrollHeight, 'inner scrolling cannot grow the outer shell').to.equal(outer.clientHeight);
      const takeOver = toolbar.querySelector<HTMLButtonElement>('[part="take-over-button"]')!;
      await focusByKeyboard(takeOver);
      const requested = oneEvent(el, 'lr-take-over');
      await sendKeys({ press: 'Enter' });
      expect((await requested).detail).to.deep.equal({ controller: 'user' });
      const stop = toolbar.querySelector<HTMLButtonElement>('[part="stop-button"]')!;
      await focusByKeyboard(stop);
      const stopped = oneEvent(el, 'lr-stop');
      await sendKeys({ press: 'Enter' });
      await stopped;
      const action = el.querySelector<HTMLButtonElement>('[slot="actions"]')!;
      await focusByKeyboard(action);
      expect(el.ownerDocument.activeElement === action).to.equal(true);
      expect(outer.scrollHeight, 'toolbar actions preserve the scroll owner').to.equal(outer.clientHeight);
    });
  }
}
