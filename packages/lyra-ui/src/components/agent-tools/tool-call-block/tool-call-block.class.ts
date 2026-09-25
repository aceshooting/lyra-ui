import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { guard } from 'lit/directives/guard.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { ToolCallStatus } from '../tool-call-chip/tool-call-chip.class.js';
import { literalSetConverter } from '../../../internal/converters.js';
import { nextId } from '../../../internal/a11y.js';
import { chevronIcon } from '../../../internal/icons.js';
import { finiteRange } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { durationMessageValue } from '../../../internal/duration.js';
import { tag } from '../../../internal/prefix.js';
import {
  observeScrollOverflow,
  SCROLL_OVERFLOW_ATTRIBUTE,
} from '../../../internal/scroll-overflow.js';
import type { LyraJsonViewerEventMap } from '../../utility/json-viewer/json-viewer.class.js';
import { TOOL_CALL_STATUSES, TOOL_STATUS_LABEL_KEY, toolStatusIcon } from '../tool-status.js';
import {
  projectedRedactionFields,
  redactToolDetail,
  TOO_MANY_REDACTION_PATHS,
  type RedactedToolDetail,
} from '../tool-redaction.js';
import { styles } from './tool-call-block.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_durationMilliseconds, LYRA_DEFAULT_durationSeconds, LYRA_DEFAULT_envListValueHidden, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_noData, LYRA_DEFAULT_open, LYRA_DEFAULT_popover, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_statusDenied, LYRA_DEFAULT_statusError, LYRA_DEFAULT_statusPending, LYRA_DEFAULT_statusRunning, LYRA_DEFAULT_statusSuccess, LYRA_DEFAULT_toolCall, LYRA_DEFAULT_toolCallBlockArgumentsLabel, LYRA_DEFAULT_toolCallBlockErrorLabel, LYRA_DEFAULT_toolCallBlockHeaderDenied, LYRA_DEFAULT_toolCallBlockHeaderError, LYRA_DEFAULT_toolCallBlockHeaderPending, LYRA_DEFAULT_toolCallBlockHeaderRunning, LYRA_DEFAULT_toolCallBlockHeaderSuccess, LYRA_DEFAULT_toolCallBlockResultLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** `detail` for `lr-toggle`: the new expanded state, and the call it belongs to. */
export interface ToolCallBlockToggleDetail {
  expanded: boolean;
  callId: string;
}

/** `detail` for the re-emitted `lr-render-error`: the composed result view's own detail, plus the
 *  call it belongs to. */
export interface ToolCallBlockRenderErrorDetail {
  toolName: string;
  error: unknown;
  callId: string;
}

export interface LyraToolCallBlockEventMap extends LyraJsonViewerEventMap {
  'lr-toggle': CustomEvent<ToolCallBlockToggleDetail>;
  'lr-render-error': CustomEvent<ToolCallBlockRenderErrorDetail>;
}

const TOOL_CALL_BLOCK_STATUS = literalSetConverter<ToolCallStatus>(TOOL_CALL_STATUSES, 'pending');

/** Header verb for each status; the verb carries the state as text. */
const HEADER_KEY: Readonly<Record<ToolCallStatus, string>> = {
  pending: 'toolCallBlockHeaderPending',
  running: 'toolCallBlockHeaderRunning',
  success: 'toolCallBlockHeaderSuccess',
  error: 'toolCallBlockHeaderError',
  denied: 'toolCallBlockHeaderDenied',
};

interface DetailMemo {
  readonly detail: RedactedToolDetail;
  readonly hasArgs: boolean;
}

/** Whether `args` should render an arguments section. A throwing inspection (a hostile Proxy)
 *  counts as present, because the composed json-viewer's bounded snapshot owns hostile input. */
function argsPresent(args: unknown): boolean {
  if (args === undefined || args === null) return false;
  if (typeof args !== 'object') return true;
  try {
    const prototype = Object.getPrototypeOf(args) as unknown;
    if (prototype !== Object.prototype && prototype !== null) return true;
    return Object.keys(args).length > 0;
  } catch {
    return true;
  }
}

