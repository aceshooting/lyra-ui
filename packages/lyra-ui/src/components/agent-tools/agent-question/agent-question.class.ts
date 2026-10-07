import { eventCollectionSupport } from '../../../internal/collection-snapshot.js';
import { tag } from '../../../internal/prefix.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement, type LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import { literalSetConverter } from '../../../internal/converters.js';
import type { FlatToolParamSchema, LyraToolParamForm, ToolParamFormValue } from '../tool-param-form/tool-param-form.class.js';
import { snapshotFormValue } from '../tool-param-form/tool-param-snapshot.js';
import { styles } from './agent-question.styles.js';
import { resolveHeadingLevel, type LyraHeadingLevel } from '../../../internal/heading-level.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_agentQuestionAccept, LYRA_DEFAULT_agentQuestionDecline, LYRA_DEFAULT_agentQuestionLabel, LYRA_DEFAULT_agentQuestionSubmitted, LYRA_DEFAULT_agentQuestionUnsupported, LYRA_DEFAULT_cancel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type AgentQuestionStatus = 'pending' | 'submitted';
export type AgentQuestionAction = 'accept' | 'decline' | 'cancel';
export type AgentQuestionResponse =
  | { requestId: string; action: 'accept'; content: ToolParamFormValue }
  | { requestId: string; action: 'decline' | 'cancel' };
export interface LyraAgentQuestionEventMap {
  'lr-question-input': CustomEvent<LyraEventDetailSnapshot<{ requestId: string; value: ToolParamFormValue }>>;
  'lr-question-response': CustomEvent<LyraEventDetailSnapshot<AgentQuestionResponse>>;
}
const QUESTION_STATUS = literalSetConverter<AgentQuestionStatus>(['pending', 'submitted'], 'pending');
const SCHEMA_KEYS = new Set(['type', 'properties', 'required', '$schema']);
const PROPERTY_KEYS = new Set(['type', 'enum', 'description', 'title', 'default', 'const', 'autocomplete', 'spellcheck', 'autocapitalize', 'autoCorrect', 'inputMode', 'enterKeyHint', 'minLength', 'maxLength', 'format', 'minimum', 'maximum', 'minItems', 'maxItems', 'oneOf', 'enumNames', 'items']);

/**
 * A structured agent question with accept, decline and cancel responses compatible with MCP form
 * elicitation actions. The host owns transport and maps `requestId` to its protocol request.
 * This is a request interaction, not an outer form-associated control; its composed
 * `<lr-tool-param-form>` owns field validation. Only flat object schemas with string, number,
 * integer, boolean and string-enum properties (including multiple choice) are supported, with
 * Unicode string lengths, email/URI/date/date-time formats, numeric bounds, selection counts,
 * `required`, primitive `const`, defaults, titled choices and field descriptions. Unknown schema
 * keywords (including nested schemas, `$ref` and patterns) visibly block acceptance rather than
 * silently weakening validation. URL-mode elicitation is outside this component's scope.
 *
 * Input updates `value` and emits a draft event. A response immediately sets `status` to
 * `submitted` to prevent duplicate sends; the host may restore `pending` after a rejected send.
 * Changing `requestId` resets the draft/status unless the respective property is explicitly
 * reassigned in that update. Responses for stale rendered request identities are ignored.
 * Only schema-declared fields are returned; hidden extra draft keys are never submitted.
 * Collections are clone-owned snapshots; replace the object to update.
 *
 * @customElement lr-agent-question
 * @event lr-question-input - Draft edit. `detail: { requestId, value }`.
 * @event lr-question-response - One response. Accepted responses include validated `content`;
 *   decline/cancel responses omit it. `detail: { requestId, action, content? }`.
 * @csspart base - The named question group.
 * @csspart heading - The question heading.
 * @csspart message - Caller-provided question text.
 * @csspart requester - The server or agent requesting the information.
 * @csspart actions - Response controls.
 * @csspart action - A response button.
 * @csspart status - The submitted-state message.
 * @csspart error - Unsupported-schema explanation.
 * @status experimental
 * @since 22.0.0
 */
