import { aTimeout, fixture, html, expect, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { setForcedColors, setReducedMotion } from '../../../../test/wtr-media.js';
// The shipped French catalog slices the lang="fr" relabel test resolves against.
import '../../../translations/fr/conversation.js';
import '../../../translations/fr/shared.js';
import jsonGrammar from 'shiki/langs/json.mjs';
import './markdown.js';
import './markdown-core.js';
import type { LyraMarkdown } from './markdown.js';

describe('code-block header', () => {
  for (const name of ['lr-markdown', 'lr-markdown-core'] as const) {
    it(`${name} adds no text and preserves tabs when copying after skipped empty blocks`, async () => {
      const host = await fixture<HTMLElement>(html`<div></div>`);
      const el = document.createElement(name) as LyraMarkdown;
      el.codeBlockHeader = true;
      el.highlightCode = false;
      el.content = '```\n```\n\n```make\n\tbuild\n```';
      host.append(el);
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('[part="code-block-copy"]')));
      const header = el.shadowRoot!.querySelector('[part="code-block-header"]')!;
      expect(header.textContent).to.equal('');
      expect(el.shadowRoot!.querySelectorAll('[part="code-block-frame"]').length).to.equal(1);
      const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
      const writes: string[] = [];
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { writes.push(text); } } });
      try {
        const event = oneEvent(el, 'lr-copy');
        el.shadowRoot!.querySelector<HTMLButtonElement>('[part="code-block-copy"]')!.click();
        const outcome = await event as CustomEvent<{ ok: boolean; text: string }>;
        expect(outcome.detail).to.deep.equal({ ok: true, text: '\tbuild' });
        expect(writes).to.deep.equal(['\tbuild']);
        expect(outcome.composed && outcome.bubbles && !outcome.cancelable).to.equal(true);
        await el.updateComplete;
        expect(el.shadowRoot!.querySelectorAll('[part~="code-block-copy-success"]').length).to.equal(1);
        const previous = el.shadowRoot!.querySelector('[part~="code-block-copy"]');
        el.content = 'Paragraph\n\n' + el.content;
        await el.updateComplete;
        expect(el.shadowRoot!.querySelectorAll('[part~="code-block-copy-success"]').length).to.equal(1);
        expect(el.shadowRoot!.querySelector('[part~="code-block-copy"]') === previous).to.equal(false);
      } finally {
        if (original) Object.defineProperty(navigator, 'clipboard', original);
        else Reflect.deleteProperty(navigator, 'clipboard');
      }
    });
    it(`${name} rejects decoration forgery and strips authored styles only while enabled`, async () => {
      const host = await fixture<HTMLElement>(html`<div></div>`);
      const el = document.createElement(name) as LyraMarkdown;
      el.highlightCode = false;
      el.codeBlockHeader = true;
      el.content = '<style>.line { display:none }</style>\n\n<a part="code-block-copy" data-lr-code-chrome href="/">Decoy</a>\n\n```js\nvisible\n```';
      host.append(el);
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('button')));
      expect(el.shadowRoot!.querySelectorAll('style').length).to.equal(0);
      expect(el.shadowRoot!.querySelector('a')?.hasAttribute('data-lr-code-chrome')).to.equal(false);
      expect(el.shadowRoot!.querySelectorAll('button').length).to.equal(1);
      expect(getComputedStyle(el.shadowRoot!.querySelector('a')!).minBlockSize).to.equal('0px');
      await expect(el).to.be.accessible();
    });
    it(`${name} bounds controls and clips language labels by code point`, async () => {
      const host = await fixture<HTMLElement>(html`<div></div>`);
      const el = document.createElement(name) as LyraMarkdown;
      el.codeBlockHeader = true; el.highlightCode = false;
      el.content = Array.from({ length: 205 }, (_, index) => `\`\`\`${'x'.repeat(40)}\nvalue ${index}\n\`\`\``).join('\n\n');
      host.append(el);
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('button')));
      expect(el.shadowRoot!.querySelectorAll('button').length).to.equal(200);
      expect(el.shadowRoot!.querySelectorAll('pre').length).to.equal(205);
      expect(el.shadowRoot!.querySelector('[part="code-block-language"]')?.getAttribute('data-language')).to.equal('x'.repeat(32));
    });
    it(`${name} localizes existing controls and returns localized clipboard failure`, async () => {
      const host = await fixture<HTMLElement>(html`<div></div>`);
      const el = document.createElement(name) as LyraMarkdown;
      el.codeBlockHeader = true; el.highlightCode = false; el.content = '```js\nsource\n```';
      host.append(el);
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('button')));
      const button = el.shadowRoot!.querySelector('button')!;
      el.strings = { copyCode: 'Copier', copyFailed: 'Échec', codeRegionWithLanguage: 'Code {language}' };
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('button') === button).to.equal(true);
      expect(button.getAttribute('aria-label')).to.equal('Copier');
      expect(el.shadowRoot!.querySelector('[part="code-block-frame"]')?.getAttribute('aria-label')).to.equal('Code js');
      const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new DOMException('denied', 'NotAllowedError'); } } });
      try {
        const event = oneEvent(el, 'lr-copy-error'); button.click();
        const outcome = await event as CustomEvent<{ ok: boolean }>;
        expect(outcome.detail.ok).to.equal(false);
        expect(Object.isFrozen(outcome.detail)).to.equal(true);
        await el.updateComplete;
        expect(button.getAttribute('aria-label')).to.equal('Échec');
        expect(button.part.contains('code-block-copy-error')).to.equal(true);
      } finally {
        if (original) Object.defineProperty(navigator, 'clipboard', original);
        else Reflect.deleteProperty(navigator, 'clipboard');
      }
    });
    it(`${name} suppresses stale clipboard settlement after content replacement and disconnect`, async () => {
      const host = await fixture<HTMLElement>(html`<div></div>`);
      const el = document.createElement(name) as LyraMarkdown;
      el.codeBlockHeader = true; el.highlightCode = false; el.content = '```\none\n```';
      host.append(el);
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('button')));
      let resolveWrite: (() => void) | undefined;
      let copies = 0;
      el.addEventListener('lr-copy', () => copies++);
      const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => new Promise<void>((resolve) => { resolveWrite = resolve; }) } });
      try {
        el.shadowRoot!.querySelector('button')!.click();
        el.content = '```\ntwo\n```'; await el.updateComplete;
        resolveWrite!(); await Promise.resolve(); await Promise.resolve(); await el.updateComplete;
        expect(copies).to.equal(0);
        expect(el.shadowRoot!.querySelector('button')!.part.contains('code-block-copy-success')).to.equal(false);
        el.shadowRoot!.querySelector('button')!.click(); el.remove();
        resolveWrite!(); await Promise.resolve(); await Promise.resolve();
        host.append(el); await el.updateComplete;
        expect(copies).to.equal(0);
      } finally {
        if (original) Object.defineProperty(navigator, 'clipboard', original);
        else Reflect.deleteProperty(navigator, 'clipboard');
      }
    });
  }
});

