import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteCount } from '../../../internal/numbers.js';
import type { Citation } from '../../../ai/types.js';
import type { ContextMeterSegment, ContextMeterTone } from '../../data/context-meter/context-meter.class.js';
import type { ExportFormatOption } from '../../utility/export-button/export-button.class.js';
import '../../data/context-meter/context-meter.class.js';
import '../../utility/copy-button/copy-button.class.js';
import '../../utility/export-button/export-button.class.js';
import '../../retrieval/citation-badge/citation-badge.class.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './context-inspector.styles.js';

/**
 * One redacted character range within a `ContextInspectorSegment.text`. `start`/`end` are plain
 * UTF-16 offsets, matching `Citation['span']`'s own `{ start; end }` shape (`ai/types.ts`). `text`
 * is expected to already carry a redaction placeholder in that range (e.g. `[REDACTED]`) -- this
 * component only visually/accessibly marks the range, it never receives, un-redacts, or renders
 * the original sensitive content.
 */
export interface ContextInspectorRedaction {
  start: number;
  end: number;
  /** Shown as the marker's `title`/accessible reason. Falls back to a generic localized "Redacted" when unset. */
  reason?: string;
}

/** One piece of the assembled final prompt context, e.g. a system prompt, a retrieved chunk, or one chat-history turn. */
export interface ContextInspectorSegment {
  id: string;
  /** Short heading, e.g. "System prompt", "Retrieved chunk 2". Feeds both this segment's own heading and its `<lr-context-meter>` segment label. */
  label: string;
  /** The segment's final text, exactly as sent to the model (post-redaction/post-truncation). */
  text: string;
  /** Estimated token count. Feeds `<lr-context-meter>`'s segment `value` directly. */
  tokens: number;
  tone?: ContextMeterTone;
  /** Source attribution -- renders a `<lr-citation-badge>` carrying `citation.sourceId`/`citation.label`. */
  citation?: Citation;
  /** True when `text` was cut short of the segment's original content. */
  truncated?: boolean;
  /** Tokens omitted by truncation, shown in the truncation-boundary marker's text when set. */
  omittedTokens?: number;
  /** Character ranges within `text` that are redaction placeholders (see `ContextInspectorRedaction`). */
  redactions?: ContextInspectorRedaction[];
}

interface NormalizedRedaction {
  start: number;
  end: number;
  reason?: string;
}

/**
 * Clamps, sorts, and merges overlapping/inverted/out-of-range ranges in `redactions` against
 * `length` -- bad host data (a dangling span past the end of `text`, a reversed `start`/`end`, two
 * overlapping spans) degrades to a clamped, non-overlapping range list instead of throwing or
 * corrupting the rendered text.
 */
