import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './markdown.js';
import './markdown-core.js';
import '../code-block/code-block.js';
import '../code-block/code-block-core.js';
import type { LyraMarkdown } from './markdown.js';
import type { LyraMarkdownCore } from './markdown-core.js';
import { loadMarkdownDeps } from './markdown-loader.js';

const markdownTags = ['lr-markdown', 'lr-markdown-core'] as const;

type MarkdownElement = (LyraMarkdown | LyraMarkdownCore) & { content: string; streaming: boolean };

function rgb(color: string): readonly [number, number, number] {
  const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
  if (match) return [Number(match[1]), Number(match[2]), Number(match[3])];
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color.trim());
  if (hex) {
    const digits = hex[1]!.length === 3 ? [...hex[1]!].map((digit) => `${digit}${digit}`).join('') : hex[1]!;
    return [0, 2, 4].map((offset) => Number.parseInt(digits.slice(offset, offset + 2), 16)) as [number, number, number];
  }
  throw new Error(`Expected a computed RGB or hex color, got ${color}`);
}

function contrastRatio(first: string, second: string): number {
  const luminance = (color: string): number => {
    const channels = rgb(color).map((channel) => channel / 255).map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    );
    return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
  };
  const [high, low] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (high! + 0.05) / (low! + 0.05);
}

async function createMarkdown(tagName: (typeof markdownTags)[number], content: string): Promise<{ wrapper: HTMLElement; el: MarkdownElement }> {
  const wrapper = await fixture<HTMLElement>(html`<div></div>`);
  const el = document.createElement(tagName) as MarkdownElement;
  el.content = content;
  wrapper.append(el);
  return { wrapper, el };
}