describe('code-block header labels, keyboard and direction', () => {
  for (const name of ['lr-markdown', 'lr-markdown-core'] as const) {
    async function mount(content: string, dir = 'ltr'): Promise<LyraMarkdown> {
      const host = await fixture<HTMLElement>(html`<div dir=${dir}></div>`);
      const el = document.createElement(name) as LyraMarkdown;
      el.codeBlockHeader = true;
      el.highlightCode = false;
      el.content = content;
      host.append(el);
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('[part~="code-block-copy"]')));
      return el;
    }

    it(`${name} names the frame, label and button and marks every chrome node`, async () => {
      const el = await mount('```ts\nconst a = 1;\n```\n\n    indented');
      const frames = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="code-block-frame"]')];
      expect(frames.map((frame) => frame.getAttribute('aria-label'))).to.deep.equal(['ts code', 'Code']);
      const label = el.shadowRoot!.querySelector<HTMLElement>('[part="code-block-language"]')!;
      expect([label.getAttribute('data-language'), label.getAttribute('aria-hidden')]).to.deep.equal(['ts', 'true']);
      expect(frames[1]!.querySelectorAll('[part="code-block-language"]').length).to.equal(0);
      const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="code-block-copy"]')!;
      expect([button.getAttribute('aria-label'), button.title]).to.deep.equal(['Copy code', 'Copy code']);
      for (const node of [frames[0]!, frames[0]!.querySelector('[part="code-block-header"]')!, label, button]) {
        expect(node.hasAttribute('data-lr-code-chrome'), node.getAttribute('part') ?? '').to.equal(true);
      }
    });

    it(`${name} reaches each copy button before its code and copies the focused block from the keyboard`, async () => {
      const el = await mount('```js\nfirst();\n```\n\n```js\nsecond();\n```');
      const writes: string[] = [];
      const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { writes.push(text); } } });
      try {
        const buttons = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="code-block-copy"]')];
        buttons[0]!.focus();
        await sendKeys({ press: 'Tab' });
        expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('code-block');
        expect(el.shadowRoot!.activeElement?.textContent).to.equal('first();\n');
        buttons[1]!.focus();
        await sendKeys({ press: 'Enter' });
        await waitUntil(() => writes.length === 1);
        el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="code-block-copy"]')[1]!.focus();
        await sendKeys({ press: 'Space' });
        await waitUntil(() => writes.length === 2);
        expect(writes).to.deep.equal(['second();', 'second();']);
      } finally {
        if (original) Object.defineProperty(navigator, 'clipboard', original);
        else Reflect.deleteProperty(navigator, 'clipboard');
      }
    });

    it(`${name} puts the copy button at inline-end under RTL and passes axe`, async () => {
      const el = await mount('```ts\nconst a = 1;\n```', 'rtl');
      const button = el.shadowRoot!.querySelector<HTMLElement>('[part~="code-block-copy"]')!.getBoundingClientRect();
      const label = el.shadowRoot!.querySelector<HTMLElement>('[part="code-block-language"]')!.getBoundingClientRect();
      expect(button.right).to.be.at.most(label.left + 0.5);
      await expect(el).to.be.accessible();
    });
  }
});

