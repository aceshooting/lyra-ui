import { fixture, html, expect, waitUntil } from '@open-wc/testing';
import { setForcedColors } from '../../../../test/wtr-media.js';
import './markdown.js';
import './markdown-core.js';
import type { LyraMarkdown } from './markdown.js';

describe('GFM task items', () => {
  for (const name of ['lr-markdown', 'lr-markdown-core'] as const) {
    for (const htmlMode of ['sanitize', 'escape', 'trusted'] as const) {
      it(`${name} exposes completed state and preserves ordered numerals in ${htmlMode}`, async () => {
        const host = await fixture<HTMLElement>(html`<div></div>`);
        const el = document.createElement(name) as LyraMarkdown;
        el.htmlMode = htmlMode;
        el.content = '- [ ] Open\n- [x] Done\n\n1. [x] Ordered\n2. [ ] Next';
        host.append(el);
        await waitUntil(() => el.shadowRoot?.querySelectorAll('input').length === 4);
        const root = el.shadowRoot!;
        expect(root.querySelector('ul')?.getAttribute('role')).to.equal('list');
        expect(root.querySelectorAll('[part~="task-list"]').length).to.equal(2);
        expect(root.querySelectorAll('[part~="task-item-checked"]').length).to.equal(2);
        expect(root.querySelectorAll('[part="task-checkbox"]:disabled').length).to.equal(4);
        expect(getComputedStyle(root.querySelector('ol > li')!).listStyleType).to.equal('decimal');
        expect(getComputedStyle(root.querySelector('ul > li')!).listStyleType).to.equal('none');
        expect(root.querySelector('li')?.textContent).to.equal('Open');
        await expect(el).to.be.accessible();
      });
    }
    it(`${name} follows the checkbox size property without shifting task text away from sibling prose`, async () => {
      const host = await fixture<HTMLElement>(html`<div dir="rtl"></div>`);
      const el = document.createElement(name) as LyraMarkdown;
      el.content = '- Ordinary\n- [x] Task';
      el.style.setProperty('--lr-markdown-task-checkbox-size', '1.5em');
      host.append(el);
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('input')));
      const checkbox = el.shadowRoot!.querySelector<HTMLInputElement>('input')!;
      const style = getComputedStyle(checkbox);
      expect(parseFloat(style.inlineSize)).to.be.closeTo(parseFloat(style.fontSize) * 1.5, 0.5);
      expect(style.opacity).to.equal('1');
      expect(style.getPropertyValue('print-color-adjust') || style.getPropertyValue('-webkit-print-color-adjust')).to.equal('exact');
      expect(getComputedStyle(checkbox, '::before').direction).to.equal('ltr');
    });
  }
});

function textRect(root: Node, needle: string): DOMRect {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const index = (node as Text).data.indexOf(needle);
    if (index === -1) continue;
    const range = document.createRange();
    range.setStart(node, index);
    range.setEnd(node, index + needle.length);
    return range.getClientRects()[0] ?? range.getBoundingClientRect();
  }
  throw new Error(`text ${JSON.stringify(needle)} not rendered`);
}

function contentBox(el: Element): { start: number; end: number } {
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return {
    start: rect.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft),
    end: rect.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight),
  };
}

async function mountTasks(name: string, content: string, dir: 'ltr' | 'rtl' = 'ltr', hostStyle = ''): Promise<LyraMarkdown> {
  const host = await fixture<HTMLElement>(html`<div dir=${dir} style=${`inline-size: 480px; ${hostStyle}`}></div>`);
  const el = document.createElement(name) as LyraMarkdown;
  el.content = content;
  host.append(el);
  await waitUntil(() => Boolean(el.shadowRoot?.querySelector('input')));
  return el;
}

