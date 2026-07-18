import {
  html,
  nothing,
  svg,
  type TemplateResult,
  type SVGTemplateResult,
  type PropertyValues,
  type ComplexAttributeConverter,
} from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { finiteCount, finiteRange } from '../../internal/numbers.js';
import { styles } from './generation-status.styles.js';
import { getNumberFormat, getPluralRules } from '../../internal/intl-cache.js';

// Mirrors the shared icon set's viewBox/stroke conventions
// (internal/icons.ts's chevronIcon()/closeIcon()/etc.) without adding a
// stop glyph to that module -- it's off limits here -- so this one-off icon
// still reads as part of the same visual language as the rest of the
// library's inline icons. Identical shape to `<lyra-chat-composer>`'s own
// local `stopIcon()` (the conventional filled-square "stop generating"
// glyph), duplicated rather than imported since these are two independently
// consumable components with no dependency between them.
function stopIcon(): SVGTemplateResult {
  return svg`
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      aria-hidden="true"
      focusable="false"
    ><rect x="6" y="6" width="12" height="12" rx="1.5"></rect></svg>
  `;
}

interface FormattedElapsed {
  key: 'generationStatusElapsedSeconds' | 'elapsedMinutesSecondsTemplate';
  values: Record<string, string>;
}

/** `4200` produces a localized seconds message; `65000` produces a localized
 *  minutes-and-seconds message. Sub-minute durations get one
 *  decimal place of seconds (the common case: most single generations finish
 *  in single-digit seconds, where whole-second precision would look static
 *  between ticks); once a full minute is reached, `"Xm Ys"` reads better than
 *  a fractional-minute or a 3-4 digit seconds count. The `59.95` cutoff (not
 *  a plain `60`) exists so a value that *rounds* to `"60.0s"` at one-decimal
 *  precision is displayed as `"1m 0s"` instead -- without it, the two
 *  branches could each independently round the same instant to a different
 *  minute. Returning a message key and values keeps all library-owned words
 *  and punctuation inside the localized template. */
function formatElapsed(ms: number, locale: string): FormattedElapsed {
  const totalSeconds = Math.max(0, ms) / 1000;
  if (totalSeconds < 59.95) {
    const seconds = getNumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(Math.round(totalSeconds * 10) / 10);
    return { key: 'generationStatusElapsedSeconds', values: { seconds } };
  }
  const wholeSeconds = Math.round(totalSeconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const seconds = wholeSeconds % 60;
  const numberFormat = getNumberFormat(locale, { maximumFractionDigits: 0 });
  return {
    key: 'elapsedMinutesSecondsTemplate',
    values: { minutes: numberFormat.format(minutes), seconds: numberFormat.format(seconds) },
  };
}

/** Locale-formats a token count after applying the component's documented
 *  non-negative integer normalization. */
function formatTokenCount(count: number, locale: string): { rounded: number; formatted: string } {
  const rounded = Math.max(0, Math.round(count));
  return { rounded, formatted: getNumberFormat(locale).format(rounded) };
}

/** `27.4` -> `"27"`; `3.2` -> `"3.2"`. Same shape as this file's
 *  `formatElapsed`/`<lyra-tool-call-chip>`'s `formatDuration`: the low end of
 *  the range (where a whole-number rounding would flatten every early
 *  reading to the same "0" or "1") gets one decimal place, while anything at
 *  or above 10 tok/s rounds to a whole number, which is plenty precise for a
 *  live-updating throughput figure. The caller interpolates the result into
 *  the complete localized throughput message. */
function formatThroughput(value: number, locale: string): string {
  const clamped = Math.max(0, value);
  const rounded = clamped < 10 ? Math.round(clamped * 10) / 10 : Math.round(clamped);
  return getNumberFormat(locale, { maximumFractionDigits: clamped < 10 ? 1 : 0 }).format(rounded);
}

/**
 * String-aware boolean attribute converter for `show-stop`. Lit's built-in
 * `type: Boolean` converter is presence-based -- the attribute's mere
 * presence (regardless of its string value) maps to `true`, so a plain-
 * markup consumer writing the literal `show-stop="false"` would actually get
 * the button *shown*, the opposite of what that string reads as (the same
 * bug class `<lyra-streaming-text>`'s `optionalBooleanConverter` and
 * `<lyra-line-chart>`'s `WithoutBeginAtZero` story both document). Unlike
 * `<lyra-streaming-text>`'s tri-state converter, this property's default is
 * `true`, not "unset" -- so this one only needs two states: attribute absent
 * (or removed) -> `true` (the default); `show-stop="false"` -> `false`;
 * anything else present (no value, `="true"`, ...) -> `true`.
 */
const showStopConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute(value): boolean {
    return value !== 'false';
  },
  toAttribute(value): string | null {
    // `true` is this property's default, so there's nothing worth reflecting
    // for it; only the non-default `false` needs an attribute at all.
    return value ? null : 'false';
  },
};