type ClipboardWrite = (text: string) => Promise<void>;

/** Replaces `navigator.clipboard` for the duration of `run`, restoring the original afterwards. */
async function withClipboard(writeText: ClipboardWrite, run: () => Promise<void>): Promise<void> {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  try {
    await run();
  } finally {
    if (original) Object.defineProperty(navigator, 'clipboard', original);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
}

const politeSinks = (doc: Document = document): HTMLElement[] =>
  [...doc.querySelectorAll<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`)];
const politeMessages = (doc: Document = document): string[] =>
  politeSinks(doc).flatMap((sink) => [...sink.children].map((child) => child.textContent ?? ''));

async function mountHeader(
  name: string,
  content: string,
  { dir = 'ltr', lang = '', style = '', props = {} }: { dir?: string; lang?: string; style?: string; props?: Partial<LyraMarkdown> } = {},
): Promise<{ host: HTMLElement; el: LyraMarkdown }> {
  const host = await fixture<HTMLElement>(html`<div dir=${dir} lang=${lang} style=${style}></div>`);
  const el = document.createElement(name) as LyraMarkdown;
  el.codeBlockHeader = true;
  el.highlightCode = false;
  Object.assign(el, props);
  el.content = content;
  host.append(el);
  await waitUntil(() => Boolean(el.shadowRoot?.querySelector('[part~="code-block-copy"]')), 'no copy control rendered');
  return { host, el };
}

const copyButtons = (el: LyraMarkdown): HTMLButtonElement[] =>
  [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="code-block-copy"]')];
const frameParts = (el: LyraMarkdown): string[] => copyButtons(el).map((button) => button.getAttribute('part') ?? '');

function subtreeSize(root: Node): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL);
  let count = 1;
  while (walker.nextNode()) count++;
  return count;
}

describe('code-block header: copy outcomes, announcements and timing', () => {
  for (const name of ['lr-markdown', 'lr-markdown-core'] as const) {
    it(`${name} reports a denied write with the default failure name, title and error part`, async () => {
      const { el } = await mountHeader(name, '```js\nsource\n```');
      await withClipboard(async () => { throw new DOMException('denied', 'NotAllowedError'); }, async () => {
        const event = oneEvent(el, 'lr-copy-error');
        copyButtons(el)[0]!.click();
        const outcome = (await event) as CustomEvent<{ ok: boolean; reason: string; text: string }>;
        expect([outcome.detail.ok, outcome.detail.reason, outcome.detail.text]).to.deep.equal([false, 'denied', 'source']);
        await el.updateComplete;
        const button = copyButtons(el)[0]!;
        expect([button.getAttribute('aria-label'), button.title, button.getAttribute('part')]).to.deep.equal([
          'Copy failed', 'Copy failed', 'code-block-copy code-block-copy-error',
        ]);
      });
    });

    it(`${name} reverts the success state after the confirmation window`, async () => {
      const { el } = await mountHeader(name, '```js\nsource\n```');
      await withClipboard(async () => undefined, async () => {
        const event = oneEvent(el, 'lr-copy');
        copyButtons(el)[0]!.click();
        await event;
        await el.updateComplete;
        expect(frameParts(el)).to.deep.equal(['code-block-copy code-block-copy-success']);
        expect(copyButtons(el)[0]!.title).to.equal('Copied to clipboard');
        // Margined well inside the 1500 ms window, then well past it.
        await aTimeout(600);
        expect(frameParts(el)).to.deep.equal(['code-block-copy code-block-copy-success']);
        await waitUntil(() => frameParts(el)[0] === 'code-block-copy', 'success state never reverted', { timeout: 4000 });
        expect([copyButtons(el)[0]!.getAttribute('aria-label'), copyButtons(el)[0]!.title]).to.deep.equal(['Copy code', 'Copy code']);
      });
    });

    it(`${name} announces every activation in its light-DOM sink`, async () => {
      const { el } = await mountHeader(name, '```js\nsource\n```');
      expect(politeSinks().length).to.equal(1);
      expect(el.shadowRoot!.querySelector(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}]`) === null).to.equal(true);
      await withClipboard(async () => undefined, async () => {
        for (let press = 0; press < 2; press++) {
          const event = oneEvent(el, 'lr-copy');
          copyButtons(el)[0]!.click();
          await event;
        }
      });
      expect(politeMessages().filter((message) => message === 'Copied to clipboard').length).to.equal(2);
    });

    it(`${name} adds no text and a fixed element budget per decorated block`, async () => {
      const { el } = await mountHeader(name, '```ts\nconst a = 1;\n```\n\n```\nplain\n```');
      const frames = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="code-block-frame"]')];
      expect(frames.length).to.equal(2);
      for (const header of el.shadowRoot!.querySelectorAll('[part="code-block-header"]')) {
        const walker = document.createTreeWalker(header, NodeFilter.SHOW_TEXT);
        expect(walker.nextNode() === null).to.equal(true);
      }
      const deltas = frames.map((frame) => subtreeSize(frame) - subtreeSize(frame.querySelector('pre')!));
      expect(deltas).to.deep.equal([7, 6]);
    });
  }
});

