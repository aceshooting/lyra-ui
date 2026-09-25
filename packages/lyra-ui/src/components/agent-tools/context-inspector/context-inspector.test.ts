import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './context-inspector.js';
import type { LyraContextInspector, ContextInspectorSegment } from './context-inspector.js';
import type { LyraContextMeter } from '../../data/context-meter/context-meter.js';
import type { LyraCopyButton } from '../../utility/copy-button/copy-button.js';
import type { LyraExportButton } from '../../utility/export-button/export-button.js';
import { renderedTemplateWhitespace } from '../../../../test/rendered-whitespace.js';

const segments: ContextInspectorSegment[] = [
  { id: 's1', label: 'System prompt', text: 'You are helpful.', tokens: 100 },
  {
    id: 's2',
    label: 'Chunk 1',
    text: 'Paris is the capital of France.',
    tokens: 200,
    citation: { id: 'c1', sourceId: 'doc-1', label: 'annual_report.pdf' },
  },
];

it('renders the empty state when segments is empty (the default), with no meter/toolbar/segments', async () => {
  const el = (await fixture(html`<lr-context-inspector></lr-context-inspector>`)) as LyraContextInspector;
  expect(el.segments).to.deep.equal([]);
  expect(el.shadowRoot!.querySelector('lr-empty')).to.exist;
  expect((el.shadowRoot!.querySelector('lr-context-meter')) == null).to.be.true;
  expect((el.shadowRoot!.querySelector('[part="toolbar"]')) == null).to.be.true;
});

it('fails a non-array runtime segment collection closed', async () => {
  const el = await fixture<LyraContextInspector>(html`<lr-context-inspector></lr-context-inspector>`);
  el.segments = { 0: segments[0], length: 1 } as unknown as ContextInspectorSegment[];
  await el.updateComplete;

  expect(el.shadowRoot!.querySelectorAll('[part="segment"]')).to.have.lengthOf(0);
  expect(el.shadowRoot!.querySelectorAll('lr-empty')).to.have.lengthOf(1);
});

it('keeps a valid-id streaming segment whose text body has not arrived yet', async () => {
  const el = await fixture<LyraContextInspector>(html`<lr-context-inspector></lr-context-inspector>`);
  el.segments = [{ id: 's1', label: 'System prompt', tokens: 12 }] as unknown as ContextInspectorSegment[];
  await el.updateComplete;

  const row = el.shadowRoot!.querySelector('[part="segment"]')!;
  expect(row.querySelector('[part="segment-label"]')!.textContent).to.equal('System prompt');
  expect(row.querySelector('[part="segment-text"]')!.textContent!.trim()).to.equal('');
  expect((el.shadowRoot!.querySelector('lr-copy-button') as LyraCopyButton).value).to.equal('System prompt\n');
});

it('maps segments/total/label onto the embedded lr-context-meter', async () => {
  const el = (await fixture(html`<lr-context-inspector></lr-context-inspector>`)) as LyraContextInspector;
  el.segments = segments;
  el.total = 1000;
  el.label = '1K budget';
  await el.updateComplete;
  const meter = el.shadowRoot!.querySelector('lr-context-meter') as LyraContextMeter;
  expect(meter.total).to.equal(1000);
  expect(meter.label).to.equal('1K budget');
  expect(meter.segments).to.deep.equal([
    { label: 'System prompt', value: 100 },
    { label: 'Chunk 1', value: 200 },
  ]);
});

it('renders one segment row per array entry with its label and token-count text', async () => {
  const el = (await fixture(html`<lr-context-inspector></lr-context-inspector>`)) as LyraContextInspector;
  el.segments = segments;
  await el.updateComplete;
  const rows = el.shadowRoot!.querySelectorAll('[part="segment"]');
  expect(rows.length).to.equal(2);
  expect(rows[0]!.querySelector('[part="segment-label"]')!.textContent).to.equal('System prompt');
  expect(rows[0]!.querySelector('[part="segment-tokens"]')!.textContent).to.include('100');
  expect(rows[1]!.querySelector('[part="segment-tokens"]')!.textContent).to.include('200');
});