export interface LyraGenerationStatusEventMap {
  'lyra-stop': CustomEvent<undefined>;
}
/**
 * `<lyra-generation-status>` — a compact, ticking status readout shown
 * alongside an in-progress AI response: elapsed time, token count, and
 * token-throughput, plus a built-in Stop button. Renders as e.g.
 * `12.3s · 340 tokens · 27 tok/s [Stop]`.
 *
 * This is deliberately a *different* concern than the already-landed
 * `<lyra-stream-status>`: that component is about transport/connection
 * health (idle/connecting/streaming/stalled, heartbeat-aware stall
 * detection), while this one is a user-facing metrics readout for a
 * generation that both components' hosts typically already know is
 * healthily in progress. Neither imports or depends on the other, and a
 * consumer building a full generation UI is expected to compose both side by
 * side rather than pick one.
 *
 * `active` drives an internal ~1s `setInterval` ticker that recomputes the
 * elapsed-time display (a plain interval is sufficient here -- unlike
 * `<lyra-stream-status>`'s stall timer, this never needs to be armed with a
 * precise deadline, only to refresh a display roughly once a second). The
 * elapsed clock's start instant is `started-at` when set (an epoch-ms
 * timestamp -- lets a host that already knows exactly when generation began,
 * e.g. from its own request-dispatch timestamp, feed that in directly and
 * survive this component being created slightly later than that instant);
 * when `started-at` is unset, this component falls back to capturing
 * `Date.now()` itself at the moment `active` flips from `false`/unset to
 * `true`, so the ticker still starts from a sensible instant with zero
 * required host bookkeeping. The ticker is cleared whenever `active` becomes
 * `false` and on disconnect; the display is left at whatever it last showed
 * (frozen, not reset to zero) -- a static "Generated in 12.3s" reads better
 * as a completed-state summary than the readout blanking out the instant
 * generation ends.
 *
 * `tokens-per-second`, when the host supplies it directly (e.g. from its own
 * smoothed/windowed rate calculation), is always used as-is. When omitted,
 * this component derives a live figure itself from `token-count` divided by
 * elapsed seconds -- but only once at least one full second of elapsed time
 * has accumulated, since dividing by a sub-second elapsed window can produce
 * wildly-swinging, misleading early readings (e.g. 3 tokens in 40ms reading
 * as "75 tok/s"). A host that wants a stable figure from the very first tick
 * should supply `tokens-per-second` itself. The tokens segment and the
 * throughput segment are independently optional: either, both, or neither
 * may render depending on what's available, per each property's own doc.
 *
 * Accessibility: this readout ticks roughly once per second while active,
 * which is exactly the kind of high-frequency update
 * `<lyra-live-region>`/`Announcer` (`../../internal/announcer.js`) exists to
 * *prevent* from being read aloud verbatim -- routing a per-second numeric
 * tick through even a throttled announcer would still narrate a new number
 * to a screen-reader user roughly once every throttle window for as long as
 * generation runs, which is noise, not information. This component
 * therefore carries no `role="status"`/`aria-live` of its own and never
 * announces anything; a host that wants generation-start/-end announced
 * should pair this with something that announces state *transitions* (e.g.
 * `<lyra-typing-indicator>`'s mount-time announcement), not this ticking
 * readout. The one genuinely actionable, infrequent control here -- the Stop
 * button -- gets a normal, always-present `aria-label`, no different from
 * any other icon-only button in this library.
 *
 * @customElement lyra-generation-status
 * @event lyra-stop - The built-in Stop button was clicked. No detail payload.
 * @csspart base - The root inline layout container.
 * @csspart elapsed - The elapsed-time segment, e.g. `"12.3s"`. Always rendered (reads `"0.0s"` before the component has ever been active).
 * @csspart tokens - The token-count segment, e.g. `"340 tokens"`. Only rendered when `token-count` is set.
 * @csspart throughput - The throughput segment, e.g. `"27 tok/s"`. Only rendered when a value is available (host-supplied or derived; see the class doc).
 * @csspart stop-button - The built-in Stop button. Only rendered while `show-stop` is true.
 */