function normalizeRedactions(redactions: ContextInspectorRedaction[] | undefined, length: number): NormalizedRedaction[] {
  if (!redactions || redactions.length === 0) return [];
  const clamped = redactions
    .map((r) => ({
      start: finiteCount(Math.min(r.start, r.end), 0, length),
      end: finiteCount(Math.max(r.start, r.end), 0, length),
      reason: r.reason,
    }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start);
  const merged: NormalizedRedaction[] = [];
  for (const r of clamped) {
    const prev = merged[merged.length - 1];
    if (prev && r.start < prev.end) {
      prev.end = Math.max(prev.end, r.end);
      continue;
    }
    merged.push({ ...r });
  }
  return merged;
}

function formatCount(n: number, locale: string): string {
  return Math.round(finiteCount(n)).toLocaleString(locale);
}

/**
 * `<lr-context-inspector>` — an inspection view of the exact context assembled for a model call:
 * per-segment token estimates via `<lr-context-meter>`, source attribution via
 * `<lr-citation-badge>`, and copy/export affordances via `<lr-copy-button>`/`<lr-export-button>`.
 * Truncation-boundary and redaction-marker rendering are this component's own minimal
 * presentational logic (see `ContextInspectorSegment`'s `truncated`/`omittedTokens`/`redactions`
 * fields) — no existing primitive covers "show where this got cut off / redacted", so this stays a
 * small, purpose-built rendering step rather than a general text-annotation system.
 *
 * Pure projection: never fetches, estimates tokens, or performs redaction itself — `segments` is
 * expected to already carry each field's final, already-processed value (e.g. `text` already has
 * any redaction placeholders substituted in; this component never sees or renders the original
 * unredacted content).
 *
 * @customElement lr-context-inspector
 * @event lr-copy - `detail: { text }`, surfaced by the embedded `lr-copy-button` copying the
 *   assembled context text (every segment's `label` + `text`, in order). Bubbles + composed
 *   already; not re-emitted, so exactly one event reaches a host listener.
 * @event lr-export - `detail: { format }`, surfaced by the embedded `lr-export-button`, one row
 *   per segment. Cancelable — see that component's own contract for substituting a
 *   server-generated export.
 * @event lr-export-complete - `detail: { format }`, fired after a non-cancelled export completes.
 * @event lr-citation-activate - `detail: { sourceId, index }`, surfaced by a segment's embedded
 *   `lr-citation-badge` — the "jump to this source" signal a host wires to scrolling/highlighting
 *   the matching `lr-source-card`.
 * @event lr-citation-open - `detail: { sourceId, index, href }`, this component's "full preview"
 *   signal, surfaced the same way.
 * @csspart base - The `role="group"` wrapper.
 * @csspart meter - The embedded `lr-context-meter`. Omitted (replaced by `empty`) when `segments` is empty.
 * @csspart toolbar - The wrapper around the copy/export affordances. Omitted when `segments` is empty.
 * @csspart copy-button - The embedded `lr-copy-button`.
 * @csspart export-button - The embedded `lr-export-button`.
 * @csspart segments - The `role="list"` wrapper around all segments. Omitted (replaced by `empty`) when `segments` is empty.
 * @csspart segment - One segment's wrapper (`role="listitem"`).
 * @csspart segment-header - A segment's label/token-count/citation row.
 * @csspart segment-label - A segment's visible label text.
 * @csspart segment-tokens - A segment's visible token-estimate text.
 * @csspart citation - A segment's embedded `lr-citation-badge`, rendered only when it carries a `citation`.
 * @csspart segment-text - A segment's text body, carrying any `redaction` marks and its own trailing `truncation-boundary` marker.
 * @csspart redaction - One redacted range within a segment's text (a `<mark>`).
 * @csspart truncation-boundary - The marker appended after a `truncated` segment's text.
 * @csspart empty - The empty state, shown when `segments` is empty.
 */
export class LyraContextInspector extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** The assembled context, one entry per piece (system prompt, retrieved chunk, history turn, ...). */
  @property({ attribute: false }) segments: ContextInspectorSegment[] = [];

  /** The full token budget `segments` are measured against — passed straight through to `<lr-context-meter>`'s own `total`. */
  @property({ type: Number }) total = 0;

  /** Accessible group name, and the embedded `<lr-context-meter>`'s own visible caption, e.g. "128K context window". */
  @property() label = '';

  /** Export format(s) offered by the embedded `<lr-export-button>` — a single id renders a plain button, more than one a format-choice menu. */
  @property({ attribute: false }) formats: ExportFormatOption[] = ['json'];

  /** Download filename (no extension) passed through to `<lr-export-button>`. */
  @property() filename = 'context';

  private get meterSegments(): ContextMeterSegment[] {
    return this.segments.map((s) => ({ label: s.label, value: s.tokens, ...(s.tone ? { tone: s.tone } : {}) }));
  }

  /** Every segment's `label` + `text`, in order — the `<lr-copy-button>`'s `value`. */
  private get assembledText(): string {
    return this.segments.map((s) => `${s.label}\n${s.text}`).join('\n\n');
  }

  /** One flat row per segment for `<lr-export-button>` — `redactions` is summarized as a count
   *  rather than carried in full, keeping every export format (including CSV) well-formed. */
  private get exportRows(): Record<string, unknown>[] {
    return this.segments.map((s) => ({
      id: s.id,
      label: s.label,
      tokens: s.tokens,
      truncated: !!s.truncated,
      omittedTokens: s.omittedTokens ?? null,
      sourceId: s.citation?.sourceId ?? null,
      redactionCount: s.redactions?.length ?? 0,
      text: s.text,
    }));
  }

  private renderSegmentText(segment: ContextInspectorSegment): TemplateResult {
    const text = segment.text;
    const redactions = normalizeRedactions(segment.redactions, text.length);
    if (redactions.length === 0) return html`${text}`;
    const nodes: unknown[] = [];
    let cursor = 0;
    for (const r of redactions) {
      if (r.start > cursor) nodes.push(text.slice(cursor, r.start));
      nodes.push(
        html`<mark part="redaction" title=${r.reason || this.localize('contextInspectorRedacted')}
          >${text.slice(r.start, r.end)}</mark
        >`,
      );
      cursor = r.end;
    }
    if (cursor < text.length) nodes.push(text.slice(cursor));
    return html`${nodes}`;
  }

  private renderTruncationBoundary(segment: ContextInspectorSegment): TemplateResult {
    const text =
      segment.omittedTokens != null
        ? this.localize('contextInspectorTruncatedCount', undefined, {
            count: formatCount(segment.omittedTokens, this.effectiveLocale),
          })
        : this.localize('contextInspectorTruncated');
    return html`<div part="truncation-boundary" role="note">${text}</div>`;
  }

  private renderSegment(segment: ContextInspectorSegment, citationIndex: number): TemplateResult {
    const tokensText = this.localize('contextInspectorSegmentTokens', undefined, {
      tokens: formatCount(segment.tokens, this.effectiveLocale),
    });
    return html`
      <div part="segment" role="listitem">
        <div part="segment-header">
          <span part="segment-label">${segment.label}</span>
          <span part="segment-tokens">${tokensText}</span>
          ${segment.citation
            ? html`<lr-citation-badge part="citation" source-id=${segment.citation.sourceId ?? ''} index=${citationIndex}
                >${segment.citation.label ?? ''}</lr-citation-badge
              >`
            : nothing}
        </div>
        <div part="segment-text">
          ${this.renderSegmentText(segment)}${segment.truncated ? this.renderTruncationBoundary(segment) : nothing}
        </div>
      </div>
    `;
  }

  render(): TemplateResult {
    const groupLabel = this.getAttribute('aria-label') || this.label || this.localize('contextInspectorLabel');

    if (this.segments.length === 0) {
      return html`
        <div part="base" role="group" aria-label=${groupLabel}>
          <lr-empty part="empty" heading=${this.localize('contextInspectorEmpty')}></lr-empty>
        </div>
      `;
    }

    let citationIndex = 0;
    return html`
      <div part="base" role="group" aria-label=${groupLabel}>
        <lr-context-meter part="meter" .segments=${this.meterSegments} .total=${this.total} label=${this.label}></lr-context-meter>
        <div part="toolbar">
          <lr-copy-button
            part="copy-button"
            .value=${this.assembledText}
            aria-label=${this.localize('contextInspectorCopyLabel')}
          ></lr-copy-button>
          <lr-export-button part="export-button" .rows=${this.exportRows} .formats=${this.formats} filename=${this.filename}></lr-export-button>
        </div>
        <div part="segments" role="list">
          ${this.segments.map((segment) => {
            if (segment.citation) citationIndex += 1;
            return this.renderSegment(segment, citationIndex);
          })}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-context-inspector': LyraContextInspector;
  }
}