it('renders a citation badge only for segments carrying a citation, numbered sequentially among themselves', async () => {
  const el = (await fixture(html`<lr-context-inspector></lr-context-inspector>`)) as LyraContextInspector;
  el.segments = [
    { id: 's1', label: 'A', text: 'a', tokens: 1 },
    { id: 's2', label: 'B', text: 'b', tokens: 2, citation: { id: 'c1', sourceId: 'doc-1' } },
    { id: 's3', label: 'C', text: 'c', tokens: 3, citation: { id: 'c2', sourceId: 'doc-2' } },
  ];
  await el.updateComplete;
  const rows = el.shadowRoot!.querySelectorAll('[part="segment"]');
  expect((rows[0]!.querySelector('lr-citation-badge')) == null).to.be.true;
  const badge1 = rows[1]!.querySelector('lr-citation-badge')!;
  expect(badge1.getAttribute('source-id')).to.equal('doc-1');
  expect(badge1.getAttribute('index')).to.equal('1');
  const badge2 = rows[2]!.querySelector('lr-citation-badge')!;
  expect(badge2.getAttribute('source-id')).to.equal('doc-2');
  expect(badge2.getAttribute('index')).to.equal('2');
});

it('lr-citation-activate bubbles unchanged from a segment citation badge', async () => {
  const el = (await fixture(html`<lr-context-inspector></lr-context-inspector>`)) as LyraContextInspector;
  el.segments = segments;
  await el.updateComplete;
  const badge = el.shadowRoot!.querySelector('lr-citation-badge')!;
  const listener = oneEvent(el, 'lr-citation-activate');
  (badge.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement).click();
  const event = await listener;
  expect(event.detail).to.deep.equal({ sourceId: 'doc-1', index: 1 });
});

it('renders a truncation-boundary marker only for truncated segments, with omitted-count text when set', async () => {
  const el = (await fixture(html`<lr-context-inspector></lr-context-inspector>`)) as LyraContextInspector;
  el.segments = [
    { id: 's1', label: 'A', text: 'a', tokens: 1 },
    { id: 's2', label: 'B', text: 'b', tokens: 2, truncated: true },
    { id: 's3', label: 'C', text: 'c', tokens: 3, truncated: true, omittedTokens: 40 },
  ];
  await el.updateComplete;
  const rows = [...el.shadowRoot!.querySelectorAll('[part="segment"]')];
  expect((rows[0]!.querySelector('[part="truncation-boundary"]')) == null).to.be.true;
  expect(rows[1]!.querySelector('[part="truncation-boundary"]')!.textContent).to.equal('Truncated');
  expect(rows[2]!.querySelector('[part="truncation-boundary"]')!.textContent).to.include('40');
});

it('wraps a redacted character range in a titled [part="redaction"] mark, leaving the rest of the text intact', async () => {
  const el = (await fixture(html`<lr-context-inspector></lr-context-inspector>`)) as LyraContextInspector;
  el.segments = [
    {
      id: 's1',
      label: 'Secret',
      text: 'key=SECRET123 end',
      tokens: 5,
      redactions: [{ start: 4, end: 13, reason: 'API key' }],
    },
  ];
  await el.updateComplete;
  const row = el.shadowRoot!.querySelector('[part="segment"]')!;
  const mark = row.querySelector('[part="redaction"]') as HTMLElement;
  expect(mark.textContent).to.equal('SECRET123');
  expect(mark.getAttribute('title')).to.equal('API key');
  expect(row.querySelector('[part="segment-text"]')!.textContent).to.include('key=');
  expect(row.querySelector('[part="segment-text"]')!.textContent).to.include('end');
});

it('falls back to a generic localized reason when a redaction carries none', async () => {
  const el = (await fixture(html`<lr-context-inspector></lr-context-inspector>`)) as LyraContextInspector;
  el.segments = [{ id: 's1', label: 'X', text: 'abcdef', tokens: 1, redactions: [{ start: 0, end: 3 }] }];
  await el.updateComplete;
  const mark = el.shadowRoot!.querySelector('[part="redaction"]') as HTMLElement;
  expect(mark.getAttribute('title')).to.equal('Redacted');
});