export class LyraGenerationStatus extends LyraElement<LyraGenerationStatusEventMap> {
  static styles = [LyraElement.styles, styles];

  /** Whether generation is currently in progress. The elapsed-time ticker
   *  runs only while this is `true` (see the class doc). */
  @property({ type: Boolean, reflect: true }) active = false;

  /** Epoch-ms timestamp of when generation began. Optional -- when unset (or
   *  when set to a value that fails to parse as a finite number, e.g. an
   *  ISO-8601 date string) while `active` is `true`, this component captures
   *  the current time itself the moment `active` becomes `true` and counts
   *  from there instead (see the class doc). */
  @property({ type: Number, attribute: 'started-at' }) startedAt?: number;

  /** Running token count so far. Omitted from the readout entirely (no
   *  `tokens` segment) while unset. */
  @property({ type: Number, attribute: 'token-count' }) tokenCount?: number;

  /** Host-computed tokens/sec figure, used as-is when set. When unset, this
   *  component derives a live figure from `token-count` and elapsed time
   *  itself once one is available -- see the class doc for the exact rule
   *  and why. */
  @property({ type: Number, attribute: 'tokens-per-second' }) tokensPerSecond?: number;

  /** Whether the built-in Stop button renders at all. Defaults to `true`.
   *  Uses {@link showStopConverter} rather than Lit's default presence-based
   *  `type: Boolean` handling, so a plain-HTML consumer with no way to write
   *  a `.showStop` property binding can still turn this off with
   *  `show-stop="false"`; a Lit template can do the same with either that
   *  attribute string or a `.showStop=${false}` property binding. */
  @property({ attribute: 'show-stop', converter: showStopConverter }) showStop = true;

  // Recomputed on activation and on every ~1s tick; frozen (not reset) once
  // `active` goes false -- see the class doc's "ticker" paragraph.
  @state() private elapsedMs = 0;

  private tickTimer?: ReturnType<typeof setInterval>;

  // Only ever set/read while `startedAt` is unset -- see the class doc.
  private fallbackStartMs?: number;

