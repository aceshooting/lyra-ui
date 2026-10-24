import { expect } from '@open-wc/testing';
import { render } from 'lit';
import {
  canvasSentence,
  canvasTextDirection,
  firstStrongDirection,
  isolateCanvasLabel,
  isolateCanvasText,
  isolatedMessage,
  isolateScaleTickLabels,
  isolateTooltipLines,
  tooltipIsolationHook,
} from './chart-bidi.js';

const LRE = '\u202a';
const RLE = '\u202b';
const PDF = '\u202c';
const HEBREW = 'שלום';

describe('chart bidi canvas isolation', () => {
  it('resolves a direction from the first strong character outside isolates and embeddings', () => {
    expect(firstStrongDirection('2.4 MiB/s')).to.equal('ltr');
    expect(firstStrongDirection('12 %')).to.equal(null);
    expect(firstStrongDirection(`${HEBREW} 12`)).to.equal('rtl');
    expect(firstStrongDirection(`\u2067${HEBREW}\u2069 abc`)).to.equal('ltr');
    expect(firstStrongDirection(`${RLE}${HEBREW}${PDF} abc`)).to.equal('ltr');
    expect(firstStrongDirection('\u200f12')).to.equal('rtl');
    expect(firstStrongDirection('\u200e12')).to.equal('ltr');
    expect(firstStrongDirection('\u061c12')).to.equal('rtl');
  });

  it('wraps a label only when its own direction differs from the canvas direction', () => {
    expect(isolateCanvasText('', 'rtl')).to.equal('');
    expect(isolateCanvasText('2.4 MiB/s', 'ltr')).to.equal('2.4 MiB/s');
    expect(isolateCanvasText(HEBREW, 'rtl')).to.equal(HEBREW);
    expect(isolateCanvasText('2.4 MiB/s', 'rtl')).to.equal(`${LRE}2.4 MiB/s${PDF}`);
    expect(isolateCanvasText('-3', 'rtl')).to.equal(`${LRE}-3${PDF}`);
    expect(isolateCanvasText(HEBREW, 'ltr')).to.equal(`${RLE}${HEBREW}${PDF}`);
  });

  it('is idempotent and treats an unterminated embedding as ordinary text to wrap', () => {
    const once = isolateCanvasText('abc', 'rtl');
    expect(isolateCanvasText(once, 'rtl')).to.equal(once);
    // An opening control with no matching pop never forms one embedding that spans the label.
    const unterminated = `${LRE}abc`;
    expect(isolateCanvasText(unterminated, 'rtl')).to.equal(`${LRE}${LRE}abc${PDF}`);
    // Two adjacent runs are not one embedding either, so the whole label is wrapped.
    const adjacent = `${LRE}a${PDF}${LRE}b${PDF}`;
    expect(isolateCanvasText(adjacent, 'rtl')).to.equal(`${LRE}${adjacent}${PDF}`);
  });

  it('keeps a value after an opposite-direction series label in its own order', () => {
    const sentence = (value: string) => `${HEBREW}: ${value}`;
    expect(canvasSentence(sentence, '1.5 MiB/s')).to.equal(`${HEBREW}: ${LRE}1.5 MiB/s${PDF}`);
    expect(canvasSentence((value) => `cpu: ${value}`, '12')).to.equal('cpu: 12');
  });

  it('isolates each line of a multi-line label and passes non-strings through untouched', () => {
    const lines = isolateCanvasLabel(['abc', 42, null, HEBREW] as unknown[], 'rtl');
    expect(lines).to.deep.equal([`${LRE}abc${PDF}`, 42, null, HEBREW]);
    expect(isolateCanvasLabel(7, 'rtl')).to.equal(7);
    expect(isolateCanvasLabel('abc', 'rtl')).to.equal(`${LRE}abc${PDF}`);
  });

  it('isolates every tick label of a scale and ignores a scale without a tick list', () => {
    const ticks: unknown[] = [{ label: 'abc' }, null, 7, { value: 3 }, { label: HEBREW }];
    isolateScaleTickLabels({ ticks }, 'rtl');
    expect(ticks[0]).to.deep.equal({ label: `${LRE}abc${PDF}` });
    expect(ticks[1]).to.equal(null);
    expect(ticks[2]).to.equal(7);
    expect(ticks[3]).to.deep.equal({ value: 3 });
    expect(ticks[4]).to.deep.equal({ label: HEBREW });
    for (const scale of [{}, { ticks: undefined }, { ticks: 'abc' }]) {
      expect(() => isolateScaleTickLabels(scale, 'rtl')).not.to.throw();
    }
    const arrayLike = { ticks: { 0: { label: 'abc' }, length: 1 } };
    isolateScaleTickLabels(arrayLike, 'rtl');
    expect(arrayLike.ticks[0].label).to.equal('abc');
  });

  it('isolates tooltip title, body and footer lines while skipping malformed collections', () => {
    const tooltip = {
      title: ['abc'],
      beforeBody: 'not a list',
      body: [null, 7, { before: 'oops', lines: ['abc', 5], after: ['abc'] }, { lines: [HEBREW] }],
      afterBody: undefined,
      footer: ['abc'],
    };
    isolateTooltipLines(tooltip, 'rtl');
    expect(tooltip.title).to.deep.equal([`${LRE}abc${PDF}`]);
    expect(tooltip.beforeBody).to.equal('not a list');
    expect(tooltip.body[0]).to.equal(null);
    expect(tooltip.body[1]).to.equal(7);
    expect(tooltip.body[2]).to.deep.equal({ before: 'oops', lines: [`${LRE}abc${PDF}`, 5], after: [`${LRE}abc${PDF}`] });
    expect(tooltip.body[3]).to.deep.equal({ lines: [HEBREW] });
    expect(tooltip.footer).to.deep.equal([`${LRE}abc${PDF}`]);
    const withoutBodyList = { title: ['abc'], body: 'not a list' };
    isolateTooltipLines(withoutBodyList, 'rtl');
    expect(withoutBodyList.title).to.deep.equal([`${LRE}abc${PDF}`]);
    expect(withoutBodyList.body).to.equal('not a list');
  });

  it('draws a tooltip in its configured text direction, falling back to the host direction', () => {
    expect(canvasTextDirection(undefined, 'rtl')).to.equal('rtl');
    expect(canvasTextDirection('tooltip', 'rtl')).to.equal('rtl');
    expect(canvasTextDirection({ options: { textDirection: 'auto' } }, 'rtl')).to.equal('rtl');
    expect(canvasTextDirection({ options: { textDirection: 'ltr' } }, 'rtl')).to.equal('ltr');
    const hook = tooltipIsolationHook(() => 'rtl');
    const hosted = { title: ['abc', HEBREW] };
    hook({}, { tooltip: hosted });
    expect(hosted.title).to.deep.equal([`${LRE}abc${PDF}`, HEBREW]);
    const configured = { options: { textDirection: 'ltr' }, title: ['abc', HEBREW] };
    hook({}, { tooltip: configured });
    expect(configured.title).to.deep.equal(['abc', `${RLE}${HEBREW}${PDF}`]);
    expect(() => hook({}, {})).not.to.throw();
    expect(() => hook({}, { tooltip: 'text' })).not.to.throw();
    expect(() => hook({}, undefined as unknown as { tooltip?: unknown })).not.to.throw();
  });
});