describe('code-block header: anchors and headings are header-independent', () => {
  for (const name of ['lr-markdown', 'lr-markdown-core'] as const) {
    it(`${name} resolves the same anchors, highlights and heading tree with the header on and off`, async () => {
      const content = '# Title\n\nIntro para\n\n```ts\nconst a = 1;\n```\n\n## Next\n\nOutro';
      const quotes = ['Intro para', 'const a = 1;', 'Outro'];
      const snapshots: unknown[] = [];
      for (const codeBlockHeader of [false, true]) {
        const host = await fixture<HTMLElement>(html`<div></div>`);
        const el = document.createElement(name) as LyraMarkdown;
        Object.assign(el, { codeBlockHeader, highlightCode: false, content });
        Object.assign(el as unknown as { anchorTimeoutMs: number; anchorRetryIntervalMs: number }, { anchorTimeoutMs: 200, anchorRetryIntervalMs: 10 });
        host.append(el);
        await waitUntil(() => Boolean(el.shadowRoot?.querySelector('pre')));
        expect(Boolean(el.shadowRoot!.querySelector('[part~="code-block-frame"]'))).to.equal(codeBlockHeader);
        const resolved: boolean[] = [];
        for (const quote of quotes) resolved.push(await el.scrollToAnchor({ kind: 'text-quote', quote }));
        el.highlights = quotes.map((quote, index) => ({ id: `h${index}`, anchor: { kind: 'text-quote' as const, quote } }));
        await el.updateComplete;
        snapshots.push({
          resolved,
          ranges: (el as unknown as { resolvedHighlightRanges: unknown[] }).resolvedHighlightRanges.length,
          headings: JSON.stringify(el.getHeadingTree()),
        });
        host.remove();
      }
      expect((snapshots[0] as { resolved: boolean[] }).resolved).to.deep.equal([true, true, true]);
      expect(snapshots[1]).to.deep.equal(snapshots[0]);
    });
  }
});