/**
 * `<lr-tool-call-block>` — one tool call shown inline as a collapsed-by-default disclosure. The
 * header reads a status-aware verb (`Used web_search`) beside a status glyph and an optional
 * duration; expanding it in place reveals the call's arguments, then its error, then its result.
 *
 * Details are deferred: a collapsed block renders an empty body and never reads `args` or
 * `result`. Expanding renders `args` through `<lr-json-viewer>` and `result` through
 * `<lr-tool-result-view>`, so any renderer registered with `registerToolRenderer()` still applies.
 * `redactedFields` masks dotted paths rooted at `args`, `result` or `error` (a bare root masks the
 * whole branch) with the same bounded, fail-closed rules as `<lr-tool-timeline>`.
 *
 * The result section becomes a keyboard stop (`tabindex="0"`) only while its content overflows,
 * so a wide custom renderer stays reachable by keyboard.
 *
 * `<lr-message-parts tool-display="block">` renders each paired tool-call/tool-result through one
 * of these blocks.
 *
 * @customElement lr-tool-call-block
 * @event lr-toggle - A header activation changed `expanded`. Not emitted for programmatic writes.
 * `detail: { expanded, callId }`.
 * @event lr-render-error - Re-emitted from the composed result view with `callId` added, whenever
 * no registered renderer matches or a renderer fails. Only an expanded block renders a result view;
 * each expand, and each `result`/`args` identity change while expanded, dispatches again.
 * `detail: { toolName, error, callId }`.
 * @event lr-copy - Passthrough from the composed arguments JSON viewer.
 * @event lr-copy-error - Passthrough from the composed arguments JSON viewer.
 * @event lr-error - Passthrough from the composed arguments JSON viewer.
 * @event lr-search-change - Passthrough from the composed arguments JSON viewer.
 * @csspart base - The card.
 * @csspart header - The disclosure button.
 * @csspart toggle - The chevron, first in the header.
 * @csspart icon - The status glyph wrapper.
 * @csspart label - The header text.
 * @csspart status-text - The visible status text, rendered only when `label` overrides the verb.
 * @csspart duration - The duration text, rendered only when `duration-ms` is finite.
 * @csspart body - The disclosed region.
 * @csspart args - The arguments section.
 * @csspart args-label - The arguments section label.
 * @csspart result - The result section; a keyboard stop only while it overflows.
 * @csspart result-label - The result section label.
 * @csspart error - The error section.
 * @csspart error-label - The error section label.
 * @csspart empty - The message shown when there are no details yet.
 * @cssprop [--lr-tool-call-block-background=var(--lr-color-surface)] - Card fill.
 * @cssprop [--lr-tool-call-block-border-color=var(--lr-color-border)] - Card edge and header/body divider.
 * @cssprop [--lr-tool-call-block-radius=var(--lr-radius)] - Card corner radius.
 * @cssprop [--lr-tool-call-block-accent=var(--lr-color-text-quiet)] - Status glyph colour; defaults per status (brand while running, success, danger on error, warning when denied).
 * @cssprop [--lr-tool-call-block-error-color=var(--lr-color-danger)] - Error section text colour.
 * @status experimental
 * @since unreleased
 */