it('clamps, sorts, and merges malformed redaction spans (out-of-range, inverted, overlapping) instead of throwing', async () => {
  const el = (await fixture(html`<lr-context-inspector></lr-context-inspector>`)) as LyraContextInspector;
  el.segments = [
    {
      id: 's1',
      label: 'X',
      text: 'abcdef',
      tokens: 1,
      redactions: [
        { start: -5, end: 2 }, // clamps to [0,2]
        { start: 1, end: 4 }, // overlaps -> merges into [0,4]
        { start: 10, end: 3 }, // inverted + out-of-range -> clamps/sorts to [3,6], overlaps -> merges into [0,6]
      ],
    },
  ];
  await el.updateComplete;
  const marks = el.shadowRoot!.querySelectorAll('[part="redaction"]');
  expect(marks.length).to.equal(1);
  expect(marks[0]!.textContent).to.equal('abcdef');
});

it('lr-copy-button value is the assembled label+text of every segment, in order, and lr-copy bubbles unchanged', async () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async () => undefined },
  });
  const el = (await fixture(html`<lr-context-inspector></lr-context-inspector>`)) as LyraContextInspector;
  try {
    el.segments = segments;
    await el.updateComplete;
    const copyButton = el.shadowRoot!.querySelector('lr-copy-button') as LyraCopyButton;
    // The host's own update does not await its composed child's first render, and the trigger this
    // test clicks lives two shadow roots down.
    await copyButton.updateComplete;
    const trigger = copyButton.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    await (trigger as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
    expect(copyButton.value).to.equal(
      'System prompt\nYou are helpful.\n\nChunk 1\nParis is the capital of France.',
    );
    const listener = oneEvent(el, 'lr-copy');
    // <lr-copy-button>'s built-in trigger is a composed <lr-icon-button>; its native control sits
    // one shadow boundary deeper than `[part~="base"]`.
    (trigger.shadowRoot!.querySelector('button[part~="button"]') as HTMLButtonElement).click();
    const event = await listener;
    expect(event.detail).to.deep.equal({ ok: true, text: copyButton.value });
  } finally {
    if (original) Object.defineProperty(navigator, 'clipboard', original);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
});

it('surfaces one lr-toolbar-actions-change event from the embedded copy button unchanged', async () => {
  const el = await fixture<LyraContextInspector>(html`
    <lr-context-inspector .segments=${segments}></lr-context-inspector>
  `);
  const copyButton = el.shadowRoot!.querySelector('lr-copy-button') as LyraCopyButton;
  let count = 0;
  el.addEventListener('lr-toolbar-actions-change', () => count++);
  const changed = oneEvent(el, 'lr-toolbar-actions-change');

  copyButton.disabled = true;
  const event = await changed;
  await copyButton.updateComplete;

  expect(event.bubbles).to.equal(true);
  expect(event.composed).to.equal(true);
  expect(count).to.equal(1);
});

it('builds one export row per segment and bubbles lr-export / lr-export-complete from the embedded lr-export-button', async () => {
  const el = (await fixture(html`<lr-context-inspector></lr-context-inspector>`)) as LyraContextInspector;
  el.segments = [
    {
      id: 's1',
      label: 'A',
      text: 'a',
      tokens: 1,
      truncated: true,
      omittedTokens: 9,
      citation: { id: 'c', sourceId: 'doc-1' },
      redactions: [{ start: 0, end: 1 }],
    },
  ];
  await el.updateComplete;
  const exportButton = el.shadowRoot!.querySelector('lr-export-button') as LyraExportButton;
  expect(exportButton.rows).to.deep.equal([
    {
      id: 's1',
      label: 'A',
      tokens: 1,
      truncated: true,
      omittedTokens: 9,
      sourceId: 'doc-1',
      redactionCount: 1,
      text: 'a',
    },
  ]);
  const exportEvent = oneEvent(el, 'lr-export');
  const completeEvent = oneEvent(el, 'lr-export-complete');
  (exportButton.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement).click();
  const event = await exportEvent;
  expect(event.detail.format).to.equal('json');
  await completeEvent;
});

it('forwards the explicit exportFormats/exportFilename vocabulary to the export control', async () => {
  const el = (await fixture(html`
    <lr-context-inspector export-filename="model-context"></lr-context-inspector>
  `)) as LyraContextInspector;
  el.exportFormats = ['csv', 'json'];
  el.segments = [{ id: 's1', label: 'System', text: 'Prompt', tokens: 1 }];
  await el.updateComplete;

  const exportButton = el.shadowRoot!.querySelector('lr-export-button') as LyraExportButton;
  expect(el.exportFilename).to.equal('model-context');
  expect(exportButton.formats).to.deep.equal(['csv', 'json']);
  expect(exportButton.filename).to.equal('model-context');
});

