import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './stack-trace.js';
import type { LyraStackTrace } from './stack-trace.js';

async function settleClipboard(el: LyraStackTrace): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await el.updateComplete;
}
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

const trace = [
  'TypeError: Cannot read properties of undefined',
  '    at Object.doThing (/app/src/util.js:10:5)',
  '    at Module._compile (node:internal/modules/cjs/loader:1105:14)',
  '    at Module._extensions..js (node:internal/modules/cjs/loader:1179:10)',
].join('\n');

const overflowLocation = '9'.repeat(400);

describe('lr-stack-trace', () => {
  it('expands separate internal runs independently', async () => {
    const el = (await fixture(html`<lr-stack-trace></lr-stack-trace>`)) as LyraStackTrace;
    el.trace = [
      'Error: boom',
      '    at first (/app/node_modules/a.js:1:1)',
      '    at second (/app/node_modules/b.js:2:1)',
      '    at app (/app/src/app.js:3:1)',
      '    at third (/app/node_modules/c.js:4:1)',
      '    at fourth (/app/node_modules/d.js:5:1)',
    ].join('\n');
    await el.updateComplete;
    const toggles = [...el.shadowRoot!.querySelectorAll('[part="internal-toggle"]')] as HTMLButtonElement[];
    expect(toggles).to.have.lengthOf(2);
    toggles[0]!.click();
    await el.updateComplete;
    const updated = [...el.shadowRoot!.querySelectorAll('[part="internal-toggle"]')] as HTMLButtonElement[];
    expect(updated.map((button) => button.getAttribute('aria-expanded'))).to.deep.equal(['true', 'false']);
  });

  it('resets copied confirmation across disconnect/reconnect', async () => {
    const el = (await fixture(html`<lr-stack-trace trace="plain"></lr-stack-trace>`)) as LyraStackTrace;
    (el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
    el.remove();
    document.body.append(el);
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).textContent!.trim()).to.equal(
      'Copy',
    );
  });
  it('defaults to collapseInternal=true and copyable=true', async () => {
    const el = (await fixture(html`<lr-stack-trace></lr-stack-trace>`)) as LyraStackTrace;
    expect(el.collapseInternal).to.be.true;
    expect(el.copyable).to.be.true;
  });

  it('clears collapseInternal/copyable from a plain HTML attribute="false" (not just a property binding)', async () => {
    const el = (await fixture(
      html`<lr-stack-trace collapse-internal="false" copyable="false"></lr-stack-trace>`,
    )) as LyraStackTrace;
    expect(el.collapseInternal).to.be.false;
    expect(el.copyable).to.be.false;
  });

  it('renders the message and one frame button per parsed frame when internal collapsing is off', async () => {
    // NOTE: `.collapseInternal=${false}` uses a *property* binding, not `?collapse-internal=${false}`
    // -- Lit's `?attr=` boolean directive only ever toggles attribute *presence*, so it can never
    // remove an already-present-by-default `true` back to `false` even with the trueDefaultBooleanConverter
    // in place (the literal `collapse-internal="false"` attribute form above is the other way to do it).
    const el = (await fixture(
      html`<lr-stack-trace .trace=${trace} .collapseInternal=${false}></lr-stack-trace>`,
    )) as LyraStackTrace;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="message"]')!.textContent).to.include('TypeError');
    expect(el.shadowRoot!.querySelectorAll('[part="frame"]').length).to.equal(3);
  });

  it('collapses internal frames behind a toggle showing the count when collapseInternal', async () => {
    const el = (await fixture(html`<lr-stack-trace .trace=${trace} collapse-internal></lr-stack-trace>`)) as LyraStackTrace;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[part="internal-toggle"]') as HTMLButtonElement;
    expect((toggle) != null).to.equal(true);
    expect(toggle.getAttribute('aria-expanded')).to.equal('false');
    expect(toggle.textContent).to.include('2');
    toggle.click();
    await el.updateComplete;
    expect(toggle.getAttribute('aria-expanded')).to.equal('true');
  });

  it('formats collapsed internal-frame counts with the effective locale', async () => {
    const el = (await fixture(
      html`<lr-stack-trace lang="ar-EG" .trace=${trace} collapse-internal></lr-stack-trace>`,
    )) as LyraStackTrace;
    const toggle = el.shadowRoot!.querySelector('[part="internal-toggle"]') as HTMLButtonElement;
    expect(toggle.textContent).to.include(new Intl.NumberFormat('ar-EG').format(2));
  });

  it('emits lr-frame-select with file/line/column on frame activation', async () => {
    const el = (await fixture(html`<lr-stack-trace .trace=${trace}></lr-stack-trace>`)) as LyraStackTrace;
    await el.updateComplete;
    const frame = el.shadowRoot!.querySelector('[part="frame"]') as HTMLButtonElement;
    const listener = oneEvent(el, 'lr-frame-select');
    frame.click();
    const event = (await listener) as CustomEvent<{ file: string; line: number; column: number }>;
    expect(event.detail).to.deep.include({ file: '/app/src/util.js', line: 10, column: 5 });
  });

  it('renders overflow and malformed locations as raw non-activatable frames that cannot emit selection', async () => {
    const overflow = `    at overflow (/app/overflow.js:${overflowLocation}:${overflowLocation})`;
    const malformed = '    at malformed (/app/malformed.js:line:column)';
    const el = (await fixture(html`
      <lr-stack-trace
        .collapseInternal=${false}
        .trace=${['Error: untrusted stack', '    at safe (/app/safe.js:1:1)', overflow, malformed].join('\n')}
      ></lr-stack-trace>
    `)) as LyraStackTrace;
    await el.updateComplete;
    const selectableFrames = el.shadowRoot!.querySelectorAll('button[part="frame"]');
    const rawFrames = [...el.shadowRoot!.querySelectorAll<HTMLElement>('span[part="frame"][data-raw]')];
    let selectEvents = 0;
    el.addEventListener('lr-frame-select', () => {
      selectEvents += 1;
    });

    expect(selectableFrames.length).to.equal(1);
    expect(rawFrames.map((frame) => frame.textContent)).to.deep.equal([overflow, malformed]);
    expect(rawFrames.map((frame) => frame.getAttribute('tabindex'))).to.deep.equal([null, null]);
    expect(rawFrames.map((frame) => frame.getAttribute('dir'))).to.deep.equal(['ltr', 'ltr']);
    rawFrames.forEach((frame) => frame.click());
    expect(selectEvents).to.equal(0);
  });

  it('falls back to the original raw trace when every location overflows', async () => {
    const unsafeTrace = [
      'Error: unsafe stack',
      `    at overflow (/app/overflow.js:${overflowLocation}:${overflowLocation})`,
    ].join('\n');
    const el = (await fixture(html`<lr-stack-trace .trace=${unsafeTrace}></lr-stack-trace>`)) as LyraStackTrace;
    await el.updateComplete;

    const raw = el.shadowRoot!.querySelector<HTMLElement>('[part="raw"]');
    expect((raw) != null).to.equal(true);
    expect(raw!.textContent).to.equal(unsafeTrace);
    expect(el.shadowRoot!.querySelectorAll('button[part="frame"]').length).to.equal(0);
  });

  it('renders verbatim raw output in part="raw" when nothing parses', async () => {
    const el = (await fixture(
      html`<lr-stack-trace trace="not a trace at all"></lr-stack-trace>`,
    )) as LyraStackTrace;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="raw"]')!.textContent).to.equal('not a trace at all');
    expect(el.shadowRoot!.querySelectorAll('[part="frame"]').length).to.equal(0);
  });

  it('bounds untrusted raw trace rendering and exposes localized truncation', async () => {
    const el = (await fixture(html`<lr-stack-trace
      .trace=${'x'.repeat(300_000)}
      .strings=${{ stackTraceLimit: 'Trace shortened' }}
    ></lr-stack-trace>`)) as LyraStackTrace;
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('[part="raw"]')!.textContent!.length).to.be.lessThan(300_000);
    expect(el.shadowRoot!.querySelector('[part="limit"]')!.textContent).to.equal('Trace shortened');
  });

  it('owns an independent default internal-pattern array per instance', async () => {
    const first = (await fixture(html`<lr-stack-trace></lr-stack-trace>`)) as LyraStackTrace;
    const second = (await fixture(html`<lr-stack-trace></lr-stack-trace>`)) as LyraStackTrace;
    expect(first.internalPatterns).not.to.equal(second.internalPatterns);
  });

  it('copy button emits lr-copy with the raw trace text', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.resolve() },
    });
    try {
      const el = (await fixture(html`<lr-stack-trace .trace=${trace} copyable></lr-stack-trace>`)) as LyraStackTrace;
      await el.updateComplete;
      const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
      const listener = oneEvent(el, 'lr-copy');
      button.click();
      const event = (await listener) as CustomEvent<{ ok: true; text: string }>;
      expect(event.detail).to.deep.equal({ ok: true, text: trace });
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('renders failure instead of copied and emits the typed clipboard error outcome', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const failure = new Error('write failed');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(failure) },
    });
    try {
      const el = (await fixture(html`<lr-stack-trace .trace=${trace}></lr-stack-trace>`)) as LyraStackTrace;
      const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
      const genericError = oneEvent(el, 'lr-error');
      const detailedError = oneEvent(el, 'lr-copy-error');
      button.click();
      const [, detailedEvent] = await Promise.all([genericError, detailedError]) as [
        CustomEvent<null>,
        CustomEvent<{ ok: false; text: string; reason: string; error: unknown }>,
      ];
      await el.updateComplete;
      expect(detailedEvent.detail).to.deep.equal({ ok: false, text: trace, reason: 'failed', error: failure });
      expect(button.textContent!.trim()).to.equal('Copy failed');
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('uses the adopted owner clipboard and does not arm ambient resources when ownerless', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameDocument = frame.contentDocument!;
    const frameWindow = frame.contentWindow!;
    const inertDocument = document.implementation.createHTMLDocument('ownerless');
    const ambientDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'clipboard');
    const destinationDescriptor = Object.getOwnPropertyDescriptor(frameWindow.navigator, 'clipboard');
    const originalAmbientSetTimeout = window.setTimeout;
    const ambientWrites: string[] = [];
    const destinationWrites: string[] = [];
    let ambientTimers = 0;
    let el: LyraStackTrace | undefined;

    try {
      Object.defineProperty(window.navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (text: string) => ambientWrites.push(text) },
      });
      Object.defineProperty(frameWindow.navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (text: string) => destinationWrites.push(text) },
      });
      el = (await fixture(html`<lr-stack-trace .trace=${trace}></lr-stack-trace>`)) as LyraStackTrace;
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
      button.click();
      expect(destinationWrites).to.deep.equal([trace]);
      expect(ambientWrites).to.deep.equal([]);

      el.remove();
      inertDocument.body.append(inertDocument.adoptNode(el));
      window.setTimeout = ((..._args: Parameters<typeof setTimeout>) => {
        ambientTimers += 1;
        return 993;
      }) as typeof window.setTimeout;
      button.click();
      expect(ambientWrites).to.deep.equal([]);
      expect(ambientTimers, 'an ownerless component must not arm the ambient timer').to.equal(0);
    } finally {
      window.setTimeout = originalAmbientSetTimeout;
      if (el && el.ownerDocument !== document) document.adoptNode(el);
      el?.remove();
      if (ambientDescriptor) Object.defineProperty(window.navigator, 'clipboard', ambientDescriptor);
      else Reflect.deleteProperty(window.navigator, 'clipboard');
      if (destinationDescriptor) Object.defineProperty(frameWindow.navigator, 'clipboard', destinationDescriptor);
      else Reflect.deleteProperty(frameWindow.navigator, 'clipboard');
      frame.remove();
    }
  });

  it('retains the exact owner timer, clears it on adoption, and ignores its queued callback', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameDocument = frame.contentDocument!;
    const frameWindow = frame.contentWindow!;
    const originalSetTimeout = frameWindow.setTimeout;
    const originalClearTimeout = frameWindow.clearTimeout;
    const ambientClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const frameClipboard = Object.getOwnPropertyDescriptor(frameWindow.navigator, 'clipboard');
    let queued: (() => void) | undefined;
    const cleared: number[] = [];
    let el: LyraStackTrace | undefined;

    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.resolve() },
      });
      Object.defineProperty(frameWindow.navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.resolve() },
      });
      frameWindow.setTimeout = ((handler: TimerHandler) => {
        if (typeof handler === 'function') queued = handler as () => void;
        return 994;
      }) as typeof frameWindow.setTimeout;
      frameWindow.clearTimeout = ((handle?: number) => {
        if (handle !== undefined) cleared.push(handle);
      }) as typeof frameWindow.clearTimeout;
      el = (await fixture(html`<lr-stack-trace .trace=${trace}></lr-stack-trace>`)) as LyraStackTrace;
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
      button.click();
      await settleClipboard(el);
      expect(queued).to.be.a('function');

      document.body.append(document.adoptNode(el));
      await el.updateComplete;
      expect(cleared).to.deep.equal([994]);
      button.click();
      await settleClipboard(el);
      queued!();
      await el.updateComplete;
      expect(button.textContent?.trim(), 'the retired owner callback must not clear new feedback').to.equal('Copied!');
    } finally {
      frameWindow.setTimeout = originalSetTimeout;
      frameWindow.clearTimeout = originalClearTimeout;
      if (ambientClipboard) Object.defineProperty(navigator, 'clipboard', ambientClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
      if (frameClipboard) Object.defineProperty(frameWindow.navigator, 'clipboard', frameClipboard);
      else Reflect.deleteProperty(frameWindow.navigator, 'clipboard');
      el?.remove();
      frame.remove();
    }
  });

  it('renders the built-in English label with no locale registered', async () => {
    const el = (await fixture(html`<lr-stack-trace .trace=${trace}></lr-stack-trace>`)) as LyraStackTrace;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Stack trace');
  });

  it('honors a .strings override for the internal-frame toggle label', async () => {
    const el = (await fixture(
      html`<lr-stack-trace .trace=${trace} .strings=${{ stackTraceShowFrames: '{count} masqués' }}></lr-stack-trace>`,
    )) as LyraStackTrace;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[part="internal-toggle"]') as HTMLButtonElement;
    expect(toggle.textContent).to.include('masqués');
  });

  it('is accessible with a parsed, internal-collapsed trace', async () => {
    const el = (await fixture(html`<lr-stack-trace .trace=${trace}></lr-stack-trace>`)) as LyraStackTrace;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

describe('lr-stack-trace chrome', () => {
  const baseChrome = (el: LyraStackTrace) => {
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const s = getComputedStyle(base);
    return {
      paddingTop: s.paddingTop,
      paddingLeft: s.paddingLeft,
      borderTopWidth: s.borderTopWidth,
      borderTopStyle: s.borderTopStyle,
      borderTopLeftRadius: s.borderTopLeftRadius,
      backgroundColor: s.backgroundColor,
      overflowY: s.overflowY,
    };
  };

  it('defaults to frame="card", rendering identically to that value restated', async () => {
    const implicit = (await fixture(html`<lr-stack-trace .trace=${trace}></lr-stack-trace>`)) as LyraStackTrace;
    const explicit = (await fixture(
      html`<lr-stack-trace frame="card" .trace=${trace}></lr-stack-trace>`,
    )) as LyraStackTrace;

    expect(implicit.frame).to.equal('card');
    expect(implicit.getAttribute('frame')).to.equal('card');
    expect(baseChrome(explicit)).to.deep.equal(baseChrome(implicit));

    const chrome = baseChrome(implicit);
    expect(chrome.paddingTop).to.equal('8px'); // --lr-space-s
    expect(chrome.borderTopWidth).to.equal('1px');
    expect(chrome.borderTopStyle).to.equal('solid');
    expect(chrome.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
  });

  it('drops border, background, padding and radius under frame="plain"', async () => {
    const el = (await fixture(
      html`<lr-stack-trace frame="plain" .trace=${trace}></lr-stack-trace>`,
    )) as LyraStackTrace;
    expect(el.getAttribute('frame')).to.equal('plain');
    const chrome = baseChrome(el);
    expect(chrome.borderTopWidth).to.equal('0px');
    expect(chrome.borderTopLeftRadius).to.equal('0px');
    expect(chrome.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    expect(chrome.paddingTop).to.equal('0px');
    expect(chrome.paddingLeft).to.equal('0px');
  });

  it('keeps the max-height scroll cap working under plain', async () => {
    const el = (await fixture(
      html`<lr-stack-trace frame="plain" max-height="3rem" .trace=${trace}></lr-stack-trace>`,
    )) as LyraStackTrace;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const s = getComputedStyle(base);
    expect(s.maxBlockSize).to.equal('48px');
    expect(s.overflowY).to.equal('auto');
    expect(base.scrollHeight).to.be.greaterThan(base.clientHeight);
  });

  it('keeps the copy button and frame buttons visibly interactive under plain (their chrome is their own)', async () => {
    const el = (await fixture(
      html`<lr-stack-trace
        frame="plain"
        style="--lr-stack-trace-interactive-color: rgb(1, 2, 3)"
        .trace=${trace}
      ></lr-stack-trace>`,
    )) as LyraStackTrace;
    const copy = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLElement;
    expect((copy) != null).to.equal(true);
    const s = getComputedStyle(copy);
    expect(s.borderTopWidth).to.equal('1px');
    expect(s.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
    const frame = el.shadowRoot!.querySelector('button[part="frame"]') as HTMLButtonElement;
    const rect = frame.getBoundingClientRect();
    try {
      await sendMouse({
        type: 'move',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      await waitUntil(() => getComputedStyle(frame).color === 'rgb(1, 2, 3)');
      expect(getComputedStyle(frame).color).to.equal('rgb(1, 2, 3)');
    } finally {
      await resetMouse();
    }
  });

  it('paints a real internal-toggle hover state', async () => {
    const el = await fixture<LyraStackTrace>(html`
      <lr-stack-trace style="--lr-color-brand-quiet: rgb(4, 5, 6)" .trace=${trace}></lr-stack-trace>
    `);
    const toggle = el.shadowRoot!.querySelector('[part="internal-toggle"]') as HTMLButtonElement;
    const rect = toggle.getBoundingClientRect();
    try {
      await sendMouse({
        type: 'move',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      await waitUntil(() => getComputedStyle(toggle).backgroundColor === 'rgb(4, 5, 6)');
      expect(getComputedStyle(toggle).backgroundColor).to.equal('rgb(4, 5, 6)');
    } finally {
      await resetMouse();
    }
  });

  it('is accessible with a parsed trace under frame="plain"', async () => {
    const el = (await fixture(
      html`<lr-stack-trace frame="plain" .trace=${trace}></lr-stack-trace>`,
    )) as LyraStackTrace;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('defaults compact to false and reflects it as an attribute when set', async () => {
    const plain = (await fixture(html`<lr-stack-trace .trace=${trace}></lr-stack-trace>`)) as LyraStackTrace;
    expect(plain.compact).to.equal(false);
    expect(plain.hasAttribute('compact')).to.equal(false);

    plain.compact = true;
    await plain.updateComplete;
    expect(plain.hasAttribute('compact')).to.equal(true);
  });

  it('compact tightens padding and group spacing while keeping the card chrome', async () => {
    const regular = (await fixture(html`<lr-stack-trace .trace=${trace}></lr-stack-trace>`)) as LyraStackTrace;
    const el = (await fixture(html`<lr-stack-trace compact .trace=${trace}></lr-stack-trace>`)) as LyraStackTrace;

    const dense = baseChrome(el);
    const full = baseChrome(regular);
    expect(dense.borderTopWidth).to.equal(full.borderTopWidth);
    expect(dense.borderTopLeftRadius).to.equal(full.borderTopLeftRadius);
    expect(dense.backgroundColor).to.equal(full.backgroundColor);
    expect(parseFloat(dense.paddingTop)).to.be.greaterThan(0);
    expect(parseFloat(dense.paddingTop)).to.be.lessThan(parseFloat(full.paddingTop));

    const messageMargin = (host: LyraStackTrace) =>
      parseFloat(getComputedStyle(host.shadowRoot!.querySelector('[part="message"]') as HTMLElement).marginBlockEnd);
    expect(messageMargin(el)).to.be.greaterThan(0);
    expect(messageMargin(el)).to.be.lessThan(messageMargin(regular));
  });

  it('keeps compact group spacing tighter than the default, and still zero on the last group', async () => {
    const chained = ['Error: outer', '    at a (/app/a.js:1:1)', 'Caused by: Error: inner', '    at b (/app/b.js:2:2)']
      .join('\n');
    const regular = (await fixture(html`<lr-stack-trace .trace=${chained}></lr-stack-trace>`)) as LyraStackTrace;
    const el = (await fixture(html`<lr-stack-trace compact .trace=${chained}></lr-stack-trace>`)) as LyraStackTrace;

    const groups = (host: LyraStackTrace) =>
      [...host.shadowRoot!.querySelectorAll<HTMLElement>('[part="group"]')].map((g) =>
        parseFloat(getComputedStyle(g).marginBlockEnd));
    const dense = groups(el);
    const full = groups(regular);
    expect(dense.length).to.be.greaterThan(1);
    expect(dense[0]!).to.be.greaterThan(0);
    expect(dense[0]!).to.be.lessThan(full[0]!);
    expect(dense[dense.length - 1]!).to.equal(0);
  });

  it('lets frame="plain" win over compact padding, as on every sibling that pairs them', async () => {
    const el = (await fixture(
      html`<lr-stack-trace compact frame="plain" .trace=${trace}></lr-stack-trace>`,
    )) as LyraStackTrace;
    const chrome = baseChrome(el);
    expect(chrome.paddingTop).to.equal('0px');
    expect(chrome.paddingLeft).to.equal('0px');
    expect(chrome.borderTopWidth).to.equal('0px');
  });

  it('is accessible in the compact presentation', async () => {
    const el = (await fixture(html`<lr-stack-trace compact .trace=${trace}></lr-stack-trace>`)) as LyraStackTrace;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

it('exposes component-scoped internal-frame and interactive colors', async () => {
  const el = (await fixture(html`
    <lr-stack-trace
      collapse-internal="false"
      style="
        --lr-stack-trace-internal-frame-color: rgb(1, 2, 3);
        --lr-stack-trace-interactive-color: rgb(4, 5, 6);
      "
      .trace=${trace}
    ></lr-stack-trace>
  `)) as LyraStackTrace;
  const internal = el.shadowRoot!.querySelector<HTMLElement>('[part="frame"][data-internal]')!;
  const toggle = (await fixture(html`
    <lr-stack-trace
      style="--lr-stack-trace-interactive-color: rgb(4, 5, 6)"
      .trace=${trace}
    ></lr-stack-trace>
  `)) as LyraStackTrace;
  expect(getComputedStyle(internal).color).to.equal('rgb(1, 2, 3)');
  expect(getComputedStyle(toggle.shadowRoot!.querySelector('[part="internal-toggle"]')!).color).to.equal(
    'rgb(4, 5, 6)',
  );
});

it('rejects a max-height that tries to escape the custom property into extra declarations', async () => {
  const el = (await fixture(
    html`<lr-stack-trace max-height="3rem;position:fixed;inset:0"></lr-stack-trace>`,
  )) as LyraStackTrace;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(base).position, 'the injected declaration must not apply').to.not.equal('fixed');
  expect(base.style.getPropertyValue('--lr-stack-trace-max-height').trim()).to.equal('');

  el.setAttribute('max-height', '20rem');
  await el.updateComplete;
  expect(base.style.getPropertyValue('--lr-stack-trace-max-height').trim()).to.equal('20rem');
});
