import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../test/wtr-focus.js';
import { srOnly } from './a11y.js';
import { acquireAnnouncementSink } from './announcer.js';
import '../components/utility/live-region/live-region.js';
import '../components/utility/visually-hidden/visually-hidden.js';
import '../components/utility/json-viewer/json-viewer.js';
import '../components/agent-tools/terminal/terminal.js';
import '../components/data/flow-run-status/flow-run-status.js';
import '../components/data/context-meter/context-meter.js';
import '../components/retrieval/ingestion-queue/ingestion-queue.js';
import '../components/retrieval/node-palette/node-palette.js';
import '../components/retrieval/graph-legend/graph-legend.js';
import '../components/retrieval/graph/graph.js';
import '../components/media/file-input/file-input.js';
import '../components/conversation/typing-indicator/typing-indicator.js';
import '../components/utility/copy-button/copy-button.js';
import '../components/forms/textarea/textarea.js';
import '../components/data/pagination/pagination.js';

const owners = [
  'lr-live-region', 'lr-visually-hidden', 'lr-json-viewer', 'lr-terminal',
  'lr-flow-run-status', 'lr-context-meter', 'lr-ingestion-queue',
  'lr-node-palette', 'lr-graph-legend', 'lr-file-input', 'lr-typing-indicator',
  'lr-copy-button', 'lr-textarea', 'lr-pagination',
] as const;

let documentDirection: string | null;
beforeEach(() => { documentDirection = document.documentElement.getAttribute('dir'); });
afterEach(() => {
  if (documentDirection === null) document.documentElement.removeAttribute('dir');
  else document.documentElement.setAttribute('dir', documentDirection);
});

const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));
const extent = (): number[] => [document.documentElement.scrollWidth, document.documentElement.scrollHeight];

async function scrollport(direction: 'ltr' | 'rtl'): Promise<HTMLDivElement> {
  document.documentElement.dir = direction === 'rtl' ? 'ltr' : 'rtl';
  return fixture<HTMLDivElement>(html`<div dir=${direction} style="inline-size:320px;block-size:100px;overflow:auto">
    <div style="inline-size:1600px;block-size:1200px"></div>
  </div>`);
}

