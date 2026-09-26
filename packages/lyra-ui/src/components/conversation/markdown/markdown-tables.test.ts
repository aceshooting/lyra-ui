import { fixture, html, expect, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { setForcedColors } from '../../../../test/wtr-media.js';
import { LYRA_DEFAULT_STRINGS, registerLyraLocale } from '../../../internal/localization.js';
import './markdown.js';
import './markdown-core.js';
import type { LyraMarkdown } from './markdown.js';

describe('GFM table wrapper', () => {
  for (const name of ['lr-markdown', 'lr-markdown-core'] as const) {
    it(`${name} names its scroll stop and relabels it without replacing table nodes`, async () => {
      const host = await fixture<HTMLElement>(html`<div style="inline-size: 320px"></div>`);
      const el = document.createElement(name) as LyraMarkdown;
      el.content = '| Name | Number |\n| :--- | ---: |\n| LongUnbreakableColumnHeadingLongUnbreakableColumnHeading | 42 |';
      host.append(el);
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('table')));
      const root = el.shadowRoot!;
      const table = root.querySelector('table')!;
      const wrapper = root.querySelector<HTMLElement>('[part="table-wrapper"]')!;
      expect(wrapper.getAttribute('role')).to.equal('group');
      expect(wrapper.getAttribute('aria-label')).to.equal('Table');
      expect(wrapper.tabIndex).to.equal(0);
      expect(wrapper.scrollWidth).to.be.greaterThan(wrapper.clientWidth);
      expect(getComputedStyle(table).wordBreak).to.equal('normal');
      expect(getComputedStyle(table).overflowWrap).to.equal('break-word');
      expect(getComputedStyle(root.querySelector('th[align="right"]')!).textAlign).to.match(/right$/);
      el.strings = { markdownTableRegion: 'Custom table' };
      await el.updateComplete;
      expect(wrapper.getAttribute('aria-label')).to.equal('Custom table');
      expect(root.querySelector('table') === table).to.equal(true);
      await expect(el).to.be.accessible();
    });
    it(`${name} leaves unwrapped tables and forged generic wrappers unchanged`, async () => {
      const host = await fixture<HTMLElement>(html`<div></div>`);
      const el = document.createElement(name) as LyraMarkdown;
      el.content = '<div part="table-wrapper">authored</div>\n\n<table part="table"><tr><td>authored</td></tr></table>';
      host.append(el);
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('table')));
      expect(el.shadowRoot!.querySelector('[part="table-wrapper"]')?.hasAttribute('aria-label')).to.equal(false);
      expect(getComputedStyle(el.shadowRoot!.querySelector('table')!).overflowWrap).to.equal('anywhere');
    });
  }
});

const WIDE = [
  '| Identifier | Region | Owner | Created | Status | Checksum |',
  '| --- | --- | --- | --- | --- | --- |',
  '| svc-authentication-gateway-primary | eu-central-1 | platform-infrastructure-team | 2026-09-25T10:00:00Z | operational | 9f86d081884c7d659a2feaa0c55ad015 |',
].join('\n');
const FITTING = '| A | B |\n| --- | --- |\n| 1 | 2 |';

async function mountTable(name: string, content: string, width = 390, dir: 'ltr' | 'rtl' = 'ltr', props: Partial<LyraMarkdown> = {}): Promise<{ host: HTMLElement; el: LyraMarkdown }> {
  const host = await fixture<HTMLElement>(html`<div dir=${dir} style=${`inline-size: ${width}px`}></div>`);
  const el = document.createElement(name) as LyraMarkdown;
  Object.assign(el, props);
  el.content = content;
  host.append(el);
  await waitUntil(() => Boolean(el.shadowRoot?.querySelector('table')));
  return { host, el };
}
const wrapperOf = (el: LyraMarkdown): HTMLElement => el.shadowRoot!.querySelector<HTMLElement>('[part="table-wrapper"]')!;