function luminance(color: string): number {
  const [r, g, b] = (color.match(/[\d.]+/g) ?? []).slice(0, 3).map((part) => {
    const channel = Number(part) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const contrast = (a: string, b: string): number => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
};

describe('GFM task items: geometry, tokens and parts', () => {
  for (const name of ['lr-markdown', 'lr-markdown-core'] as const) {
    for (const dir of ['ltr', 'rtl'] as const) {
      for (const loose of [false, true]) {
        it(`${name} hangs the checkbox in the bullet gutter (${dir}, ${loose ? 'loose' : 'tight'})`, async () => {
          const el = await mountTasks(name, loose ? '- Ordinary\n\n- [ ] Task\n' : '- Ordinary\n- [ ] Task\n', dir);
          const root = el.shadowRoot!;
          const checkbox = root.querySelector<HTMLInputElement>('[part~="task-checkbox"]')!.getBoundingClientRect();
          const item = contentBox(root.querySelector('[part~="task-item"]')!);
          const list = root.querySelector('ul')!.getBoundingClientRect();
          const task = textRect(root, 'Task');
          const sibling = textRect(root, 'Ordinary');
          if (dir === 'ltr') {
            expect(Math.abs(task.left - sibling.left)).to.be.at.most(1);
            expect(checkbox.right).to.be.at.most(item.start + 0.5);
            expect(checkbox.left).to.be.at.least(list.left - 0.5);
          } else {
            expect(Math.abs(task.right - sibling.right)).to.be.at.most(1);
            expect(checkbox.left).to.be.at.least(item.end - 0.5);
            expect(checkbox.right).to.be.at.most(list.right + 0.5);
          }
          const middle = (rect: DOMRect): number => rect.top + rect.height / 2;
          expect(Math.abs(middle(checkbox) - middle(task))).to.be.at.most(0.25 * checkbox.height);
        });
      }
    }

    it(`${name} keeps an ordered task checkbox inline after the numeral`, async () => {
      const el = await mountTasks(name, '1. Plain\n2. [x] Task\n');
      const root = el.shadowRoot!;
      const items = root.querySelectorAll('li');
      const checkbox = root.querySelector('[part~="task-checkbox"]')!.getBoundingClientRect();
      expect(checkbox.left).to.be.at.least(contentBox(items[1]!).start - 0.5);
    });

    it(`${name} wires the checkbox paint to theme tokens and beats a UA disabled fade`, async () => {
      const el = await mountTasks(name, '- [ ] Open\n- [x] Done\n');
      el.style.setProperty('--lr-theme-color-surface-border', 'rgb(1, 2, 3)');
      el.style.setProperty('--lr-theme-color-surface-default', 'rgb(10, 11, 12)');
      el.style.setProperty('--lr-theme-color-brand-fill-loud', 'rgb(4, 5, 6)');
      el.style.setProperty('--lr-theme-color-brand-on-loud', 'rgb(7, 8, 9)');
      const root = el.shadowRoot!;
      const [open, done] = [...root.querySelectorAll<HTMLInputElement>('[part~="task-checkbox"]')];
      const openStyle = getComputedStyle(open!);
      expect(openStyle.borderTopColor).to.equal('rgb(1, 2, 3)');
      expect(openStyle.backgroundColor).to.equal('rgb(10, 11, 12)');
      expect(openStyle.appearance).to.equal('none');
      expect(openStyle.fontSize).to.equal(getComputedStyle(root.querySelector('li')!).fontSize);
      expect(openStyle.getPropertyValue('print-color-adjust')).to.equal('exact');
      const doneStyle = getComputedStyle(done!);
      expect(doneStyle.backgroundColor).to.equal('rgb(4, 5, 6)');
      expect(doneStyle.borderTopColor).to.equal('rgb(4, 5, 6)');
      const check = getComputedStyle(done!, '::before');
      expect(check.borderRightColor).to.equal('rgb(7, 8, 9)');
      expect(check.getPropertyValue('print-color-adjust')).to.equal('exact');
      const original = root.adoptedStyleSheets;
      const fade = new CSSStyleSheet();
      fade.replaceSync(':where(input:disabled) { opacity: 0.4 }');
      try {
        root.adoptedStyleSheets = [fade, ...original];
        expect(getComputedStyle(open!).opacity).to.equal('1');
      } finally {
        root.adoptedStyleSheets = original;
      }
    });

    it(`${name} keeps default checkbox contrast at 3:1 in light and dark`, async () => {
      const pairs: string[][] = [];
      for (const theme of ['light', 'dark'] as const) {
        const el = await mountTasks(name, '- [ ] Open\n- [x] Done\n');
        if (theme === 'dark') el.setAttribute('data-lr-theme', 'dark');
        await el.updateComplete;
        const [open, done] = [...el.shadowRoot!.querySelectorAll<HTMLInputElement>('[part~="task-checkbox"]')];
        const edge = getComputedStyle(open!).borderTopColor;
        const fill = getComputedStyle(open!).backgroundColor;
        const checked = getComputedStyle(done!).backgroundColor;
        const mark = getComputedStyle(done!, '::before').borderRightColor;
        expect(contrast(edge, fill), `${theme} edge`).to.be.at.least(3);
        expect(contrast(checked, fill), `${theme} checked fill`).to.be.at.least(3);
        expect(contrast(mark, checked), `${theme} check`).to.be.at.least(3);
        pairs.push([edge, fill, checked, mark]);
      }
      expect(JSON.stringify(pairs[0])).not.to.equal(JSON.stringify(pairs[1]));
    });

    it(`${name} maps the checkbox to system colors under forced colors`, async function () {
      try {
        await setForcedColors('active');
      } catch {
        this.skip();
      }
      try {
        if (!matchMedia('(forced-colors: active)').matches) this.skip();
        const el = await mountTasks(name, '- [ ] Open\n- [x] Done\n');
        const probe = (color: string): string => {
          const span = document.createElement('span');
          span.style.color = color;
          document.body.append(span);
          const value = getComputedStyle(span).color;
          span.remove();
          return value;
        };
        const [open, done] = [...el.shadowRoot!.querySelectorAll<HTMLInputElement>('[part~="task-checkbox"]')];
        expect(getComputedStyle(done!).backgroundColor).to.equal(probe('LinkText'));
        expect(getComputedStyle(open!).borderTopColor).to.equal(probe('ButtonText'));
        expect(getComputedStyle(done!, '::before').borderRightColor).to.equal(probe('Canvas'));
      } finally {
        await setForcedColors('none');
      }
    });

    it(`${name} exposes every task part to outer ::part() rules`, async () => {
      const style = document.createElement('style');
      style.textContent = `
        ${name}::part(task-item) { outline-style: dotted }
        ${name}::part(task-list) { outline-style: dashed }
        ${name}::part(task-checkbox):checked { outline-style: solid }
        ${name}::part(task-item-checked) { text-decoration-line: line-through }
        ${name}::part(list) { outline-color: rgb(1, 2, 3) }
      `;
      document.head.append(style);
      try {
        const el = await mountTasks(name, '- [ ] Open\n- [x] Done\n\n1. Plain\n2. [x] Ordered done\n3. [ ] Ordered open\n');
        const root = el.shadowRoot!;
        const allTask = root.querySelector('ul')!;
        expect(getComputedStyle(allTask).outlineStyle).to.equal('dashed');
        expect(getComputedStyle(allTask).outlineColor).to.equal('rgb(1, 2, 3)');
        const boxes = [...root.querySelectorAll<HTMLInputElement>('[part~="task-checkbox"]')];
        expect(boxes.map((box) => getComputedStyle(box).outlineStyle)).to.deep.equal(boxes.map((box) => box.checked ? 'solid' : 'none'));
        const items = [...root.querySelectorAll('li')];
        expect(items.map((item) => getComputedStyle(item).textDecorationLine)).to.deep.equal(['none', 'line-through', 'none', 'line-through', 'none']);
        expect(items.map((item) => getComputedStyle(item).outlineStyle)).to.deep.equal(['dotted', 'dotted', 'none', 'dotted', 'dotted']);
      } finally {
        style.remove();
      }
    });
  }
});

describe('GFM task items: size knob and glyph cascade', () => {
  for (const name of ['lr-markdown', 'lr-markdown-core'] as const) {
    for (const via of ['host', 'part'] as const) {
      for (const dir of ['ltr', 'rtl'] as const) {
        it(`${name} sizes the box from --lr-markdown-task-checkbox-size set on the ${via} and keeps the hang (${dir})`, async () => {
          const style = document.createElement('style');
          style.textContent = `${name}::part(task-checkbox) { --lr-markdown-task-checkbox-size: 1.25em }`;
          if (via === 'part') document.head.append(style);
          try {
            const el = await mountTasks(name, '- Ordinary\n- [ ] Task\n\n1. Plain\n2. [x] Numbered\n', dir);
            if (via === 'host') el.style.setProperty('--lr-markdown-task-checkbox-size', '1.25em');
            await el.updateComplete;
            const root = el.shadowRoot!;
            const [ulBox, olBox] = [...root.querySelectorAll<HTMLInputElement>('[part~="task-checkbox"]')];
            const li = root.querySelector('ul > [part~="task-item"]')!;
            await waitUntil(
              () => Math.abs(ulBox!.getBoundingClientRect().width - parseFloat(getComputedStyle(li).fontSize) * 1.25) <= 0.5,
              `box never followed the ${via} size property`,
            );
            const task = textRect(root, 'Task');
            const sibling = textRect(root, 'Ordinary');
            expect(dir === 'ltr' ? Math.abs(task.left - sibling.left) : Math.abs(task.right - sibling.right)).to.be.at.most(1);
            const olItem = contentBox(root.querySelectorAll('ol > li')[1]!);
            const olRect = olBox!.getBoundingClientRect();
            if (dir === 'ltr') expect(olRect.left).to.be.at.least(olItem.start - 0.5);
            else expect(olRect.right).to.be.at.most(olItem.end + 0.5);
          } finally {
            style.remove();
          }
        });
      }
    }

    for (const dir of ['ltr', 'rtl'] as const) {
      it(`${name} cascades the unmirrored check glyph only onto checked boxes (${dir})`, async () => {
        const el = await mountTasks(name, '- [ ] Open\n- [x] Done\n', dir);
        const [open, done] = [...el.shadowRoot!.querySelectorAll<HTMLInputElement>('[part~="task-checkbox"]')];
        const checked = getComputedStyle(done!, '::before');
        expect(checked.content).to.not.equal('none');
        expect(parseFloat(checked.borderRightWidth)).to.be.greaterThan(0);
        expect(parseFloat(checked.borderLeftWidth)).to.equal(0);
        expect(getComputedStyle(open!, '::before').content).to.equal('none');
      });
    }
  }
});
