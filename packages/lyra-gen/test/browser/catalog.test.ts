import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { applyLyraStyleScope } from '@aceshooting/lyra-ui/theme.js';
import type { LyraAlert } from '@aceshooting/lyra-ui/components/overlays/alert/alert.class.js';
import { focusByKeyboard } from '../../../lyra-ui/test/wtr-focus.js';
import { setReducedMotion } from '../../../lyra-ui/test/wtr-media.js';
import { initialCatalog } from '../../src/catalog.js';
import { LyraGenViewElement } from '../../src/gen-view.js';
import type { LyraGenNode, LyraGenView } from '../../src/types.js';

interface UpdatingElement extends HTMLElement { readonly updateComplete: Promise<boolean> }
const text = (id: string, value: string, slot?: string): LyraGenNode => ({ id, type: 'text', text: value, ...(slot === undefined ? {} : { slot }) });
const button = (id: string, value: string, slot?: string): LyraGenNode => ({ id, type: 'button', text: value, props: { type: 'button' }, ...(slot === undefined ? {} : { slot }) });
const source = (id: string): LyraGenNode => ({ id, type: 'source-card', props: { sourceId: 'report-2026', heading: 'Quarterly operations report' }, children: [text(`${id}-excerpt`, 'Orders increased in the second quarter.', 'excerpt'), text(`${id}-full`, 'The synthetic source contains 24 orders and one missing observation.', 'full')] });
const select: LyraGenNode = { id: 'subject', type: 'select', props: { label: 'Reporting period', value: 'week' }, children: [
  { id: 'week', type: 'option', props: { value: 'week', label: 'This week' }, text: 'This week' },
  { id: 'month', type: 'option', props: { value: 'month', label: 'This month' }, text: 'This month' },
] };
const chart: LyraGenNode = { id: 'subject', type: 'chart', props: { label: 'Orders by quarter', description: 'Two synthetic series; a missing value is preserved.', type: 'bar', labels: ['Q1', 'Q2'], datasets: [{ label: 'Orders', data: [8, 16] }, { label: 'Returns', data: [2, null] }], withLegend: true, withDataTable: true } };
const table: LyraGenNode = { id: 'subject', type: 'table', props: { caption: 'Quarterly totals', columns: [{ key: 'c0', label: 'Quarter', sortable: true }, { key: 'c1', label: 'Orders', sortable: true }], rows: [{ c0: 'Q2', c1: 16 }, { c0: 'Q1', c1: 8 }] } };