describe('GFM table wrapper: layout, keyboard and reach', () => {
  for (const name of ['lr-markdown', 'lr-markdown-core'] as const) {
    for (const width of [390, 391, 777, 1001]) {
      it(`${name} keeps a fitting table full width with no scrollbar at ${width}px`, async () => {
        const { el } = await mountTable(name, FITTING, width);
        const wrapper = wrapperOf(el);
        expect(wrapper.scrollWidth - wrapper.clientWidth).to.equal(0);
        expect(wrapper.scrollHeight - wrapper.clientHeight).to.equal(0);
        expect(Math.abs(el.shadowRoot!.querySelector('table')!.getBoundingClientRect().width - wrapper.clientWidth)).to.be.at.most(1);
      });
    }

    for (const dir of ['ltr', 'rtl'] as const) {
      it(`${name} makes the wrapper one tab stop that arrow keys scroll (${dir})`, async () => {
        const host = await fixture<HTMLElement>(html`<div dir=${dir} style="inline-size: 390px">
          <button id="before">before</button><span id="slot"></span><button id="after">after</button>
        </div>`);
        const el = document.createElement(name) as LyraMarkdown;
        el.content = WIDE;
        host.querySelector('#slot')!.append(el);
        await waitUntil(() => Boolean(el.shadowRoot?.querySelector('table')));
        host.querySelector<HTMLButtonElement>('#before')!.focus();
        const stops: string[] = [];
        for (let i = 0; i < 3; i++) {
          await sendKeys({ press: 'Tab' });
          const inner = el.shadowRoot!.activeElement as HTMLElement | null;
          stops.push(document.activeElement === el ? inner?.getAttribute('part') ?? 'host' : document.activeElement?.id ?? '');
        }
        expect(stops).to.deep.equal(['content', 'table-wrapper', 'after']);
        await sendKeys({ press: 'Shift+Tab' });
        const wrapper = wrapperOf(el);
        expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('table-wrapper');
        const outline = getComputedStyle(wrapper);
        expect(outline.outlineStyle).to.equal('solid');
        expect(parseFloat(outline.outlineWidth)).to.be.greaterThan(0);
        const key = dir === 'ltr' ? 'ArrowRight' : 'ArrowLeft';
        for (let i = 0; i < 3; i++) await sendKeys({ press: key });
        await waitUntil(() => Math.abs(wrapper.scrollLeft) > 0, 'arrow keys never scrolled the wrapper');
        if (dir === 'rtl') expect(wrapper.scrollLeft).to.be.lessThan(0);
      });
    }

    it(`${name} relabels the wrapper for locale registrations and new content without reparsing`, async () => {
      const tag = 'fr-x-lrtables';
      registerLyraLocale(tag, { ...LYRA_DEFAULT_STRINGS, markdownTableRegion: 'Tableau' });
      try {
        const { host, el } = await mountTable(name, FITTING);
        const wrapper = wrapperOf(el) as HTMLElement & { marker?: string };
        wrapper.marker = 'kept';
        expect(wrapper.getAttribute('aria-label')).to.equal('Table');
        host.lang = tag;
        await waitUntil(() => wrapper.getAttribute('aria-label') === 'Tableau', 'ancestor lang switch never relabeled');
        registerLyraLocale(tag, { markdownTableRegion: 'Grille' });
        await waitUntil(() => wrapper.getAttribute('aria-label') === 'Grille', 'registration never relabeled');
        expect(wrapperOf(el) === wrapper && wrapper.marker === 'kept').to.equal(true);
        el.content = `${FITTING}\n\nnew`;
        await waitUntil(() => el.shadowRoot!.textContent!.includes('new'));
        await el.updateComplete;
        expect(wrapperOf(el).getAttribute('aria-label')).to.equal('Grille');
      } finally {
        registerLyraLocale(tag, { markdownTableRegion: 'Tableau' });
      }
    });

    it(`${name} resolves no table label for a table-free document under an uncatalogued lang`, async () => {
      // devWarnOnce memoizes (locale, key) page-wide in Lit's `litIssuedWarnings` set, so a retried
      // attempt or the other loop iteration would otherwise hide both the regression and the
      // positive control below. Forget this tag's memo entry for the duration of the test.
      const tag = 'ar';
      const memoKey = `lyra-locale-fallback:${tag}:markdownTableRegion`;
      const issued = (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings;
      expect(issued, 'dev-mode warning memo').to.not.equal(undefined);
      const hadMemo = issued!.delete(memoKey);
      const warnings: string[] = [];
      const originalWarn = console.warn;
      console.warn = (...args: unknown[]) => {
        warnings.push(args.map(String).join(' '));
      };
      try {
        const host = await fixture<HTMLElement>(html`<div lang=${tag}></div>`);
        const el = document.createElement(name) as LyraMarkdown;
        el.content = '# Heading\n\nA paragraph with `code` and **no** tables.';
        host.append(el);
        await waitUntil(() => Boolean(el.shadowRoot?.querySelector('h1')));
        await el.updateComplete;
        el.content = 'Still no table.';
        await waitUntil(() => el.shadowRoot!.textContent!.includes('Still no table.'));
        await el.updateComplete;
        expect(warnings.filter((w) => w.includes('markdownTableRegion')).length).to.equal(0);
        // Positive control: once a wrapped table appears, the label is resolved (and, with no
        // catalog for this tag, the fallback warning the spy would otherwise have seen fires).
        el.content = FITTING;
        await waitUntil(() => Boolean(el.shadowRoot?.querySelector('[part="table-wrapper"]')));
        await el.updateComplete;
        expect(wrapperOf(el).getAttribute('aria-label')).to.equal('Table');
        expect(warnings.filter((w) => w.includes('markdownTableRegion')).length).to.equal(1);
      } finally {
        console.warn = originalWarn;
        if (hadMemo) issued!.add(memoKey);
      }
    });

    it(`${name} labels a table that appears after a table-free first render in the catalog's language`, async () => {
      const tag = 'fr-x-latetbl';
      registerLyraLocale(tag, { ...LYRA_DEFAULT_STRINGS, markdownTableRegion: 'Tableau' });
      const host = await fixture<HTMLElement>(html`<div lang=${tag}></div>`);
      const el = document.createElement(name) as LyraMarkdown;
      el.content = 'No table yet.';
      host.append(el);
      await waitUntil(() => el.shadowRoot!.textContent!.includes('No table yet.'));
      await el.updateComplete;
      el.content = FITTING;
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('[part="table-wrapper"]')));
      await el.updateComplete;
      expect(wrapperOf(el).getAttribute('aria-label')).to.equal('Tableau');
      registerLyraLocale(tag, { markdownTableRegion: 'Grille' });
      await waitUntil(() => wrapperOf(el).getAttribute('aria-label') === 'Grille', 'registration never relabeled');
      registerLyraLocale(tag, { markdownTableRegion: 'Tableau' });
    });

    it(`${name} keeps both escape hatches and wrapper reach through ::part()`, async () => {
      const style = document.createElement('style');
      style.textContent = `
        ${name}.anywhere::part(table) { overflow-wrap: anywhere }
        ${name}.keep::part(table) { word-break: keep-all }
        ${name}::part(table-wrapper) { outline-style: dotted }
      `;
      document.head.append(style);
      try {
        const { el } = await mountTable(name, WIDE);
        el.classList.add('anywhere');
        expect(getComputedStyle(el.shadowRoot!.querySelector('td')!).overflowWrap).to.equal('anywhere');
        el.classList.replace('anywhere', 'keep');
        (el.parentElement as HTMLElement).style.wordBreak = 'keep-all';
        expect(getComputedStyle(el.shadowRoot!.querySelector('td')!).wordBreak).to.equal('keep-all');
        expect(getComputedStyle(wrapperOf(el)).outlineStyle).to.equal('dotted');
      } finally {
        style.remove();
      }
    });

    for (const htmlMode of ['sanitize', 'escape', 'trusted'] as const) {
      it(`${name} keeps the wrapper semantics and column alignment in ${htmlMode} mode`, async () => {
        const { el } = await mountTable(name, '| L | C | R | N |\n| :-- | :-: | --: | --- |\n| 1 | 2 | 3 | 4 |', 390, 'ltr', { htmlMode });
        const wrapper = wrapperOf(el);
        expect([wrapper.getAttribute('role'), wrapper.getAttribute('tabindex')]).to.deep.equal(['group', '0']);
        expect([...el.shadowRoot!.querySelectorAll('td')].map((cell) => cell.getAttribute('align'))).to.deep.equal(['left', 'center', 'right', null]);
      });
    }

    it(`${name} paints the focused wrapper outline in Highlight under forced colors`, async function () {
      try {
        await setForcedColors('active');
      } catch {
        this.skip();
      }
      try {
        if (!matchMedia('(forced-colors: active)').matches) this.skip();
        const { el } = await mountTable(name, WIDE);
        const probe = document.createElement('span');
        probe.style.color = 'Highlight';
        document.body.append(probe);
        const highlight = getComputedStyle(probe).color;
        probe.remove();
        wrapperOf(el).focus();
        await sendKeys({ press: 'Shift' });
        expect(getComputedStyle(wrapperOf(el)).outlineColor).to.equal(highlight);
      } finally {
        await setForcedColors('none');
      }
    });

    it(`${name} keeps unwrapped tables wrapping inside the content`, async () => {
      const cell = '<td>svc-authentication-gateway-primary-platform-infrastructure-team-9f86d081884c7d659a2feaa0c55ad015</td>';
      const cases: Array<[string, Partial<LyraMarkdown>]> = [
        [`<table><tr>${cell}</tr></table>`, { htmlMode: 'sanitize' }],
        [`<table><tr>${cell}</tr></table>`, { htmlMode: 'trusted' }],
        [`<table part="table"><tr>${cell}</tr></table>\n\nAfter\n\nEnd`, { htmlMode: 'sanitize' }],
        [`<table part="table"><tr>${cell}</tr></table>\n\nAfter\n\nEnd`, { htmlMode: 'trusted' }],
        [WIDE, { htmlMode: 'sanitize' }],
      ];
      for (const [index, [content, props]] of cases.entries()) {
        const { el } = await mountTable(name, content, 390, 'ltr', props);
        if (index === cases.length - 1) {
          // A consumer table renderer bypasses the built-in scroller entirely.
          el.marked!.use({ renderer: { table: () => `<table part='table'><tr>${cell}</tr></table>\n` } });
          el.renderMarkdown();
          await waitUntil(() => !el.shadowRoot!.querySelector('[part="table-wrapper"]'), 'custom renderer output never replaced the wrapper');
        }
        const root = el.shadowRoot!;
        const contentPart = root.querySelector<HTMLElement>('[part="content"]')!;
        expect(Boolean(root.querySelector('table')!.closest('[part="table-wrapper"]')), `case ${index}`).to.equal(false);
        expect(getComputedStyle(root.querySelector('td')!).overflowWrap, `case ${index}`).to.equal('anywhere');
        expect(contentPart.scrollWidth - contentPart.clientWidth, `case ${index}`).to.be.at.most(0);
        if (content.includes('After')) {
          const paragraph = root.querySelector('p')!;
          expect(getComputedStyle(root.querySelector('table')!).marginBlockEnd, `case ${index}`).to.equal(getComputedStyle(paragraph).marginBlockEnd);
        }
      }
    });
  }
});

