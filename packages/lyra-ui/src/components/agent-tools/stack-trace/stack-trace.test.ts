import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './stack-trace.js';
import type { LyraStackTrace } from './stack-trace.js';
import { styles } from './stack-trace.styles.js';

const trace = [
  'TypeError: Cannot read properties of undefined',
  '    at Object.doThing (/app/src/util.js:10:5)',
  '    at Module._compile (node:internal/modules/cjs/loader:1105:14)',
  '    at Module._extensions..js (node:internal/modules/cjs/loader:1179:10)',
].join('\n');

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
    expect(toggle).to.exist;
    expect(toggle.getAttribute('aria-expanded')).to.equal('false');
    expect(toggle.textContent).to.include('2');
    toggle.click();
    await el.updateComplete;
    expect(toggle.getAttribute('aria-expanded')).to.equal('true');
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

  it('renders verbatim raw output in part="raw" when nothing parses', async () => {
    const el = (await fixture(
      html`<lr-stack-trace trace="not a trace at all"></lr-stack-trace>`,
    )) as LyraStackTrace;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="raw"]')!.textContent).to.equal('not a trace at all');
    expect(el.shadowRoot!.querySelectorAll('[part="frame"]').length).to.equal(0);
  });

  it('copy button emits lr-copy with the raw trace text', async () => {
    const el = (await fixture(html`<lr-stack-trace .trace=${trace} copyable></lr-stack-trace>`)) as LyraStackTrace;
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
    const listener = oneEvent(el, 'lr-copy');
    button.click();
    const event = (await listener) as CustomEvent<{ text: string }>;
    expect(event.detail.text).to.equal(trace);
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

  it('defaults to appearance="card", rendering identically to that value restated', async () => {
    const implicit = (await fixture(html`<lr-stack-trace .trace=${trace}></lr-stack-trace>`)) as LyraStackTrace;
    const explicit = (await fixture(
      html`<lr-stack-trace appearance="card" .trace=${trace}></lr-stack-trace>`,
    )) as LyraStackTrace;

    expect(implicit.appearance).to.equal('card');
    expect(implicit.getAttribute('appearance')).to.equal('card');
    expect(baseChrome(explicit)).to.deep.equal(baseChrome(implicit));

    const chrome = baseChrome(implicit);
    expect(chrome.paddingTop).to.equal('8px'); // --lr-space-s
    expect(chrome.borderTopWidth).to.equal('1px');
    expect(chrome.borderTopStyle).to.equal('solid');
    expect(chrome.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
  });

  it('drops border, background, padding and radius under appearance="plain"', async () => {
    const el = (await fixture(
      html`<lr-stack-trace appearance="plain" .trace=${trace}></lr-stack-trace>`,
    )) as LyraStackTrace;
    expect(el.getAttribute('appearance')).to.equal('plain');
    const chrome = baseChrome(el);
    expect(chrome.borderTopWidth).to.equal('0px');
    expect(chrome.borderTopLeftRadius).to.equal('0px');
    expect(chrome.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    expect(chrome.paddingTop).to.equal('0px');
    expect(chrome.paddingLeft).to.equal('0px');
  });

  it('keeps the max-height scroll cap working under plain', async () => {
    const el = (await fixture(
      html`<lr-stack-trace appearance="plain" max-height="3rem" .trace=${trace}></lr-stack-trace>`,
    )) as LyraStackTrace;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const s = getComputedStyle(base);
    expect(s.maxBlockSize).to.equal('48px');
    expect(s.overflowY).to.equal('auto');
    expect(base.scrollHeight).to.be.greaterThan(base.clientHeight);
  });

  it('keeps the copy button and frame buttons visibly interactive under plain (their chrome is their own)', async () => {
    const el = (await fixture(
      html`<lr-stack-trace appearance="plain" .trace=${trace}></lr-stack-trace>`,
    )) as LyraStackTrace;
    const copy = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLElement;
    expect(copy).to.exist;
    const s = getComputedStyle(copy);
    expect(s.borderTopWidth).to.equal('1px');
    expect(s.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.include("[part='frame']:hover, [part='frame']:focus-visible { color: var(--lr-color-brand); }");
  });

  it('gives internal-toggle a hover state', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='internal-toggle'\]:hover/);
  });

  it('is accessible with a parsed trace under appearance="plain"', async () => {
    const el = (await fixture(
      html`<lr-stack-trace appearance="plain" .trace=${trace}></lr-stack-trace>`,
    )) as LyraStackTrace;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});