export class LyraAgentQuestion extends LyraElement<LyraAgentQuestionEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    agentQuestionAccept: LYRA_DEFAULT_agentQuestionAccept,
    agentQuestionDecline: LYRA_DEFAULT_agentQuestionDecline,
    agentQuestionLabel: LYRA_DEFAULT_agentQuestionLabel,
    agentQuestionSubmitted: LYRA_DEFAULT_agentQuestionSubmitted,
    agentQuestionUnsupported: LYRA_DEFAULT_agentQuestionUnsupported,
    cancel: LYRA_DEFAULT_cancel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override collectionSupport = eventCollectionSupport;
  protected static override readonly immutableEventDetails = Object.freeze(['lr-question-input', 'lr-question-response']);
  static override styles = [LyraElement.styles, styles];
  /** Correlation identity. Blank identities disable all responses. */
  @property({ attribute: 'request-id' }) requestId = '';
  /** Server or agent name shown as request provenance. Supply it for MCP elicitation. */
  @property() requester = '';
  /** Visible question text supplied by the caller. */
  @property() message = '';
  /** Visible heading and accessible name; omission localizes the default. */
  @property() label?: string;
  /** Level of the visible heading: `'1'`-`'6'`, or `'none'` for no heading semantics. */
  @property({ attribute: 'heading-level' }) headingLevel: LyraHeadingLevel = '2';
  /** Supported flat primitive form schema. Unknown keywords block acceptance. */
  @property({ attribute: false })
  get schema(): FlatToolParamSchema { return this._schema; }
  set schema(value: FlatToolParamSchema) {
    if (value === this.assignedSchema) return;
    this.assignedSchema = value;
    const previous = this._schema;
    const snapshot = snapshotFormValue(value);
    this.schemaInvalid = snapshot.invalid || snapshot.truncated;
    this._schema = snapshot.value as unknown as FlatToolParamSchema;
    this.requestUpdate('schema', previous);
  }
  private _schema: FlatToolParamSchema = Object.freeze({ type: 'object', properties: Object.freeze({}) });
  // The last host-assigned objects: re-binding the same reference must not discard the typed draft.
  private assignedSchema: unknown = this._schema;
  private schemaInvalid = false;
  private valueInvalid = false;
  /** Current draft. Nested input updates it; host assignments can replace it. */
  @property({ attribute: false })
  get value(): ToolParamFormValue { return this._value; }
  set value(value: ToolParamFormValue) {
    this.valueAssignedInCommit = true;
    if (value === this.assignedValue) return;
    this.assignedValue = value;
    this.setDraft(value);
  }
  private _value: ToolParamFormValue = Object.freeze({});
  private assignedValue: unknown = this._value;
  private valueAssignedInCommit = false;
  private setDraft(value: ToolParamFormValue): void {
    const previous = this._value;
    const snapshot = snapshotFormValue(value);
    this.valueInvalid = snapshot.invalid || snapshot.truncated;
    this._value = snapshot.value;
    this.requestUpdate('value', previous);
  }
  /** Disable input and all response actions. */
  @property({ type: Boolean, reflect: true }) disabled = false;
  /** Submitted responses disable input and all response actions until reset by the host. */
  @property({ reflect: true, converter: QUESTION_STATUS })
  get status(): AgentQuestionStatus { return this._status; }
  set status(value: AgentQuestionStatus) {
    this.statusAssignedInCommit = true;
    this.setStatus(QUESTION_STATUS.normalize(value));
  }
  private _status: AgentQuestionStatus = 'pending';
  private statusAssignedInCommit = false;
  private setStatus(value: AgentQuestionStatus): void {
    const previous = this._status;
    this._status = value;
    this.requestUpdate('status', previous);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('requestId') && this.hasUpdated) {
      this.setDraft(this.valueAssignedInCommit ? (this.assignedValue as ToolParamFormValue) : Object.freeze({}));
      if (!this.statusAssignedInCommit) this.setStatus('pending');
    }
    this.valueAssignedInCommit = false;
    this.statusAssignedInCommit = false;
  }
  private announcements?: AnnouncementSink;
  private isMounting = true;
  override connectedCallback(): void {
    super.connectedCallback();
    this.isMounting = true;
    this.announcements = acquireAnnouncementSink('polite', { document: this.ownerDocument, source: this });
  }
  override disconnectedCallback(): void {
    this.announcements?.release();
    this.announcements = undefined;
    super.disconnectedCallback();
  }
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (!this.isMounting && changed.has('status') && this.status === 'submitted') {
      this.announcements?.announce(this.localize('agentQuestionSubmitted'));
    }
    this.isMounting = false;
  }
  private get supportedSchema(): boolean {
    if (this.schemaInvalid || !this.schema || typeof this.schema !== 'object' || Array.isArray(this.schema)) return false;
    if (Object.keys(this.schema).some((key) => !SCHEMA_KEYS.has(key))) return false;
    const properties = this.schema.properties;
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return false;
    return Object.values(properties).every((field) => field && typeof field === 'object' && !Array.isArray(field)
      && Object.keys(field).every((key) => PROPERTY_KEYS.has(key)));
  }
  private get inactive(): boolean {
    return this.disabled || this.status !== 'pending' || typeof this.requestId !== 'string' || this.requestId.trim() === '';
  }
  private input(event: CustomEvent<{ value: ToolParamFormValue }>, requestId: string): void {
    event.stopPropagation();
    if (this.inactive || requestId !== this.requestId) return;
    this.setDraft(event.detail.value);
    this.emit('lr-question-input', { requestId, value: this.value });
  }
  private responseDispatching = false;
  private respond(action: AgentQuestionAction, requestId: string): void {
    if (this.responseDispatching || this.inactive || requestId !== this.requestId) return;
    this.responseDispatching = true;
    try {
      let content: ToolParamFormValue | undefined;
      if (action === 'accept') {
        if (!this.supportedSchema || this.valueInvalid) return;
        const form = this.renderRoot.querySelector<LyraToolParamForm>(tag('tool-param-form'));
        if (!form) return;
        // Synchronize synchronous host assignments before validation, even before Lit's next render.
        const schema = this.schema;
        const value = this.value;
        form.schema = schema;
        form.value = value;
        if (!form.reportValidity()) return;
        // Validation events can synchronously replace the host request or its draft.
        if (this.inactive || requestId !== this.requestId || this.schema !== schema || this.value !== value) return;
        const effective = form.effectiveValue;
        content = Object.fromEntries(Object.keys(schema.properties)
          .filter((key) => Object.prototype.hasOwnProperty.call(effective, key) && effective[key] !== undefined)
          .map((key) => [key, effective[key]]));
      }
      this.setStatus('submitted');
      this.emit('lr-question-response', action === 'accept'
        ? { requestId, action, content: content! }
        : { requestId, action });
    } finally {
      this.responseDispatching = false;
    }
  }
  override render(): TemplateResult {
    const requestId = this.requestId;
    const label = this.label ?? this.localize('agentQuestionLabel');
    const level = resolveHeadingLevel(this.headingLevel ?? '2');
    return html`<div part="base" role="group" aria-label=${this.getAttribute('aria-label') ?? label}>
      ${label === '' ? nothing : html`<div part="heading" role=${level ? 'heading' : nothing} aria-level=${level ?? nothing}>${label}</div>`}
      ${this.requester ? html`<p part="requester">${this.requester}</p>` : nothing}
      ${this.message ? html`<p part="message">${this.message}</p>` : nothing}
      ${this.supportedSchema ? html`<lr-tool-param-form .schema=${this.schema} .value=${this.value}
        .disabled=${this.inactive} @lr-input=${(event: CustomEvent<{ value: ToolParamFormValue }>) => this.input(event, requestId)}></lr-tool-param-form>`
        : html`<p part="error">${this.localize('agentQuestionUnsupported')}</p>`}
      <div part="actions">${(['accept', 'decline', 'cancel'] as const).map((action) => html`<button
        part="action" type="button" data-action=${action} ?disabled=${this.inactive || (action === 'accept' && !this.supportedSchema)}
        @click=${() => this.respond(action, requestId)}>${this.localize(action === 'accept' ? 'agentQuestionAccept' : action === 'decline' ? 'agentQuestionDecline' : 'cancel')}</button>`)}</div>
      ${this.status === 'submitted' ? html`<p part="status">${this.localize('agentQuestionSubmitted')}</p>` : nothing}
    </div>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-agent-question': LyraAgentQuestion; } }