it('renders the default English built-in copy with no locale registered and no .strings override', async () => {
  const el = (await fixture(html`<lr-context-inspector></lr-context-inspector>`)) as LyraContextInspector;
  expect(el.shadowRoot!.querySelector('lr-empty')!.getAttribute('heading')).to.equal('No context segments');
});

it('honors .strings overrides for the empty state and the truncation marker', async () => {
  const el = (await fixture(html`<lr-context-inspector></lr-context-inspector>`)) as LyraContextInspector;
  el.strings = { contextInspectorEmpty: 'Rien à afficher' };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('lr-empty')!.getAttribute('heading')).to.equal('Rien à afficher');

  el.strings = { contextInspectorTruncated: 'Tronqué' };
  el.segments = [{ id: 's1', label: 'A', text: 'a', tokens: 1, truncated: true }];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="truncation-boundary"]')!.textContent).to.equal('Tronqué');
});

it('is accessible with a fully populated state (meter, citation, truncation, redaction)', async () => {
  const el = (await fixture(
    html`<lr-context-inspector label="128K context window"></lr-context-inspector>`,
  )) as LyraContextInspector;
  el.total = 1000;
  el.segments = [
    { id: 's1', label: 'System prompt', text: 'You are helpful.', tokens: 100, tone: 'brand' },
    {
      id: 's2',
      label: 'Chunk 1',
      text: 'Paris is the capital of France.',
      tokens: 200,
      citation: { id: 'c1', sourceId: 'doc-1', label: 'annual_report.pdf' },
      truncated: true,
      omittedTokens: 50,
    },
    {
      id: 's3',
      label: 'Secret',
      text: 'key=SECRET end',
      tokens: 20,
      redactions: [{ start: 4, end: 10, reason: 'API key' }],
    },
  ];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="segment"]').length).to.equal(3);
  await expect(el).to.be.accessible();
});

it('remains functional and accessible under dir="rtl"', async () => {
  const wrapper = await fixture(html`<div dir="rtl"><lr-context-inspector></lr-context-inspector></div>`);
  const el = wrapper.querySelector('lr-context-inspector') as LyraContextInspector;
  el.total = 100;
  el.segments = [
    {
      id: 's1',
      label: 'System prompt',
      text: 'You are helpful.',
      tokens: 10,
      citation: { id: 'c1', sourceId: 'doc-1' },
      truncated: true,
    },
  ];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="segment"]')).to.exist;
  expect(el.shadowRoot!.querySelector('lr-citation-badge')).to.exist;
  await expect(el).to.be.accessible();
});

it('shrinks to a 320px allocation with a long label and long segment text without overflowing', async () => {
  const wrapper = await fixture(
    html`<div style="inline-size: 320px;"><lr-context-inspector></lr-context-inspector></div>`,
  );
  const el = wrapper.querySelector('lr-context-inspector') as LyraContextInspector;
  el.label = 'A very long descriptive label for the assembled prompt context window';
  el.total = 128_000;
  el.segments = [
    {
      id: 's1',
      label: 'A fairly long segment label describing the system prompt in a lot of detail',
      text: 'x'.repeat(200),
      tokens: 4000,
      citation: { id: 'c1', sourceId: 'doc-1' },
    },
  ];
  await el.updateComplete;
  expect(el.getBoundingClientRect().width).to.be.at.most(320);
});

it('normalizes duplicate segment ids first-wins before metering and rendering', async () => {
  const el = await fixture<LyraContextInspector>(html`
    <lr-context-inspector
      .segments=${[
        { id: 'same', label: 'First segment', text: 'first', tokens: 10 },
        { id: 'same', label: 'Later segment', text: 'later', tokens: 90 },
      ]}
      total="100"
    ></lr-context-inspector>
  `);
  const rows = el.shadowRoot!.querySelectorAll('[part="segment"]');
  expect(rows).to.have.length(1);
  expect(rows[0]!.textContent).to.contain('First segment');
  const meter = el.shadowRoot!.querySelector('lr-context-meter') as LyraContextMeter;
  expect(meter.segments).to.have.length(1);
  expect(meter.segments[0]!.value).to.equal(10);
});