export class LyraToolCallBlock extends LyraElement<LyraToolCallBlockEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    durationMilliseconds: LYRA_DEFAULT_durationMilliseconds,
    durationSeconds: LYRA_DEFAULT_durationSeconds,
    envListValueHidden: LYRA_DEFAULT_envListValueHidden,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    noData: LYRA_DEFAULT_noData,
    open: LYRA_DEFAULT_open,
    popover: LYRA_DEFAULT_popover,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    statusDenied: LYRA_DEFAULT_statusDenied,
    statusError: LYRA_DEFAULT_statusError,
    statusPending: LYRA_DEFAULT_statusPending,
    statusRunning: LYRA_DEFAULT_statusRunning,
    statusSuccess: LYRA_DEFAULT_statusSuccess,
    toolCall: LYRA_DEFAULT_toolCall,
    toolCallBlockArgumentsLabel: LYRA_DEFAULT_toolCallBlockArgumentsLabel,
    toolCallBlockErrorLabel: LYRA_DEFAULT_toolCallBlockErrorLabel,
    toolCallBlockHeaderDenied: LYRA_DEFAULT_toolCallBlockHeaderDenied,
    toolCallBlockHeaderError: LYRA_DEFAULT_toolCallBlockHeaderError,
    toolCallBlockHeaderPending: LYRA_DEFAULT_toolCallBlockHeaderPending,
    toolCallBlockHeaderRunning: LYRA_DEFAULT_toolCallBlockHeaderRunning,
    toolCallBlockHeaderSuccess: LYRA_DEFAULT_toolCallBlockHeaderSuccess,
    toolCallBlockResultLabel: LYRA_DEFAULT_toolCallBlockResultLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  protected static override readonly ownedCollectionProperties = Object.freeze(['redactedFields']);

  /** Tool name. An empty name renders the localized generic tool-call label in its place. */
  @property() name = '';

  /** Invocation id, echoed in `lr-toggle` and `lr-render-error` details. */
  @property({ attribute: 'call-id' }) callId = '';

  private statusValue: ToolCallStatus = 'pending';

  /** Call status. Values outside `pending | running | success | error | denied` normalize and
   *  reflect as `pending`. */
  @property({ reflect: true, converter: TOOL_CALL_BLOCK_STATUS })
  get status(): ToolCallStatus {
    return this.statusValue;
  }
  set status(next: ToolCallStatus) {
    const normalized = TOOL_CALL_BLOCK_STATUS.normalizeReflected(this, 'status', next);
    const old = this.statusValue;
    if (old === normalized) return;
    this.statusValue = normalized;
    this.requestUpdate('status', old);
  }

  /** Whether the details are shown. Starts collapsed. */
  @property({ type: Boolean, reflect: true }) expanded = false;

  /** Header text override, used verbatim (including `''`). When set, the localized status text is
   *  shown beside it; unset renders the localized status verb with `name`. */
  @property() label?: string;

  /** How long the call took, in milliseconds. Hidden unless finite; negative values clamp to 0. */
  @property({ type: Number, attribute: 'duration-ms' }) durationMs?: number;

  /** Call arguments. Opaque; the block keeps the identity and reads it only while expanded. */
  @property({ attribute: false }) args: unknown;

  /** Call result. `undefined` means no result yet. */
  @property({ attribute: false }) result: unknown;

  /** Error text. A non-empty string renders the error section. */
  @property() error?: string;

  /** Dotted paths within `args`/`result`/`error` to mask; a bare `'args'`/`'result'`/`'error'`
   *  masks the whole branch, and a path with no match is a no-op. */
  @property({ attribute: false }) redactedFields: readonly string[] = [];

  private readonly bodyId = nextId('tool-call-block-body');
  private readonly labelId = nextId('tool-call-block-label');
  private readonly argsLabelId = nextId('tool-call-block-args-label');
  private readonly resultLabelId = nextId('tool-call-block-result-label');
  private readonly errorLabelId = nextId('tool-call-block-error-label');
  private projectedPaths: readonly unknown[] = [];
  private detailMemo?: DetailMemo;
  private restoreFocusToHeader = false;

  private readonly resultOverflow = observeScrollOverflow(
    this,
    () => this.renderRoot?.querySelector('[part="result"]'),
    () => this.syncResultScrollStop(),
  );

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (!this.hasUpdated || changed.has('redactedFields')) {
      // An unreadable array cannot drop this single element the way the timeline drops an entry,
      // so it fails closed instead: every present branch renders the placeholder.
      this.projectedPaths = projectedRedactionFields(this.redactedFields) ?? TOO_MANY_REDACTION_PATHS;
    }
    // `expanded = false` is a field default, so the first update already looks like a collapse;
    // the `hasUpdated` guard keeps mounting (and server rendering) from touching the render root.
    if (this.hasUpdated && changed.get('expanded') === true && !this.expanded) {
      const root = this.renderRoot as ShadowRoot | undefined;
      this.restoreFocusToHeader = !!root
        ?.querySelector('[part="body"]')
        ?.contains(root.activeElement);
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    const view = this.renderRoot.querySelector(tag('tool-result-view'));
    if (view) this.resultOverflow.observeExtra([view]);
    this.syncResultScrollStop();
    if (this.restoreFocusToHeader) {
      this.restoreFocusToHeader = false;
      this.renderRoot.querySelector<HTMLButtonElement>('[part="header"]')?.focus();
    }
  }

  /** Written as an attribute rather than through the template because overflow is measured, not
   *  rendered: the controller flips it from a resize with no state Lit could re-render from. */
  private syncResultScrollStop(): void {
    const result = this.renderRoot?.querySelector<HTMLElement>('[part="result"]');
    if (!result) return;
    if (result.hasAttribute(SCROLL_OVERFLOW_ATTRIBUTE)) result.setAttribute('tabindex', '0');
    else result.removeAttribute('tabindex');
  }

  private readonly onHeaderClick = (): void => {
    this.expanded = !this.expanded;
    this.emit('lr-toggle', { expanded: this.expanded, callId: this.callId });
  };

  private readonly onRenderError = (event: CustomEvent<{ toolName: string; error: unknown }>): void => {
    event.stopPropagation();
    this.emit('lr-render-error', {
      toolName: event.detail.toolName,
      error: event.detail.error,
      callId: this.callId,
    });
  };

  private detail(): DetailMemo {
    const detail = redactToolDetail(
      { args: this.args, result: this.result, error: this.error },
      this.projectedPaths,
      this.localize('envListValueHidden'),
      this.detailMemo?.detail,
    );
    if (detail !== this.detailMemo?.detail) {
      this.detailMemo = { detail, hasArgs: argsPresent(this.args) };
    }
    return this.detailMemo!;
  }

  private get safeDurationMs(): number | null {
    return this.durationMs != null && Number.isFinite(this.durationMs)
      ? finiteRange(this.durationMs, 0, 0)
      : null;
  }

  private durationText(): string | null {
    const ms = this.safeDurationMs;
    if (ms == null) return null;
    const duration = durationMessageValue(ms);
    const seconds = duration.key === 'durationSeconds';
    const value = getNumberFormat(this.effectiveLocale, {
      maximumFractionDigits: seconds ? 1 : 0,
    }).format(duration.value);
    return this.localize(seconds ? 'durationSeconds' : 'durationMilliseconds', undefined, { value });
  }

  private emptyText(): string {
    if (this.status === 'pending') return this.localize('statusPending');
    if (this.status === 'running') return this.localize('statusRunning');
    return this.localize('noData');
  }

  private bodyTemplate(): TemplateResult {
    const memo = this.detail();
    const { detail, hasArgs } = memo;
    const empty =
      !hasArgs &&
      !(typeof detail.sourceError === 'string' && detail.sourceError !== '') &&
      detail.sourceResult === undefined;
    const labels = [
      this.localize('toolCallBlockArgumentsLabel'),
      this.localize('toolCallBlockErrorLabel'),
      this.localize('toolCallBlockResultLabel'),
      // Only a detail-less body shows the status-aware message, so only then may status re-render it.
      empty ? this.emptyText() : '',
    ] as const;
    // Guarded on identities and strings only, so an unrelated host update never re-evaluates the
    // payload bindings (which would inspect the payload objects).
    return html`${guard([memo, this.name, this.onRenderError, ...labels], () =>
      this.sectionsTemplate(memo, labels),
    )}`;
  }

  private sectionsTemplate(
    { detail, hasArgs }: DetailMemo,
    [argsLabel, errorLabel, resultLabel, emptyText]: readonly [string, string, string, string],
  ): TemplateResult {
    const hasError = typeof detail.sourceError === 'string' && detail.sourceError !== '';
    const hasResult = detail.sourceResult !== undefined;
    if (!hasArgs && !hasError && !hasResult) {
      return html`<p part="empty">${emptyText}</p>`;
    }
    return html`
      ${hasArgs
        ? html`<div part="args" role="group" aria-labelledby=${this.argsLabelId}>
            <div part="args-label" id=${this.argsLabelId}>${argsLabel}</div>
            <lr-json-viewer .data=${detail.args}></lr-json-viewer>
          </div>`
        : nothing}
      ${hasError
        ? html`<div part="error" role="group" aria-labelledby=${this.errorLabelId}>
            <div part="error-label" id=${this.errorLabelId}>${errorLabel}</div>
            <p>${detail.error}</p>
          </div>`
        : nothing}
      ${hasResult
        ? html`<div part="result" role="group" aria-labelledby=${this.resultLabelId}>
            <div part="result-label" id=${this.resultLabelId}>${resultLabel}</div>
            <lr-tool-result-view
              tool-name=${this.name}
              .args=${detail.args}
              .result=${detail.result}
              @lr-render-error=${this.onRenderError}
            ></lr-tool-result-view>
          </div>`
        : nothing}
    `;
  }

  override render(): TemplateResult {
    const status = this.status;
    const name = this.name === '' ? this.localize('toolCall') : this.name;
    const label = this.label ?? this.localize(HEADER_KEY[status], undefined, { name });
    const duration = this.durationText();
    return html`
      <div part="base">
        <button
          part="header"
          type="button"
          aria-expanded=${this.expanded ? 'true' : 'false'}
          aria-controls=${this.bodyId}
          @click=${this.onHeaderClick}
        >
          <span part="toggle" aria-hidden="true" inert>${chevronIcon()}</span>
          <span part="icon" aria-hidden="true" inert>${toolStatusIcon(status)}</span>
          <span part="label" id=${this.labelId}>${label}</span>
          ${this.label != null
            ? html`<span part="status-text">${this.localize(TOOL_STATUS_LABEL_KEY[status])}</span>`
            : nothing}
          ${duration != null ? html`<span part="duration">${duration}</span>` : nothing}
        </button>
        <div
          part="body"
          id=${this.bodyId}
          role="group"
          aria-labelledby=${this.labelId}
          ?hidden=${!this.expanded}
        >${this.expanded ? this.bodyTemplate() : nothing}</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-tool-call-block': LyraToolCallBlock;
  }
}
