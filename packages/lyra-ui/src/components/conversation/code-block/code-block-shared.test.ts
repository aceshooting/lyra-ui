import { render } from 'lit';
import { expect } from '@open-wc/testing';
import { parseHighlightLines, codeBlockLineTransformer, renderCodeBlockPlainCode } from './code-block-shared.js';

describe('parseHighlightLines', () => {
  it('parses a single range', () => {
    expect([...parseHighlightLines('3-5')].sort((a, b) => a - b)).to.deep.equal([3, 4, 5]);
  });

  it('parses multiple comma-separated segments, tolerating whitespace', () => {
    expect([...parseHighlightLines(' 3-5, 7 ')].sort((a, b) => a - b)).to.deep.equal([3, 4, 5, 7]);
  });

  it('normalizes a reversed range', () => {
    expect([...parseHighlightLines('5-3')].sort((a, b) => a - b)).to.deep.equal([3, 4, 5]);
  });

  it('merges overlapping ranges into a set with no duplicates', () => {
    expect([...parseHighlightLines('1-3,2-4')].sort((a, b) => a - b)).to.deep.equal([1, 2, 3, 4]);
  });

  it('ignores an invalid segment and warns, keeping the valid ones', () => {
    const warn = console.warn;
    let warned = false;
    console.warn = () => {
      warned = true;
    };
    try {
      expect([...parseHighlightLines('2,garbage,4')].sort((a, b) => a - b)).to.deep.equal([2, 4]);
      expect(warned).to.be.true;
    } finally {
      console.warn = warn;
    }
  });

  it('returns an empty set for an empty string', () => {
    expect(parseHighlightLines('').size).to.equal(0);
  });

  it('bounds arbitrarily large ranges to the rendered line count', () => {
    expect([...parseHighlightLines('1-999999999', 3)]).to.deep.equal([1, 2, 3]);
  });
});

describe('codeBlockLineTransformer', () => {
  it('stamps data-line, data-highlighted, and part on a highlighted line node', () => {
    const transformer = codeBlockLineTransformer({
      lineNumbers: false,
      interactiveLines: false,
      focusedLine: 1,
      highlightedLines: new Set([2]),
      activeLines: new Set(),
      lineDescription: () => '',
    });
    const node = { properties: {} as Record<string, unknown> };
    transformer.line(node, 2);
    expect(node.properties['data-line']).to.equal('2');
    expect(node.properties['data-highlighted']).to.equal('');
    expect(node.properties.part).to.deep.equal(['line-highlight']);
  });

  it('does not stamp part on a non-highlighted line', () => {
    const transformer = codeBlockLineTransformer({
      lineNumbers: false,
      interactiveLines: false,
      focusedLine: 1,
      highlightedLines: new Set([2]),
      activeLines: new Set(),
      lineDescription: () => '',
    });
    const node = { properties: {} as Record<string, unknown> };
    transformer.line(node, 5);
    expect(node.properties.part).to.equal(undefined);
    expect(node.properties['data-highlighted']).to.equal(undefined);
  });

  it('stamps data-active for an active line', () => {
    const transformer = codeBlockLineTransformer({
      lineNumbers: false,
      interactiveLines: false,
      focusedLine: 1,
      highlightedLines: new Set(),
      activeLines: new Set([3]),
      lineDescription: () => '',
    });
    const node = { properties: {} as Record<string, unknown> };
    transformer.line(node, 3);
    expect(node.properties['data-active']).to.equal('');
  });

  it('makes highlighted shiki lines keyboard-operable without replacing their source text', () => {
    const transformer = codeBlockLineTransformer({
      lineNumbers: true,
      interactiveLines: true,
      focusedLine: 2,
      highlightedLines: new Set(),
      activeLines: new Set(),
      lineDescription: (line) => `Line ${line}`,
    });
    const node = { properties: {} as Record<string, unknown> };
    transformer.line(node, 2);
    expect(node.properties.part).to.deep.equal(['line-button']);
    expect(node.properties.role).to.equal('button');
    expect(node.properties.tabindex).to.equal('0');
    expect(node.properties['aria-description']).to.equal('Line 2');
    expect(node.properties['aria-label']).to.equal(undefined);
  });
});

// Regression for the xcomp-lean-full-split-duplication finding: renderCodeBlockPlainCode() used to
// be a byte-for-byte-duplicated private method on both <lr-code-block> and <lr-code-block-core> --
// exercised here directly (in isolation from either custom element) so both components' own tests
// only need to prove they delegate to it, not re-prove its rendering logic.
describe('renderCodeBlockPlainCode', () => {
  const localize = (key: string, _fallback?: string, values?: Record<string, string | number>): string =>
    values ? `${key}:${JSON.stringify(values)}` : key;

  function renderInto(options: Parameters<typeof renderCodeBlockPlainCode>[0]): HTMLElement {
    const container = document.createElement('div');
    render(renderCodeBlockPlainCode(options), container);
    return container;
  }

  it('renders one non-interactive <span class="line"> per line, carrying data-line', () => {
    const container = renderInto({
      code: 'first\nsecond',
      lineNumbers: true,
      interactiveLines: false,
      focusedLine: 1,
      highlightedLines: new Set(),
      activeLines: new Set(),
      localize,
      onLineActivate: () => {},
      onLineKeyDown: () => {},
    });
    const lines = container.querySelectorAll('.line');
    expect(lines).to.have.lengthOf(2);
    expect(lines[0].tagName).to.equal('SPAN');
    expect(lines[0].getAttribute('data-line')).to.equal('1');
    expect(lines[1].getAttribute('data-line')).to.equal('2');
  });

  it('keeps source text as each line button name and supplies the localized line number as a description', () => {
    const container = renderInto({
      code: 'a\nb\nc',
      lineNumbers: true,
      interactiveLines: true,
      focusedLine: 2,
      highlightedLines: new Set([2]),
      activeLines: new Set(),
      localize,
      onLineActivate: () => {},
      onLineKeyDown: () => {},
    });
    const buttons = container.querySelectorAll('button.line');
    expect(buttons).to.have.lengthOf(3);
    expect(buttons[0].getAttribute('tabindex')).to.equal('-1');
    expect(buttons[1].getAttribute('tabindex')).to.equal('0');
    expect(buttons[1].getAttribute('part')).to.equal('line-button line-highlight');
    expect(buttons[1].hasAttribute('aria-label')).to.be.false;
    expect(buttons[1].getAttribute('aria-description')).to.equal('codeBlockLineLabel:{"line":2}');
  });

  it('invokes onLineActivate/onLineKeyDown with the clicked/pressed line number', () => {
    const activated: number[] = [];
    const keyed: Array<{ key: string; line: number }> = [];
    const container = renderInto({
      code: 'a\nb',
      lineNumbers: true,
      interactiveLines: true,
      focusedLine: 1,
      highlightedLines: new Set(),
      activeLines: new Set(),
      localize,
      onLineActivate: (line) => activated.push(line),
      onLineKeyDown: (e, line) => keyed.push({ key: e.key, line }),
    });
    const buttons = container.querySelectorAll('button.line');
    (buttons[1] as HTMLButtonElement).click();
    buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(activated).to.deep.equal([2]);
    expect(keyed).to.deep.equal([{ key: 'ArrowDown', line: 1 }]);
  });
});