it('caps rendered segment rows at the render ceiling and shows a localized limit notice', async () => {
  const many: ContextInspectorSegment[] = Array.from({ length: 600 }, (_, index) => ({
    id: `segment-${index}`,
    label: `Segment ${index}`,
    text: `Text ${index}`,
    tokens: 10,
  }));
  const el = await fixture<LyraContextInspector>(html`<lr-context-inspector .segments=${many}></lr-context-inspector>`);
  const rows = el.shadowRoot!.querySelectorAll('[part="segment"]');
  expect(rows).to.have.lengthOf(500);
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.equal(
    'Only the first 500 segments are shown.',
  );
  // The embedded meter and copy payload still reflect every segment, not just the rendered subset.
  const meter = el.shadowRoot!.querySelector('lr-context-meter') as LyraContextMeter;
  expect(meter.segments).to.have.lengthOf(600);
});

it('renders no limit notice when segments stays within the render ceiling', async () => {
  const el = await fixture<LyraContextInspector>(html`<lr-context-inspector .segments=${segments}></lr-context-inspector>`);
  expect((el.shadowRoot!.querySelector('[part="limit"]')) == null).to.be.true;
});

describe('template whitespace', () => {
  const plain: ContextInspectorSegment = { id: 'p', label: 'Plain', text: 'One line of segment text.', tokens: 5 };
  const truncated: ContextInspectorSegment = {
    id: 't',
    label: 'Truncated',
    text: 'One line before the boundary.',
    tokens: 5,
    truncated: true,
  };

  const segmentTexts = (el: LyraContextInspector): HTMLElement[] =>
    Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('[part="segment-text"]'));

  /** The segment text with the truncation boundary removed. */
  function textBeforeBoundary(part: HTMLElement): string {
    const clone = part.cloneNode(true) as HTMLElement;
    clone.querySelector('[part="truncation-boundary"]')?.remove();
    return clone.textContent ?? '';
  }

  function lineHeightPx(element: HTMLElement): number {
    const value = getComputedStyle(element).lineHeight;
    if (value.endsWith('px')) return parseFloat(value);
    return parseFloat(value) * parseFloat(getComputedStyle(element).fontSize);
  }

  async function mount(dir?: 'rtl'): Promise<LyraContextInspector> {
    const el = await fixture<LyraContextInspector>(
      html`<lr-context-inspector dir=${dir ?? 'ltr'} .segments=${[plain, truncated]}></lr-context-inspector>`,
    );
    await el.updateComplete;
    return el;
  }

  it('renders segment text exactly, with the truncation boundary directly below one text line', async () => {
    const el = await mount();
    const [plainPart, truncatedPart] = segmentTexts(el);
    expect(plainPart!.textContent).to.equal(plain.text);
    expect(textBeforeBoundary(truncatedPart!)).to.equal(truncated.text);
    expect(renderedTemplateWhitespace(el.shadowRoot!)).to.deep.equal([]);

    const boundary = truncatedPart!.querySelector<HTMLElement>('[part="truncation-boundary"]')!;
    const boundaryBlock =
      boundary.getBoundingClientRect().height + parseFloat(getComputedStyle(boundary).marginBlockStart);
    expect(truncatedPart!.getBoundingClientRect().height).to.be.closeTo(
      lineHeightPx(truncatedPart!) + boundaryBlock,
      1,
    );
    await expect(el).to.be.accessible();
  });

  it('starts segment text at the inline-start edge under dir="rtl"', async () => {
    const el = await mount('rtl');
    expect(renderedTemplateWhitespace(el.shadowRoot!)).to.deep.equal([]);
    const [plainPart] = segmentTexts(el);
    const walker = document.createTreeWalker(plainPart!, NodeFilter.SHOW_TEXT);
    let textNode: Text | null = null;
    while (!textNode && walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (node.data.includes(plain.text)) textNode = node;
    }
    const range = document.createRange();
    range.selectNodeContents(textNode!);
    const partRect = plainPart!.getBoundingClientRect();
    const textRect = range.getBoundingClientRect();
    expect(partRect.right - textRect.right).to.be.at.most(1);
    expect(textRect.top - partRect.top).to.be.lessThan(lineHeightPx(plainPart!));
  });
});
