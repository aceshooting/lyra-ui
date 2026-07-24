import { fixture, expect, html, aTimeout } from '@open-wc/testing';
import './diff-view.js';
import type { LyraDiffView } from './diff-view.js';
import type { DiffOp } from './diff-line-diff.js';
import { styles } from './diff-view.styles.js';

describe('lr-diff-view', () => {
  it('renders the localized size fallback instead of diffing past maxLines', async () => {
    const el = (await fixture(
      html`<lr-diff-view
        .oldText=${'a\nb\nc'}
        .newText=${'a\nb\nd'}
        .maxLines=${2}
        .strings=${{ diffViewTooLarge: 'Diff trop grande' }}
      ></lr-diff-view>`,
    )) as LyraDiffView;

    expect(el.shadowRoot!.querySelector('[part="limit"]')!.textContent).to.equal('Diff trop grande');
    expect(el.shadowRoot!.querySelectorAll('[part="line"]').length).to.equal(0);
  });

  it('renders the English size fallback with no locale registered', async () => {
    const el = (await fixture(
      html`<lr-diff-view
        .oldText=${'a\nb\nc'}
        .newText=${'a\nb\nd'}
        .maxLines=${2}
      ></lr-diff-view>`,
    )) as LyraDiffView;

    expect(el.shadowRoot!.querySelector('[part="limit"]')!.textContent).to.equal(
      'Diff is too large to display.',
    );
  });

  it('defaults maxLines to 5000 and leaves ordinary diffs unchanged', async () => {
    const el = (await fixture(
      html`<lr-diff-view .oldText=${'a\nb'} .newText=${'a\nc'}></lr-diff-view>`,
    )) as LyraDiffView;

    expect(el.maxLines).to.equal(5000);
    expect(el.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="line"]')).to.have.length(3);
  });

  it('enforces the default ceiling and accepts explicit Infinity as the documented opt-out', async () => {
    const oversized = Array.from({ length: 5001 }, (_, index) => `line-${index}`).join('\n');
    const limited = (await fixture(
      html`<lr-diff-view
        .oldText=${''}
        .newText=${oversized}
        .strings=${{ diffViewTooLarge: 'Too large' }}
      ></lr-diff-view>`,
    )) as LyraDiffView;
    expect(limited.shadowRoot!.querySelector('[part="limit"]')!.textContent).to.equal('Too large');

    const unbounded = (await fixture(
      html`<lr-diff-view
        .oldText=${'a\nb\nc'}
        .newText=${'a\nb\nd'}
        .maxLines=${Number.POSITIVE_INFINITY}
      ></lr-diff-view>`,
    )) as LyraDiffView;
    expect(unbounded.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(0);
    expect(unbounded.shadowRoot!.querySelectorAll('[part="line"]').length).to.be.greaterThan(0);
  });

  it('renders interleaved add/remove/equal lines, not all-removed-then-all-added', async () => {
    const el = (await fixture(html`
      <lr-diff-view .oldText=${'a\nb\nc\nd\ne'} .newText=${'a\nb\nX\nd\ne'}></lr-diff-view>
    `)) as LyraDiffView;
    const lines = [...el.shadowRoot!.querySelectorAll('[part="line"]')];
    const types = lines.map((l) => l.getAttribute('data-type'));
    expect(types).to.deep.equal(['equal', 'equal', 'remove', 'add', 'equal', 'equal']);
  });

  it('renders no copy button by default, one when copyable is set', async () => {
    const plain = (await fixture(html`<lr-diff-view .oldText=${'a'} .newText=${'b'}></lr-diff-view>`)) as LyraDiffView;
    expect(plain.shadowRoot!.querySelector('[part="copy-button"]')).to.not.exist;
    const withCopy = (await fixture(html`<lr-diff-view copyable .oldText=${'a'} .newText=${'b'}></lr-diff-view>`)) as LyraDiffView;
    expect(withCopy.shadowRoot!.querySelector('[part="copy-button"]')).to.exist;
  });

  it('is accessible', async () => {
    const el = (await fixture(html`<lr-diff-view .oldText=${'a'} .newText=${'b'}></lr-diff-view>`)) as LyraDiffView;
    await expect(el).to.be.accessible();
  });

  it('localizes the copy-button aria-label via this.localize(), not a hardcoded "diff" suffix', async () => {
    const el = (await fixture(
      html`<lr-diff-view copyable .oldText=${'a'} .newText=${'b'} .strings=${{ copyDiff: 'Copier la diff' }}></lr-diff-view>`,
    )) as LyraDiffView;
    const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).to.equal('Copier la diff');
  });

  it('defaults to English "Copy diff" when no strings override is set', async () => {
    const el = (await fixture(
      html`<lr-diff-view copyable .oldText=${'a'} .newText=${'b'}></lr-diff-view>`,
    )) as LyraDiffView;
    const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).to.equal('Copy diff');
  });

  it('gives the copy button a :hover treatment, matching every sibling copy button in the library', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='copy-button'\]:hover\s*\{[^}]+\}/);
  });

  it('still emits exactly one lr-copy and enters confirmation state when clipboard.writeText throws synchronously', async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText(): Promise<void> {
          throw new Error('synchronous clipboard failure');
        },
      },
    });
    try {
      const el = (await fixture(
        html`<lr-diff-view copyable .oldText=${'a'} .newText=${'b'}></lr-diff-view>`,
      )) as LyraDiffView;
      let events = 0;
      let detail = '';
      el.addEventListener('lr-copy', (event) => {
        events++;
        detail = (event as CustomEvent<{ text: string }>).detail.text;
      });

      (el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
      await el.updateComplete;

      expect(events).to.equal(1);
      expect(detail).to.equal('- a\n+ b');
      expect(el.shadowRoot!.querySelector('[part="copy-button"]')!.textContent!.trim()).to.equal('Copied!');
    } finally {
      if (originalDescriptor) Object.defineProperty(navigator, 'clipboard', originalDescriptor);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('clears copy confirmation state across disconnect and reconnect', async () => {
    const el = (await fixture(
      html`<lr-diff-view copyable .oldText=${'a'} .newText=${'b'}></lr-diff-view>`,
    )) as LyraDiffView;
    (el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="copy-button"]')!.textContent!.trim()).to.equal('Copied!');

    el.remove();
    document.body.append(el);
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('[part="copy-button"]')!.textContent!.trim()).to.equal('Copy');
  });

  it('does not recompute the diff when only the copy-confirmation state toggles, only when oldText/newText change', async () => {
    const el = (await fixture(html`
      <lr-diff-view copyable .oldText=${'a\nb'} .newText=${'a\nX'}></lr-diff-view>
    `)) as LyraDiffView;
    await el.updateComplete;
    const opsBefore = (el as unknown as { diffOps: DiffOp[] }).diffOps;

    // Clicking the copy button only flips the `justCopied` @state field -- a render triggered
    // purely by that must reuse the same cached diff array instead of a freshly recomputed one.
    (el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect((el as unknown as { diffOps: DiffOp[] }).diffOps).to.equal(opsBefore);

    // Changing the actual compared text must still produce a fresh diff.
    el.newText = 'a\nY';
    await el.updateComplete;
    expect((el as unknown as { diffOps: DiffOp[] }).diffOps).to.not.equal(opsBefore);
  });
});

