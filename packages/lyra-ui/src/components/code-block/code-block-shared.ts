/**
 * Localized label helpers, line-highlighting parsing, and the shared shiki
 * transformer for `<lr-code-block>` and `<lr-code-block-core>`. Both
 * components render an otherwise-identical header/body, and pulling their
 * common `this.localize()` call sites and line-addressing logic out into
 * one place keeps their behavior from silently drifting apart the way it
 * previously did between the two.
 */

import type { ShikiTransformer } from 'shiki';
import type { OptionalPeerApi } from '../../internal/optional-peer-types.js';

/** Matches `LyraElement.localize()`'s signature so either component's bound
 *  method can be passed straight through. */
export type LyraLocalizeFn = (
  key: string,
  fallback?: string,
  values?: Record<string, string | number>,
) => string;

/** The collapse/expand header toggle button's `aria-label`. */
export function codeBlockToggleLabel(localize: LyraLocalizeFn, collapsed: boolean): string {
  return collapsed ? localize('expandCode') : localize('collapseCode');
}

/** The copy-to-clipboard header button's `aria-label`. */
export function codeBlockCopyLabel(localize: LyraLocalizeFn, justCopied: boolean): string {
  return justCopied ? localize('copiedToClipboard') : localize('copyCode');
}

/** The `[part="body"]` region's `aria-label`: the filename when set, else a
 *  language-aware "Code" region label. */
export function codeBlockBodyLabel(localize: LyraLocalizeFn, filename: string, language: string): string {
  return filename || (language ? localize('codeRegionWithLanguage', undefined, { language }) : localize('codeRegion'));
}

/**
 * Parses a `highlight-lines` attribute value (e.g. `"3-5,7"`) into the set of one-based line
 * numbers it addresses: comma-separated segments, each either a single line number or an
 * inclusive range, whitespace around commas/dashes tolerated, a reversed range (`"5-3"`)
 * normalized to ascending order. An invalid segment is skipped (with a `console.warn`) rather
 * than throwing or discarding the otherwise-valid segments around it.
 */
export function parseHighlightLines(spec: string): Set<number> {
  const lines = new Set<number>();
  for (const raw of spec.split(',')) {
    const segment = raw.trim();
    if (!segment) continue;
    const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(segment);
    if (rangeMatch) {
      const a = Number(rangeMatch[1]);
      const b = Number(rangeMatch[2]);
      for (let n = Math.min(a, b); n <= Math.max(a, b); n++) lines.add(n);
      continue;
    }
    const single = /^(\d+)$/.exec(segment);
    if (single) {
      lines.add(Number(single[1]));
      continue;
    }
    console.warn(`highlight-lines: ignored invalid segment "${segment}"`);
  }
  return lines;
}

export interface CodeBlockLineTransformerOptions {
  lineNumbers: boolean;
  highlightedLines: Set<number>;
  activeLines: Set<number>;
}

/**
 * A shiki transformer shared by `<lr-code-block>` and `<lr-code-block-core>` — rewrites
 * shiki's generated `<pre>`/`<code>`/per-line hast nodes so the highlighted output carries this
 * library's own `part="pre"`/`part="code"` hooks plus, per line, `data-line`, and (only for a
 * highlighted/active line) `data-highlighted`/`data-active` and `part="line-highlight"`. Also
 * strips shiki's own default `tabindex="0"` from `<pre>` — each component's own `[part="body"]`
 * wrapper is the single scrollable/focusable region.
 */
export function codeBlockLineTransformer(options: CodeBlockLineTransformerOptions): ShikiTransformer {
  return {
    name: 'lr-code-block-parts',
    pre(node: OptionalPeerApi) {
      node.properties.part = ['pre'];
      if (options.lineNumbers) {
        const classes = Array.isArray(node.properties.class)
          ? node.properties.class
          : node.properties.class
            ? [node.properties.class]
            : [];
        node.properties.class = [...classes, 'line-numbers'];
      }
      delete node.properties.tabindex;
    },
    code(node: OptionalPeerApi) {
      node.properties.part = ['code'];
    },
    line(node: OptionalPeerApi, line: number) {
      node.properties['data-line'] = String(line);
      if (options.highlightedLines.has(line)) {
        node.properties.part = ['line-highlight'];
        node.properties['data-highlighted'] = '';
      }
      if (options.activeLines.has(line)) node.properties['data-active'] = '';
    },
  };
}