const REPORT = [
  '| Check | Owner | Guidance |',
  '| --- | --- | --- |',
  '| Use the median latency for this report whenever the regional sample is small | Platform | Measure the median and mean response times across every region before comparing releases |',
  '| This column documents the expected behaviour of the gateway under sustained load | Runtime | Median values stay below the documented ceiling for the whole observation window |',
].join('\n');

/** The rounded line top of the code unit at `index` in `node`. */
function lineTop(node: Text, index: number): number {
  const range = document.createRange();
  range.setStart(node, index);
  range.setEnd(node, index + 1);
  return Math.round(range.getBoundingClientRect().top);
}

/** Table-cell words (whitespace-delimited runs) broken mid-letter across lines. A line break right
 *  after a hyphen is an ordinary soft-wrap opportunity, not a split word. */
function splitWords(root: ParentNode): string[] {
  const split: string[] = [];
  for (const cell of root.querySelectorAll('th, td')) {
    const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      for (const match of node.data.matchAll(/\S+/g)) {
        const start = match.index!;
        for (let index = start + 1; index < start + match[0].length; index++) {
          if (lineTop(node, index) !== lineTop(node, index - 1) && node.data[index - 1] !== '-') {
            split.push(match[0]);
            break;
          }
        }
      }
    }
  }
  return split;
}