describe('code-block header: status lifecycle', () => {
  for (const name of ['lr-markdown', 'lr-markdown-core'] as const) {
    async function copyBlock(el: LyraMarkdown, index: number): Promise<void> {
      const event = oneEvent(el, 'lr-copy');
      copyButtons(el)[index]!.click();
      await event;
      await el.updateComplete;
    }

    it(`${name} keeps a block's status across re-renders that keep its source and clears it when the pairing changes`, async () => {
      const block = (text: string): string => `\`\`\`js\n${text}\n\`\`\``;
      const { el } = await mountHeader(name, `${block('one();')}\n\n${block('two();')}`);
      const success = 'code-block-copy code-block-copy-success';
      await withClipboard(async () => undefined, async () => {
        await copyBlock(el, 0);
        expect(frameParts(el)).to.deep.equal([success, 'code-block-copy']);
        el.headingOffset = 1;
        await el.updateComplete;
        expect(frameParts(el)[0]).to.equal(success);
        el.content = `${block('one();')}\n\n${block('changed();')}`;
        await waitUntil(() => el.shadowRoot!.textContent!.includes('changed();'));
        await el.updateComplete;
        expect(frameParts(el)).to.deep.equal([success, 'code-block-copy']);
        el.content = `${el.content}\n\n${block('three();')}`;
        await waitUntil(() => copyButtons(el).length === 3);
        await el.updateComplete;
        expect(frameParts(el)).to.deep.equal([success, 'code-block-copy', 'code-block-copy']);
        el.content = `${block('zero();')}\n\n${el.content}`;
        await waitUntil(() => copyButtons(el).length === 4);
        await el.updateComplete;
        expect(frameParts(el).includes(success)).to.equal(false);
      });
    });

    it(`${name} removes frames when turned off and decorates (and announces) when enabled after settling`, async () => {
      const { el } = await mountHeader(name, '```js\nsource\n```');
      el.codeBlockHeader = false;
      await waitUntil(() => !el.shadowRoot!.querySelector('[part~="code-block-frame"]'), 'frames never removed');
      expect(el.shadowRoot!.querySelectorAll('[data-lr-code-chrome]').length).to.equal(0);
      const settled = oneEvent(el, 'lr-content-settled');
      el.content = '```js\nsettled\n```';
      await settled;
      el.codeBlockHeader = true;
      await waitUntil(() => copyButtons(el).length === 1, 'frames never returned');
      // A copy that announces proves the controller reacquired its announcement sink.
      await withClipboard(async () => undefined, async () => {
        const event = oneEvent(el, 'lr-copy');
        copyButtons(el)[0]!.click();
        await event;
      });
      expect(politeMessages()).to.deep.equal(['Copied to clipboard']);
    });

    it(`${name} copies and announces again after a reconnect that dropped an in-flight copy`, async () => {
      const { host, el } = await mountHeader(name, '```js\nsource\n```');
      let copies = 0;
      el.addEventListener('lr-copy', () => copies++);
      let settle: (() => void) | undefined;
      await withClipboard(() => new Promise<void>((resolve) => { settle = resolve; }), async () => {
        copyButtons(el)[0]!.click();
        el.remove();
        settle!();
        await aTimeout(0);
        expect(copies).to.equal(0);
        host.append(el);
        await el.updateComplete;
        expect(politeMessages().length).to.equal(0);
      });
      await withClipboard(async () => undefined, async () => {
        const event = oneEvent(el, 'lr-copy');
        copyButtons(el)[0]!.click();
        await event;
      });
      expect(copies).to.equal(1);
      expect(politeMessages()).to.deep.equal(['Copied to clipboard']);
    });

    it(`${name} drops a stale copy on adoption and announces from the new document afterwards`, async () => {
      const iframe = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
      const frameDocument = iframe.contentDocument!;
      const { el } = await mountHeader(name, '```js\nsource\n```');
      let copies = 0;
      el.addEventListener('lr-copy', () => copies++);
      let settle: (() => void) | undefined;
      await withClipboard(() => new Promise<void>((resolve) => { settle = resolve; }), async () => {
        copyButtons(el)[0]!.click();
        frameDocument.body.append(frameDocument.adoptNode(el));
        await el.updateComplete;
        settle!();
        await aTimeout(0);
        expect(copies).to.equal(0);
      });
      await waitUntil(() => copyButtons(el).length === 1);
      expect(politeSinks(document).length).to.equal(0);
      expect(politeSinks(frameDocument).length).to.equal(1);
      expect(copyButtons(el)[0]!.ownerDocument === frameDocument).to.equal(true);
      // The adopted element's clipboard is its new owner window's.
      const frameNavigator = iframe.contentWindow!.navigator;
      const original = Object.getOwnPropertyDescriptor(frameNavigator, 'clipboard');
      Object.defineProperty(frameNavigator, 'clipboard', { configurable: true, value: { writeText: async () => undefined } });
      try {
        const event = oneEvent(el, 'lr-copy');
        copyButtons(el)[0]!.click();
        await event;
      } finally {
        if (original) Object.defineProperty(frameNavigator, 'clipboard', original);
        else Reflect.deleteProperty(frameNavigator, 'clipboard');
      }
      expect(copies).to.equal(1);
      expect(politeMessages(frameDocument)).to.deep.equal(['Copied to clipboard']);
      el.remove();
    });
  }
});

