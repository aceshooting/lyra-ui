import { eventCollectionSupport } from '../../../internal/collection-snapshot.js';
import { tag } from '../../../internal/prefix.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement, type LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { deepActiveElementIn, shadowFocusTarget } from '../../../internal/active-element.js';
import { restoreComposedFocus } from '../../../internal/focus-repair.js';
import { captureComposedFocusRepair } from '../../../internal/focus-navigation.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { normalizeLabel, resolveAccessibleName } from '../../../internal/accessible-name.js';
import { containShadowChildEvent } from '../../../internal/child-event-containment.js';
import { literalSetConverter } from '../../../internal/converters.js';
import type { FlatToolParamSchema, LyraToolParamForm, ToolParamFormValue } from '../tool-param-form/tool-param-form.class.js';
import { snapshotFormValue } from '../tool-param-form/tool-param-snapshot.js';
import { loadLazyChildren } from '../../../internal/lazy-children.js';
import { AGENT_QUESTION_CHILDREN } from './agent-question-children.js';
import { styles } from './agent-question.styles.js';
import { agentActionButtonStyles } from '../agent-action-button.styles.js';
import { resolveHeadingLevel, type LyraHeadingLevel } from '../../../internal/heading-level.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_agentQuestionAccept, LYRA_DEFAULT_agentQuestionDecline, LYRA_DEFAULT_agentQuestionFormLoadFailed, LYRA_DEFAULT_agentQuestionLabel, LYRA_DEFAULT_agentQuestionSubmitted, LYRA_DEFAULT_agentQuestionUnsupported } from '../../../internal/default-strings/agent-tools.generated.js';
import { LYRA_DEFAULT_cancel } from '../../../internal/default-strings/shared.generated.js';
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
const EMPTY_SCHEMA: FlatToolParamSchema = Object.freeze({ type: 'object', properties: Object.freeze({}) });
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
 * @csspart status - The submitted-state message. Receives focus if submission disables the focused
 *   response control and focus has not moved elsewhere.
 * @csspart error - Unsupported-schema explanation, or the notice that the response form could not load.
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
    agentQuestionFormLoadFailed: LYRA_DEFAULT_agentQuestionFormLoadFailed,
    agentQuestionLabel: LYRA_DEFAULT_agentQuestionLabel,
    agentQuestionSubmitted: LYRA_DEFAULT_agentQuestionSubmitted,
    agentQuestionUnsupported: LYRA_DEFAULT_agentQuestionUnsupported,
    cancel: LYRA_DEFAULT_cancel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override collectionSupport = eventCollectionSupport;
  protected static override readonly immutableEventDetails = Object.freeze(['lr-question-input', 'lr-question-response']);
  static override styles = [LyraElement.styles, styles, agentActionButtonStyles];
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
  private _schema = EMPTY_SCHEMA;
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

  private childRegistration?: Promise<unknown>;
  /** The response form's registration failed; a later render retries it. */
  @state() private formLoadFailed = false;

  protected override async getUpdateComplete(): Promise<boolean> {
    const complete = await super.getUpdateComplete();
    await this.childRegistration;
    return complete;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('requestId') && this.hasUpdated) {
      this.setDraft(this.valueAssignedInCommit ? (this.assignedValue as ToolParamFormValue) : Object.freeze({}));
      if (!this.statusAssignedInCommit) this.setStatus('pending');
    }
    this.valueAssignedInCommit = false;
    this.statusAssignedInCommit = false;

    this.restoreActionFocus = changed.get('status') === 'submitted' && this.status === 'pending' &&
      shadowFocusTarget(this)?.getAttribute('part') === 'status';
    this.submittedFocusAnchor = changed.get('status') === 'pending' && this.status === 'submitted' && !changed.has('requestId')
      ? captureComposedFocusRepair(this, this)?.activeElement ?? null
      : null;
  }
  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    const root = super.createRenderRoot();
    for (const type of ['input', 'change', 'lr-change', 'lr-invalid']) root.addEventListener(type, containShadowChildEvent);
    return root;
  }

  private restoreActionFocus = false;
  private submittedFocusAnchor: Element | null = null;
  private readonly announcements = new AnnouncementSinkController(this, { eager: ['polite'] });
  private isMounting = true;
  override connectedCallback(): void {
    super.connectedCallback();
    this.isMounting = !this.hasUpdated;
  }
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const registration = loadLazyChildren(AGENT_QUESTION_CHILDREN, this.renderRoot);
    if (registration) {
      this.childRegistration = registration;
      void registration.then((loaded) => {
        if (loaded === !this.formLoadFailed) return;
        this.formLoadFailed = !loaded;
        if (!loaded) this.announcements.announceAssertive(this.localize('agentQuestionFormLoadFailed'));
      });
    } else if (this.formLoadFailed && customElements.get(tag('tool-param-form'))) {
      this.formLoadFailed = false;
    }
    if (this.restoreActionFocus) {
      restoreComposedFocus(this, true, this.renderRoot.querySelector<HTMLButtonElement>('button[part="action"]:enabled'));
    }
    const anchor = this.submittedFocusAnchor;
    this.submittedFocusAnchor = null;
    const mounted = !this.isMounting;
    this.isMounting = false;
    if (!changed.has('status') || this.status !== 'submitted') return;
    if (anchor && this.isConnected) {
      const active = deepActiveElementIn(this.ownerDocument);
      if (!active || active === this.ownerDocument.body || active === anchor) {
        const status = this.renderRoot.querySelector<HTMLElement>('[part="status"]');
        status?.focus();
        // Moving focus to the message already presents the text to assistive technology.
        if (status && shadowFocusTarget(this) === status) return;
      }
    }
    if (mounted) this.announcements.announcePolite(this.localize('agentQuestionSubmitted'));
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
        if (this.schema === EMPTY_SCHEMA) {
          content = {};
        } else {
          const form = this.renderRoot.querySelector<LyraToolParamForm>(tag('tool-param-form'));
          if (!form?.matches(':defined')) return;
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
    const defaultLabel = this.localize('agentQuestionLabel');
    const label = this.label === '' ? '' : normalizeLabel(this.label) ?? defaultLabel;
    const level = resolveHeadingLevel(this.headingLevel, '2');
    return html`<div part="base" role="group" aria-label=${ifDefined(resolveAccessibleName(this, label, defaultLabel))}>
      ${label === '' ? nothing : html`<div part="heading" role=${level ? 'heading' : nothing} aria-level=${level ?? nothing}>${label}</div>`}
      ${this.requester ? html`<p part="requester">${this.requester}</p>` : nothing}
      ${this.message ? html`<p part="message">${this.message}</p>` : nothing}
      ${this.schema === EMPTY_SCHEMA ? nothing : this.supportedSchema ? html`<lr-tool-param-form .schema=${this.schema} .value=${this.value}
        .disabled=${this.inactive} @lr-input=${(event: CustomEvent<{ value: ToolParamFormValue }>) => this.input(event, requestId)}></lr-tool-param-form>`
        : html`<p part="error">${this.localize('agentQuestionUnsupported')}</p>`}
      ${this.formLoadFailed && this.schema !== EMPTY_SCHEMA && this.supportedSchema
        ? html`<p part="error">${this.localize('agentQuestionFormLoadFailed')}</p>` : nothing}
      <div part="actions">${(['accept', 'decline', 'cancel'] as const).map((action) => html`<button
        part="action" type="button" data-action=${action} data-agent-action=${action === 'accept' ? 'brand' : 'neutral'} ?disabled=${this.inactive || (action === 'accept' && (!this.supportedSchema || this.formLoadFailed))}
        @click=${() => this.respond(action, requestId)}>${this.localize(action === 'accept' ? 'agentQuestionAccept' : action === 'decline' ? 'agentQuestionDecline' : 'cancel')}</button>`)}</div>
      ${this.status === 'submitted' ? html`<p part="status" tabindex="-1">${this.localize('agentQuestionSubmitted')}</p>` : nothing}
    </div>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-agent-question': LyraAgentQuestion; } }
