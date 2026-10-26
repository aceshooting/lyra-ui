import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import '@aceshooting/lyra-translations/fr.js';
import '@aceshooting/lyra-translations/ar.js';
import type { LyraButton } from '@aceshooting/lyra-ui/components/lr-button.js';
import type { LyraInput } from '@aceshooting/lyra-ui/components/lr-input.js';
import type { LyraSelect } from '@aceshooting/lyra-ui/components/lr-select.js';
import type { LyraTable } from '@aceshooting/lyra-ui/components/lr-table.js';
import type { LyraLiteChart } from '@aceshooting/lyra-ui/components/lr-lite-chart.js';
import type { LyraGenViewElement } from '@aceshooting/lyra-gen/gen-view.js';
import { focusByKeyboard } from '../../../lyra-ui/test/wtr-focus.js';
import { setReducedMotion } from '../../../lyra-ui/test/wtr-media.js';
import { twoFrames } from '../../../lyra-ui/test/frames.js';
import { mountGuidedDemo } from '../../examples/guided-demo-host.js';
import { guidedDemoLocales, guidedDemoScenarios, type GuidedDemoLocale } from '../../examples/guided-demo.js';

const apps: ReturnType<typeof mountGuidedDemo>[] = [];
afterEach(async () => { for (const app of apps.splice(0)) app.dispose(); await setReducedMotion('no-preference'); });
function query<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error(`Missing guided demo element ${selector}`);
  return found;
}
async function mount(locale: GuidedDemoLocale = 'en', width = 960) {
  const root = await fixture<HTMLElement>(html`<div style=${`inline-size:${width}px;max-inline-size:100%`}></div>`);
  const app = mountGuidedDemo(root, { locale, packageVersion: '1.0.0' });
  apps.push(app); await app.ready;
  return { root, app };
}
function button(root: ParentNode, action: string): HTMLButtonElement {
  return query<HTMLButtonElement>(query<LyraButton>(root, `lr-button[data-action="${action}"]`).shadowRoot!, 'button');
}
async function activate(element: HTMLElement) { await focusByKeyboard(element); await sendKeys({ press: 'Enter' }); }
function input(root: ParentNode, name: string): HTMLInputElement {
  return query<HTMLInputElement>(query<LyraInput>(root, `lr-input[name="${name}"]`).shadowRoot!, 'input');
}
function activeElement(): Element | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}
function tableRows(table: LyraTable): { readonly c0: string; readonly c1: number }[] {
  return table.rows.map(row => {
    if (row === null || typeof row !== 'object' || !('c0' in row) || typeof row.c0 !== 'string'
      || !('c1' in row) || typeof row.c1 !== 'number' || !Number.isFinite(row.c1)) throw new Error('Expected labelled numeric demo table rows');
    return { c0: row.c0, c1: row.c1 };
  });
}
async function replace(input: HTMLInputElement, value: string) {
  await focusByKeyboard(input); await sendKeys({ press: 'Control+A' }); await sendKeys({ type: value });
}
async function loaded(app: ReturnType<typeof mountGuidedDemo>) {
  await waitUntil(() => app.controller.snapshot.phase === 'complete', 'Replay completed', { timeout: 10000 });
  await app.transcript.updateComplete;
  await waitUntil(() => {
    const views = [...app.transcript.shadowRoot!.querySelectorAll<LyraGenViewElement>('lr-gen-view')];
    return views.length === 2 && views.every(view => view.status === 'ready');
  }, 'Both current islands are rendered', { timeout: 10000 });
  const view = query<LyraGenViewElement>(app.transcript.shadowRoot!, 'lr-gen-view[data-dashboard]');
  const table = query<LyraTable>(view.shadowRoot!, 'lr-table');
  const chart = query<LyraLiteChart>(view.shadowRoot!, 'lr-lite-chart');
  await Promise.all([table.updateComplete, chart.updateComplete]); await twoFrames();
  return { view, table, chart };
}