// These scenarios are authored independently of catalog examples and property defaults.
const scenarios: Readonly<Record<string, LyraGenNode>> = {
  stack: { id: 'subject', type: 'stack', children: [text('intro', 'A complete synthetic report.'), button('inspect', 'Inspect report')] },
  row: { id: 'subject', type: 'row', children: [{ id: 'status', type: 'badge', text: 'Ready' }, button('inspect', 'Inspect report')] },
  text: text('subject', 'Plain content remains text: <script> is not executable.'),
  heading: { id: 'subject', type: 'heading', text: 'Quarterly operations' },
  card: { id: 'subject', type: 'card', props: { appearance: 'outlined' }, children: [{ id: 'title', type: 'heading', text: 'Orders awaiting review', slot: 'header' }, text('body', 'Three orders require an owner.'), button('inspect', 'Review orders', 'actions')] },
  badge: { id: 'subject', type: 'badge', props: { variant: 'success' }, text: 'Review complete' },
  alert: { id: 'subject', type: 'alert', props: { open: true, closable: true, variant: 'warning' }, text: 'One source is missing a value.' },
  empty: { id: 'subject', type: 'empty', props: { heading: 'No orders in this period', description: 'Choose another reporting period.' }, children: [button('inspect', 'Change period', 'actions')] },
  skeleton: { id: 'subject', type: 'skeleton', props: { label: 'Preparing the quarterly report', shape: 'rect', effect: 'sheen' } },
  stat: { id: 'subject', type: 'stat', props: { label: 'Reviewed orders', value: '24', unit: 'orders', caption: 'Two quarters combined', variant: 'brand' } },
  form: { id: 'subject', type: 'form', props: { ariaLabel: 'Report reviewer details' }, children: [{ id: 'reviewer', type: 'input', props: { label: 'Reviewer', name: 'reviewer', value: 'Avery' } }, { id: 'submit', type: 'button', text: 'Save reviewer', props: { type: 'submit' } }] },
  button: button('subject', 'Apply reporting period'),
  input: { id: 'subject', type: 'input', props: { label: 'Report name', value: 'Quarterly summary', hint: 'A short, meaningful title.' } },
  textarea: { id: 'subject', type: 'textarea', props: { label: 'Review observations', value: 'Orders increased.\nReview missing observations.', rows: 3, resize: 'auto' } },
  select,
  option: { id: 'option-parent', type: 'select', props: { label: 'Reporting period', value: 'week' }, children: [{ id: 'subject', type: 'option', props: { value: 'week', label: 'This week' }, text: 'This week' }, { id: 'month', type: 'option', props: { value: 'month', label: 'This month' }, text: 'This month' }] },
  checkbox: { id: 'subject', type: 'checkbox', props: { checked: false, hint: 'Include records from earlier periods.' }, text: 'Include archived orders' },
  switch: { id: 'subject', type: 'switch', props: { checked: true, hint: 'Notify the report owner when ready.' }, text: 'Enable report reminders' },
  slider: { id: 'subject', type: 'slider', props: { label: 'Review threshold', min: 0, max: 100, step: 5, value: 40, hint: 'Choose a percentage.' } },
  'chat-viewport': { id: 'subject', type: 'chat-viewport', props: { accessibleLabel: 'Report discussion', live: 'off' }, children: [{ id: 'question', type: 'chat-message', props: { messageRole: 'user', status: 'sent' }, text: 'How many orders were reviewed?' }, { id: 'answer', type: 'chat-message', props: { messageRole: 'assistant', status: 'sent' }, text: 'Twenty-four orders were reviewed.' }] },
  'chat-message': { id: 'subject', type: 'chat-message', props: { messageRole: 'assistant', status: 'failed', messageId: 'answer-1' }, text: 'The report could not be completed.' },
  'chat-composer': { id: 'subject', type: 'chat-composer', props: { accessibleLabel: 'Ask about the report', value: 'Explain the missing observation', status: 'idle' } },
  table,
  chart,
  citation: { id: 'subject', type: 'citation', props: { sourceId: 'report-2026', index: 2, label: 'Quarterly operations report' } },
  'source-card': { ...source('subject') },
  'source-list': { id: 'subject', type: 'source-list', props: { label: 'Report sources', expanded: true }, children: [source('source')] },
  search: { id: 'subject', type: 'search', props: { accessibleLabel: 'Search report sources', query: 'quarterly orders', placeholder: 'Search the source collection' } },
};