describe('code-block header: locale, geometry, pointer and media', () => {
  for (const name of ['lr-markdown', 'lr-markdown-core'] as const) {
    it(`${name} relabels the frame and button for lang="fr" without replacing chrome nodes`, async () => {
      const { host, el } = await mountHeader(name, '```ts\nconst a = 1;\n```');
      const frame = el.shadowRoot!.querySelector<HTMLElement>('[part~="code-block-frame"]')!;
      const button = copyButtons(el)[0]!;
      expect([frame.getAttribute('aria-label'), button.getAttribute('aria-label')]).to.deep.equal(['ts code', 'Copy code']);
      host.lang = 'fr';
      await waitUntil(() => button.getAttribute('aria-label') === 'Copier le code', 'lang="fr" never relabeled the button');
      expect([frame.getAttribute('aria-label'), button.title]).to.deep.equal(['Code ts', 'Copier le code']);
      expect(el.shadowRoot!.querySelector('[part~="code-block-frame"]') === frame && copyButtons(el)[0] === button).to.equal(true);
    });

    it(`${name} gives the copy button a hover background and an icon-button-size hit area`, async () => {
      const { host, el } = await mountHeader(name, '```ts\nconst a = 1;\n```');
      const button = copyButtons(el)[0]!;
      const rect = button.getBoundingClientRect();
      expect(rect.width).to.be.at.least(40);
      expect(rect.height).to.be.at.least(40);
      host.style.setProperty('--lr-icon-button-size-scope', '3.5rem');
      await waitUntil(() => button.getBoundingClientRect().height >= 55, 'hit area ignored --lr-icon-button-size-scope');
      host.style.removeProperty('--lr-icon-button-size-scope');
      const probe = document.createElement('span');
      probe.style.backgroundColor = 'var(--lr-color-brand-quiet)';
      el.shadowRoot!.append(probe);
      const brandQuiet = getComputedStyle(probe).backgroundColor;
      probe.remove();
      try {
        await hoverUntilMatched(button, 'copy button never hovered');
        await waitUntil(() => getComputedStyle(button).backgroundColor === brandQuiet, 'hover background never applied');
      } finally {
        await resetMouse();
      }
    });

    for (const outcome of ['success', 'danger'] as const) {
      it(`${name} paints the ${outcome} colour under a held pointer`, async () => {
        const { el } = await mountHeader(name, '```ts\nconst a = 1;\n```', { style: '--lr-transition-fast: 0s; --lr-transition-interactive: none' });
        const button = copyButtons(el)[0]!;
        const probe = document.createElement('span');
        probe.style.color = `var(--lr-color-${outcome})`;
        el.shadowRoot!.append(probe);
        const expected = getComputedStyle(probe).color;
        probe.remove();
        const write = outcome === 'success' ? async () => undefined : async () => { throw new DOMException('denied', 'NotAllowedError'); };
        await withClipboard(write, async () => {
          try {
            await hoverUntilMatched(button, 'copy button never hovered');
            await sendMouse({ type: 'down' });
            await sendMouse({ type: 'up' });
            await waitUntil(() => getComputedStyle(copyButtons(el)[0]!).color === expected, `${outcome} colour never painted`);
            expect(copyButtons(el)[0]!.matches(':hover')).to.equal(true);
          } finally {
            await resetMouse();
          }
        });
      });
    }

    it(`${name} keeps a long label inside a 320px header and ellipsizes it`, async () => {
      const { el } = await mountHeader(name, `\`\`\`${'W'.repeat(32)}\nx\n\`\`\``, { style: 'inline-size: 320px' });
      const header = el.shadowRoot!.querySelector<HTMLElement>('[part="code-block-header"]')!;
      const label = el.shadowRoot!.querySelector<HTMLElement>('[part="code-block-language"]')!;
      expect(header.scrollWidth - header.clientWidth).to.be.at.most(0);
      expect(getComputedStyle(label).textOverflow).to.equal('ellipsis');
      expect(label.scrollWidth).to.be.greaterThan(label.clientWidth);
      const button = copyButtons(el)[0]!.getBoundingClientRect();
      expect(button.right).to.be.at.most(header.getBoundingClientRect().right + 0.5);
    });

    it(`${name} shows a forced-colors border and honors reduced motion`, async function () {
      const { el } = await mountHeader(name, '```ts\nconst a = 1;\n```');
      const button = (): HTMLButtonElement => copyButtons(el)[0]!;
      const durations = (): number[] => getComputedStyle(button()).transitionDuration.split(',').map((value) => parseFloat(value) * (value.trim().endsWith('ms') ? 0.001 : 1));
      try {
        await setForcedColors('active');
      } catch {
        this.skip();
      }
      try {
        if (matchMedia('(forced-colors: active)').matches) {
          expect(getComputedStyle(button()).borderTopStyle).to.equal('solid');
          expect(parseFloat(getComputedStyle(button()).borderTopWidth)).to.be.greaterThan(0);
        }
      } finally {
        await setForcedColors('none');
      }
      try {
        await setReducedMotion('reduce');
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
          expect(durations().every((duration) => duration <= 0.000001)).to.equal(true);
        }
        await setReducedMotion('no-preference');
        expect(durations().every((duration) => duration > 0)).to.equal(true);
      } finally {
        await setReducedMotion('no-preference');
      }
    });
  }
});

