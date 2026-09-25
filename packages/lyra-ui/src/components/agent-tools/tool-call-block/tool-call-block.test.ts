import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import type { LyraToolCallBlock } from './tool-call-block.class.js';
import './tool-call-block.js';
import { registerToolRenderer } from '../tool-result-view/registry.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { setForcedColors, setReducedMotion } from '../../../../test/wtr-media.js';

type Block = LyraToolCallBlock;
let uniqueCounter = 0;
const uniqueName = (stem: string): string => `${stem}_${Date.now().toString(36)}_${++uniqueCounter}`;

function part(el: Block, name: string): HTMLElement | null {
  return el.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`);
}
function header(el: Block): HTMLButtonElement {
  return part(el, 'header') as HTMLButtonElement;
}
function text(node: Element | null | undefined): string {
  return (node?.textContent ?? '').replace(/\s+/gu, ' ').trim();
}
async function settleChildren(el: Block): Promise<void> {
  await el.updateComplete;
  const children = [...el.shadowRoot!.querySelectorAll('*')].filter((node) => node.localName.includes('-'));
  await Promise.all(children.map((node) => (node as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete));
  await el.updateComplete;
}

/** Normalizes any computed colour (oklab, color-mix results, named) to `rgb(r, g, b)` through a
 *  1x1 canvas, so contrast math never parses a colour space it does not understand. */
function toRgb(color: string): [number, number, number, number] {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d')!;
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return [r!, g!, b!, a!];
}
function luminance([r, g, b]: [number, number, number, number]): number {
  const [red, green, blue] = [r, g, b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return red! * 0.2126 + green! * 0.7152 + blue! * 0.0722;
}
function contrast(foreground: string, background: string): number {
  const a = luminance(toRgb(foreground));
  const b = luminance(toRgb(background));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
function effectiveBackground(el: Block): string {
  const own = getComputedStyle(header(el)).backgroundColor;
  if (toRgb(own)[3] !== 0) return own;
  return getComputedStyle(part(el, 'base')!).backgroundColor;
}
function resolvedToken(el: Element, token: string, property = 'color'): string {
  const probe = document.createElement('span');
  probe.style.setProperty(property, `var(${token})`);
  el.shadowRoot!.appendChild(probe);
  const value = getComputedStyle(probe).getPropertyValue(property);
  probe.remove();
  return value;
}

describe('<lr-tool-call-block>', () => {
  afterEach(async () => {
    await resetMouse();
  });

  it('renders a collapsed, pending default that reflects status and defers every detail', async () => {
    const el = await fixture<Block>(html`<lr-tool-call-block></lr-tool-call-block>`);
    expect(text(part(el, 'label'))).to.equal('Waiting to use Tool call');
    expect(header(el).getAttribute('aria-expanded')).to.equal('false');
    expect(el.getAttribute('status')).to.equal('pending');
    expect(el.hasAttribute('expanded')).to.equal(false);
    const body = part(el, 'body')!;
    expect(body.hidden).to.equal(true);
    expect(body.children.length).to.equal(0);
    expect(header(el).getAttribute('aria-controls')).to.equal(body.id);
    expect(el.shadowRoot!.querySelectorAll('lr-json-viewer, lr-tool-result-view').length).to.equal(0);
    expect(part(el, 'status-text') === null).to.equal(true);
    expect(part(el, 'duration') === null).to.equal(true);
  });

  it('mounts without throwing and without moving focus away from an outside control', async () => {
    const outside = document.createElement('button');
    outside.textContent = 'outside';
    document.body.append(outside);
    const el = document.createElement('lr-tool-call-block') as Block;
    try {
      outside.focus();
      document.body.append(el);
      await el.updateComplete;
      expect(document.activeElement === outside).to.equal(true);
    } finally {
      el.remove();
      outside.remove();
    }
  });

  it('maps every status to its verb, glyph and reflected attribute, and normalizes foreign values', async () => {
    const el = await fixture<Block>(html`<lr-tool-call-block name="web_search"></lr-tool-call-block>`);
    const expected: Record<string, string> = {
      pending: 'Waiting to use web_search',
      running: 'Using web_search',
      success: 'Used web_search',
      error: 'Failed to use web_search',
      denied: 'Use of web_search denied',
    };
    const glyphs = new Set<string>();
    for (const [status, verb] of Object.entries(expected)) {
      el.status = status as Block['status'];
      await el.updateComplete;
      expect(text(part(el, 'label')), status).to.equal(verb);
      expect(el.getAttribute('status')).to.equal(status);
      glyphs.add(part(el, 'icon')!.innerHTML.replace(/<!--[^]*?-->/gu, ''));
    }
    expect(glyphs.size).to.equal(5);

    el.setAttribute('status', 'bogus');
    await el.updateComplete;
    expect(el.status).to.equal('pending');
    expect(el.getAttribute('status')).to.equal('pending');

    el.status = 'success';
    await el.updateComplete;
    el.status = 'bogus' as Block['status'];
    await el.updateComplete;
    expect(el.status).to.equal('pending');
    expect(el.getAttribute('status')).to.equal('pending');
  });

  it('toggles on header click and emits one lr-toggle with the call id', async () => {
    const el = await fixture<Block>(html`<lr-tool-call-block name="t" call-id="c1"></lr-tool-call-block>`);
    let count = 0;
    el.addEventListener('lr-toggle', () => count++);
    const toggled = oneEvent(el, 'lr-toggle');
    header(el).click();
    const event = (await toggled) as CustomEvent;
    expect(event.detail).to.deep.equal({ expanded: true, callId: 'c1' });
    expect([event.bubbles, event.composed, event.cancelable]).to.deep.equal([true, true, false]);
    await el.updateComplete;
    expect(el.expanded).to.equal(true);
    expect(el.hasAttribute('expanded')).to.equal(true);
    expect(header(el).getAttribute('aria-expanded')).to.equal('true');
    expect(part(el, 'body')!.hidden).to.equal(false);
    expect(count).to.equal(1);
  });

  it('toggles from the keyboard with Enter and Space on the focused header', async () => {
    const el = await fixture<Block>(html`<lr-tool-call-block name="t"></lr-tool-call-block>`);
    header(el).focus();
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('header');
    await sendKeys({ press: 'Enter' });
    await el.updateComplete;
    expect(el.expanded).to.equal(true);
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('header');
    await sendKeys({ press: 'Space' });
    await el.updateComplete;
    expect(el.expanded).to.equal(false);
  });

  it('renders details for a programmatic expand without emitting lr-toggle', async () => {
    const el = await fixture<Block>(html`<lr-tool-call-block name="t" .args=${{ q: 1 }}></lr-tool-call-block>`);
    let count = 0;
    el.addEventListener('lr-toggle', () => count++);
    el.expanded = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('lr-json-viewer').length).to.equal(1);
    expect(count).to.equal(0);
  });

  it('never traverses args while collapsed or on unrelated updates', async () => {
    let reads = 0;
    const args = new Proxy({ query: 'lyra' } as Record<string, unknown>, {
      ownKeys(target) {
        reads++;
        return Reflect.ownKeys(target);
      },
      get(target, key, receiver) {
        reads++;
        return Reflect.get(target, key, receiver);
      },
      getOwnPropertyDescriptor(target, key) {
        reads++;
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
      getPrototypeOf(target) {
        reads++;
        return Reflect.getPrototypeOf(target);
      },
    });
    // Assigned directly: the test's own template binding would otherwise inspect the value.
    const el = await fixture<Block>(html`<lr-tool-call-block name="t"></lr-tool-call-block>`);
    el.args = args;
    await el.updateComplete;
    expect(reads).to.equal(0);
    el.status = 'running';
    el.label = 'Search';
    el.durationMs = 1200;
    await el.updateComplete;
    expect(reads).to.equal(0);

    el.expanded = true;
    await settleChildren(el);
    const afterExpand = reads;
    el.label = 'Search again';
    await settleChildren(el);
    expect(reads).to.equal(afterExpand);
    el.status = 'success';
    await settleChildren(el);
    expect(reads).to.equal(afterExpand);
  });

  it('renders args, error and result in order, passing identities through when unredacted', async () => {
    const args = { query: 'lyra' };
    const result = { hits: 3 };
    const el = await fixture<Block>(html`<lr-tool-call-block
      name="web_search"
      expanded
      .args=${args}
      .result=${result}
      error="partial failure"
    ></lr-tool-call-block>`);
    await settleChildren(el);
    const order = [...part(el, 'body')!.children].map((child) => child.getAttribute('part'));
    expect(order).to.deep.equal(['args', 'error', 'result']);
    const viewer = el.shadowRoot!.querySelector('lr-json-viewer') as HTMLElement & { data: unknown };
    expect(viewer.data === args).to.equal(true);
    const view = el.shadowRoot!.querySelector('lr-tool-result-view') as HTMLElement & {
      toolName: string;
      args: unknown;
      result: unknown;
    };
    expect(view.toolName).to.equal('web_search');
    expect(view.args === args && view.result === result).to.equal(true);
    expect(text(part(el, 'error')!.querySelector('p'))).to.equal('partial failure');
  });

  it('shows each section only when present and a status-aware empty message otherwise', async () => {
    const el = await fixture<Block>(html`<lr-tool-call-block name="t" expanded></lr-tool-call-block>`);
    for (const args of [undefined, null, {}]) {
      el.args = args;
      await el.updateComplete;
      expect(part(el, 'args') === null, String(args)).to.equal(true);
    }
    el.error = '';
    await el.updateComplete;
    expect(part(el, 'error') === null).to.equal(true);

    const expected: Record<string, string> = {
      pending: 'Pending',
      running: 'Running',
      success: 'No data',
      error: 'No data',
      denied: 'No data',
    };
    for (const [status, message] of Object.entries(expected)) {
      el.status = status as Block['status'];
      await el.updateComplete;
      expect(text(part(el, 'empty')), status).to.equal(message);
    }

    el.error = 'boom';
    el.result = { partial: true };
    await el.updateComplete;
    expect(part(el, 'empty') === null).to.equal(true);
    expect([part(el, 'error') !== null, part(el, 'result') !== null]).to.deep.equal([true, true]);
  });

  it('masks redacted paths, honours a placeholder override and ignores dangling paths', async () => {
    const el = await fixture<Block>(html`<lr-tool-call-block
      name="lookup"
      expanded
      .args=${{ apiKey: 'secret', query: 'q' }}
      .result=${{ rows: [{ ssn: '123' }] }}
      error="token=abc"
      .redactedFields=${['args.apiKey', 'result.rows.0.ssn', 'error', 'args.missing.deep']}
    ></lr-tool-call-block>`);
    await settleChildren(el);
    const viewer = el.shadowRoot!.querySelector('lr-json-viewer') as HTMLElement & { data: Record<string, unknown> };
    expect(viewer.data['apiKey']).to.equal('Value hidden');
    expect(viewer.data['query']).to.equal('q');
    expect(Object.getPrototypeOf(viewer.data)).to.equal(null);
    const view = el.shadowRoot!.querySelector('lr-tool-result-view') as HTMLElement & {
      result: { rows: Array<Record<string, unknown>> };
    };
    expect(view.result.rows[0]!['ssn']).to.equal('Value hidden');
    expect(text(part(el, 'error')!.querySelector('p'))).to.equal('Value hidden');

    el.strings = { envListValueHidden: 'Masqué' };
    await settleChildren(el);
    expect(text(part(el, 'error')!.querySelector('p'))).to.equal('Masqué');
  });

  it('fails closed when the redaction list itself cannot be read', async () => {
    const el = await fixture<Block>(html`<lr-tool-call-block
      name="lookup"
      expanded
      .args=${{ apiKey: 'secret' }}
      .result=${{ ok: true }}
      error="boom"
    ></lr-tool-call-block>`);
    const hostile: string[] = [];
    Object.defineProperty(hostile, 'length', { value: 1, writable: true });
    Object.defineProperty(hostile, 0, { get: () => 'args.apiKey', enumerable: true });
    el.redactedFields = hostile;
    await settleChildren(el);
    const viewer = el.shadowRoot!.querySelector('lr-json-viewer') as HTMLElement & { data: unknown };
    const view = el.shadowRoot!.querySelector('lr-tool-result-view') as HTMLElement & { result: unknown };
    // The owned snapshot of an unreadable list either drops it or keeps it unreadable; both must
    // leave no unmasked secret reachable.
    expect(JSON.stringify(viewer.data ?? null)).to.not.contain('secret');
    expect([viewer.data, view.result, text(part(el, 'error')!.querySelector('p'))]).to.deep.equal([
      'Value hidden',
      'Value hidden',
      'Value hidden',
    ]);
  });

  it('shows a verbatim label override with a visible status text, and restores the verb when removed', async () => {
    const el = await fixture<Block>(html`<lr-tool-call-block name="x" status="success" label=""></lr-tool-call-block>`);
    expect(text(part(el, 'label'))).to.equal('');
    expect(text(part(el, 'status-text'))).to.equal('Success');

    el.strings = { toolCallBlockHeaderSuccess: 'Utilisé {name}' };
    el.setAttribute('label', 'Used x');
    await el.updateComplete;
    expect(text(part(el, 'label'))).to.equal('Used x');
    expect(part(el, 'status-text') !== null).to.equal(true);

    el.removeAttribute('label');
    await el.updateComplete;
    expect(text(part(el, 'label'))).to.equal('Utilisé x');
    expect(part(el, 'status-text') === null).to.equal(true);
  });

  it('formats a finite duration in the effective locale and hides non-finite values', async () => {
    const el = await fixture<Block>(html`<lr-tool-call-block name="t" .durationMs=${820}></lr-tool-call-block>`);
    expect(text(part(el, 'duration'))).to.equal('820ms');
    el.durationMs = 1500;
    await el.updateComplete;
    expect(text(part(el, 'duration'))).to.equal('1.5s');
    el.setAttribute('lang', 'de-DE');
    await el.updateComplete;
    expect(text(part(el, 'duration'))).to.equal('1,5s');
    el.removeAttribute('lang');
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, undefined]) {
      el.durationMs = value;
      await el.updateComplete;
      expect(part(el, 'duration') === null, String(value)).to.equal(true);
    }
    el.durationMs = -40;
    await el.updateComplete;
    expect(text(part(el, 'duration'))).to.equal('0ms');
  });

  it('derives the header name from its content and labels the body and each section', async () => {
    const el = await fixture<Block>(html`<lr-tool-call-block
      name="web_search"
      status="success"
      expanded
      .durationMs=${1500}
      .args=${{ q: 1 }}
      .result=${{ ok: true }}
      error="e"
    ></lr-tool-call-block>`);
    expect(text(header(el))).to.equal('Used web_search 1.5s');
    const body = part(el, 'body')!;
    const labelledBy = body.getAttribute('aria-labelledby')!;
    expect(el.shadowRoot!.getElementById(labelledBy)?.getAttribute('part')).to.equal('label');
    for (const section of ['args', 'error', 'result']) {
      const id = part(el, section)!.getAttribute('aria-labelledby')!;
      expect(part(el, section)!.getAttribute('role')).to.equal('group');
      expect(el.shadowRoot!.getElementById(id)?.getAttribute('part'), section).to.equal(`${section}-label`);
    }
    expect([...el.shadowRoot!.querySelectorAll('[part="toggle"], [part="icon"]')].map((node) => node.getAttribute('aria-hidden'))).to.deep.equal(['true', 'true']);
  });

  it('returns focus to the header only when a collapse removes the focused element', async () => {
    const el = await fixture<Block>(html`<lr-tool-call-block name="t" expanded .args=${{ nested: { a: 1 } }}></lr-tool-call-block>`);
    await settleChildren(el);
    const viewer = el.shadowRoot!.querySelector('lr-json-viewer')!;
    await (viewer as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
    const focusable = viewer.shadowRoot!.querySelector<HTMLElement>('button, [tabindex="0"]');
    expect(focusable !== null, 'json viewer exposes a focusable control').to.equal(true);
    focusable!.focus();
    expect(el.shadowRoot!.activeElement?.localName).to.equal('lr-json-viewer');
    el.expanded = false;
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('header');

    const outside = document.createElement('button');
    document.body.append(outside);
    try {
      outside.focus();
      el.expanded = true;
      await el.updateComplete;
      el.expanded = false;
      await el.updateComplete;
      expect(document.activeElement === outside).to.equal(true);
    } finally {
      outside.remove();
    }

    header(el).focus();
    header(el).click();
    await el.updateComplete;
    header(el).click();
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('header');
  });

  it('re-emits the result view render error with the call id and contains the raw event', async () => {
    const name = uniqueName('unregistered');
    const el = await fixture<Block>(html`<lr-tool-call-block .name=${name} call-id="c1" .result=${{ a: 1 }}></lr-tool-call-block>`);
    const events: Array<Record<string, unknown>> = [];
    el.addEventListener('lr-render-error', (event) => events.push((event as CustomEvent).detail));
    await settleChildren(el);
    expect(events.length, 'a collapsed block emits nothing').to.equal(0);

    el.expanded = true;
    await settleChildren(el);
    await waitUntil(() => events.length === 1, 'no-match render error re-emitted');
    expect(events[0]!['toolName']).to.equal(name);
    expect(events[0]!['callId']).to.equal('c1');
    expect('error' in events[0]!).to.equal(true);

    let raw = 0;
    const view = el.shadowRoot!.querySelector('lr-tool-result-view')!;
    part(el, 'body')!.addEventListener('lr-render-error', () => raw++);
    events.length = 0;
    view.dispatchEvent(new CustomEvent('lr-render-error', {
      bubbles: true,
      composed: true,
      detail: { toolName: 'web_search', error: 'failed' },
    }));
    expect(events).to.deep.equal([{ toolName: 'web_search', error: 'failed', callId: 'c1' }]);
    expect(raw).to.equal(0);

    events.length = 0;
    el.expanded = false;
    await settleChildren(el);
    el.expanded = true;
    await settleChildren(el);
    await waitUntil(() => events.length === 1, 're-expand re-emits once');
    expect(events.length).to.equal(1);
  });

  it('gives two blocks with the same unregistered tool distinct call ids', async () => {
    const name = uniqueName('shared');
    const wrapper = await fixture<HTMLElement>(html`<div>
      <lr-tool-call-block .name=${name} call-id="a" expanded .result=${1}></lr-tool-call-block>
      <lr-tool-call-block .name=${name} call-id="b" expanded .result=${2}></lr-tool-call-block>
    </div>`);
    const ids: string[] = [];
    wrapper.addEventListener('lr-render-error', (event) => ids.push((event as CustomEvent).detail.callId));
    const blocks = [...wrapper.querySelectorAll<Block>('lr-tool-call-block')];
    for (const block of blocks) {
      block.expanded = false;
      await block.updateComplete;
      block.expanded = true;
      await settleChildren(block);
    }
    await waitUntil(() => ids.length >= 2, 'both blocks re-emit');
    expect([...new Set(ids)].sort()).to.deep.equal(['a', 'b']);
  });

  it('keeps its expanded state across reconnect and still emits one toggle per click', async () => {
    const el = await fixture<Block>(html`<lr-tool-call-block name="t" .args=${{ a: 1 }}></lr-tool-call-block>`);
    el.expanded = true;
    await el.updateComplete;
    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    await el.updateComplete;
    expect(el.expanded).to.equal(true);
    expect(el.shadowRoot!.querySelectorAll('lr-json-viewer').length).to.equal(1);
    let count = 0;
    el.addEventListener('lr-toggle', () => count++);
    header(el).click();
    expect(count).to.equal(1);
  });

  it('puts the chevron at inline-start and mirrors it only while collapsed under RTL', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div>
      <lr-tool-call-block style="--lr-transition-fast: 0s" dir="rtl" name="t"></lr-tool-call-block>
      <lr-tool-call-block style="--lr-transition-fast: 0s" name="t"></lr-tool-call-block>
    </div>`);
    const [rtl, ltr] = [...wrapper.querySelectorAll<Block>('lr-tool-call-block')] as [Block, Block];
    const toggleRect = part(rtl, 'toggle')!.getBoundingClientRect();
    const iconRect = part(rtl, 'icon')!.getBoundingClientRect();
    expect(toggleRect.left).to.be.greaterThan(iconRect.left);
    expect(getComputedStyle(part(rtl, 'toggle')!).transform).to.equal('matrix(-1, 0, 0, 1, 0, 0)');
    expect(getComputedStyle(part(ltr, 'toggle')!).transform).to.equal('none');
    rtl.expanded = true;
    ltr.expanded = true;
    await Promise.all([rtl.updateComplete, ltr.updateComplete]);
    expect(getComputedStyle(part(rtl, 'toggle')!).transform).to.equal(getComputedStyle(part(ltr, 'toggle')!).transform);
  });

  it('stays inside a 320px container, applies narrow padding, and survives shrink-to-fit', async () => {
    const longName = 'x'.repeat(200);
    const wrapper = await fixture<HTMLElement>(html`<div style="inline-size: 320px">
      <lr-tool-call-block .name=${longName} expanded .args=${{ long: 'y'.repeat(400) }}></lr-tool-call-block>
    </div>`);
    const el = wrapper.querySelector<Block>('lr-tool-call-block')!;
    await settleChildren(el);
    expect(el.scrollWidth).to.be.at.most(320);

    wrapper.style.inlineSize = '280px';
    await waitUntil(() => getComputedStyle(header(el)).paddingInlineStart === resolvedToken(el, '--lr-space-s', 'padding-inline-start'), 'narrow padding applies');

    const grid = await fixture<HTMLElement>(html`<div style="display: grid; place-items: center; inline-size: 400px">
      <lr-tool-call-block name="t"></lr-tool-call-block>
    </div>`);
    expect(grid.querySelector('lr-tool-call-block')!.getBoundingClientRect().width).to.be.greaterThan(0);
  });

  it('scrolls a wide renderer inside the result section and makes it a keyboard stop only while it overflows', async () => {
    const wide = uniqueName('wide');
    registerToolRenderer(wide, { render: () => html`<div class="wide" style="inline-size: 1200px">wide</div>` });
    const wrapper = await fixture<HTMLElement>(html`<div style="inline-size: 320px">
      <lr-tool-call-block .name=${wide} expanded .result=${{}}></lr-tool-call-block>
    </div>`);
    const el = wrapper.querySelector<Block>('lr-tool-call-block')!;
    await settleChildren(el);
    const view = el.shadowRoot!.querySelector('lr-tool-result-view')!;
    await waitUntil(() => view.shadowRoot?.querySelector('.wide') ?? view.querySelector('.wide'), 'wide renderer output');
    const result = part(el, 'result')!;
    await waitUntil(() => result.getAttribute('tabindex') === '0', 'overflowing result becomes a stop');
    expect(result.scrollWidth).to.be.greaterThan(result.clientWidth);
    expect(result.hasAttribute('data-scroll-overflow')).to.equal(true);
    result.scrollLeft = 200;
    expect(result.scrollLeft).to.be.greaterThan(0);
    expect(el.scrollWidth).to.be.at.most(320);

    header(el).focus();
    await sendKeys({ press: 'Tab' });
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('result');
    await expect(el).to.be.accessible();

    const small = await fixture<Block>(html`<lr-tool-call-block name="t" expanded .result=${'ok'}></lr-tool-call-block>`);
    await settleChildren(small);
    expect(part(small, 'result')!.hasAttribute('tabindex')).to.equal(false);
    const after = document.createElement('button');
    small.after(after);
    try {
      header(small).focus();
      await sendKeys({ press: 'Tab' });
      expect(small.shadowRoot!.activeElement?.getAttribute('part')).to.not.equal('result');
    } finally {
      after.remove();
    }
  });

  for (const theme of ['light', 'dark'] as const) {
    it(`keeps header text readable at rest, hover and press (${theme})`, async () => {
      const el = await fixture<Block>(html`<lr-tool-call-block
        data-lr-theme=${theme}
        style="--lr-transition-fast: 0s"
        name="web_search"
        status="success"
        label="Search"
        .durationMs=${1500}
      ></lr-tool-call-block>`);
      const texts = ['label', 'status-text', 'duration'].map((name) => part(el, name)!);
      const quiet = resolvedToken(el, '--lr-color-text-quiet');
      expect(getComputedStyle(texts[1]!).color).to.equal(quiet);
      expect(getComputedStyle(texts[2]!).color).to.equal(quiet);
      const assertContrast = (state: string): void => {
        const background = effectiveBackground(el);
        for (const node of texts) {
          expect(contrast(getComputedStyle(node).color, background), `${state} ${node.getAttribute('part')}`).to.be.at.least(4.5);
        }
      };
      assertContrast('rest');

      const restBackground = getComputedStyle(header(el)).backgroundColor;
      await hoverUntilMatched(header(el), 'block header under the pointer');
      await waitUntil(() => getComputedStyle(header(el)).backgroundColor !== restBackground, 'hover background');
      const brand = resolvedToken(el, '--lr-color-brand');
      expect(texts.map((node) => getComputedStyle(node).color)).to.deep.equal([brand, brand, brand]);
      assertContrast('hover');
      const hoverBackground = getComputedStyle(header(el)).backgroundColor;

      await sendMouse({ type: 'down' });
      try {
        await waitUntil(() => getComputedStyle(header(el)).backgroundColor !== hoverBackground, 'pressed background');
        const body = resolvedToken(el, '--lr-color-text');
        expect(texts.map((node) => getComputedStyle(node).color)).to.deep.equal([body, body, body]);
        assertContrast('pressed');
      } finally {
        await sendMouse({ type: 'up' });
      }
    });
  }

  it('shows a focus ring after keyboard focus', async () => {
    const el = await fixture<Block>(html`<lr-tool-call-block name="t"></lr-tool-call-block>`);
    const before = document.createElement('button');
    el.before(before);
    try {
      before.focus();
      await sendKeys({ press: 'Tab' });
      expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('header');
      await waitUntil(() => getComputedStyle(header(el)).outlineStyle === 'solid', 'focus ring');
    } finally {
      before.remove();
    }
  });

  it('outlines a hovered header in forced colors', async () => {
    const el = await fixture<Block>(html`<lr-tool-call-block name="t"></lr-tool-call-block>`);
    try {
      await setForcedColors('active');
      await hoverUntilMatched(header(el), 'block header under the pointer');
      await waitUntil(() => getComputedStyle(header(el)).outlineStyle === 'solid', 'forced-colors hover outline');
    } finally {
      await setForcedColors('none');
    }
  });

  it('animates running and pending glyphs and stops them under reduced motion', async () => {
    await setReducedMotion('no-preference');
    try {
      const wrapper = await fixture<HTMLElement>(html`<div>
        <lr-tool-call-block status="running"></lr-tool-call-block>
        <lr-tool-call-block status="pending"></lr-tool-call-block>
      </div>`);
      const glyphs = [...wrapper.querySelectorAll<Block>('lr-tool-call-block')].map(
        (block) => block.shadowRoot!.querySelector('[part="icon"] svg')!,
      );
      expect(glyphs.map((glyph) => getComputedStyle(glyph).animationName)).to.deep.equal([
        'lr-tool-call-block-spin',
        'lr-tool-call-block-pulse',
      ]);
      await setReducedMotion('reduce');
      expect(glyphs.map((glyph) => getComputedStyle(glyph).animationName)).to.deep.equal(['none', 'none']);
    } finally {
      await setReducedMotion('no-preference');
    }
  });

  it('routes every custom property and defaults both edges to the regular border colour', async () => {
    const el = await fixture<Block>(html`<lr-tool-call-block name="t" expanded status="success" error="e"></lr-tool-call-block>`);
    const base = part(el, 'base')!;
    const border = resolvedToken(el, '--lr-color-border');
    expect(getComputedStyle(base).borderTopColor).to.equal(border);
    expect(getComputedStyle(part(el, 'body')!).borderBlockStartColor).to.equal(border);

    el.style.setProperty('--lr-tool-call-block-background', 'rgb(1, 2, 3)');
    el.style.setProperty('--lr-tool-call-block-border-color', 'rgb(4, 5, 6)');
    el.style.setProperty('--lr-tool-call-block-radius', '7px');
    el.style.setProperty('--lr-tool-call-block-accent', 'rgb(8, 9, 10)');
    el.style.setProperty('--lr-tool-call-block-error-color', 'rgb(11, 12, 13)');
    expect(getComputedStyle(base).backgroundColor).to.equal('rgb(1, 2, 3)');
    expect(getComputedStyle(base).borderTopColor).to.equal('rgb(4, 5, 6)');
    expect(getComputedStyle(base).borderTopLeftRadius).to.equal('7px');
    expect(getComputedStyle(part(el, 'icon')!).color).to.equal('rgb(8, 9, 10)');
    expect(getComputedStyle(part(el, 'error')!).color).to.equal('rgb(11, 12, 13)');
  });

  it('renders the English fallback with no locale and lets string overrides reach the DOM', async () => {
    const el = await fixture<Block>(html`<lr-tool-call-block
      name="t"
      status="success"
      expanded
      .args=${{ a: 1 }}
      .result=${{ b: 2 }}
      error="e"
    ></lr-tool-call-block>`);
    expect([text(part(el, 'args-label')), text(part(el, 'error-label')), text(part(el, 'result-label'))]).to.deep.equal([
      'Arguments',
      'Error',
      'Result',
    ]);
    el.strings = {
      toolCallBlockHeaderSuccess: 'Utilisé {name}',
      toolCallBlockArgumentsLabel: 'Arguments FR',
      toolCallBlockErrorLabel: 'Erreur',
      toolCallBlockResultLabel: 'Résultat',
    };
    await el.updateComplete;
    expect(text(part(el, 'label'))).to.equal('Utilisé t');
    expect([text(part(el, 'args-label')), text(part(el, 'error-label')), text(part(el, 'result-label'))]).to.deep.equal([
      'Arguments FR',
      'Erreur',
      'Résultat',
    ]);
  });

  it('is accessible collapsed, expanded with every section, and with a label override', async () => {
    const el = await fixture<Block>(html`<lr-tool-call-block name="web_search" status="running" .durationMs=${820}></lr-tool-call-block>`);
    await expect(el).to.be.accessible();
    el.args = { q: 'lyra' };
    el.result = { hits: 1 };
    el.error = 'partial';
    el.expanded = true;
    await settleChildren(el);
    await expect(el).to.be.accessible();
    el.label = 'Search the web';
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});