  // A re-parenting host (e.g. a virtualized/reordering list) disconnects and
  // reconnects this element without ever toggling `active` -- `willUpdate`/
  // `updated` only react to *changes* of `active`, so with no override here
  // a still-active element would come back with `disconnectedCallback`'s
  // cleared ticker never restarted, freezing the readout even though
  // `active` (still `true`) says generation is ongoing. Restarting from
  // `computeElapsedMs()` (rather than resuming a stale in-flight interval)
  // matches how `startTicker()` already re-baselines on every fresh start.
  connectedCallback(): void {
    super.connectedCallback();
    if (this.active) {
      this.elapsedMs = this.computeElapsedMs();
      this.startTicker();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopTicker();
  }

  // Recomputing `elapsedMs` here (rather than in `updated()`) matters: Lit
  // runs `willUpdate()` *before* render, as part of the same update pass, so
  // a property set here is picked up by this same render with no extra
  // cycle. Setting a reactive property from inside `updated()` instead would
  // schedule a *second* update after the first has already completed (Lit
  // warns about exactly this in dev mode) -- meaning a caller doing
  // `el.active = true; await el.updateComplete;` would still observe the
  // stale pre-activation `elapsedMs` once that first promise resolves.
  //
  // `changed.has('active')` fires on the very first update too when the
  // element mounts already `active` (the parsed-attribute/property value
  // differs from the `false` field-initializer default that was seen first)
  // -- same mechanism `<lyra-stream-status>`'s `onPhaseChanged` relies on to
  // arm its stall timer on a `phase="streaming"` mount, so mounting this
  // component already active correctly seeds `elapsedMs` with no separate
  // first-update special case needed.
  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('active') && this.active) {
      if (this.validStartedAt == null) this.fallbackStartMs = Date.now();
      this.elapsedMs = this.computeElapsedMs();
    } else if (this.active && changed.has('startedAt')) {
      // A `started-at` that arrives (or changes) mid-generation should
      // immediately re-baseline the displayed elapsed time rather than wait
      // up to ~1s for the next tick.
      this.elapsedMs = this.computeElapsedMs();
    }
  }

  // Starting/stopping the interval is a genuine side effect (not a reactive-
  // property write), so it belongs in `updated()`, unlike the `elapsedMs`
  // computation above.
  protected updated(changed: PropertyValues): void {
    if (changed.has('active')) {
      if (this.active) this.startTicker();
      else this.stopTicker();
    }
  }

  private startTicker(): void {
    this.stopTicker();
    // Setting `elapsedMs` here (unlike inside `updated()`, see that method's
    // doc) is fine: an interval callback is a wholly separate future task,
    // not a continuation of an in-progress Lit update, so this starts a
    // normal, self-contained update cycle rather than a same-tick "second
    // update" scheduled mid-render.
    this.tickTimer = setInterval(() => {
      this.elapsedMs = this.computeElapsedMs();
    }, 1000);
  }

  private stopTicker(): void {
    if (this.tickTimer !== undefined) {
      clearInterval(this.tickTimer);
      this.tickTimer = undefined;
    }
  }

  // `startedAt` is host-supplied and, unlike `tokenCount`/`tokensPerSecond`
  // (both already guarded at their read sites), had no `Number.isFinite`
  // check of its own -- a non-numeric `started-at` attribute (e.g. an
  // ISO-8601 date string that failed the `type: Number` conversion, landing
  // as `NaN`) would flow straight into `Date.now() - start`, permanently
  // rendering the literal text "NaNm NaNs" with no fallback or recovery.
  // Treating an invalid value the same as "unset" here restores this
  // property's own documented fallback-clock behavior instead.
  private get validStartedAt(): number | undefined {
    if (this.startedAt == null || !Number.isFinite(this.startedAt)) return undefined;
    // Clamped to non-negative -- any finite epoch-ms instant is otherwise accepted as-is (no
    // upper bound: a slightly future, clock-skewed timestamp is still a real instant); only a
    // negative value (nonsensical for "when generation began") is floored to 0.
    return finiteRange(this.startedAt, this.startedAt, 0);
  }

  private computeElapsedMs(): number {
    const start = this.validStartedAt ?? this.fallbackStartMs;
    return start == null ? 0 : Math.max(0, Date.now() - start);
  }

  /** `tokenCount` normalized to a finite, non-negative integer -- `undefined` while unset or
   *  non-finite (the `tokens` segment is omitted entirely; see the class doc). */
  private get validTokenCount(): number | undefined {
    if (this.tokenCount == null || !Number.isFinite(this.tokenCount)) return undefined;
    return finiteCount(Math.round(this.tokenCount));
  }

  /** `tokens-per-second` when set; otherwise a derived figure once enough
   *  elapsed time has accumulated for it to be meaningful; otherwise
   *  `undefined` (the throughput segment doesn't render at all). */
  private get effectiveTokensPerSecond(): number | undefined {
    if (this.tokensPerSecond != null && Number.isFinite(this.tokensPerSecond)) {
      // Clamped to non-negative -- a host-supplied negative rate is never a meaningful reading.
      return finiteRange(this.tokensPerSecond, this.tokensPerSecond, 0);
    }
    const tokenCount = this.validTokenCount;
    if (tokenCount !== undefined) {
      const elapsedSeconds = this.elapsedMs / 1000;
      if (elapsedSeconds >= 1) return tokenCount / elapsedSeconds;
    }
    return undefined;
  }

  private onStopClick = (): void => {
    this.emit('lyra-stop');
  };

  render(): TemplateResult {
    const validTokenCount = this.validTokenCount;
    const hasTokens = validTokenCount !== undefined;
    const throughput = this.effectiveTokensPerSecond;
    const hasThroughput = throughput !== undefined;
    const locale = this.effectiveLocale;
    const elapsed = formatElapsed(this.elapsedMs, locale);
    const tokenCount = hasTokens ? formatTokenCount(validTokenCount!, locale) : undefined;
    const tokenMessageKey =
      tokenCount && getPluralRules(locale).select(tokenCount.rounded) === 'one'
        ? 'generationStatusTokenCount'
        : 'generationStatusTokensCount';

    return html`
      <div part="base">
        <span part="elapsed">${this.localize(elapsed.key, undefined, elapsed.values)}</span>
        ${hasTokens
          ? html`<span part="tokens"
              >${this.localize(tokenMessageKey, undefined, { count: tokenCount!.formatted })}</span
            >`
          : nothing}
        ${hasThroughput
          ? html`<span part="throughput"
              >${this.localize('generationStatusThroughput', undefined, {
                rate: formatThroughput(throughput!, locale),
              })}</span
            >`
          : nothing}
        ${this.showStop
          ? html`
              <button
                part="stop-button"
                type="button"
                aria-label=${this.localize('stopGenerating')}
                @click=${this.onStopClick}
              >
                ${stopIcon()}
              </button>
            `
          : nothing}
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lyra-generation-status': LyraGenerationStatus;
  }
}