describe('GFM table wrapper: word integrity, margins and intrinsic size', () => {
  for (const name of ['lr-markdown', 'lr-markdown-core'] as const) {
    for (const dir of ['ltr', 'rtl'] as const) {
      for (const width of [1440, 390, 320]) {
        it(`${name} splits no report-table word at ${width}px (${dir})`, async () => {
          const { el } = await mountTable(name, REPORT, width, dir);
          const td = el.shadowRoot!.querySelector('td')!;
          expect([getComputedStyle(td).overflowWrap, getComputedStyle(td).wordBreak]).to.deep.equal(['break-word', 'normal']);
          expect(splitWords(el.shadowRoot!)).to.deep.equal([]);
        });
      }

      for (const width of [390, 320]) {
        it(`${name} scrolls a wide identifier table inside its wrapper at ${width}px (${dir})`, async () => {
          const { el } = await mountTable(name, WIDE, width, dir);
          const wrapper = wrapperOf(el);
          const content = el.shadowRoot!.querySelector<HTMLElement>('[part="content"]')!;
          expect(splitWords(el.shadowRoot!)).to.deep.equal([]);
          expect(wrapper.scrollWidth - wrapper.clientWidth).to.be.greaterThan(0);
          expect(content.scrollWidth - content.clientWidth).to.be.at.most(0);
          // Scroll to the inline end; RTL scroll offsets run negative in every current engine.
          wrapper.scrollLeft = dir === 'ltr' ? wrapper.scrollWidth : -wrapper.scrollWidth;
          const table = el.shadowRoot!.querySelector('table')!;
          const farEdge = (): number => {
            const [t, w] = [table.getBoundingClientRect(), wrapper.getBoundingClientRect()];
            return dir === 'ltr' ? Math.abs(t.right - (w.left + wrapper.clientLeft + wrapper.clientWidth)) : Math.abs(t.left - (w.left + wrapper.clientLeft));
          };
          await waitUntil(() => farEdge() <= 1, `table far edge never met the wrapper's (${farEdge()}px)`);
        });
      }
    }

    it(`${name} splits no word under an inherited break-all / anywhere ancestor`, async () => {
      const host = await fixture<HTMLElement>(html`<div style="inline-size: 390px; word-break: break-all; overflow-wrap: anywhere"></div>`);
      const el = document.createElement(name) as LyraMarkdown;
      el.content = REPORT;
      host.append(el);
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('table')));
      expect(splitWords(el.shadowRoot!)).to.deep.equal([]);
    });

    it(`${name} ends a table-only document flush and spaces a following paragraph`, async () => {
      const probe = document.createElement('span');
      probe.style.marginBlockEnd = 'var(--lr-space-s)';
      const { el } = await mountTable(name, FITTING);
      el.shadowRoot!.append(probe);
      const spaceS = getComputedStyle(probe).marginBlockEnd;
      probe.remove();
      expect(parseFloat(spaceS)).to.be.greaterThan(0);
      expect([getComputedStyle(wrapperOf(el)).marginBlockEnd, getComputedStyle(el.shadowRoot!.querySelector('table')!).marginBlockEnd]).to.deep.equal(['0px', '0px']);
      el.content = `${FITTING}\n\nAfter`;
      await waitUntil(() => Boolean(el.shadowRoot!.querySelector('p')));
      expect(getComputedStyle(wrapperOf(el)).marginBlockEnd).to.equal(spaceS);
    });

    it(`${name} keeps a 1fr grid item at its track size with a wide table`, async () => {
      const host = await fixture<HTMLElement>(html`<div style="display: grid; grid-template-columns: 1fr; inline-size: 390px"></div>`);
      const el = document.createElement(name) as LyraMarkdown;
      el.content = WIDE;
      host.append(el);
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('table')));
      expect(Math.round(el.getBoundingClientRect().width)).to.equal(390);
      expect(wrapperOf(el).scrollWidth - wrapperOf(el).clientWidth).to.be.greaterThan(0);
    });

    it(`${name} never names forged wrappers next to a real one`, async () => {
      const { el } = await mountTable(name, `${FITTING}\n\n<div part="table-wrapper">x</div>\n\n<div part="table-wrapper"></div>`, 390, 'ltr', { htmlMode: 'sanitize' });
      await el.updateComplete;
      const wrappers = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="table-wrapper"]')];
      expect(wrappers.map((wrapper) => wrapper.getAttribute('aria-label'))).to.deep.equal(['Table', null, null]);
      await expect(el).to.be.accessible();
    });
  }

  it('keeps an lr-agent-workspace host at 390px when an assistant message holds a wide table', async () => {
    await import('../agent-workspace/agent-workspace.js');
    const host = await fixture<HTMLElement>(html`<div style="inline-size: 390px"></div>`);
    const workspace = document.createElement('lr-agent-workspace');
    workspace.messages = [{ id: 'm1', role: 'assistant', text: WIDE }];
    host.append(workspace);
    const findMarkdown = (root: ParentNode): LyraMarkdown | null => {
      for (const node of root.querySelectorAll('*')) {
        if (node.localName === 'lr-markdown') return node as LyraMarkdown;
        const nested = node.shadowRoot ? findMarkdown(node.shadowRoot) : null;
        if (nested) return nested;
      }
      return null;
    };
    await waitUntil(() => Boolean(findMarkdown(workspace.shadowRoot ?? workspace)?.shadowRoot?.querySelector('[part="table-wrapper"]')), 'composed table never rendered', { timeout: 5000 });
    const markdown = findMarkdown(workspace.shadowRoot!)!;
    const content = markdown.shadowRoot!.querySelector<HTMLElement>('[part="content"]')!;
    expect(Math.round(host.getBoundingClientRect().width)).to.equal(390);
    expect(Math.round(workspace.getBoundingClientRect().width)).to.be.at.most(390);
    expect(content.scrollWidth - content.clientWidth).to.be.at.most(0);
    expect(wrapperOf(markdown).scrollWidth - wrapperOf(markdown).clientWidth).to.be.greaterThan(0);
  });
});