for (const locale of guidedDemoLocales) for (const scenario of guidedDemoScenarios) {
  it(`renders the populated ${locale}/${scenario} demo at narrow and desktop allocation with localized provenance and axe`, async function () {
    this.timeout(15000);
    const { root, app } = await mount(locale, 320);
    app.controller.selectScenario(scenario);
    await activate(button(root, 'next'));
    const { view, table, chart } = await loaded(app);
    const snapshot = app.controller.snapshot;
    expect(app.element.lang).to.equal(locale);
    expect(app.element.dir).to.equal(locale === 'ar' ? 'rtl' : 'ltr');
    expect(getComputedStyle(chart).direction).to.equal(locale === 'ar' ? 'rtl' : 'ltr');
    expect(query(root, '[data-simulation]').textContent).to.equal(snapshot.labels.simulatedData);
    expect(query(root, '[data-scripted]').textContent).to.equal(snapshot.labels.authoredReply);
    expect(query(root, '[role="status"]').textContent).to.equal(snapshot.labels.complete);
    expect(root.querySelectorAll('[aria-current="step"]').length).to.equal(1);
    expect(table.rows.length).to.equal(scenario === 'travel-budget' ? 6 : 3);
    expect(chart.datasets.length).to.equal(scenario === 'markets' ? 3 : 1);
    expect(table.shadowRoot!.querySelectorAll('tbody tr').length).to.equal(table.rows.length);
    expect(view.shadowRoot!.querySelector('[data-gen-id="comparison"]') !== null).to.equal(true);
    expect(app.element.scrollWidth <= app.element.clientWidth + 1, 'Narrow allocation contains the demo').to.equal(true);
    await expect(app.element).to.be.accessible();
    root.style.inlineSize = '960px'; await twoFrames();
    expect(app.element.scrollWidth <= app.element.clientWidth + 1, 'Desktop allocation contains the demo').to.equal(true);
  });
}

it('uses trusted keyboard scenario selection and follow-up submission to change real table and chart content', async function () {
  this.timeout(15000);
  const { root, app } = await mount();
  const select = query<LyraSelect>(root, 'lr-select');
  await focusByKeyboard(query<HTMLButtonElement>(select.shadowRoot!, '[role="combobox"]'));
  await sendKeys({ press: 'Enter' });
  await waitUntil(() => select.open);
  await expect(app.element).to.be.accessible();
  await sendKeys({ press: 'ArrowDown' }); await sendKeys({ press: 'Enter' });
  await waitUntil(() => app.controller.snapshot.scenario === 'weather');
  expect(select.value).to.equal('weather');
  await activate(button(root, 'next'));
  let rendered = await loaded(app);
  expect(activeElement() === button(root, 'next')).to.equal(true);
  expect(tableRows(rendered.table).map(row => row.c0)).to.deep.equal(['Lyon', 'Lisbon', 'Oslo']);
  const question = input(root, 'question');
  await replace(question, 'An unsupported question'); await sendKeys({ press: 'Enter' });
  await waitUntil(() => app.controller.snapshot.phase === 'unsupported');
  expect(query(root, '[role="status"]').textContent).to.equal(app.controller.snapshot.labels.unsupported);
  expect(rendered.table.rows.length).to.equal(3);
  await replace(question, app.controller.snapshot.followUp.question); await sendKeys({ press: 'Enter' });
  rendered = await loaded(app);
  expect(app.controller.snapshot.step).to.equal(2);
  expect(tableRows(rendered.table).map(row => row.c0)).to.deep.equal(['Lyon', 'Lisbon']);
  expect(rendered.chart.labels).to.deep.equal(['Lyon', 'Lisbon']);
  expect(rendered.chart.datasets[0]?.data).to.deep.equal([18, 23]);
  expect(rendered.table.shadowRoot!.textContent).to.contain('Lisbon');
  expect(rendered.table.shadowRoot!.textContent).not.to.contain('Oslo');
  await activate(button(root, 'back')); await loaded(app);
  expect(app.controller.snapshot.step).to.equal(1);
  await activate(button(root, 'back'));
  await waitUntil(() => app.controller.snapshot.step === 0);
  expect(app.transcript.parts.length).to.equal(0);
});