describe('layout', () => {
  it('defaults to unified and renders the existing single <pre>', async () => {
    const el = (await fixture(html`<lr-diff-view .oldText=${'a\nb'} .newText=${'a\nc'}></lr-diff-view>`)) as LyraDiffView;
    expect(el.layout).to.equal('unified');
    expect(el.shadowRoot!.querySelectorAll('[part="side"]').length).to.equal(0);
  });

  it('renders two [part="side"] columns in split layout with localized labels', async () => {
    const el = (await fixture(
      html`<lr-diff-view layout="split" .oldText=${'a\nb'} .newText=${'a\nc'}></lr-diff-view>`,
    )) as LyraDiffView;
    const sides = [...el.shadowRoot!.querySelectorAll('[part="side"]')];
    expect(sides).to.have.lengthOf(2);
    expect(sides[0]!.getAttribute('aria-label')).to.equal('Original');
    expect(sides[1]!.getAttribute('aria-label')).to.equal('Modified');
    expect(sides[0]!.getAttribute('role')).to.equal('region');
    expect(sides[1]!.getAttribute('role')).to.equal('region');
  });

  it('placeholder cells in split layout carry no +/- prefix', async () => {
    // Deliberately not `oldText=${''}` -- `''.split('\n')` is `['']` (one empty-string line, not
    // zero lines), so an empty `oldText` against a single-line `newText` is actually a *balanced*
    // 1-remove/1-add pairing (see `pairOpsForSplit`'s tests), producing no placeholder at all.
    // `oldText='a'` against a two-line `newText` genuinely produces a pure-add hunk after the
    // shared `'a'` line, giving the old side a real placeholder to assert against.
    const el = (await fixture(
      html`<lr-diff-view layout="split" .oldText=${'a'} .newText=${'a\nnew line'}></lr-diff-view>`,
    )) as LyraDiffView;
    const oldSide = el.shadowRoot!.querySelector('[part="side"][data-side="old"]')!;
    const placeholder = oldSide.querySelector('[data-type="empty"]')!;
    expect(placeholder.textContent!.trim()).to.equal('');
  });

  it('copies the same unified text regardless of layout', async () => {
    const unified = (await fixture(
      html`<lr-diff-view copyable .oldText=${'a'} .newText=${'b'}></lr-diff-view>`,
    )) as LyraDiffView;
    const split = (await fixture(
      html`<lr-diff-view copyable layout="split" .oldText=${'a'} .newText=${'b'}></lr-diff-view>`,
    )) as LyraDiffView;
    let unifiedText = '';
    let splitText = '';
    unified.addEventListener('lr-copy', (e) => (unifiedText = (e as CustomEvent).detail.text));
    split.addEventListener('lr-copy', (e) => (splitText = (e as CustomEvent).detail.text));
    (unified.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
    (split.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
    expect(unifiedText).to.equal(splitText);
  });
});

describe('line-ending normalization', () => {
  it('treats CRLF and LF forms of the same content as unchanged', async () => {
    const el = (await fixture(html`
      <lr-diff-view .oldText=${'a\r\nb\r\nc'} .newText=${'a\nb\nc'}></lr-diff-view>
    `)) as LyraDiffView;
    await el.updateComplete;
    const lines = [...el.shadowRoot!.querySelectorAll('[part="line"]')];
    const changed = lines.filter((l) => {
      const t = l.getAttribute('data-type');
      return t === 'add' || t === 'remove';
    });
    expect(changed.length).to.equal(0);
  });

  it('splits a lone-CR (classic Mac) document into separate lines, not one giant line', async () => {
    const el = (await fixture(html`
      <lr-diff-view .oldText=${'a\rb\rc'} .newText=${'a\rb\rc'}></lr-diff-view>
    `)) as LyraDiffView;
    await el.updateComplete;
    const lines = [...el.shadowRoot!.querySelectorAll('[part="line"]')];
    expect(lines.length).to.equal(3);
  });

  it('emits an lr-copy payload with no stray carriage returns for CRLF input', async () => {
    const el = (await fixture(html`
      <lr-diff-view copyable .oldText=${'a\r\nb'} .newText=${'a\r\nc'}></lr-diff-view>
    `)) as LyraDiffView;
    await el.updateComplete;
    let copyText = '';
    el.addEventListener('lr-copy', (e) => (copyText = (e as CustomEvent).detail.text));
    (el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
    expect(copyText.includes('\r')).to.equal(false);
  });
});

describe('syntax highlighting', () => {
  it('does not load shiki when language/languages are unset', async () => {
    const el = (await fixture(html`<lr-diff-view .oldText=${'a'} .newText=${'b'}></lr-diff-view>`)) as LyraDiffView;
    await el.updateComplete;
    // No direct way to assert "no dynamic import happened" without a bundler-level check; this
    // test instead asserts the plain-text rendering path is used (no shiki-generated span classes).
    expect(el.shadowRoot!.querySelector('.shiki')).to.not.exist;
  });

  it('tokenized line count equals the plain split("\\n") line count, including a trailing newline', async () => {
    // Uses a fake ShikiHighlighterCore-shaped object (matching lr-code-block's own test pattern
    // for injecting a fake highlighter) rather than the real optional peer.
    const fakeHighlighter = {
      codeToHtml: (text: string) =>
        `<pre class="shiki"><code>${text
          .split('\n')
          .map((line) => `<span class="line">${line}</span>`)
          .join('\n')}</code></pre>`,
    };
    const el = (await fixture(
      html`<lr-diff-view .oldText=${'a\nb\n'} .newText=${'a\nb\n'} language="text"></lr-diff-view>`,
    )) as LyraDiffView;
    (el as unknown as { languages: unknown }).languages = { text: {} };
    (el as unknown as { loadHighlighterCore: () => Promise<unknown> }).loadHighlighterCore = () =>
      Promise.resolve(fakeHighlighter);
    await el.updateComplete;
    await aTimeout(10);
    const expectedLineCount = 'a\nb\n'.split('\n').length;
    expect((el as unknown as { highlightedOldLines: string[] | null }).highlightedOldLines?.length).to.equal(
      expectedLineCount,
    );
  });

  it('indexes an add op that follows an equal op into the correct highlightedNewLines entry (regression)', async () => {
    // Regression for a counter bug: a per-op line counter that only advances `newCounter` on
    // `add` ops (treating `equal` as consuming only from the old side) misindexes every `add` that
    // follows an `equal` -- old=['a','b'] new=['a','x','b'] diffs to [equal 'a', add 'x', equal
    // 'b']; `x` is newLines[1], but a counter that never advanced past 0 for the preceding equal
    // would read newLines[0] ('a') instead. Both counters must advance on `equal` independently.
    const fakeHighlighter = {
      codeToHtml: (text: string) =>
        `<pre class="shiki"><code>${text
          .split('\n')
          .map((line) => `<span class="line">HL:${line}</span>`)
          .join('\n')}</code></pre>`,
    };
    const el = (await fixture(
      html`<lr-diff-view .oldText=${'a\nb'} .newText=${'a\nx\nb'} language="text"></lr-diff-view>`,
    )) as LyraDiffView;
    (el as unknown as { languages: unknown }).languages = { text: {} };
    (el as unknown as { loadHighlighterCore: () => Promise<unknown> }).loadHighlighterCore = () =>
      Promise.resolve(fakeHighlighter);
    await el.updateComplete;
    await aTimeout(10);
    const addLine = el.shadowRoot!.querySelector('[part="line"][data-type="add"]')!;
    expect(addLine.textContent!.trim()).to.equal('+ HL:x');
  });

  it('keeps highlighted line count in lockstep with the diff line count for CRLF input', async () => {
    // Shiki normalizes CRLF internally, so its rendered `.line` count matches the NORMALIZED line
    // count. tokenizeLines must pad/truncate to `splitLines(text).length` (also normalized) -- if
    // it used a raw `split('\n')` it would expect one extra entry per CRLF line and misindex every
    // highlighted line. This fake highlighter mimics shiki's CRLF normalization.
    const fakeHighlighter = {
      codeToHtml: (text: string) =>
        `<pre class="shiki"><code>${text
          .replace(/\r\n|\r/g, '\n')
          .split('\n')
          .map((line) => `<span class="line">HL:${line}</span>`)
          .join('\n')}</code></pre>`,
    };
    const el = (await fixture(
      html`<lr-diff-view .oldText=${'a\r\nb\r\nc'} .newText=${'a\r\nb\r\nc'} language="text"></lr-diff-view>`,
    )) as LyraDiffView;
    (el as unknown as { languages: unknown }).languages = { text: {} };
    (el as unknown as { loadHighlighterCore: () => Promise<unknown> }).loadHighlighterCore = () =>
      Promise.resolve(fakeHighlighter);
    await el.updateComplete;
    await aTimeout(10);
    const diffLineCount = el.shadowRoot!.querySelectorAll('[part="line"]').length;
    const highlighted = (el as unknown as { highlightedOldLines: string[] | null }).highlightedOldLines;
    expect(highlighted?.length).to.equal(diffLineCount);
  });
});

describe('contextLines', () => {
  const old8 = ['a', 'ctx1', 'ctx2', 'ctx3', 'ctx4', 'ctx5', 'ctx6', 'z'].join('\n');
  const new8 = ['A', 'ctx1', 'ctx2', 'ctx3', 'ctx4', 'ctx5', 'ctx6', 'Z'].join('\n');

  it('does not fold anything when contextLines is unset, regardless of run length', async () => {
    const el = (await fixture(html`<lr-diff-view .oldText=${old8} .newText=${new8}></lr-diff-view>`)) as LyraDiffView;
    expect(el.shadowRoot!.querySelector('[data-type="fold"]')).to.not.exist;
    expect(el.shadowRoot!.querySelectorAll('[part="line"]').length).to.equal(10);
  });

  for (const contextLines of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    it(`treats contextLines=${String(contextLines)} as unset instead of enabling zero-context folding`, async () => {
      const el = (await fixture(
        html`<lr-diff-view
          .oldText=${old8}
          .newText=${new8}
          .contextLines=${contextLines}
        ></lr-diff-view>`,
      )) as LyraDiffView;
      expect(el.shadowRoot!.querySelector('[data-type="fold"]')).to.not.exist;
      expect(el.shadowRoot!.querySelectorAll('[part="line"]').length).to.equal(10);
    });
  }

  it('locale-formats the hidden-line count before interpolating it into the localized message', async () => {
    const oldText = ['a', ...Array.from({ length: 1236 }, (_, index) => `same-${index}`), 'z'].join('\n');
    const newText = ['A', ...Array.from({ length: 1236 }, (_, index) => `same-${index}`), 'Z'].join('\n');
    const el = (await fixture(
      html`<lr-diff-view
        lang="ar"
        .oldText=${oldText}
        .newText=${newText}
        .contextLines=${1}
      ></lr-diff-view>`,
    )) as LyraDiffView;
    const expected = new Intl.NumberFormat(el.effectiveLocale).format(1234);
    expect(el.shadowRoot!.querySelector('[data-type="fold"]')!.textContent).to.contain(expected);
  });

  it('folds a middle run of unchanged lines beyond contextLines on each side, unified layout', async () => {
    const el = (await fixture(
      html`<lr-diff-view .oldText=${old8} .newText=${new8} .contextLines=${2}></lr-diff-view>`,
    )) as LyraDiffView;
    const lines = [...el.shadowRoot!.querySelectorAll('[part="line"]')];
    const types = lines.map((l) => l.getAttribute('data-type'));
    // remove A, add A, ctx1, ctx2, [fold], ctx5, ctx6, remove z, add Z
    expect(types).to.deep.equal(['remove', 'add', 'equal', 'equal', 'fold', 'equal', 'equal', 'remove', 'add']);
    const fold = lines.find((l) => l.getAttribute('data-type') === 'fold')!;
    expect(fold.textContent!.trim()).to.equal('2 unchanged lines');
  });

  it('folds a leading run down to the last contextLines lines before the first change', async () => {
    const oldText = ['x1', 'x2', 'x3', 'x4', 'x5', 'a'].join('\n');
    const newText = ['x1', 'x2', 'x3', 'x4', 'x5', 'A'].join('\n');
    const el = (await fixture(
      html`<lr-diff-view .oldText=${oldText} .newText=${newText} .contextLines=${2}></lr-diff-view>`,
    )) as LyraDiffView;
    const lines = [...el.shadowRoot!.querySelectorAll('[part="line"]')];
    const types = lines.map((l) => l.getAttribute('data-type'));
    expect(types).to.deep.equal(['fold', 'equal', 'equal', 'remove', 'add']);
    expect(lines[0]!.textContent!.trim()).to.equal('3 unchanged lines');
  });

  it('folds a trailing run down to the first contextLines lines after the last change', async () => {
    const oldText = ['a', 'y1', 'y2', 'y3', 'y4', 'y5'].join('\n');
    const newText = ['A', 'y1', 'y2', 'y3', 'y4', 'y5'].join('\n');
    const el = (await fixture(
      html`<lr-diff-view .oldText=${oldText} .newText=${newText} .contextLines=${2}></lr-diff-view>`,
    )) as LyraDiffView;
    const lines = [...el.shadowRoot!.querySelectorAll('[part="line"]')];
    const types = lines.map((l) => l.getAttribute('data-type'));
    expect(types).to.deep.equal(['remove', 'add', 'equal', 'equal', 'fold']);
    expect(lines[lines.length - 1]!.textContent!.trim()).to.equal('3 unchanged lines');
  });

  it('does not fold a run no longer than 2x contextLines', async () => {
    const oldText = ['a', 'ctx1', 'ctx2', 'ctx3', 'ctx4', 'z'].join('\n');
    const newText = ['A', 'ctx1', 'ctx2', 'ctx3', 'ctx4', 'Z'].join('\n');
    const el = (await fixture(
      html`<lr-diff-view .oldText=${oldText} .newText=${newText} .contextLines=${2}></lr-diff-view>`,
    )) as LyraDiffView;
    expect(el.shadowRoot!.querySelector('[data-type="fold"]')).to.not.exist;
  });

  it('uses singular localized text for exactly one hidden line', async () => {
    const oldText = ['a', 'ctx1', 'ctx2', 'ctx3', 'z'].join('\n');
    const newText = ['A', 'ctx1', 'ctx2', 'ctx3', 'Z'].join('\n');
    const el = (await fixture(
      html`<lr-diff-view .oldText=${oldText} .newText=${newText} .contextLines=${1}></lr-diff-view>`,
    )) as LyraDiffView;
    const fold = el.shadowRoot!.querySelector('[data-type="fold"]')!;
    expect(fold.textContent!.trim()).to.equal('1 unchanged line');
  });

  it('folds equivalently in split layout, one fold marker per side at the same position', async () => {
    const el = (await fixture(
      html`<lr-diff-view layout="split" .oldText=${old8} .newText=${new8} .contextLines=${2}></lr-diff-view>`,
    )) as LyraDiffView;
    const oldSide = el.shadowRoot!.querySelector('[part="side"][data-side="old"]')!;
    const newSide = el.shadowRoot!.querySelector('[part="side"][data-side="new"]')!;
    expect(oldSide.querySelectorAll('[data-type="fold"]')).to.have.lengthOf(1);
    expect(newSide.querySelectorAll('[data-type="fold"]')).to.have.lengthOf(1);
    expect(oldSide.querySelector('[data-type="fold"]')!.textContent!.trim()).to.equal('2 unchanged lines');
  });

  it('does not fold when oldText and newText are identical (nothing to give context around)', async () => {
    const el = (await fixture(
      html`<lr-diff-view .oldText=${old8} .newText=${old8} .contextLines=${1}></lr-diff-view>`,
    )) as LyraDiffView;
    expect(el.shadowRoot!.querySelector('[data-type="fold"]')).to.not.exist;
  });
});

describe('back-compat', () => {
  it('default (unified, no language) output is byte-identical to today', async () => {
    const el = (await fixture(html`<lr-diff-view .oldText=${'a\nb'} .newText=${'a\nc'}></lr-diff-view>`)) as LyraDiffView;
    const lines = [...el.shadowRoot!.querySelectorAll('[part="line"]')].map((l) => l.textContent);
    // Today's actual (pre-existing, unchanged) template literally concatenates `${marker} ${text}`
    // -- for an `equal` op the marker itself is already a space, so the rendered prefix is two
    // spaces (`"  a"`), not one. Asserted against the real current output, not the single-space
    // literal the plan brief's own copy-pasted snippet used, so this genuinely proves the default
    // unified path is untouched by the split/highlighting work below.
    expect(lines).to.deep.equal(['  a', '- b', '+ c']);
  });
});