describe('chart bidi localized messages', () => {
  const host = (): HTMLDivElement => document.body.appendChild(document.createElement('div'));

  it('isolates only the named values and keeps the translated sentence text intact', () => {
    const container = host();
    try {
      render(isolatedMessage(
        (values) => `${values['label']}: ${values['value']} (${values['count']})`,
        { label: 'cpu', value: '2.4 MiB/s', count: 3 },
        ['label', 'value'],
      ), container);
      expect(container.textContent).to.equal('cpu: 2.4 MiB/s (3)');
      const spans = [...container.querySelectorAll('span.bidi')];
      expect(spans.map((span) => span.textContent)).to.deep.equal(['cpu', '2.4 MiB/s']);
    } finally {
      container.remove();
    }
  });

  it('keeps sentinel-looking text from a caller value as ordinary text', () => {
    const container = host();
    const lookalike = 'a\ue0007\ue001b';
    try {
      render(isolatedMessage(
        (values) => `${values['label']} / ${values['value']}`,
        { label: lookalike, value: '5' },
        ['value'],
      ), container);
      expect(container.textContent).to.equal(`${lookalike} / 5`);
      expect([...container.querySelectorAll('span.bidi')].map((span) => span.textContent)).to.deep.equal(['5']);
    } finally {
      container.remove();
    }
  });
});