it('submits form-associated travel edits, updates visible totals and replays without compounding', async function () {
  this.timeout(20000);
  const { root, app } = await mount('fr', 320);
  app.controller.selectScenario('travel-budget');
  await activate(button(root, 'next')); await loaded(app);
  await activate(button(root, 'follow-up')); await loaded(app);
  expect(app.controller.snapshot.travel.inputs.nights).to.equal(5);
  await replace(input(root, 'nights'), '2');
  await replace(input(root, 'travelers'), '3');
  await replace(input(root, 'budget'), '500.25');
  const form = query<HTMLFormElement>(root, 'form[data-travel]');
  expect(new FormData(form).get('budget')).to.equal('500.25');
  await activate(button(root, 'apply'));
  let rendered = await loaded(app);
  expect(tableRows(rendered.table).map(row => row.c1)).to.deep.equal([190, 252, 72, 135, 649, -148.75]);
  expect(rendered.table.shadowRoot!.textContent).to.contain('649');
  expect(rendered.table.shadowRoot!.textContent).to.contain('-148.75');
  expect(rendered.chart.datasets[0]?.data).to.deep.equal([190, 252, 72, 135]);
  const source = app.controller.snapshot.source;
  await activate(button(root, 'replay')); rendered = await loaded(app);
  expect(app.controller.snapshot.source).to.equal(source);
  expect(app.controller.snapshot.travel.inputs.nights).to.equal(2);
  expect(tableRows(rendered.table).at(-1)?.c1).to.equal(-148.75);
  await expect(app.element).to.be.accessible();
});

it('cancels replay, preserves a completed shell, and ignores stale renders after switching scenario', async function () {
  this.timeout(15000);
  const { root, app } = await mount();
  const pending = app.controller.next();
  await waitUntil(() => app.controller.snapshot.deliveredChunks >= 3 && app.controller.snapshot.phase === 'playing');
  await app.transcript.updateComplete;
  const summary = query<LyraGenViewElement>(app.transcript.shadowRoot!, 'lr-gen-view');
  await activate(button(root, 'cancel'));
  await pending;
  expect(app.controller.snapshot.phase).to.equal('cancelled');
  expect(query<LyraGenViewElement>(app.transcript.shadowRoot!, 'lr-gen-view') === summary).to.equal(true);
  expect(query(root, '[role="status"]').textContent).to.equal(app.controller.snapshot.labels.cancelled);
  expect(activeElement() === button(root, 'replay')).to.equal(true);
  const obsolete = app.controller.replay();
  app.controller.selectScenario('weather');
  await obsolete; await app.transcript.updateComplete; await twoFrames();
  expect(app.controller.snapshot.scenario).to.equal('weather');
  expect(app.transcript.shadowRoot!.querySelectorAll('lr-gen-view').length).to.equal(0);
  await activate(button(root, 'next'));
  const rendered = await loaded(app);
  expect(tableRows(rendered.table).map(row => row.c0)).to.deep.equal(['Lyon', 'Lisbon', 'Oslo']);
});

it('opens source by keyboard, retains valid rendered islands after rejection, and recovers under reduced motion', async function () {
  this.timeout(15000);
  await setReducedMotion('reduce');
  const { root, app } = await mount('ar', 320);
  await activate(button(root, 'next'));
  const rendered = await loaded(app);
  const summary = query<HTMLElement>(root, 'details summary');
  await activate(summary);
  expect(query<HTMLDetailsElement>(root, 'details').open).to.equal(true);
  expect(query(root, '[data-source-text]').textContent).to.equal(app.controller.snapshot.source);
  await activate(button(root, 'failure'));
  await app.transcript.updateComplete;
  expect(app.controller.snapshot.phase).to.equal('error');
  expect(activeElement() === button(root, 'replay')).to.equal(true);
  expect(query<LyraGenViewElement>(app.transcript.shadowRoot!, 'lr-gen-view[data-dashboard]') === rendered.view).to.equal(true);
  expect(rendered.table.rows.length).to.equal(3);
  expect(app.transcript.shadowRoot!.textContent).to.contain(app.controller.snapshot.labels.invalid);
  expect(query(root, '[data-source-text]').textContent).to.contain('unknown-role');
  await expect(app.element).to.be.accessible();
  await activate(button(root, 'replay')); await loaded(app);
  expect(app.controller.snapshot.chat.diagnostics.length).to.equal(0);
  expect(query(root, '[data-source-text]').textContent).not.to.contain('unknown-role');
});