describe('code-block header: forgery, fallback highlights and focus restore', () => {
  for (const name of ['lr-markdown', 'lr-markdown-core'] as const) {
    it(`${name} decorates the real block after 1001 authored frame decoys`, async () => {
      const decoys = Array.from({ length: 1001 }, (_, index) => `<div data-lr-code-frame="x:${index}"></div>`).join('');
      const { el } = await mountHeader(name, `${decoys}\n\n\`\`\`js\nreal();\n\`\`\``, { props: { htmlMode: 'sanitize' } });
      expect(copyButtons(el).length).to.equal(1);
      expect(copyButtons(el)[0]!.closest('[part~="code-block-frame"]')!.querySelector('pre')!.textContent).to.equal('real();\n');
    });

    it(`${name} leaves authored chrome lookalikes unstyled and inert`, async () => {
      const writes: string[] = [];
      await withClipboard(async (text) => { writes.push(text); }, async () => {
        const { el } = await mountHeader(name, [
          '<div part="code-block-frame" data-lr-code-frame="x:0"><button part="code-block-copy">Fake</button></div>',
          '',
          '<p><a part="code-block-copy" href="https://example.invalid">link</a> <span part="code-block-language" data-language="bash">x</span></p>',
          '',
          '```js',
          'real();',
          '```',
        ].join('\n'), { props: { htmlMode: 'sanitize' } });
        const fake = [...el.shadowRoot!.querySelectorAll<HTMLElement>('button')].find((button) => button.textContent === 'Fake');
        expect(fake !== undefined, 'authored decoy button was not rendered').to.equal(true);
        fake!.click();
        await aTimeout(50);
        expect(writes.length).to.equal(0);
        expect(fake!.hasAttribute('data-lr-code-chrome')).to.equal(false);
        const anchor = el.shadowRoot!.querySelector<HTMLElement>('a')!;
        const span = el.shadowRoot!.querySelector<HTMLElement>('span[data-language="bash"]');
        // An authored link keeps the UA's own pointer cursor; what must not reach it is the chrome
        // button's layout (inline-flex box with the icon-button hit-area floor).
        expect(getComputedStyle(anchor).display).to.not.equal('inline-flex');
        expect(getComputedStyle(anchor).minBlockSize).to.equal('0px');
        expect(span !== null, 'authored language decoy was not rendered').to.equal(true);
        expect(['none', 'normal']).to.include(getComputedStyle(span!, '::before').content);
        expect(copyButtons(el).filter((button) => button.hasAttribute('data-lr-code-chrome')).length).to.equal(1);
      });
    });

    for (const htmlMode of ['escape', 'trusted'] as const) {
      it(`${name} decorates and copies in ${htmlMode} mode`, async () => {
        const { el } = await mountHeader(name, '```js\nmode();\n```', { props: { htmlMode } });
        await withClipboard(async () => undefined, async () => {
          const event = oneEvent(el, 'lr-copy');
          copyButtons(el)[0]!.click();
          expect(((await event) as CustomEvent<{ text: string }>).detail.text).to.equal('mode();');
        });
      });
    }

    it(`${name} paints identical <mark> fallback highlights with the header on and off`, async () => {
      const content = 'Intro para\n\n```ts\nconst a = 1;\n```';
      const original = Object.getOwnPropertyDescriptor(globalThis, 'Highlight');
      Object.defineProperty(globalThis, 'Highlight', { configurable: true, writable: true, value: undefined });
      try {
        const snapshots: string[][] = [];
        for (const codeBlockHeader of [false, true]) {
          const host = await fixture<HTMLElement>(html`<div></div>`);
          const el = document.createElement(name) as LyraMarkdown;
          Object.assign(el, { codeBlockHeader, highlightCode: false, content });
          host.append(el);
          await waitUntil(() => Boolean(el.shadowRoot?.querySelector('pre')));
          el.highlights = [
            { id: 'prose', anchor: { kind: 'text-quote', quote: 'Intro para' } },
            { id: 'code', anchor: { kind: 'text-quote', quote: 'const a' } },
          ];
          await waitUntil(() => el.shadowRoot!.querySelectorAll('mark').length >= 2, 'fallback marks never painted');
          expect(el.shadowRoot!.querySelectorAll('[part="code-block-header"] mark').length).to.equal(0);
          snapshots.push([...el.shadowRoot!.querySelectorAll('mark')].map((mark) => mark.textContent ?? ''));
          host.remove();
        }
        expect(snapshots[0]).to.deep.equal(['Intro para', 'const a']);
        expect(snapshots[1]).to.deep.equal(snapshots[0]);
      } finally {
        if (original) Object.defineProperty(globalThis, 'Highlight', original);
        else Reflect.deleteProperty(globalThis, 'Highlight');
      }
    });

    it(`${name} returns focus to the rebuilt copy button after the Shiki upgrade, but never steals it`, async function () {
      this.timeout(60_000);
      const content = '```json\n{"a":1}\n```\n\n```json\n{"b":2}\n```';
      // Mount plain, focus, then opt into highlighting: the Shiki upgrade replaces the frames while
      // the focused button's block is still pending, even once the highlighter is warm.
      const mountPending = async (): Promise<{ host: HTMLElement; el: LyraMarkdown }> => {
        const mounted = await mountHeader(name, content, { props: { languages: { json: jsonGrammar } } as Partial<LyraMarkdown> });
        expect(Boolean(mounted.el.shadowRoot!.querySelector('pre code span'))).to.equal(false);
        return mounted;
      };
      const highlighted = async (el: LyraMarkdown): Promise<void> => {
        el.highlightCode = true;
        await waitUntil(() => Boolean(el.shadowRoot!.querySelector('pre code span')), 'never highlighted', { timeout: 45_000 });
      };
      const first = await mountPending();
      const before = copyButtons(first.el)[1]!;
      before.focus();
      await highlighted(first.el);
      await first.el.updateComplete;
      const after = copyButtons(first.el)[1]!;
      expect(after !== before && !before.isConnected, 'the upgrade never rebuilt the focused button').to.equal(true);
      expect(first.el.shadowRoot!.activeElement === after).to.equal(true);
      first.host.remove();

      const second = await mountPending();
      const input = document.createElement('input');
      second.host.append(input);
      copyButtons(second.el)[1]!.focus();
      input.focus();
      await highlighted(second.el);
      await second.el.updateComplete;
      expect(document.activeElement === input).to.equal(true);
    });
  }
});
