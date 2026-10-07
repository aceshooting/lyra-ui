import { progressPercent, formatProgressPercent } from '../../../internal/progress-value.js';
import { collectionSupport } from '../../../internal/collection-snapshot.js';
import { finiteCount } from '../../../internal/numbers.js';
import { resolveHeadingLevel, type LyraHeadingLevel } from '../../../internal/heading-level.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { devWarnOnce } from '../../../internal/dev-warning.js';
import { normalizeAgentTerminalStatus } from '../../../internal/shared-unions.js';
import { firstByRetrievalIdentity } from '../retrieval-identity.js';
import {
  retrievalSemanticLabel,
  retrievalSemanticRole,
} from '../retrieval-semantic-owner.js';
import { styles } from './research-progress.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_researchProgressEmpty, LYRA_DEFAULT_researchProgressLabel, LYRA_DEFAULT_researchProgressLimit, LYRA_DEFAULT_researchProgressSources, LYRA_DEFAULT_researchProgressStatusCompleted, LYRA_DEFAULT_researchProgressStatusFailed, LYRA_DEFAULT_researchProgressStatusPending, LYRA_DEFAULT_researchProgressStatusRunning, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_statusIncomplete } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type ResearchStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'incomplete';

/** A host-owned research step. Source counts are optional nonnegative finite counts. */
export interface ResearchStep {
  id: string;
  label: string;
  description?: string;
  status: ResearchStepStatus | 'success' | 'done' | 'complete' | 'error' | 'cancelled';
  sources?: number;
}

const MAX_RENDERED_STEPS = 100;
const STATUSES: readonly ResearchStepStatus[] = ['pending', 'running', 'completed', 'failed', 'incomplete'];
type DisplayStep = Omit<ResearchStep, 'status'> & { status: ResearchStepStatus | 'unknown' };
const STATUS_LABEL_KEY: Record<DisplayStep['status'], string> = {
  pending: 'researchProgressStatusPending',
  running: 'researchProgressStatusRunning',
  completed: 'researchProgressStatusCompleted',
  failed: 'researchProgressStatusFailed',
  incomplete: 'statusIncomplete',
  unknown: 'statusUnknown',
};

/**
 * `<lr-research-progress>` — an ordered, read-only view of host-owned research steps with a
 * completion summary. It does not run searches or infer step state. Assigned steps are detached
 * snapshots; blank ids and duplicate ids are omitted, and no more than 100 rows render. A step
 * whose `status` is not recognized after shared terminal spelling normalization is kept
 * and rendered as a neutral unknown state (it is not dropped); `incomplete` is a step that stopped without
 * finishing (a cancelled run) and is not counted as completed.
 *
 * The progress track and fill honor the shared progress track color/radius and indicator color
 * tokens while preserving this summary's compact labeled geometry.
 *
 * @customElement lr-research-progress
 * @csspart base - The named component group.
 * @csspart label - The visible group label.
 * @csspart progress - The aggregate completion progressbar.
 * @csspart list - The ordered list of research steps.
 * @csspart step - One host-supplied step, keyed by `data-step-id`.
 * @csspart step-label - The host-supplied step label.
 * @csspart step-copy - The text area containing the step label and optional description.
 * @csspart description - Optional host-supplied step description.
 * @csspart progress-label - The localized aggregate completion percentage.
 * @csspart status - The localized controlled status.
 * @csspart sources - The localized number of sources for a step.
 * @csspart empty - The empty state.
 * @csspart limit - Localized notice shown when more than 100 valid steps are supplied.
 * @status experimental
 * @since 22.0.0
 */
