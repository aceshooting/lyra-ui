import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraHierarchyRow } from '../../../data-sources.js';
import type { LyraTraceTree, TraceTreeSource } from './trace-tree.class.js';
import type { LyraSpan } from './span.js';
import './trace-tree.js';

const span: LyraSpan = { id: 'work', name: 'Generate answer', detail: 'User-visible explanation', kind: 'tool', status: 'success', startMs: 100, endMs: 125 };
function provider(values: readonly LyraSpan[], revision = 1) {
  let calls = 0;
  const rows: LyraHierarchyRow<LyraSpan>[] = values.map((value, index) => ({ key: value.id, value,
    parentKey: null, level: 1, position: index + 1, setSize: values.length, childCount: 0, expanded: false, selected: false }));
  const source: TraceTreeSource = { revision, async project() {
    calls++;
    return { state: `display-${revision}`, total: rows.length, summary: { startMs: 100, endMs: 200 },
      rows: { count: rows.length, keyAt: index => rows[index]!.key, itemAt: index => rows[index]!,
        indexOfKey: (key: string | number) => rows.findIndex(row => row.key === key) } };
  } };
  return { source, calls: () => calls };
}
const row = (element: LyraTraceTree, key = 'work') => element.shadowRoot!.querySelector<HTMLElement>(`[data-source-key="${key}"]`)!;
async function ready(element: LyraTraceTree, key = 'work'): Promise<void> {
  await waitUntil(() => row(element, key) !== null, 'the accepted source span is visible');
}
const text = (element: Element, part: string) => element.querySelector(`[part="${part}"]`)?.textContent ?? '';

it('keeps provider token and cost columns opt-in and includes their localized accessible names when enabled', async () => {
  const data = provider([{ ...span, tokensIn: 1200, tokensOut: 3400, costText: '$0.50' }]);
  const element = await fixture<LyraTraceTree>(html`<lr-trace-tree .treeSource=${data.source}></lr-trace-tree>`);
  await ready(element);
  expect(row(element).querySelectorAll('[part="tokens-in"], [part="tokens-out"], [part="cost"]').length).to.equal(0);
  expect(row(element).getAttribute('aria-label')).not.to.include('Tokens out');
  element.withTokens = true; element.withCost = true;
  await element.updateComplete;
  await waitUntil(() => text(row(element), 'tokens-out') === '3,400');
  expect(text(row(element), 'tokens-in')).to.equal('1,200');
  expect(text(row(element), 'cost')).to.equal('$0.50');
  expect(row(element).getAttribute('aria-label')).to.include('Tokens in: 1,200').and.include('Tokens out: 3,400').and.include('Cost: $0.50');
  element.strings = { tokensIn: 'Input units', tokensOut: 'Output units', cost: 'Charge',
    traceTreeMetricLabel: '{label}={value}', accessibleLabelSeparator: ' | ' };
  await element.updateComplete;
  await waitUntil(() => row(element).getAttribute('aria-label')?.includes('Output units=3,400') === true);
  expect(row(element).getAttribute('aria-label')).to.include(' | Input units=1,200 | Output units=3,400 | Charge=$0.50');
  expect(text(row(element), 'detail')).to.equal(span.detail);
  expect(data.calls()).to.equal(1);
  element.withTokens = false; element.withCost = false;
  await element.updateComplete;
  await waitUntil(() => row(element).querySelector('[part="tokens-out"]') === null);
  expect(row(element).getAttribute('aria-label')).not.to.include('Output units');
  expect(data.calls()).to.equal(1);
});

it('distinguishes zero token counts from invalid or absent metrics without changing the provider timing extent', async () => {
  const data = provider([
    { ...span, id: 'zero', tokensIn: 0, tokensOut: 0 },
    { ...span, id: 'invalid', tokensIn: -1, tokensOut: Infinity },
    { ...span, id: 'absent', status: 'pending', endMs: undefined },
  ]);
  const element = await fixture<LyraTraceTree>(html`<lr-trace-tree with-tokens with-cost .treeSource=${data.source}></lr-trace-tree>`);
  await ready(element, 'absent');
  expect(text(row(element, 'zero'), 'tokens-in')).to.equal('0');
  expect(text(row(element, 'zero'), 'tokens-out')).to.equal('0');
  expect(row(element, 'zero').getAttribute('aria-label')).to.include('Tokens in: 0').and.include('Tokens out: 0');
  for (const key of ['invalid', 'absent']) {
    expect(text(row(element, key), 'tokens-in')).to.equal('');
    expect(text(row(element, key), 'tokens-out')).to.equal('');
    expect(text(row(element, key), 'cost')).to.equal('');
    expect(row(element, key).getAttribute('aria-label')).not.to.include('Tokens in').and.not.to.include('Tokens out');
  }
  expect(text(row(element, 'absent'), 'duration')).to.equal('');
  expect(row(element, 'absent').querySelector<HTMLElement>('[part="bar"]')!.style.inlineSize).to.equal('0%');
  expect(row(element, 'zero').querySelector<HTMLElement>('[part="bar"]')!.style.inlineSize).to.equal('25%');
  expect(element.shadowRoot!.textContent).not.to.include('Infinity');
});

for (const [name, timing] of [
  ['negative start', { startMs: -1 }], ['nonfinite start', { startMs: NaN }],
  ['reversed interval', { endMs: 99 }], ['nonfinite end', { endMs: Infinity }],
] as const) {
  it(`rejects a provider span with ${name} and recovers with a corrected binding`, async () => {
    const data = provider([{ ...span, ...timing }]);
    const element = await fixture<LyraTraceTree>(html`<lr-trace-tree .treeSource=${data.source}
      .strings=${{ treeSourceError: 'Span data unavailable' }}></lr-trace-tree>`);
    await waitUntil(() => element.shadowRoot!.querySelector('[part~="source-error"]') !== null);
    expect(element.shadowRoot!.textContent).to.include('Span data unavailable');
    expect(element.shadowRoot!.textContent).not.to.include('Invalid span timing');
    expect(element.shadowRoot!.querySelectorAll('[data-source-key]').length).to.equal(0);
    element.treeSource = provider([span], 2).source;
    await ready(element);
    expect(element.shadowRoot!.querySelectorAll('[part~="source-error"]').length).to.equal(0);
    expect(text(row(element), 'name')).to.equal(span.name);
    expect(row(element).querySelector<HTMLElement>('[part="bar"]')!.style.inlineSize).to.equal('25%');
  });
}
