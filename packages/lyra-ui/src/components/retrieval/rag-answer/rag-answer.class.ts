import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { Citation, CitationSelectEventDetail, DocumentRef, GroundedClaim, GroundingAssessment } from '../../../ai/types.js';
import { styles } from './rag-answer.styles.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';

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
 * @csspart error - The caller-supplied error message.
 * @csspart retry - The retry button.
 * @csspart grounding - The grounding assessment.
 * @csspart citations - The citation section.
 * @csspart citation-list - The citation badge row.
 * @csspart sources - The source section.
 * @csspart source-list - The data-driven source list.
 * @csspart section-heading - A localized section heading.
 */
export class LyraRagAnswer extends LyraElement<LyraRagAnswerEventMap> {
  static override styles = [LyraElement.styles, styles];
  @property() answer = '';
  @property({ attribute: false }) citations: Citation[] = [];
  @property({ attribute: false }) sources: DocumentRef[] = [];
  @property({ attribute: false }) assessment: GroundingAssessment | null = null;
  @property({ type: Boolean, reflect: true }) loading = false;
  @property() error = '';
  @property({ type: Boolean, attribute: 'show-sources', reflect: true, converter: trueDefaultBooleanConverter }) showSources = true;
  @property({ type: Boolean, attribute: 'show-claims', reflect: true, converter: trueDefaultBooleanConverter }) showClaims = true;
  @property() label = '';
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  private hasSlot(name: string): boolean { return Array.from(this.children).some((element) => element.getAttribute('slot') === name); }
  private onCitationActivate = (event: CustomEvent<{ index: number }>): void => {
    event.stopPropagation();
    const citation = this.citations[event.detail.index - 1];
    if (citation) this.emit('lr-citation-select', { citation });
  };
  private renderSource(source: DocumentRef): TemplateResult {
    return html`<lr-source-card appearance="plain" compact .sourceId=${source.id} .title=${source.name} .href=${source.uri ?? ''}>
      ${source.mimeType ? html`<span slot="excerpt">${source.mimeType}</span>` : nothing}
    </lr-source-card>`;
  }
  override render(): TemplateResult {
    const label = this.accessibleLabel || this.label || this.localize('ragAnswerLabel');
    if (this.loading && !this.answer && !this.error) return html`<div part="base" role="article" aria-label=${label} aria-busy="true"><lr-spinner part="loading" aria-label=${label}></lr-spinner></div>`;
    return html`<article part="base" aria-label=${label}>
      ${this.error ? html`<div part="error" role="alert">${this.error}</div><lr-button part="retry" variant="neutral" @click=${() => this.emit('lr-retry')}>${this.localize('ragAnswerRetry')}</lr-button>` : nothing}
      ${this.answer || this.hasSlot('answer') ? html`<div part="answer"><slot name="answer"><lr-markdown .content=${this.answer}></lr-markdown></slot></div>` : nothing}
      ${this.assessment ? html`<lr-grounding-summary part="grounding" .assessment=${this.assessment} .citations=${this.citations} .showClaims=${this.showClaims}></lr-grounding-summary>` : nothing}
      ${this.citations.length ? html`<section part="citations" aria-label=${this.localize('ragAnswerCitations')}><h3 part="section-heading">${this.localize('ragAnswerCitations')}</h3><div part="citation-list">${this.citations.map((citation, index) => html`<lr-citation-badge .index=${index + 1} .sourceId=${citation.sourceId ?? ''} .label=${citation.label ?? ''} @lr-citation-activate=${this.onCitationActivate}></lr-citation-badge>`)}</div></section>` : nothing}
      ${this.showSources && this.sources.length ? html`<section part="sources" aria-label=${this.localize('ragAnswerSources')}><h3 part="section-heading">${this.localize('ragAnswerSources')}</h3><lr-source-list part="source-list" .label=${this.localize('ragAnswerSources')} expanded><slot name="sources">${this.sources.map((source) => this.renderSource(source))}</slot></lr-source-list></section>` : nothing}
    </article>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-rag-answer': LyraRagAnswer; } }