describe('markdown presentation', () => {
  for (const tagName of markdownTags) {
    describe(tagName, () => {
      it('marks task items, removes their list markers, and styles read-only checkboxes in both themes', async () => {
        await loadMarkdownDeps();
        const { el } = await createMarkdown(tagName, '- [ ] An open task has enough words to wrap onto a second line while its checkbox stays at the start.\n- [x] Done item');
        el.style.inlineSize = '240px';
        await waitUntil(() => el.shadowRoot?.querySelector('input[type="checkbox"]') != null);

        const list = el.shadowRoot!.querySelector('[part~="list"]') as HTMLElement;
        const taskItems = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="task-item"]')];
        const listItems = [...list.querySelectorAll<HTMLElement>('li')];
        const checkbox = listItems[1]!.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
        expect(list.part.contains('task-list')).to.be.true;
        expect(taskItems).to.have.length(2);
        expect(taskItems.every((item) => item.part.contains('task-item'))).to.be.true;
        expect(getComputedStyle(listItems[0]!).listStyleType).to.equal('none');
        expect(checkbox.disabled).to.be.true;
        expect(checkbox.checked).to.be.true;
        const openText = [...listItems[0]!.childNodes].find((node) => node.nodeType === Node.TEXT_NODE)!;
        const openTextRange = document.createRange();
        openTextRange.selectNodeContents(openText);
        const textLines = [...openTextRange.getClientRects()];
        expect(textLines.length).to.be.greaterThan(1);
        expect(Math.abs(textLines[1]!.left - textLines[0]!.left)).to.be.at.most(8);

        for (const mode of ['light', 'dark']) {
          el.setAttribute('data-lr-theme', mode);
          const computed = getComputedStyle(checkbox);
          const surface = computed.getPropertyValue('--lr-color-surface').trim();
          expect(computed.appearance).to.equal('none');
          expect(computed.opacity).to.equal('1');
          expect(contrastRatio(computed.borderTopColor, surface)).to.be.at.least(3);
          expect(contrastRatio(computed.backgroundColor, surface)).to.be.at.least(3);
          const checkedFill = computed.backgroundColor;
          const checkmark = getComputedStyle(checkbox, '::before');
          expect(contrastRatio(checkmark.borderInlineEndColor, checkedFill)).to.be.at.least(3);
          el.dir = 'rtl';
          const rtlCheckmark = getComputedStyle(checkbox, '::before');
          expect(Number.parseFloat(rtlCheckmark.borderRightWidth)).to.be.greaterThan(0);
          expect(rtlCheckmark.borderLeftWidth).to.equal('0px');
          el.dir = 'ltr';
          checkbox.checked = false;
          const unchecked = getComputedStyle(checkbox);
          expect(contrastRatio(unchecked.borderTopColor, surface)).to.be.at.least(3);
          expect(unchecked.backgroundColor).to.not.equal(checkedFill);
          checkbox.checked = true;
          await el.updateComplete;
        }
      });

      it('marks mixed and nested task lists without changing ordinary sibling markers, including an empty task', async () => {
        await loadMarkdownDeps();
        const { el } = await createMarkdown(tagName, '- [ ] Task\n  - [x] Nested task\n- [ ] ![](javascript:bad)\n- Ordinary item');
        await waitUntil(() => el.shadowRoot?.querySelector('input[type="checkbox"]') != null);
        const lists = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="list"]')];
        const tasks = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="task-item"]')];
        const ordinary = [...el.shadowRoot!.querySelectorAll<HTMLElement>('li')].find((item) => item.textContent?.includes('Ordinary item'))!;
        expect(lists[0]!.part.contains('task-list')).to.be.false;
        expect(lists[1]!.part.contains('task-list')).to.be.true;
        expect(tasks).to.have.length(3);
        expect(tasks.some((item) => {
          const label = item.querySelector<HTMLInputElement>('input[type="checkbox"]')?.getAttribute('aria-label');
          return label == null || label.trim() === '';
        })).to.be.true;
        expect(ordinary.part.contains('task-item')).to.be.false;
        expect(getComputedStyle(ordinary).listStyleType).to.not.equal('none');
      });

      it('gives wide tables a logical inline scrollport without splitting short words', async () => {
        await loadMarkdownDeps();
        const content = `| Description | Type | Details |\n| --- | --- | --- |\n| ${'A long phrase for a narrow table column '.repeat(3)}Pneumonoultramicroscopicsilicovolcanoconiosis | Median | ${'Another extended phrase that needs room '.repeat(3)} |`;
        const wrapper = await fixture<HTMLElement>(html`<div dir="rtl" style="inline-size: 240px"></div>`);
        const el = document.createElement(tagName) as MarkdownElement;
        el.content = content;
        wrapper.append(el);
        await waitUntil(() => el.shadowRoot?.querySelector('[part="table"]') != null);

        const table = el.shadowRoot!.querySelector('[part="table"]') as HTMLElement;
        const scrollport = table.parentElement as HTMLElement;
        expect(scrollport.getAttribute('part')).to.equal('table-wrapper');
        const typeCell = [...table.querySelectorAll<HTMLElement>('td')].find((cell) => cell.textContent === 'Median')!;
        expect(getComputedStyle(scrollport).overflowX).to.equal('auto');
        expect(scrollport.clientWidth).to.be.lessThan(table.scrollWidth);
        expect(getComputedStyle(table).direction).to.equal('rtl');
        expect(getComputedStyle(typeCell).overflowWrap).to.equal('break-word');
        expect(getComputedStyle(typeCell).wordBreak).to.equal('normal');
        const medianRange = document.createRange();
        medianRange.selectNodeContents(typeCell);
        expect(medianRange.getClientRects().length).to.equal(1);
        expect(scrollport.tabIndex).to.equal(0);
        scrollport.focus();
        expect(el.shadowRoot!.activeElement === scrollport).to.be.true;
      });

      it('isolates inline and block code as left-to-right inside RTL prose', async () => {
        await loadMarkdownDeps();
        const wrapper = await fixture<HTMLElement>(html`<div dir="rtl"></div>`);
        const el = document.createElement(tagName) as MarkdownElement;
        el.content = 'Text `left();`\n\n```js\nleft();\n```';
        wrapper.append(el);
        await waitUntil(() => el.shadowRoot?.querySelector('[part="code-block"]') != null);

        const inline = el.shadowRoot!.querySelector('[part="inline-code"]') as HTMLElement;
        const block = el.shadowRoot!.querySelector('[part="code-block"]') as HTMLElement;
        for (const code of [inline, block]) {
          expect(getComputedStyle(code).direction).to.equal('ltr');
          expect(getComputedStyle(code).unicodeBidi).to.equal('isolate');
        }
        expect(getComputedStyle(block).textAlign).to.equal('start');
      });

      it('renders streaming fallback content without template whitespace', async () => {
        const content = 'First streamed line\nsecond line';
        const { el } = await createMarkdown(tagName, content);
        el.streaming = true;
        await waitUntil(() => el.shadowRoot?.querySelector('[part="content"][data-fallback]') != null);
        const fallback = el.shadowRoot!.querySelector('[part="content"]')!;
        expect(fallback.textContent).to.equal(content);
      });
    });
  }
});

describe('code block direction in RTL documents', () => {
  for (const tagName of ['lr-code-block', 'lr-code-block-core'] as const) {
    it(`${tagName} keeps source left-to-right and isolated`, async () => {
      const wrapper = await fixture<HTMLElement>(html`<div dir="rtl"></div>`);
      const el = document.createElement(tagName) as HTMLElement & { code: string };
      el.code = 'const punctuation = "left();";';
      wrapper.append(el);
      await waitUntil(() => el.shadowRoot?.querySelector('[part="pre"] code') != null);
      const pre = el.shadowRoot!.querySelector('[part="pre"]') as HTMLElement;
      expect(getComputedStyle(pre).direction).to.equal('ltr');
      expect(getComputedStyle(pre).unicodeBidi).to.equal('isolate');
    });
  }
});