export class LyraResearchProgress extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    researchProgressEmpty: LYRA_DEFAULT_researchProgressEmpty,
    researchProgressLabel: LYRA_DEFAULT_researchProgressLabel,
    researchProgressLimit: LYRA_DEFAULT_researchProgressLimit,
    researchProgressSources: LYRA_DEFAULT_researchProgressSources,
    researchProgressStatusCompleted: LYRA_DEFAULT_researchProgressStatusCompleted,
    researchProgressStatusFailed: LYRA_DEFAULT_researchProgressStatusFailed,
    researchProgressStatusPending: LYRA_DEFAULT_researchProgressStatusPending,
    researchProgressStatusRunning: LYRA_DEFAULT_researchProgressStatusRunning,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    statusIncomplete: LYRA_DEFAULT_statusIncomplete,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;
  protected static override readonly ownedCollectionProperties = Object.freeze(['steps']);

  static override styles = [LyraElement.styles, styles];

  /** Ordered host-owned steps. Reassign a new array after changes; the component never mutates it. */
  @property({ attribute: false }) steps: readonly ResearchStep[] = [];
  /** Accessible group name and visible heading. */
  @property() label?: string;
  /** Semantic level of the heading; `none` keeps the visible text without heading semantics. */
  @property({ attribute: 'heading-level' }) headingLevel: LyraHeadingLevel = '2';

  private get normalizedSteps(): DisplayStep[] {
    const valid: DisplayStep[] = [];
    for (const step of Array.isArray(this.steps) ? this.steps : []) {
      try {
        if (step && typeof step.label === 'string') {
          const terminal = normalizeAgentTerminalStatus(step.status);
          const status = terminal === 'success' ? 'completed' : terminal === 'error' ? 'failed' : terminal === 'cancelled' ? 'incomplete' : step.status;
          if (!(STATUSES as readonly string[]).includes(status)) devWarnOnce(
            'lr-research-progress:unknown-status',
            `<lr-research-progress>: unknown step status ${JSON.stringify(typeof step.status === 'string' ? step.status.slice(0, 80) : typeof step.status)}; rendering a neutral status.`
          );
          valid.push({ ...step, status: (STATUSES as readonly string[]).includes(status) ? status as ResearchStepStatus : 'unknown' });
        }
      } catch {
        // A malformed row cannot suppress later valid steps.
      }
    }
    return firstByRetrievalIdentity(valid, (step) => step.id);
  }

  private renderStep(step: DisplayStep): TemplateResult {
    const hasSources = typeof step.sources === 'number' && Number.isFinite(step.sources) && step.sources >= 0;
    const sources = hasSources ? finiteCount(step.sources!) : undefined;
    return html`
      <li part="step" data-step-id=${step.id} data-status=${step.status}>
        <div part="step-copy">
          <span part="step-label">${step.label}</span>
          ${step.description ? html`<span part="description">${step.description}</span>` : nothing}
          ${sources === undefined
            ? nothing
            : html`<span part="sources">${this.localize('researchProgressSources', undefined, {
                count: getNumberFormat(this.effectiveLocale).format(sources),
                pluralCount: sources,
              })}</span>`}
        </div>
        <span part="status" data-status=${step.status}>${this.localize(STATUS_LABEL_KEY[step.status])}</span>
      </li>
    `;
  }

  override render(): TemplateResult {
    const steps = this.normalizedSteps;
    const visibleLabel = this.label == null ? this.localize('researchProgressLabel') : this.label;
    const groupLabel = retrievalSemanticLabel(this, visibleLabel);
    const level = resolveHeadingLevel(this.headingLevel);
    const completed = steps.filter((step) => step.status === 'completed').length;
    const percent = steps.length === 0 ? 0 : Math.round(progressPercent(completed, steps.length));
    const formattedPercent = formatProgressPercent(this.effectiveLocale, percent);
    return html`
      <section part="base" role=${retrievalSemanticRole(this, 'group') ?? nothing} aria-label=${groupLabel ?? nothing}>
        <div part="label" role=${level ? 'heading' : nothing} aria-level=${level ?? nothing}>${visibleLabel}</div>
        ${steps.length === 0
          ? html`<p part="empty">${this.localize('researchProgressEmpty')}</p>`
          : html`
              <div
                part="progress"
                role="progressbar"
                aria-label=${visibleLabel || this.localize('researchProgressLabel')}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow=${String(percent)}
                aria-valuetext=${formattedPercent}
                style=${styleMap({ '--_progress-value': String(percent) })}
              >
                <span part="progress-label">${formattedPercent}</span>
              </div>
              <ol part="list">${steps.slice(0, MAX_RENDERED_STEPS).map((step) => this.renderStep(step))}</ol>
            `}
        ${steps.length > MAX_RENDERED_STEPS
          ? html`<p part="limit">${this.localize('researchProgressLimit', undefined, {
              count: getNumberFormat(this.effectiveLocale).format(MAX_RENDERED_STEPS),
            })}</p>`
          : nothing}
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-research-progress': LyraResearchProgress;
  }
}
