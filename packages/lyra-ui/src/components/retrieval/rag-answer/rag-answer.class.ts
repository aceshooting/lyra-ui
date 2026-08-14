import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { Citation, CitationSelectEventDetail, DocumentRef, GroundedClaim, GroundingAssessment } from '../../../ai/types.js';
import { styles } from './rag-answer.styles.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_ragAnswerCitations, LYRA_DEFAULT_ragAnswerLabel, LYRA_DEFAULT_ragAnswerRetry, LYRA_DEFAULT_ragAnswerSources } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface LyraRagAnswerEventMap {
  'lr-citation-select': CustomEvent<CitationSelectEventDetail>;
  'lr-claim-select': CustomEvent<{ claim: GroundedClaim }>;
  'lr-retry': CustomEvent<undefined>;
}

/**
 * `<lr-rag-answer>` — a controlled grounded-answer surface combining sanitized Markdown, citation
 * badges, a grounding assessment, and source previews. It performs no model call, retrieval,
 * citation parsing, or source fetching.
 *
 * @customElement lr-rag-answer
 * @slot answer - Replaces the data-driven Markdown answer body.
 * @slot sources - Replaces the data-driven source list.
 * @event lr-citation-select - A citation badge was activated. `detail: { citation }`.
 * @event lr-claim-select - A claim was activated. `detail: { claim }`.
 * @event lr-retry - The retry button was activated after an error.
 * @csspart base - The root answer wrapper.
 * @csspart answer - The answer content wrapper.
 * @csspart loading - The loading indicator.
 * @csspart error - The neutral, visible caller-supplied error message. New non-empty errors are
 *   announced through a shared assertive light-DOM region; initial and reconnect content is not
 *   replayed.
 * @csspart retry - The retry button.
 * @csspart grounding - The grounding assessment.
 * @csspart citations - The citation section.
 * @csspart citation-list - The citation badge row.
 * @csspart sources - The source section.
 * @csspart source-list - The data-driven source list.
 * @csspart section-heading - A localized section heading.
 * @status stable
 * @since 6.2.0
 */
