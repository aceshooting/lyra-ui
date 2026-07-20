#!/usr/bin/env node
// Standalone test for scripts/check-part-reachability.mjs -- plain `node:assert`, not wired into
// the wtr suite (this checker reads source text, it does not render components). Run directly:
// `node scripts/check-part-reachability.test.mjs`.
//
// Every fixture below is a reduced copy of a real shape from src/components: the bug this checker
// exists to catch, and -- just as importantly -- the correct dual-path and header-row shapes that
// must NOT be flagged.

import assert from 'node:assert/strict';
import { checkCrossRootParts, checkPartCompounds, virtualizedPartNames } from './check-part-reachability.mjs';

// Quiet by default (it runs inside the `pnpm lint` contract-policy chain); `--verbose` prints the
// per-case lines.
const verbose = process.argv.includes('--verbose');
let failures = 0;
let passes = 0;
function test(name, fn) {
  try {
    fn();
    passes += 1;
    if (verbose) console.log(`ok - ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`not ok - ${name}`);
    console.error(err instanceof Error ? err.stack : err);
  }
}

const crossRoot = (classSource, styleSource) =>
  checkCrossRootParts('fixture.class.ts', classSource, 'fixture.styles.ts', styleSource);

// --- cross-root-part: the bug ---------------------------------------------------------------

// Shape of the pre-fix lr-page-rail / lr-av-player: renderItem points at a class method that emits
// `part="row"`, and the stylesheet only ever names it with a bare attribute selector.
const BUGGY_CLASS = `
import { html } from 'lit';
export class Fixture extends LyraElement {
  private renderRow = (item: unknown) => html\`<div part="row"><span part="row-label">\${item}</span></div>\`;
  override render() {
    return html\`<lr-virtual-list part="list" .items=\${this.items} .renderItem=\${this.renderRow}></lr-virtual-list>\`;
  }
}
`;
const BUGGY_STYLES = `
import { css } from 'lit';
export const styles = css\`
  [part='list'] { display: block; }
  [part='row'] { display: flex; }
  [part='row-label'] { color: red; }
\`;
`;

test('flags every bare selector for a part rendered through lr-virtual-list', () => {
  const findings = crossRoot(BUGGY_CLASS, BUGGY_STYLES);
  assert.equal(findings.length, 2);
  assert.match(findings[0], /\[cross-root-part\] part 'row' /);
  assert.match(findings[1], /\[cross-root-part\] part 'row-label' /);
  assert.match(findings[0], /fixture\.styles\.ts:5/);
});

test("leaves [part='list'] alone -- the lr-virtual-list element is this component's own node", () => {
  assert.equal(
    crossRoot(BUGGY_CLASS, BUGGY_STYLES).filter((finding) => finding.includes("part 'list'")).length,
    0,
  );
});

test('follows an inline arrow binding and a transitive this.x() call chain', () => {
  const source = `
    export class Fixture extends LyraElement {
      private renderCell(value: unknown) { return html\`<span part="cell">\${value}</span>\`; }
      private renderRow(row: unknown[]) { return html\`<div part="data-row">\${row.map((v) => this.renderCell(v))}</div>\`; }
      override render() {
        return html\`<lr-virtual-list .renderItem=\${(row: unknown, i: number) => this.renderRow(row as unknown[], i)}></lr-virtual-list>\`;
      }
    }
  `;
  assert.deepEqual([...virtualizedPartNames(source)].sort(), ['cell', 'data-row']);
});

test('reads the whole member body past destructuring and nested template holes', () => {
  // The lr-page-rail shape: a `const { a, b } = ...` line early in the body must not be mistaken
  // for the end of the member, or every part below it goes uncollected.
  const source = `
    export class Fixture extends LyraElement {
      private renderPageItem = (pageNumber: unknown): TemplateResult => {
        const { count, tones } = this.pageHighlightSummary(pageNumber as number);
        return html\`<button part="page">
          <span part="thumbnail">\${count > 0 ? html\`<span part="heat">\${tones}</span>\` : nothing}</span>
        </button>\`;
      };
      override render() {
        return html\`<lr-virtual-list part="pages" .renderItem=\${this.renderPageItem}></lr-virtual-list>\`;
      }
    }
  `;
  assert.deepEqual([...virtualizedPartNames(source)].sort(), ['heat', 'page', 'thumbnail']);
});

test('collects part names emitted from inside a ${} hole of a part attribute', () => {
  const source = `
    export class Fixture extends LyraElement {
      private renderEntry = (entry: Entry) =>
        html\`<lr-x part="entry-name \${entry.isDir ? 'entry-name-dir' : ''}"></lr-x>\`;
      override render() {
        return html\`<lr-virtual-list .renderItem=\${this.renderEntry}></lr-virtual-list>\`;
      }
    }
  `;
  assert.deepEqual([...virtualizedPartNames(source)].sort(), ['entry-name', 'entry-name-dir']);
});

test('collects the string literals of a bound part=${} attribute, and no partial words', () => {
  // The lr-page-rail shape after the state-in-the-part-name rewrite: the row's part is a bound
  // expression, and a tone suffix is interpolated -- `heat-dot-` alone is not a part name.
  const source = `
    export class Fixture extends LyraElement {
      private renderPageItem = (page: number) => html\`
        <button part=\${this.current === page ? 'page page-current' : 'page'}>
          <span part="heat-dot heat-dot-\${this.tone(page)}"></span>
        </button>\`;
      override render() {
        return html\`<lr-virtual-list .renderItem=\${this.renderPageItem}></lr-virtual-list>\`;
      }
    }
  `;
  assert.deepEqual([...virtualizedPartNames(source)].sort(), ['heat-dot', 'page', 'page-current']);
});

test('ignores markup that only appears in a comment', () => {
  const source = `
    /** @example html\`<lr-virtual-list .renderItem=\${r}><div part="ghost"></div></lr-virtual-list>\` */
    export class Fixture extends LyraElement {
      override render() { return html\`<lr-virtual-list .renderItem=\${this.renderRow}></lr-virtual-list>\`; }
      private renderRow = () => html\`<div part="row"></div>\`;
    }
  `;
  assert.deepEqual([...virtualizedPartNames(source)], ['row']);
});

// --- cross-root-part: the correct shapes ------------------------------------------------------

test('does NOT flag the dual-path pairing (bare selector + lr-virtual-list::part())', () => {
  // The lr-ingestion-queue / lr-activity-feed shape: the same template renders into this
  // component's own shadow root below the virtualize threshold and into lr-virtual-list's above it,
  // so both selectors are required and both are live.
  const styles = `
    export const styles = css\`
      [part='row'],
      lr-virtual-list::part(row) { display: flex; }
      [part='row-label'],
      lr-virtual-list::part(row-label) { color: red; }
    \`;
  `;
  assert.deepEqual(crossRoot(BUGGY_CLASS, styles), []);
});

test('does NOT flag a directly-rendered header row that shares a part name with the body', () => {
  // The lr-csv-viewer / lr-spreadsheet-viewer shape.
  const classSource = `
    export class Fixture extends LyraElement {
      private renderRow(row: unknown[], part: 'header-row' | 'data-row') {
        return html\`<div part=\${part}>\${row.map((v) => html\`<div part="cell">\${v}</div>\`)}</div>\`;
      }
      override render() {
        return html\`<div part="sheet">\${this.renderRow(this.header, 'header-row')}
          <lr-virtual-list .renderItem=\${(row: unknown) => this.renderRow(row as unknown[], 'data-row')}></lr-virtual-list></div>\`;
      }
    }
  `;
  const styles = `
    export const styles = css\`
      [part='cell'] { padding: 0; }
      lr-virtual-list::part(cell) { padding: 0; }
      lr-virtual-list::part(data-row) { display: flex; }
    \`;
  `;
  assert.deepEqual(crossRoot(classSource, styles), []);
});

test('does NOT flag a component that never mounts lr-virtual-list', () => {
  const classSource = `
    export class Fixture extends LyraElement {
      override render() { return html\`<div part="row"></div>\`; }
    }
  `;
  assert.deepEqual(crossRoot(classSource, BUGGY_STYLES), []);
});

test('does NOT flag parts rendered outside the renderItem callback region', () => {
  const classSource = `
    export class Fixture extends LyraElement {
      private renderRow = () => html\`<div part="row"></div>\`;
      override render() {
        return html\`<div part="toolbar"></div><lr-virtual-list .renderItem=\${this.renderRow}></lr-virtual-list>\`;
      }
    }
  `;
  const findings = crossRoot(classSource, "export const styles = css`[part='toolbar'] { display: flex; }`;");
  assert.deepEqual(findings, []);
});

// --- cross-root-part: suppression -------------------------------------------------------------

test('an inline policy-allow(cross-root-part) comment suppresses the finding', () => {
  const styles = `
    export const styles = css\`
      /* policy-allow(cross-root-part): documented reason for this one rule */
      [part='row'] { display: flex; }
      [part='row-label'] { color: red; } /* policy-allow(cross-root-part): and this one */
    \`;
  `;
  assert.deepEqual(crossRoot(BUGGY_CLASS, styles), []);
});

test('a suppression comment does not leak past an intervening code line', () => {
  const styles = `
    export const styles = css\`
      /* policy-allow(cross-root-part): only applies to the rule right below it */
      [part='row'] { display: flex; }
      [part='row-label'] { color: red; }
    \`;
  `;
  const findings = crossRoot(BUGGY_CLASS, styles);
  assert.equal(findings.length, 1);
  assert.match(findings[0], /part 'row-label'/);
});

// --- part-compound ----------------------------------------------------------------------------

test('flags ::part() followed by an attribute, class, id, combinator or descendant', () => {
  const styles = `
    export const styles = css\`
      lr-virtual-list::part(page)[aria-current='true'] { background: red; }
      lr-virtual-list::part(entry).is-dir { font-weight: 700; }
      lr-virtual-list::part(entry)#main { color: red; }
      lr-virtual-list::part(output) .error-output-label { color: red; }
      lr-virtual-list::part(chunk) > .score { color: red; }
      lr-virtual-list::part(text-layer) ::selection { background: red; }
    \`;
  `;
  const findings = checkPartCompounds('fixture.styles.ts', styles);
  assert.equal(findings.length, 6);
  assert.match(findings[0], /an attribute selector/);
  assert.match(findings[1], /a class selector/);
  assert.match(findings[2], /an id selector/);
  assert.match(findings[3], /a descendant selector/);
  assert.match(findings[4], /a combinator/);
  assert.match(findings[5], /a descendant selector/);
  assert.match(findings[0], /fixture\.styles\.ts:3/);
});

test('does NOT flag the valid ::part() forms', () => {
  const styles = `
    export const styles = css\`
      lr-virtual-list::part(row):hover { background: red; }
      lr-virtual-list::part(row):focus-visible,
      lr-virtual-list::part(row):is(:hover, :active) { outline: none; }
      lr-virtual-list::part(row cell) { color: red; }
      lr-virtual-list::part(text-span)::selection { background: red; }
      lr-virtual-list::part(row)::after { content: ''; }
      :host(:dir(rtl)) lr-virtual-list::part(text-layer) { inset-inline-start: 0; }
      lr-virtual-list::part(row)
      { color: red; }
      /* prose mentioning ::part(row) .child is a comment, not a rule */
    \`;
  `;
  assert.deepEqual(checkPartCompounds('fixture.styles.ts', styles), []);
});

if (failures > 0) {
  console.error(`${failures} part-reachability checker test(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`Part reachability checker self-test passed (${passes} cases).`);
}
