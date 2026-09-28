import { collectionSupport } from '../../../internal/collection-snapshot.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { finiteCount } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { firstByIdentity } from '../../agent-tools/collection-identity.js';
import { styles } from './research-progress.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_researchProgressEmpty, LYRA_DEFAULT_researchProgressLabel, LYRA_DEFAULT_researchProgressLimit, LYRA_DEFAULT_researchProgressSources, LYRA_DEFAULT_researchProgressStatusCompleted, LYRA_DEFAULT_researchProgressStatusFailed, LYRA_DEFAULT_researchProgressStatusPending, LYRA_DEFAULT_researchProgressStatusRunning, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type ResearchStepStatus = 'pending' | 'running' | 'completed' | 'failed';

/** A host-owned research step. Source counts are optional nonnegative finite counts. */
export interface ResearchStep {
  id: string;
  label: string;
  description?: string;
  status: ResearchStepStatus;
  sources?: number;
}

const MAX_RENDERED_STEPS = 100;
const STATUSES: readonly ResearchStepStatus[] = ['pending', 'running', 'completed', 'failed'];
const STATUS_LABEL_KEY: Record<ResearchStepStatus, string> = {
  pending: 'researchProgressStatusPending',
  running: 'researchProgressStatusRunning',
  completed: 'researchProgressStatusCompleted',
  failed: 'researchProgressStatusFailed',
};

/**
 * `<lr-research-progress>` — an ordered, read-only view of host-owned research steps with a
 * completion summary. It does not run searches or infer step state. Assigned steps are detached
 * snapshots; blank ids and duplicate ids are omitted, and no more than 100 rows render.
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
 * @since unreleased
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
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;
  protected static override readonly ownedCollectionProperties = Object.freeze(['steps']);

  static override styles = [LyraElement.styles, styles];

  /** Ordered host-owned steps. Reassign a new array after changes; the component never mutates it. */
  @property({ attribute: false }) steps: readonly ResearchStep[] = [];
  /** Accessible group name and visible heading. */
  @property() label?: string;

  private get normalizedSteps(): ResearchStep[] {
    const valid = (Array.isArray(this.steps) ? this.steps : []).filter((step): step is ResearchStep => {
      try {
        return Boolean(step && typeof step.label === 'string' && STATUSES.includes(step.status));
      } catch {
        return false;
      }
    });
    return firstByIdentity(valid, (step) => step.id);
  }

  private renderStep(step: ResearchStep): TemplateResult {
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
    const hostLabel = hostAriaLabel(this);
    const completed = steps.filter((step) => step.status === 'completed').length;
    const percent = steps.length === 0 ? 0 : Math.round((completed / steps.length) * 100);
    return html`
      <section part="base" role="group" aria-label=${hostLabel === null ? nothing : hostLabel}>
        <h2 part="label">${visibleLabel}</h2>
        ${steps.length === 0
          ? html`<p part="empty">${this.localize('researchProgressEmpty')}</p>`
          : html`
              <div
                part="progress"
                role="progressbar"
                aria-label=${hostLabel ?? visibleLabel}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow=${String(percent)}
                style=${styleMap({ '--_progress-value': String(percent) })}
              >
                <span part="progress-label">${getNumberFormat(this.effectiveLocale, {
                  style: 'percent',
                  maximumFractionDigits: 0,
                }).format(percent / 100)}</span>
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