export class LyraRagAnswer extends LyraElement<LyraRagAnswerEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    ragAnswerCitations: LYRA_DEFAULT_ragAnswerCitations,
    ragAnswerLabel: LYRA_DEFAULT_ragAnswerLabel,
    ragAnswerRetry: LYRA_DEFAULT_ragAnswerRetry,
    ragAnswerSources: LYRA_DEFAULT_ragAnswerSources,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];
  /** Markdown answer content rendered when the `answer` slot is empty. */
  @property() answer = '';
  /** Citations referenced by the answer and grounding assessment. */
  @property({ attribute: false }) citations: Citation[] = [];
  /** Source records rendered when the `sources` slot is empty. */
  @property({ attribute: false }) sources: DocumentRef[] = [];
  /** Optional grounding assessment summarized above the citations. */
  @property({ attribute: false }) assessment: GroundingAssessment | null = null;
  /** Marks answer generation as pending and renders the initial loading state. */
  @property({ type: Boolean, reflect: true }) loading = false;
  /** Caller-supplied error text. The visible message is deliberately not a shadow live region;
   *  new non-empty values are announced through a shared assertive light-DOM region. Content
   *  present on the initial render or reconnect is not replayed. */
  @property({ attribute: 'error-text' }) errorText = '';
  /** Whether the source section is rendered when source data or slotted content exists. */
  @property({ type: Boolean, attribute: 'show-sources', reflect: true, converter: trueDefaultBooleanConverter }) showSources = true;
  /** Whether claim-level details are forwarded to the grounding summary. */
  @property({ type: Boolean, attribute: 'show-claims', reflect: true, converter: trueDefaultBooleanConverter }) showClaims = true;
  /** Visible and fallback accessible label for the answer. */
  @property() label = '';
  /** Host accessible-name override; takes precedence over `label` and the localized default. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  private isMounting = true;
  private errorAnnouncementSink?: AnnouncementSink;
  private slotObserver?: MutationObserver;

  override connectedCallback(): void {
    super.connectedCallback();
    this.errorAnnouncementSink ??= acquireAnnouncementSink('assertive', {
      document: this.ownerDocument,
      source: this,
    });
    // A realm without MutationObserver loses only slotted-content change tracking, so bail out
    // rather than falling back to a bare global identifier that throws a ReferenceError out of
    // connectedCallback and takes the whole component down with it.
    const MutationObserverCtor = this.ownerDocument.defaultView?.MutationObserver;
    if (!MutationObserverCtor) return;
    this.slotObserver = new MutationObserverCtor((records) => {
      if (
        this.isConnected &&
        records.some((record) =>
          record.type === 'childList' ? record.target === this : record.target.parentNode === this,
        )
      ) {
        this.requestUpdate();
      }
    });
    this.slotObserver.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['slot'],
    });
  }

  override disconnectedCallback(): void {
    this.isMounting = true;
    this.slotObserver?.disconnect();
    this.slotObserver = undefined;
    this.errorAnnouncementSink?.release();
    this.errorAnnouncementSink = undefined;
    super.disconnectedCallback();
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    const wasMounting = this.isMounting;
    this.isMounting = false;
    if (!wasMounting && changed.has('errorText') && this.errorText !== '' && this.isConnected) {
      this.errorAnnouncementSink?.announce(this.errorText);
    }
  }

  private hasSlot(name: string): boolean { return Array.from(this.children).some((element) => element.getAttribute('slot') === name); }
  private onCitationActivate = (event: CustomEvent<{ index: number }>): void => {
    event.stopPropagation();
    const citation = this.citations[event.detail.index - 1];
    if (citation) this.emit('lr-citation-select', { citation });
  };
  private renderSource(source: DocumentRef): TemplateResult {
    return html`<lr-source-card frame="plain" compact .sourceId=${source.id} .title=${source.name} .href=${source.uri ?? ''}>
      ${source.mimeType ? html`<span slot="excerpt">${source.mimeType}</span>` : nothing}
    </lr-source-card>`;
  }
  private renderSourceItems(): TemplateResult | TemplateResult[] {
    if (this.hasSlot('sources')) return html`<slot name="sources"></slot>`;
    // Keep generated cards as direct light-DOM children. Putting them in the fallback of a nested
    // forwarding slot makes the child list first see one slot and later see N flattened cards,
    // forcing a redundant post-update reconciliation when N differs from one.
    return this.sources.map((source) => this.renderSource(source));
  }
  override render(): TemplateResult {
    const label = this.accessibleLabel || this.label || this.localize('ragAnswerLabel');
    if (this.loading && !this.answer && !this.hasSlot('answer') && !this.errorText) return html`<div part="base" role="article" aria-label=${label} aria-busy="true"><lr-spinner part="loading" aria-label=${label}></lr-spinner></div>`;
    return html`<article part="base" aria-label=${label}>
      ${this.errorText ? html`<div part="error">${this.errorText}</div><lr-button part="retry" variant="neutral" @click=${() => this.emit('lr-retry')}>${this.localize('ragAnswerRetry')}</lr-button>` : nothing}
      ${this.answer || this.hasSlot('answer') ? html`<div part="answer"><slot name="answer"><lr-markdown .content=${this.answer}></lr-markdown></slot></div>` : nothing}
      ${this.assessment ? html`<lr-grounding-summary part="grounding" .assessment=${this.assessment} .citations=${this.citations} .showClaims=${this.showClaims}></lr-grounding-summary>` : nothing}
      ${this.citations.length ? html`<section part="citations" aria-label=${this.localize('ragAnswerCitations')}><h3 part="section-heading">${this.localize('ragAnswerCitations')}</h3><div part="citation-list">${this.citations.map((citation, index) => html`<lr-citation-badge .index=${index + 1} .sourceId=${citation.sourceId ?? ''} .label=${citation.label ?? ''} @lr-citation-activate=${this.onCitationActivate}></lr-citation-badge>`)}</div></section>` : nothing}
      ${this.showSources && (this.sources.length > 0 || this.hasSlot('sources')) ? html`<section part="sources" aria-label=${this.localize('ragAnswerSources')}><h3 part="section-heading">${this.localize('ragAnswerSources')}</h3><lr-source-list part="source-list" .label=${this.localize('ragAnswerSources')} expanded>${this.renderSourceItems()}</lr-source-list></section>` : nothing}
    </article>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-rag-answer': LyraRagAnswer; } }
