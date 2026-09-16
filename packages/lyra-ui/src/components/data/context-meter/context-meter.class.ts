import { nativeSvgTitle } from '../../../internal/svg-title.js';
import { html, svg, nothing, type TemplateResult, type SVGTemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteNumber } from '../../../internal/numbers.js';
import { getNumberFormat, resolveIntlLocale } from '../../../internal/intl-cache.js';
import { requestThenCommit } from '../../../internal/request-commit.js';
import { sanitizeCssColor } from '../../../internal/safe-css.js';
import {
  getOwnDataDescriptor,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
import { srOnly } from '../../../internal/a11y.js';
import { statePart } from '../../../internal/state-part.js';
import type { LyraVariant } from '../../../internal/variants.js';
import { styles } from './context-meter.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_contextMeterLabeledSummary, LYRA_DEFAULT_contextMeterSegmentLabel, LYRA_DEFAULT_contextMeterUsed, LYRA_DEFAULT_contextMeterUsedOfTotal } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** The shared semantic tone. Kept as a local name so existing imports keep resolving. */
export type ContextMeterTone = LyraVariant;
/** The meter geometry. This is deliberately separate from the semantic `variant` vocabulary. */
export type ContextMeterShape = 'ring' | 'bar';
/**
 * What each legend row shows beside its swatch. Combinable rather than mutually exclusive (the
 * `label | value | percentage` spelling `<lr-chart>`'s own legend uses cannot express "count AND
 * share", which is the ordinary reading of a part-to-whole key).
 */
export type ContextMeterLegendDisplay =
  | 'label'
  | 'label-value'
  | 'label-percent'
  | 'label-value-percent';

const CONTEXT_METER_LEGEND_DISPLAYS: readonly ContextMeterLegendDisplay[] = Object.freeze([
  'label',
  'label-value',
  'label-percent',
  'label-value-percent',
]);

/** Foreign attribute values normalize to the label-only default, as `shape` does. */
function normalizeContextMeterLegendDisplay(value: unknown): ContextMeterLegendDisplay {
  return CONTEXT_METER_LEGEND_DISPLAYS.includes(value as ContextMeterLegendDisplay)
    ? (value as ContextMeterLegendDisplay)
    : 'label';
}

/** Detail of `lr-segment-activate`: which band the user picked, and what it stands for. */
export interface LyraContextMeterSegmentActivateDetail {
  /** Zero-based index into the projected `segments` array. */
  readonly index: number;
  /** That segment's own `label`, passed through verbatim. */
  readonly label: string;
  /** That segment's normalized nonnegative `value` -- the absolute quantity, never a share. */
  readonly value: number;
}

export interface LyraContextMeterEventMap {
  'lr-segment-activate': CustomEvent<LyraContextMeterSegmentActivateDetail>;
}

export interface ContextMeterSegment {
  label: string;
  /** Absolute quantity (e.g. tokens), not a pre-computed percentage. */
  value: number;
  tone?: ContextMeterTone;
  /** Optional arbitrary CSS color. When set, it takes precedence over `tone`. */
  color?: string;
  /**
   * Marks this band non-actionable while `interactive` is set: its control renders genuinely
   * disabled (no tab stop, no hover/press affordance) and activating it emits no
   * `lr-segment-activate`.
   *
   * Deliberately NOT inferred from `value === 0`. A zero band is legitimately clickable in a
   * budget meter -- the original use for this component -- so inertness is declared, never
   * guessed. For the derived signal, style the `segment-empty`/`legend-item-empty` part instead.
   */
  disabled?: boolean;
}

interface RatioSegment {
  segment: Readonly<ContextMeterSegment>;
  /** The normalized value used by every visual and semantic projection. */
  value: number;
  /** This segment's share of `total`, already clamped so the running sum
   *  across all segments never exceeds 1. */
  ratio: number;
}

// Ring geometry: RADIUS/CENTER match lr-gauge's radial numbers, so both
// components' rings sit on the same circle within their viewBox. STROKE is
// intentionally heavier than the gauge's (12 vs. 10) -- tightly-packed
// multi-tone arcs need more width to stay visually distinct than a gauge's
// single fill arc, so it isn't shared.
const RADIUS = 40;
const CENTER = 50;
const STROKE = 12;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const MAX_CONTEXT_METER_SEGMENTS = 10_000;
const EMPTY_CONTEXT_METER_SEGMENTS: readonly Readonly<ContextMeterSegment>[] = Object.freeze([]);

function projectContextMeterSegments(value: unknown): readonly Readonly<ContextMeterSegment>[] {
  try {
    if (!Array.isArray(value)) return EMPTY_CONTEXT_METER_SEGMENTS;
    const length = getOwnDataDescriptor(value, 'length');
    if (
      length === MISSING_OWN_DATA_DESCRIPTOR ||
      length === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof length.value !== 'number' ||
      !Number.isSafeInteger(length.value) ||
      length.value < 0
    )
      return EMPTY_CONTEXT_METER_SEGMENTS;

    const segments: Readonly<ContextMeterSegment>[] = [];
    for (let index = 0; index < Math.min(length.value, MAX_CONTEXT_METER_SEGMENTS); index += 1) {
      const entry = getOwnDataDescriptor(value, String(index));
      if (
        entry === MISSING_OWN_DATA_DESCRIPTOR ||
        entry === UNSAFE_OWN_DATA_DESCRIPTOR ||
        entry.value === null ||
        typeof entry.value !== 'object' ||
        Array.isArray(entry.value)
      )
        continue;
      const label = getOwnDataDescriptor(entry.value, 'label');
      const segmentValue = getOwnDataDescriptor(entry.value, 'value');
      const tone = getOwnDataDescriptor(entry.value, 'tone');
      const color = getOwnDataDescriptor(entry.value, 'color');
      const disabled = getOwnDataDescriptor(entry.value, 'disabled');
      if (
        label === MISSING_OWN_DATA_DESCRIPTOR ||
        label === UNSAFE_OWN_DATA_DESCRIPTOR ||
        segmentValue === MISSING_OWN_DATA_DESCRIPTOR ||
        segmentValue === UNSAFE_OWN_DATA_DESCRIPTOR ||
        tone === UNSAFE_OWN_DATA_DESCRIPTOR ||
        color === UNSAFE_OWN_DATA_DESCRIPTOR ||
        disabled === UNSAFE_OWN_DATA_DESCRIPTOR ||
        typeof label.value !== 'string' ||
        typeof segmentValue.value !== 'number' ||
        (tone !== MISSING_OWN_DATA_DESCRIPTOR && typeof tone.value !== 'string') ||
        (color !== MISSING_OWN_DATA_DESCRIPTOR && typeof color.value !== 'string') ||
        (disabled !== MISSING_OWN_DATA_DESCRIPTOR && typeof disabled.value !== 'boolean')
      )
        continue;
      const toneValue = tone === MISSING_OWN_DATA_DESCRIPTOR ? undefined : tone.value;
      const colorValue = color === MISSING_OWN_DATA_DESCRIPTOR ? undefined : color.value;
      const disabledValue = disabled === MISSING_OWN_DATA_DESCRIPTOR ? undefined : disabled.value;
      segments.push(Object.freeze({
        label: label.value,
        value: segmentValue.value,
        ...(toneValue === undefined ? {} : { tone: toneValue as ContextMeterTone }),
        ...(colorValue === undefined ? {} : { color: colorValue as string }),
        ...(disabledValue === undefined ? {} : { disabled: disabledValue as boolean }),
      }));
    }
    return Object.freeze(segments);
  } catch {
    return EMPTY_CONTEXT_METER_SEGMENTS;
  }
}

function formatCount(n: number, locale: string): string {
  return Math.round(finiteNumber(n, 0)).toLocaleString(resolveIntlLocale(locale));
}

/**
 * `<lr-context-meter>` — a segmented occupancy meter (bar or ring) for
 * showing how a fixed capacity (a model's context window, a token budget,
 * any consumable quota) is divided across labeled categories. First-party
 * invention; no equivalent exists in Web Awesome.
 *
 * Pure data visualization: it renders `segments`/`total` as given and never
 * computes token counts, costs, or any other domain-specific estimate
 * itself — the one exception is the plain arithmetic sum of the segment
 * values used to build the accessible "X of Y used" summary below.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-context-meter
 * @csspart base - The component's root wrapper (a `<div>` for `bar`, an `<svg>` for `ring`).
 * @csspart track - The unfilled/empty capacity track.
 * @csspart segment - One occupied segment. Carries `data-tone` for styling and
 *   `--lr-context-meter-segment-color` when `color` is set. While `interactive` is set it is a
 *   `<button>` (bar) or a `role="button"` arc (ring) carrying `aria-pressed`, and a second
 *   `segment-selected` part token while its index is in `selectedIndices`.
 * @csspart segment-empty - A band whose `value` is 0. Derived, not declared, and carries no
 *   built-in treatment: it is the hook for a consumer's own "nothing in this bucket" styling. A
 *   zero band stays actionable unless its entry also sets `disabled`.
 * @csspart segment-disabled - A band whose `segments` entry sets `disabled`. The control is
 *   genuinely disabled: no tab stop, no hover/press affordance, and activating it emits nothing.
 * @csspart label - The visible caption, when `label` is set.
 * @csspart semantic - The visually-hidden meter/group carrying aggregate range semantics.
 * @csspart segment-list - The visually-hidden list exposing the segment breakdown.
 * @csspart segment-item - One visually-hidden segment label/count pair.
 * @csspart legend - The visible category key rendered below the meter when `showLegend` is set.
 *   `aria-hidden` in the default presentational mode, because `segment-list` already exposes the
 *   same names to assistive technology; reachable while `interactive` is set, where its rows are
 *   the filter controls themselves.
 * @csspart legend-item-empty - The legend row of a band whose `value` is 0. Derived; no built-in
 *   treatment, exactly like `segment-empty`.
 * @csspart legend-item-disabled - The legend row of a band whose entry sets `disabled`.
 * @csspart legend-item - One swatch + label pair in the legend, one per `segments` entry. A
 *   `<button>` carrying `aria-pressed` while `interactive` is set, a plain `<span>` otherwise.
 * @csspart legend-value - One legend row's absolute count, rendered by `legendDisplay`'s
 *   `label-value`/`label-value-percent` settings.
 * @csspart legend-percent - One legend row's share of `total`, rendered by `legendDisplay`'s
 *   `label-percent`/`label-value-percent` settings. Always the ratio the bar/ring actually paints.
 * @csspart legend-swatch - The color chip of a legend item, painted from that segment's resolved
 *   `color`/`tone` — the same ladder and the same inline custom-property escape `segment` uses.
 * @csspart legend-label - The text of a legend item (the segment's `label`).
 * @cssprop [--lr-context-meter-segment-color] - Per-segment color. Set inline on `[part="segment"]` by the component itself whenever that segment supplies a `color`; unset (and the token unread) otherwise, leaving the `data-tone` palette in charge. The matching `[part="legend-swatch"]` reads the same property, so a swatch can never disagree with the band it stands for.
 * @cssprop [--lr-context-meter-legend-swatch-size=var(--lr-size-0-625rem)] - Inline and block size of a legend swatch.
 * @cssprop [--lr-context-meter-track-size=var(--lr-size-0-5rem)] - Block size (thickness) of the `bar`-shape track, and therefore of its filled segments.
 * @cssprop [--lr-context-meter-track-radius=calc(var(--lr-radius) * 0.5)] - Corner radius of the `bar`-shape track.
 * @cssprop [--lr-context-meter-track-bg=color-mix(in srgb, var(--lr-color-border) 30%, transparent)] - Background of the unfilled remainder of the `bar`-shape track.
 * @cssprop [--lr-context-meter-segment-seam-color=var(--lr-color-surface)] - Color of the hairline seam painted between adjacent `bar`-shape segments.
 * @cssprop [--lr-context-meter-selected-ring-color=var(--lr-color-text)] - Colour of the inset ring marking a `bar`-shape band or a legend row whose index is in `selectedIndices`. Painted inside the shadow root because the state lives in the part name, and as a ring rather than an outline so it composes with the hover/press/focus outlines instead of being replaced by them.
 * @cssprop [--lr-context-meter-selected-ring-width=var(--lr-border-width-thick)] - Width of that selected ring.
 * @cssprop [--lr-context-meter-disabled-opacity=var(--lr-opacity-disabled)] - Opacity of a band or legend row whose `segments` entry sets `disabled`. The band keeps its own colour -- it is still the datum it always was -- and loses only the affordances that promise activation.
 * @cssprop [--lr-context-meter-selected-arc-stroke=16] - Stroke width, in this component's `0 0 100 100` viewBox units, of a selected `ring`-shape arc. Arcs share one bounding box, so a selected arc reports itself by thickening in place rather than by an outline that would trace the whole ring.
 * @event lr-segment-activate - A band or its legend row was activated while `interactive` is set.
 *   `detail: { index, label, value }`. Cancelable: the default action is this component toggling
 *   `index` in its own `selectedIndices`, so `preventDefault()` hands that state entirely to the
 *   consumer. Never emitted in the default presentational mode.
 * @status stable
 * @since 4.0.0
 */
export class LyraContextMeter extends LyraElement<LyraContextMeterEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    contextMeterLabeledSummary: LYRA_DEFAULT_contextMeterLabeledSummary,
    contextMeterSegmentLabel: LYRA_DEFAULT_contextMeterSegmentLabel,
    contextMeterUsed: LYRA_DEFAULT_contextMeterUsed,
    contextMeterUsedOfTotal: LYRA_DEFAULT_contextMeterUsedOfTotal,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'segments',
    'selectedIndices',
  ]);

  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-segment-activate',
  ]);

  static override styles = [LyraElement.styles, srOnly, styles];

  /** Occupied segments, each an absolute quantity against `total` — never a percentage. */
  @property({ attribute: false }) segments: readonly ContextMeterSegment[] = [];

  /** The full capacity segments are measured against (e.g. a model's context window size). */
  @property({ type: Number }) total = 0;

  private _shape: ContextMeterShape = 'bar';

  /** Meter geometry. Foreign attribute values normalize to the default bar shape. */
  @property({ reflect: true })
  get shape(): ContextMeterShape { return this._shape; }
  set shape(value: ContextMeterShape) {
    const normalized: ContextMeterShape = value === 'ring' ? 'ring' : 'bar';
    const previous = this._shape;
    if (previous === normalized) {
      // An invalid attribute can normalize to the current value. Still schedule reflection so
      // the DOM never advertises a closed-token state the renderer did not accept.
      if (value !== normalized) this.requestUpdate('shape', previous);
      return;
    }
    this._shape = normalized;
    this.requestUpdate('shape', previous);
  }

  /** Overall accessible label/caption, e.g. `"128K context window"`. */
  @property() label = '';

  /** Renders a static `[part="legend"]` key below the meter — one swatch/label pair per `segments`
   *  entry, each swatch painted with that segment's resolved `color`/`tone`. Off by default.
   *
   *  Without it, the only place a segment's own label is exposed is a hover `title` (desktop-only,
   *  undiscoverable) and the visually-hidden breakdown list — so a meter split across more than two
   *  or three categories is legible to a screen-reader user but not to a sighted one, who has to
   *  hand-roll swatch+label markup outside the component. Non-interactive: it toggles nothing and
   *  emits nothing, mirroring `<lr-sequence-strip>`'s `showLegend` rather than the interactive
   *  `<lr-graph-legend>`. */
  @property({ type: Boolean, reflect: true, attribute: 'show-legend' }) showLegend = false;

  /**
   * What each legend row shows beside its swatch. `label` (the default) is exactly the output this
   * component has always produced. The other three add the segment's own count, its share of
   * `total`, or both, as `[part="legend-value"]`/`[part="legend-percent"]` spans.
   *
   * The share is the SAME clamped ratio the bar/ring paints, so a key can never disagree with the
   * band it stands for, and it is formatted through `effectiveLocale`. Has no effect while
   * `showLegend` is unset. Folding the number into `segment.label` instead would push it into the
   * hover title and the visually-hidden breakdown too, where a screen reader would hear the count
   * twice.
   */
  @property({
    attribute: 'legend-display',
    converter: { fromAttribute: normalizeContextMeterLegendDisplay },
  })
  legendDisplay: ContextMeterLegendDisplay = 'label';

  /**
   * Opt-in filter mode: every band, and every legend row, becomes a real button that emits the
   * cancelable `lr-segment-activate`.
   *
   * Off by default, and off is unchanged from before this property existed -- a pure part-to-whole
   * visualization whose visible parts are all `aria-hidden`. On, the bands are `<button>`s (the
   * ring's arcs carry `role="button"`, since an SVG shape cannot be a native one), the legend
   * leaves the accessibility tree's shadow and its rows become buttons too, and both carry explicit
   * `aria-pressed` from `selectedIndices`. The visually-hidden `[part="segment-list"]` steps aside
   * in this mode: the buttons already expose the same label/count pairs, with the pressed state
   * attached, so repeating them statically would announce every category twice.
   *
   * A pressed state rather than an event alone: a filter toggle that cannot be reported as on or
   * off is unusable through assistive technology, whatever it looks like.
   *
   * A band's width IS its share, so a small band is a small pointer target. Pair `interactive` with
   * `showLegend` where that matters -- the legend row is the same action at full row height.
   */
  @property({ type: Boolean, reflect: true }) interactive = false;

  /**
   * Indexes of the currently selected segments, rendered as `aria-pressed="true"` plus a second
   * part token -- `segment-selected` on the band, `legend-item-selected` on its legend row.
   * Meaningful only while `interactive` is set.
   *
   * Uncontrolled by default: an activation this component emits and nobody vetoes toggles the
   * index here itself. `preventDefault()` on `lr-segment-activate` suppresses that write, which is
   * how a consumer that owns the selection takes control -- the library's standard request/commit
   * shape. Assigning the property directly always wins either way. A non-integer or out-of-range
   * entry selects nothing rather than throwing.
   */
  // numeric-guard-exempt: isSelected() rejects anything that is not an in-range integer before the
  // value reaches rendering, so a non-finite or fractional entry selects nothing.
  @property({ attribute: false }) selectedIndices: readonly number[] = [];

  private projectedSegmentsSource: unknown;
  private projectedSegments: readonly Readonly<ContextMeterSegment>[] = EMPTY_CONTEXT_METER_SEGMENTS;

  /** Later rendering only reads this once-projected, bounded data-descriptor view. */
  private get effectiveSegments(): readonly Readonly<ContextMeterSegment>[] {
    const source = this.segments;
    if (source !== this.projectedSegmentsSource) {
      this.projectedSegmentsSource = source;
      this.projectedSegments = projectContextMeterSegments(source);
    }
    return this.projectedSegments;
  }

  private normalizedSegmentValue(segment: Readonly<ContextMeterSegment>): number {
    return Math.max(0, finiteNumber(segment.value, 0));
  }

  /** Sum of segment values, clamped so a negative/NaN entry can't produce a negative total. */
  private get usedTotal(): number {
    return this.effectiveSegments.reduce((sum, segment) => {
      const next = sum + this.normalizedSegmentValue(segment);
      return finiteNumber(next, Number.MAX_VALUE);
    }, 0);
  }

  /** Per-segment ratio of `value` to `total`, clamped to [0,1] and capped so the
   *  running sum across all segments never overflows past 1 — a `segments` array
   *  that sums to more than `total` still renders a fully (not over-) filled meter. */
  private ratios(): RatioSegment[] {
    const total = Math.max(0, finiteNumber(this.total, 0));
    if (total <= 0) return [];
    const out: RatioSegment[] = [];
    let cumulative = 0;
    for (const segment of this.effectiveSegments) {
      const raw = this.normalizedSegmentValue(segment);
      const available = Math.max(0, 1 - cumulative);
      const ratio = Math.min(raw / total, available);
      cumulative += ratio;
      out.push({ segment, value: raw, ratio });
    }
    return out;
  }

  /** `usedTotal` and `total`, both clamped the same way ratios() clamps the
   *  visual fill -- a segments array that sums past total must not report an
   *  impossible "160 of 100 used"/aria-valuenow > aria-valuemax while the
   *  bar/ring visibly caps at 100%. Shared by `summary` and `willUpdate`'s
   *  aria-value* trio so the announced text and the queryable numeric value
   *  can never diverge. */
  private get clampedUsedTotal(): { used: number; total: number } {
    const total = Math.max(0, finiteNumber(this.total, 0));
    const used = total > 0 ? Math.min(this.usedTotal, total) : this.usedTotal;
    return { used, total };
  }

  private get summary(): string {
    const { used: usedForSummary, total: totalValue } = this.clampedUsedTotal;
    const used = formatCount(usedForSummary, this.effectiveLocale);
    const phrase =
      totalValue > 0
        ? this.localize('contextMeterUsedOfTotal', undefined, {
            used,
            total: formatCount(totalValue, this.effectiveLocale),
          })
        : this.localize('contextMeterUsed', undefined, { used });
    return this.label
      ? this.localize('contextMeterLabeledSummary', undefined, { label: this.label, summary: phrase })
      : phrase;
  }

  /** Hover/`<title>` text for one segment. Templated so a locale controls
   *  where the count sits relative to the label, not just the words. */
  private segmentTitle(segment: Readonly<ContextMeterSegment>, value = this.normalizedSegmentValue(segment)): string {
    return this.localize('contextMeterSegmentLabel', undefined, {
      label: segment.label,
      count: formatCount(value, this.effectiveLocale),
    });
  }

  private segmentColor(segment: ContextMeterSegment): string | undefined {
    return segment.color ? sanitizeCssColor(segment.color) : undefined;
  }

  /** The in-range integer entries of `selectedIndices`, deduplicated and ordered. */
  private canonicalSelectedIndices(): number[] {
    const count = this.effectiveSegments.length;
    return [
      ...new Set(
        this.selectedIndices.filter(
          (candidate): candidate is number =>
            typeof candidate === 'number' &&
            Number.isInteger(candidate) &&
            candidate >= 0 &&
            candidate < count,
        ),
      ),
    ].sort((left, right) => left - right);
  }

  private isSelected(index: number): boolean {
    return this.canonicalSelectedIndices().includes(index);
  }

  /** The same clamped ratio the band paints, as a locale-formatted percentage. */
  private formatShare(ratio: number): string {
    return getNumberFormat(this.effectiveLocale, {
      style: 'percent',
      maximumFractionDigits: 1,
    }).format(ratio);
  }

  /**
   * Emits the activation and, unless a listener vetoed it, toggles `index` in this component's own
   * `selectedIndices`. The write is the default action, which is what makes the event a real veto
   * point rather than a notification wearing a cancelable costume: a consumer that owns the
   * selection calls `preventDefault()` and assigns the property itself.
   *
   * No write-tracking guard: `selectedIndices` is a plain collection property with no setter side
   * effects, so there is nothing for a guard to observe, and a listener that reassigns it during
   * the dispatch is deliberately overwritten by this commit -- `preventDefault()` is the documented
   * way to stop it, exactly as `<lr-thread-list>`'s group-toggle pair behaves.
   */
  private activateSegment(index: number): void {
    if (!this.interactive) return;
    const segment = this.effectiveSegments[index];
    if (!segment || segment.disabled) return;
    requestThenCommit({
      requestDetail: {
        index,
        label: segment.label,
        value: this.normalizedSegmentValue(segment),
      },
      emitRequest: (detail, init: { cancelable: true }) =>
        this.emit('lr-segment-activate', detail, init),
      commit: () => {
        const selected = this.canonicalSelectedIndices();
        this.selectedIndices = selected.includes(index)
          ? selected.filter((candidate) => candidate !== index)
          : [...selected, index].sort((left, right) => left - right);
      },
    });
  }

  /** Enter/Space on the ring's `role="button"` arcs, which get none of a native button's keys. */
  private onArcKeyDown(event: KeyboardEvent, index: number): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.activateSegment(index);
  }

  /** The part token list for a band or legend row. `::part(segment)[data-selected]` is invalid
   *  CSS, so every state a consumer may need to style has to live in the part name itself. */
  private segmentPart(base: string, index: number, segment: Readonly<ContextMeterSegment>): string {
    return statePart(base, {
      selected: this.isSelected(index),
      empty: this.normalizedSegmentValue(segment) === 0,
      disabled: segment.disabled === true,
    });
  }

  private renderSemantics(): TemplateResult {
    const { used, total } = this.clampedUsedTotal;
    // A host aria-label names the custom element itself. Reusing it here would expose the same
    // name on two semantic owners; the meter retains its purpose-specific generated summary.
    const accessibleName = this.summary;
    return html`
      <div
        part="semantic"
        class="sr-only"
        role=${total > 0 ? 'meter' : 'group'}
        aria-label=${accessibleName}
        aria-valuenow=${total > 0 ? String(used) : nothing}
        aria-valuemin=${total > 0 ? '0' : nothing}
        aria-valuemax=${total > 0 ? String(total) : nothing}
      ></div>
      ${this.interactive
        ? nothing
        : html`<ul part="segment-list" class="sr-only">
            ${this.effectiveSegments.map(
              (segment) => html`<li part="segment-item">${this.segmentTitle(segment)}</li>`,
            )}
          </ul>`}
    `;
  }

  private renderBar(): TemplateResult {
    const ratios = this.ratios();
    return html`
      <div part="base">
        ${this.label ? html`<div part="label" aria-hidden="true">${this.label}</div>` : nothing}
        <div part="track" aria-hidden=${this.interactive ? nothing : 'true'}>
          ${ratios.map(({ segment, value, ratio }, index) => {
            const title = this.segmentTitle(segment, value);
            const selected = this.isSelected(index);
            const style = styleMap({
              flexBasis: `${(ratio * 100).toFixed(4)}%`,
              ...(this.segmentColor(segment)
                ? { '--lr-context-meter-segment-color': this.segmentColor(segment)! }
                : {}),
            });
            // hit-area-exempt: a band's inline size IS the datum -- the share it stands for -- so a
            // minimum target size would make the meter lie about its own data. The legend row is
            // the same action at full row height, which is why `interactive` documents pairing with
            // `showLegend`.
            return this.interactive
              ? html`<button
                  part=${this.segmentPart('segment', index, segment)}
                  type="button"
                  data-tone=${segment.tone ?? 'neutral'}
                  ?disabled=${segment.disabled === true}
                  aria-pressed=${selected ? 'true' : 'false'}
                  aria-label=${title}
                  title=${title}
                  style=${style}
                  @click=${() => this.activateSegment(index)}
                ></button>`
              : html`<span
                  part="segment"
                  data-tone=${segment.tone ?? 'neutral'}
                  title=${title}
                  style=${style}
                ></span>`;
          })}
        </div>
      </div>
    `;
  }

  private renderRing(): TemplateResult {
    const ratios = this.ratios();
    let cumulative = 0;
    const arcs: SVGTemplateResult[] = ratios.map(({ segment, value, ratio }, index) => {
      const segLen = ratio * CIRCUMFERENCE;
      const dashoffset = -cumulative * CIRCUMFERENCE;
      cumulative += ratio;
      const title = this.segmentTitle(segment, value);
      const selected = this.isSelected(index);
      // An SVG shape cannot be a native `<button>`, so an interactive arc carries the role, its own
      // tab stop and its own Enter/Space handling -- the same shape `<lr-lite-chart>`'s marks use.
      return svg`
        <circle
          part=${this.interactive ? this.segmentPart('segment', index, segment) : 'segment'}
          data-tone=${segment.tone ?? 'neutral'}
          role=${this.interactive ? 'button' : nothing}
          tabindex=${this.interactive && !segment.disabled ? '0' : nothing}
          aria-disabled=${this.interactive && segment.disabled ? 'true' : nothing}
          aria-pressed=${this.interactive ? (selected ? 'true' : 'false') : nothing}
          aria-label=${this.interactive ? title : nothing}
          @click=${this.interactive && !segment.disabled
            ? () => this.activateSegment(index)
            : nothing}
          @keydown=${this.interactive && !segment.disabled
            ? (event: KeyboardEvent) => this.onArcKeyDown(event, index)
            : nothing}
          style=${styleMap(
            this.segmentColor(segment)
              ? { '--lr-context-meter-segment-color': this.segmentColor(segment)! }
              : {},
          )}
          cx=${CENTER}
          cy=${CENTER}
          r=${RADIUS}
          stroke-width=${STROKE}
          stroke-dasharray=${`${segLen} ${CIRCUMFERENCE - segLen}`}
          stroke-dashoffset=${dashoffset}
          transform="rotate(-90 ${CENTER} ${CENTER})"
        >${nativeSvgTitle(title)}</circle>
      `;
    });
    return html`
      <svg part="base" viewBox="0 0 100 100" aria-hidden=${this.interactive ? nothing : 'true'}>
        <circle part="track" cx=${CENTER} cy=${CENTER} r=${RADIUS} stroke-width=${STROKE}></circle>
        ${arcs}
        ${this.label ? svg`
          <foreignObject part="label" x="20" y="25" width="60" height="50" aria-hidden="true">
            <div class="ring-label" title=${this.label}>${this.label}</div>
          </foreignObject>
        ` : nothing}
      </svg>
    `;
  }

  /** The visible category key. It repeats, in sighted form, exactly the label/count pairs the
   *  visually-hidden `segment-list` already exposes, so the whole subtree is `aria-hidden` — a
   *  screen reader announcing the same scheme twice is worse than not announcing the duplicate at
   *  all. Same stance, and the same `legend`/`legend-item`/`legend-swatch`/`legend-label` part
   *  names, as `<lr-sequence-strip>`'s legend. */
  private renderLegend(): TemplateResult {
    const display = normalizeContextMeterLegendDisplay(this.legendDisplay);
    const showsValue = display === 'label-value' || display === 'label-value-percent';
    const showsPercent = display === 'label-percent' || display === 'label-value-percent';
    const ratios = this.ratios();
    return html`
      <div part="legend" aria-hidden=${this.interactive ? nothing : 'true'}>
        ${this.effectiveSegments.map((segment, index) => {
          const color = this.segmentColor(segment);
          const selected = this.isSelected(index);
          const swatch = html`<span
            part="legend-swatch"
            data-tone=${segment.tone ?? 'neutral'}
            style=${styleMap(color ? { '--lr-context-meter-segment-color': color } : {})}
          ></span>`;
          // The visible text is the row's accessible name in interactive mode, so the count and
          // share a filter row shows are the ones it announces.
          const content = html`${swatch}
            <span part="legend-label">${segment.label}</span>
            ${showsValue
              ? html`<span part="legend-value"
                  >${formatCount(
                    this.normalizedSegmentValue(segment),
                    this.effectiveLocale,
                  )}</span
                >`
              : nothing}
            ${showsPercent
              ? html`<span part="legend-percent"
                  >${this.formatShare(ratios[index]?.ratio ?? 0)}</span
                >`
              : nothing}`;
          return this.interactive
            ? html`<button
                part=${this.segmentPart('legend-item', index, segment)}
                type="button"
                ?disabled=${segment.disabled === true}
                aria-pressed=${selected ? 'true' : 'false'}
                @click=${() => this.activateSegment(index)}
              >
                ${content}
              </button>`
            : html`<span part="legend-item">${content}</span>`;
        })}
      </div>
    `;
  }

  override render(): TemplateResult {
    return html`
      ${this.shape === 'ring' ? this.renderRing() : this.renderBar()}
      ${this.showLegend ? this.renderLegend() : nothing}
      ${this.renderSemantics()}
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-context-meter': LyraContextMeter;
  }
}