for (const direction of ['ltr', 'rtl'] as const) {
  for (const name of owners) {
    it(`${name} hidden content stays within the document extent beyond a ${direction} scrollport`, async () => {
      const port = await scrollport(direction);
      const before = extent();
      const element = document.createElement(name);
      element.textContent = name === 'lr-visually-hidden' ? 'Additional description' : '';
      if (name === 'lr-textarea') element.setAttribute('with-count', '');
      port.append(element);
      await element.updateComplete;
      await frame();
      expect(extent()).to.deep.equal(before);
      expect(port.scrollHeight).to.be.at.least(1200);
      expect(port.scrollWidth).to.be.at.least(1600);
    });
  }

  it(`shared hidden text does not escape nested ${direction} scrollports`, async () => {
    const outer = await scrollport(direction);
    const before = extent();
    const inner = document.createElement('div');
    inner.style.cssText = 'inline-size:200px;block-size:80px;overflow:auto';
    inner.innerHTML = '<div style="inline-size:1400px;block-size:1500px"></div>';
    const host = document.createElement('div');
    host.style.setProperty('--lr-size-1px', '1px');
    host.attachShadow({ mode: 'open' }).innerHTML = `<style>${srOnly.cssText}</style><span class="sr-only">Description</span>`;
    inner.append(host);
    outer.append(inner);
    await frame();
    expect(extent()).to.deep.equal(before);
    expect(inner.scrollHeight).to.equal(1500);
    expect(inner.scrollWidth).to.equal(1400);
  });

  it(`a ${direction} hidden skip link reveals in its own scrollport and hides again after Tab`, async () => {
    const port = await scrollport(direction);
    const before = extent();
    const hidden = document.createElement('lr-visually-hidden');
    hidden.innerHTML = '<a href="#content">Skip to content</a>';
    const after = document.createElement('button');
    after.textContent = 'Following action';
    port.append(hidden, after);
    await hidden.updateComplete;
    const link = hidden.querySelector<HTMLAnchorElement>('a')!;
    await focusByKeyboard(link);
    expect(document.activeElement === link).to.equal(true);
    expect(getComputedStyle(hidden).position).to.equal('static');
    expect(hidden.getBoundingClientRect().height).to.be.greaterThan(1);
    await waitUntil(() => port.scrollTop > 1000, 'focused content scrolls into its own viewport');
    expect(extent()).to.deep.equal(before);
    await sendKeys({ press: 'Tab' });
    expect(document.activeElement === after).to.equal(true);
    expect(hidden.getBoundingClientRect().height).to.be.at.most(1);
    expect(extent()).to.deep.equal(before);
  });

  it(`a ${direction} file input keeps keyboard focus on its visible control`, async () => {
    const port = await scrollport(direction);
    const before = extent();
    const input = document.createElement('lr-file-input');
    input.label = 'Upload files';
    port.append(input);
    await input.updateComplete;
    await focusByKeyboard(input);
    expect(input.shadowRoot!.activeElement?.getAttribute('part')?.split(' ').includes('file-input')).to.equal(true);
    expect(input.shadowRoot!.querySelector('[part="input"]')?.getAttribute('tabindex')).to.equal('-1');
    await waitUntil(() => port.scrollTop > 1000, 'focused content scrolls into its own viewport');
    expect(extent()).to.deep.equal(before);
  });

  it(`the ${direction} canvas graph cursor scrolls its own viewport without growing the document`, async () => {
    const port = await scrollport(direction);
    const before = extent();
    const graph = document.createElement('lr-graph');
    graph.renderer = 'canvas';
    graph.layout = 'layered';
    graph.width = 320;
    graph.height = 240;
    graph.nodes = [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }];
    graph.edges = [{ id: 'ab', source: 'a', target: 'b' }];
    port.append(graph);
    await waitUntil(() => !!graph.shadowRoot?.querySelector('[part="cursor-item"]'), 'canvas cursor is ready', { timeout: 10000 });
    const cursor = graph.shadowRoot!.querySelector<HTMLButtonElement>('[part="cursor-item"]')!;
    await focusByKeyboard(cursor);
    expect(graph.shadowRoot!.activeElement === cursor).to.equal(true);
    await waitUntil(() => port.scrollTop > 1000, 'focused content scrolls into its own viewport');
    const documentScroll = [window.scrollX, window.scrollY];
    await sendKeys({ press: direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight' });
    await graph.updateComplete;
    expect(cursor.getAttribute('aria-label')).to.equal('Beta');
    expect(graph.shadowRoot!.activeElement === cursor).to.equal(true);
    expect([window.scrollX, window.scrollY]).to.deep.equal(documentScroll);
    expect(extent()).to.deep.equal(before);
  });
}

it('anchors the light-DOM announcement sink without changing repeated additions or accessibility', async () => {
  const source = await fixture<HTMLDivElement>(html`<div style="block-size:1200px">Announcement source</div>`);
  const before = extent();
  const sink = acquireAnnouncementSink('polite', { document, source });
  try {
    expect(sink.element.getBoundingClientRect().top).to.be.at.most(0);
    sink.announce('Repeated message');
    sink.announce('Repeated message');
    await waitUntil(() => sink.element.children.length === 2, 'both additions reached the sink');
    expect(sink.element.getAttribute('aria-live')).to.equal('polite');
    expect(sink.element.getAttribute('aria-relevant')).to.equal('additions');
    expect(sink.element.getAttribute('aria-atomic')).to.equal('false');
    expect(getComputedStyle(sink.element).visibility).to.equal('visible');
    expect(getComputedStyle(sink.element).display).not.to.equal('none');
    expect(extent()).to.deep.equal(before);
  } finally {
    sink.release();
  }
});

it('public hidden utilities avoid escaped extent and preserve native focusable reveal', async () => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../styles/utilities.css', import.meta.url).href;
  const loaded = new Promise<void>((resolve, reject) => { link.onload = () => resolve(); link.onerror = () => reject(new Error('utilities stylesheet failed')); });
  document.head.append(link);
  try {
    await loaded;
    const port = await scrollport('rtl');
    const before = extent();
    const hidden = document.createElement('span');
    hidden.className = 'lr-visually-hidden';
    hidden.textContent = 'Additional description';
    const skip = document.createElement('a');
    skip.className = 'lr-visually-hidden-focusable';
    skip.href = '#content';
    skip.textContent = 'Skip to content';
    const after = document.createElement('button');
    after.textContent = 'Following action';
    port.append(hidden, skip, after);
    expect(getComputedStyle(skip).clipPath).to.equal('inset(50%)');
    expect(extent()).to.deep.equal(before);
    await focusByKeyboard(skip);
    expect(getComputedStyle(skip).position).to.equal('static');
    expect(getComputedStyle(skip).clipPath).to.equal('none');
    expect(skip.getBoundingClientRect().width).to.be.greaterThan(1);
    await waitUntil(() => port.scrollTop > 1000, 'focused content scrolls into its own viewport');
    expect(extent()).to.deep.equal(before);
    await sendKeys({ press: 'Tab' });
    expect(document.activeElement === after).to.equal(true);
    expect(getComputedStyle(skip).clipPath).to.equal('inset(50%)');
    expect(skip.getBoundingClientRect().height).to.be.at.most(1);
    expect(extent()).to.deep.equal(before);
  } finally {
    link.remove();
  }
});