function query<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  expect(element !== null, `Expected ${selector}`).to.equal(true);
  if (!element) throw new Error(`Missing ${selector}`);
  return element;
}
function deepQuery<T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string): T {
  const direct = root.querySelector<T>(selector);
  if (direct) return direct;
  for (const child of root.querySelectorAll<HTMLElement>('*')) if (child.shadowRoot) {
    const result = deepFind<T>(child.shadowRoot, selector);
    if (result) return result;
  }
  throw new Error(`Missing composed ${selector}`);
}
function deepFind<T extends HTMLElement>(root: ParentNode, selector: string): T | undefined {
  const direct = root.querySelector<T>(selector);
  if (direct) return direct;
  for (const child of root.querySelectorAll<HTMLElement>('*')) if (child.shadowRoot) {
    const result = deepFind<T>(child.shadowRoot, selector);
    if (result) return result;
  }
  return undefined;
}
function activeElement(): Element | null {
  let current = document.activeElement;
  while (current?.shadowRoot?.activeElement) current = current.shadowRoot.activeElement;
  return current;
}
function isOpen(element: HTMLElement): boolean { return Reflect.get(element, 'open') === true; }
async function settled(host: LyraGenViewElement): Promise<void> {
  await host.updateComplete;
  await waitUntil(() => host.shadowRoot?.querySelector('[part="loading"]') === null, 'Catalog modules loaded', { timeout: 5000 });
  await host.updateComplete;
  for (const child of host.shadowRoot?.querySelectorAll<UpdatingElement>('*') ?? []) if ('updateComplete' in child) await child.updateComplete;
}
async function mount(root: LyraGenNode): Promise<{ host: LyraGenViewElement; subject: UpdatingElement }> {
  const document: LyraGenView = { version: '1', catalog: { id: initialCatalog.id, version: initialCatalog.version }, surfaceId: 'catalog-qualification', revision: 0, root };
  const host = await fixture<LyraGenViewElement>(html`<lr-gen-view .document=${document}></lr-gen-view>`);
  await settled(host);
  expect(host.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  return { host, subject: query<UpdatingElement>(host.shadowRoot!, '[data-gen-id="subject"]') };
}
async function keyboard(target: HTMLElement, key: string): Promise<void> {
  await focusByKeyboard(target);
  expect(activeElement() === target).to.equal(true);
  await sendKeys({ press: key });
}

describe('reviewed catalog rendered qualification', () => {
  it('waits for a generated alert show lifecycle before measuring final contrast', async () => {
    await setReducedMotion('no-preference');
    const closed: LyraGenNode = { ...scenarios['alert']!, props: { ...scenarios['alert']!.props, open: false } };
    const { host, subject } = await mount(closed);
    const alert = subject as LyraAlert;
    alert.style.setProperty('--lr-duration-fast', '1s');
    const shown = oneEvent(alert, 'lr-after-show');
    host.document = { ...host.document!, revision: 1, root: scenarios['alert']! };
    await settled(host);
    const base = query(alert.shadowRoot!, '[part="base"]');
    await waitUntil(() => base.getAnimations().length > 0, 'Generated open starts the alert fade');
    const animations = base.getAnimations();
    try {
      for (const animation of animations) {
        animation.pause();
        const duration = animation.effect!.getComputedTiming().duration;
        expect(typeof duration).to.equal('number');
        animation.currentTime = Number(duration) / 2;
      }
      const opacity = Number(getComputedStyle(base).opacity);
      expect(opacity).to.be.greaterThan(0);
      expect(opacity).to.be.lessThan(1);
      let complete = false;
      const ready = alert.show().then(() => { complete = true; });
      await Promise.resolve();
      expect(complete).to.equal(false);
      for (const animation of animations) animation.finish();
      await ready;
      await shown;
      expect(getComputedStyle(base).opacity).to.equal('1');
      await expect(host).to.be.accessible();
    } finally {
      for (const animation of animations) animation.finish();
    }
  });

  it('keeps an explicit populated scenario for every reviewed catalog role', () => {
    expect(Object.keys(scenarios).sort()).to.deep.equal(Object.keys(initialCatalog.components).sort());
  });

  for (const [role, root] of Object.entries(scenarios)) {
    it(`renders populated ${role} content, accessible semantics, and its keyboard contract`, async () => {
      const { host, subject } = await mount(root);
      expect(subject.localName).to.equal(initialCatalog.components[role]!.tag);
      if (role === 'text') {
        expect(subject.textContent).to.equal('Plain content remains text: <script> is not executable.');
        expect(subject.querySelectorAll('script').length).to.equal(0);
      } else if (role === 'heading') {
        expect(subject.textContent).to.equal('Quarterly operations');
      } else if (['stack', 'row', 'card', 'empty'].includes(role)) {
        const child = query(subject, 'lr-button');
        const click = oneEvent(child, 'click');
        await keyboard(query(child.shadowRoot!, 'button'), 'Enter');
        await click;
      } else if (role === 'badge') {
        expect(subject.textContent).to.equal('Review complete');
      } else if (role === 'stat') {
        expect(query(subject.shadowRoot!, '[part="label"]').textContent).to.equal('Reviewed orders');
        expect(query(subject.shadowRoot!, '[part="value"]').textContent).to.contain('24');
      } else if (role === 'skeleton') {
        expect(Reflect.get(subject, 'label')).to.equal('Preparing the quarterly report');
        expect(getComputedStyle(query(subject.shadowRoot!, '[part~="indicator"]')).animationName).to.equal('lr-skeleton-sheen');
      } else if (role === 'alert') {
        expect(isOpen(subject)).to.equal(true);
        expect(subject.textContent).to.contain('One source is missing a value.');
        // Generated property assignment can open an already-updated alert and start its fade.
        await (subject as LyraAlert).show();
        expect(getComputedStyle(query(subject.shadowRoot!, '[part="base"]')).opacity).to.equal('1');
        await expect(host).to.be.accessible();
        await keyboard(query(subject.shadowRoot!, '[part~="close-button"]'), 'Enter');
        await waitUntil(() => !isOpen(subject));
      } else if (role === 'form') {
        expect(subject.getAttribute('aria-label')).to.equal('Report reviewer details');
        const submit = oneEvent(subject, 'submit');
        await keyboard(deepQuery(subject, 'input'), 'Enter');
        await submit;
      } else if (role === 'button') {
        const click = oneEvent(subject, 'click');
        await keyboard(query(subject.shadowRoot!, 'button'), 'Enter');
        await click;
      } else if (role === 'input' || role === 'textarea') {
        const native = query<HTMLInputElement | HTMLTextAreaElement>(subject.shadowRoot!, role === 'input' ? 'input' : 'textarea');
        expect(Array.from(native.labels ?? []).some(label => label.textContent?.includes(role === 'input' ? 'Report name' : 'Review observations'))).to.equal(true);
        await focusByKeyboard(native);
        await sendKeys({ press: 'End' });
        await sendKeys({ type: ' verified' });
        expect(native.value).to.contain(' verified');
      } else if (role === 'select' || role === 'option') {
        const owner = role === 'select' ? subject : query<UpdatingElement>(host.shadowRoot!, 'lr-select');
        const trigger = query(owner.shadowRoot!, '[part="trigger"]');
        const shown = oneEvent(owner, 'lr-after-show');
        await keyboard(trigger, 'ArrowDown');
        await shown;
        await waitUntil(() => owner.shadowRoot!.querySelector('[role="listbox"]')?.getAttribute('aria-hidden') !== 'true' && isOpen(owner));
        expect(owner.shadowRoot!.querySelectorAll('[role="option"]').length).to.equal(2);
        expect(owner.shadowRoot!.textContent).to.contain('This month');
        await expect(host).to.be.accessible();
        const hidden = oneEvent(owner, 'lr-after-hide');
        await sendKeys({ press: 'Escape' });
        await hidden;
        await waitUntil(() => !isOpen(owner));
        expect(activeElement() === trigger).to.equal(true);
      } else if (role === 'checkbox' || role === 'switch') {
        const control = query(subject.shadowRoot!, `[role="${role}"]`);
        const initial = control.getAttribute('aria-checked');
        expect(initial).to.equal(role === 'checkbox' ? 'false' : 'true');
        await keyboard(control, 'Space');
        await subject.updateComplete;
        expect(control.getAttribute('aria-checked')).to.equal(initial === 'true' ? 'false' : 'true');
      } else if (role === 'slider') {
        const thumb = query(subject.shadowRoot!, '[role="slider"]');
        expect(thumb.getAttribute('aria-valuenow')).to.equal('40');
        await keyboard(thumb, 'ArrowRight');
        await subject.updateComplete;
        expect(thumb.getAttribute('aria-valuenow')).to.equal('45');
      } else if (role === 'chat-viewport') {
        const log = query(subject.shadowRoot!, '[role="log"]');
        expect(log.getAttribute('aria-label')).to.equal('Report discussion');
        expect(log.getAttribute('aria-live')).to.equal('off');
        expect(subject.querySelectorAll('lr-chat-message').length).to.equal(2);
        await focusByKeyboard(log);
        expect(activeElement() === log).to.equal(true);
      } else if (role === 'chat-message') {
        expect(query(subject.shadowRoot!, '[role="article"]').textContent).to.contain('Retry');
        const retry = oneEvent(subject, 'lr-message-retry');
        await keyboard(query(subject.shadowRoot!, '[part="retry-button"]'), 'Enter');
        await retry;
      } else if (role === 'chat-composer') {
        const native = query<HTMLTextAreaElement>(subject.shadowRoot!, 'textarea');
        expect(native.getAttribute('aria-label')).to.equal('Ask about the report');
        const submit = oneEvent(subject, 'lr-submit');
        await keyboard(native, 'Enter');
        expect((await submit as CustomEvent<{ value: string }>).detail.value).to.equal('Explain the missing observation');
      } else if (role === 'table') {
        expect(Array.from(subject.shadowRoot!.querySelectorAll('tbody [part="cell"]'), cell => cell.textContent?.trim())).to.deep.equal(['Q2', '16', 'Q1', '8']);
        const header = query(subject.shadowRoot!, '[part="header-cell"]');
        await keyboard(header, 'ArrowRight');
        expect(activeElement()?.textContent).to.contain('Orders');
      } else if (role === 'chart') {
        expect(query(subject.shadowRoot!, 'svg').getAttribute('aria-label')).to.equal('Orders by quarter');
        expect(subject.shadowRoot!.querySelectorAll('[part="bar"]').length).to.equal(3);
        expect(subject.shadowRoot!.querySelectorAll('[part="data-table"] tbody tr').length).to.equal(2);
        const mark = query<SVGElement>(subject.shadowRoot!, '[part="bar"]');
        const before = document.createElement('button');
        before.textContent = 'Enter chart';
        host.before(before);
        try {
          await focusByKeyboard(before);
          await sendKeys({ press: 'Tab' });
          expect(activeElement() === mark).to.equal(true);
          await sendKeys({ press: 'ArrowRight' });
          expect(activeElement() === mark).to.equal(false);
          expect(subject.shadowRoot!.querySelectorAll('[part="bar"][tabindex="0"]').length).to.equal(1);
        } finally { before.remove(); }
      } else if (role === 'citation') {
        const control = query(subject.shadowRoot!, 'button');
        expect(control.getAttribute('aria-label')).to.contain('Quarterly operations report');
        const activate = oneEvent(subject, 'lr-citation-activate');
        await keyboard(control, 'Enter');
        expect((await activate as CustomEvent<{ sourceId: string }>).detail.sourceId).to.equal('report-2026');
      } else if (role === 'source-card') {
        const title = query(subject.shadowRoot!, '[part="title"]');
        expect(title.textContent).to.contain('Quarterly operations report');
        const open = oneEvent(subject, 'lr-open');
        await keyboard(title, 'Enter');
        expect((await open as CustomEvent<{ sourceId: string }>).detail.sourceId).to.equal('report-2026');
        const toggle = query(subject.shadowRoot!, '[part="toggle"]');
        await keyboard(toggle, 'Enter');
        await subject.updateComplete;
        expect(toggle.getAttribute('aria-expanded')).to.equal('true');
        expect(query<HTMLElement>(subject.shadowRoot!, '[part="full"]').hidden).to.equal(false);
      } else if (role === 'source-list') {
        const header = query(subject.shadowRoot!, '[part="header"]');
        expect(header.getAttribute('aria-label')).to.equal('Report sources');
        expect(header.getAttribute('aria-expanded')).to.equal('true');
        await expect(host).to.be.accessible();
        await keyboard(header, 'Enter');
        await subject.updateComplete;
        expect(header.getAttribute('aria-expanded')).to.equal('false');
        await keyboard(header, 'Enter');
        await subject.updateComplete;
      } else if (role === 'search') {
        const native = deepQuery<HTMLInputElement>(subject.shadowRoot!, 'input');
        const search = oneEvent(subject, 'lr-search');
        await keyboard(native, 'Enter');
        expect((await search as CustomEvent<{ text: string }>).detail.text).to.equal('quarterly orders');
      }
      await expect(host).to.be.accessible();
    });
  }
});

describe('generated view style composition', () => {
  let previousSheets: CSSStyleSheet[] = [];
  before(async () => {
    previousSheets = [...document.adoptedStyleSheets];
    const sheets = await Promise.all(['theme.css', 'density.css', 'looks/material.css', 'looks/data.css', 'looks/terminal.css', 'looks/high-contrast.css'].map(async path => {
      const response = await fetch(new URL(`../../../lyra-ui/src/${path}`, import.meta.url));
      if (!response.ok) throw new Error(`Missing theme fixture ${path}`);
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(await response.text());
      return sheet;
    }));
    document.adoptedStyleSheets = [...previousSheets, ...sheets];
  });
  after(() => { document.adoptedStyleSheets = previousSheets; });

  for (const look of ['lyra', 'shadcn', 'material', 'data', 'terminal', 'high-contrast'] as const) {
    it(`composes ${look} with light/dark, RTL, all densities, and chart token overrides`, async () => {
      const { host } = await mount({ id: 'styled', type: 'stack', children: [{ ...scenarios['input']!, id: 'subject' }, { ...chart, id: 'styled-chart' }, { ...table, id: 'styled-table' }] });
      const scope = host.parentElement!;
      scope.style.inlineSize = '320px';
      scope.style.backgroundColor = 'var(--lr-color-surface)';
      scope.style.color = 'var(--lr-color-text)';
      scope.dir = 'rtl';
      const chartHost = query<UpdatingElement>(host.shadowRoot!, 'lr-lite-chart');
      const input = query<UpdatingElement>(host.shadowRoot!, 'lr-input');
      chartHost.style.setProperty('--lr-chart-tick-color', 'rgb(127, 45, 180)');
      const heights: number[] = [];
      for (const density of ['compact', 'comfortable', 'touch'] as const) {
        applyLyraStyleScope(scope, { look, density, mode: 'light', surface: 'solid', accent: null });
        await settled(host);
        const control = query<HTMLElement>(input.shadowRoot!, '[part~="input-wrapper"]');
        heights.push(control.getBoundingClientRect().height);
        await expect(host).to.be.accessible();
      }
      expect(heights[2]!).to.be.at.least(44);
      expect(heights[0]!).to.be.lessThan(heights[2]!);
      const light = getComputedStyle(input).getPropertyValue('--lr-color-surface').trim();
      applyLyraStyleScope(scope, { look, density: 'touch', mode: 'dark', surface: 'solid', accent: null });
      await settled(host);
      expect(getComputedStyle(input).getPropertyValue('--lr-color-surface').trim()).to.not.equal(light);
      expect(getComputedStyle(chartHost).direction).to.equal('rtl');
      expect(host.getBoundingClientRect().width).to.be.at.most(321);
      const tick = query<SVGElement>(chartHost.shadowRoot!, '[part="axis-label"]');
      expect(getComputedStyle(tick).fill).to.equal('rgb(127, 45, 180)');
      await expect(host).to.be.accessible();
    });
  }

  it('stops generated ambient motion under reduced motion while retaining populated chart content', async () => {
    await setReducedMotion('no-preference');
    try {
      const { host } = await mount({ id: 'motion', type: 'stack', children: [scenarios['skeleton']!, { ...chart, id: 'motion-chart' }] });
      const indicator = query(query(host.shadowRoot!, 'lr-skeleton').shadowRoot!, '[part~="indicator"]');
      expect(getComputedStyle(indicator).animationName).to.equal('lr-skeleton-sheen');
      await setReducedMotion('reduce');
      await waitUntil(() => getComputedStyle(indicator).animationName === 'none');
      expect(query(host.shadowRoot!, 'lr-lite-chart').shadowRoot!.querySelectorAll('[part="bar"]').length).to.equal(3);
      await expect(host).to.be.accessible();
    } finally { await setReducedMotion('no-preference'); }
  });
});
