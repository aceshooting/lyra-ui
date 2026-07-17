import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './stack-trace.js';
import type { LyraStackTrace } from './stack-trace.js';

const trace = [
  'TypeError: Cannot read properties of undefined',
  '    at Object.doThing (/app/src/util.js:10:5)',
  '    at Module._compile (node:internal/modules/cjs/loader:1105:14)',
  '    at Module._extensions..js (node:internal/modules/cjs/loader:1179:10)',
].join('\n');

describe('lyra-stack-trace', () => {
  it('defaults to collapseInternal=true and copyable=true', async () => {
    const el = (await fixture(html`<lyra-stack-trace></lyra-stack-trace>`)) as LyraStackTrace;
    expect(el.collapseInternal).to.be.true;
    expect(el.copyable).to.be.true;
  });

  it('renders the message and one frame button per parsed frame when internal collapsing is off', async () => {
    // NOTE: `.collapseInternal=${false}` uses a *property* binding, not `?collapse-internal=${false}`
    // -- a boolean attribute binding can never remove an already-present-by-default `true` back to
    // `false`.
    const el = (await fixture(
      html`<lyra-stack-trace .trace=${trace} .collapseInternal=${false}></lyra-stack-trace>`,
    )) as LyraStackTrace;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="message"]')!.textContent).to.include('TypeError');
    expect(el.shadowRoot!.querySelectorAll('[part="frame"]').length).to.equal(3);
  });

  it('collapses internal frames behind a toggle showing the count when collapseInternal', async () => {
    const el = (await fixture(html`<lyra-stack-trace .trace=${trace} collapse-internal></lyra-stack-trace>`)) as LyraStackTrace;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[part="internal-toggle"]') as HTMLButtonElement;
    expect(toggle).to.exist;
    expect(toggle.getAttribute('aria-expanded')).to.equal('false');
    expect(toggle.textContent).to.include('2');
    toggle.click();
    await el.updateComplete;
    expect(toggle.getAttribute('aria-expanded')).to.equal('true');
  });

  it('emits lyra-frame-select with file/line/column on frame activation', async () => {
    const el = (await fixture(html`<lyra-stack-trace .trace=${trace}></lyra-stack-trace>`)) as LyraStackTrace;
    await el.updateComplete;
    const frame = el.shadowRoot!.querySelector('[part="frame"]') as HTMLButtonElement;
    const listener = oneEvent(el, 'lyra-frame-select');
    frame.click();
    const event = (await listener) as CustomEvent<{ file: string; line: number; column: number }>;
    expect(event.detail).to.deep.include({ file: '/app/src/util.js', line: 10, column: 5 });
  });

  it('renders verbatim raw output in part="raw" when nothing parses', async () => {
    const el = (await fixture(
      html`<lyra-stack-trace trace="not a trace at all"></lyra-stack-trace>`,
    )) as LyraStackTrace;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="raw"]')!.textContent).to.equal('not a trace at all');
    expect(el.shadowRoot!.querySelectorAll('[part="frame"]').length).to.equal(0);
  });

  it('copy button emits lyra-copy with the raw trace text', async () => {
    const el = (await fixture(html`<lyra-stack-trace .trace=${trace} copyable></lyra-stack-trace>`)) as LyraStackTrace;
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
    const listener = oneEvent(el, 'lyra-copy');
    button.click();
    const event = (await listener) as CustomEvent<{ text: string }>;
    expect(event.detail.text).to.equal(trace);
  });

  it('renders the built-in English label with no locale registered', async () => {
    const el = (await fixture(html`<lyra-stack-trace .trace=${trace}></lyra-stack-trace>`)) as LyraStackTrace;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Stack trace');
  });

  it('honors a .strings override for the internal-frame toggle label', async () => {
    const el = (await fixture(
      html`<lyra-stack-trace .trace=${trace} .strings=${{ stackTraceShowFrames: '{count} masqués' }}></lyra-stack-trace>`,
    )) as LyraStackTrace;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[part="internal-toggle"]') as HTMLButtonElement;
    expect(toggle.textContent).to.include('masqués');
  });

  it('is accessible with a parsed, internal-collapsed trace', async () => {
    const el = (await fixture(html`<lyra-stack-trace .trace=${trace}></lyra-stack-trace>`)) as LyraStackTrace;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});
