import { html, nothing, type PropertyValues, type TemplateResult } from "lit";
import { property, query, state } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";
import type { DocumentRef } from "../../../ai/types.js";
import {
  autocorrectConverter,
  normalizeAutocorrect,
  trueDefaultBooleanConverter,
} from "../../../internal/converters.js";
import {
  LyraElement,
  type LyraEmitArgs,
} from "../../../internal/lyra-element.js";
import { relayNativeEvent } from "../../../internal/native-event-relay.js";
import { SlotPresenceController } from "../../../internal/slot-presence-controller.js";
import { deepActiveElementIn } from "../../../internal/active-element.js";
import { composedContains } from "../../../internal/overlay-manager.js";
import type {
  LyraAttachmentCapability,
  LyraAttachmentFilesDetail,
} from "../../media/attachment-trigger/attachment-trigger.class.js";
import type { LyraSourceEntry } from "../../retrieval/source-picker/source-picker.class.js";
import type {
  LyraMentionItem,
  LyraMentionPopover,
  LyraMentionSelectDetail,
} from "../../utility/mention-popover/mention-popover.class.js";
import type {
  ChatComposerSelectionDirection,
  ChatComposerStatus,
  ChatComposerWrap,
  LyraChatComposer,
} from "../chat-composer/chat-composer.class.js";
import type {
  LyraCatalog,
  LyraModelCatalogEntry,
} from "../model-select/model-select.class.js";
import type { PromptQueueItem } from "../prompt-queue/prompt-queue.class.js";
import type { PromptQueueChangeDetail } from "../prompt-queue/prompt-queue.class.js";
import type {
  LyraAttachmentIdDetail,
  LyraAttachmentPreviewRequestDetail,
  LyraAttachmentUploadStatus,
} from "../../media/attachment-chip/attachment-chip.class.js";
import type { LyraVoiceCatalogEntry } from "../voice-picker/voice-picker.class.js";
import { styles } from "./prompt-input.styles.js";
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_promptInputAttachments, LYRA_DEFAULT_promptInputControls, LYRA_DEFAULT_promptInputLabel, LYRA_DEFAULT_promptInputSources } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface LyraPromptSuggestion extends LyraMentionItem {
  /** Inserted after the trigger. Defaults to `label`. */
  insertText?: string;
}

export interface LyraPromptInputAttachment extends Omit<DocumentRef, "id"> {
  attachmentId: string;
  file?: File;
  /** File size in bytes, forwarded to the rendered attachment chip. */
  bytes?: number;
  status?: LyraAttachmentUploadStatus;
  progress?: number;
}

interface ActiveSuggestion {
  trigger: "@" | "/";
  start: number;
  query: string;
}

export interface LyraPromptInputEventMap {
  input: InputEvent;
  change: Event;
  focus: FocusEvent;
  blur: FocusEvent;
  "lr-input": CustomEvent<{ value: string }>;
  "lr-change": CustomEvent<{ value: string }>;
  "lr-focus": CustomEvent<null>;
  "lr-blur": CustomEvent<null>;
  "lr-submit": CustomEvent<{ value: string }>;
  "lr-stop": CustomEvent<null>;
  "lr-mention-select": CustomEvent<{
    suggestionId: string;
    index: number;
    label: string;
    trigger: "@" | "/";
  }>;
  "lr-attachments-add": CustomEvent<LyraAttachmentFilesDetail>;
  "lr-attachment-remove": CustomEvent<LyraAttachmentIdDetail>;
  "lr-model-change": CustomEvent<{ value: string; inCatalog: boolean }>;
  "lr-voice-change": CustomEvent<{ value: string; inCatalog: boolean }>;
  "lr-sources-change": CustomEvent<{ selectedIds: string[] }>;
  "lr-queue-change": CustomEvent<PromptQueueChangeDetail>;
  "lr-send-now": CustomEvent<{ item: PromptQueueItem }>;
  "lr-camera-request": CustomEvent<null>;
  "lr-audio-request": CustomEvent<null>;
  "lr-attachment-retry": CustomEvent<LyraAttachmentIdDetail>;
  "lr-attachment-preview-request": CustomEvent<LyraAttachmentPreviewRequestDetail>;
}

type LyraPromptInputCustomEventName = Exclude<
  keyof LyraPromptInputEventMap,
  "input" | "change" | "focus" | "blur"
>;

/**
 * `<lr-prompt-input>` — a composed AI prompt surface combining the chat composer with attachments,
 * model and voice selection, retrieval sources, mentions, slash commands, and a queued-turn list.
 * It performs no upload, model call, retrieval, or persistence.
 *
 * Deliberately not form-associated: this is a composite application interaction whose complete
 * state includes attachments, source scope, model, voice, and queued turns, not one successful
 * string form entry. Observe `lr-input` for controlled text and handle `lr-submit` as the
 * submission request. `label` names the prompt section; it is not generic field chrome.
 *
 * The composed text surface exposes the same native editing-assistance, selection, and range-edit
 * APIs as `<lr-chat-composer>`. Silent `setRangeText()` calls keep this outer `value` synchronized
 * without emitting `lr-input`; selection APIs are no-ops before the nested textarea renders.
 *
 * @customElement lr-prompt-input
 * @slot controls - Replaces the data-driven model, voice, and source controls.
 * @slot start - Attachment-control content rendered before the textarea. Replaces the default
 *   attachment trigger.
 * @slot chips - Replaces the data-driven attachment chips.
 * @slot end - Custom send/stop action replacing the built-in composer action.
 * @slot footer - Content below the composer.
 * @event input - One native `InputEvent` for a user edit of the primary prompt value.
 * @event change - One native `Event` when the primary prompt edit is committed.
 * @event focus - One native `FocusEvent` when the primary prompt receives focus.
 * @event blur - One native `FocusEvent` when the primary prompt loses focus.
 * @event lr-input - Prompt text changed. `detail: { value }`.
 * @event lr-change - Prompt text edit was committed. `detail: { value }`.
 * @event lr-focus - Prefixed notification paired with native `focus`.
 * @event lr-blur - Prefixed notification paired with native `blur`.
 * @event lr-submit - Prompt submission was requested. `detail: { value }`.
 * @event lr-stop - Stop generation was requested.
 * @event lr-mention-select - A mention or slash command was inserted.
 * @event lr-attachments-add - Files were selected. `detail: { files, capability }`.
 * @event lr-attachment-remove - Attachment removal was requested. `detail: { attachmentId }`.
 * @event lr-model-change - Model selection changed. `detail: { value, inCatalog }`.
 * @event lr-voice-change - Voice selection changed. `detail: { value, inCatalog }`.
 * @event lr-sources-change - Retrieval source selection changed. `detail: { selectedIds }`.
 * @event lr-queue-change - The queued prompts changed.
 * @event lr-send-now - Immediate submission of a queued prompt was requested. `detail: { item }`.
 * @event lr-camera-request - Camera capture was requested.
 * @event lr-audio-request - Audio capture was requested.
 * @event lr-attachment-retry - Retrying an attachment was requested. `detail: { attachmentId }`.
 * @event lr-attachment-preview-request - Cancelable preview request.
 *   `detail: { attachmentId, name, mimeType, src }`.
 * @csspart base - The prompt surface.
 * @csspart controls - Model, voice, and source controls.
 * @csspart sources - The collapsible source-picker region.
 * @csspart sources-summary - The source-picker disclosure.
 * @csspart source-picker - The composed source picker.
 * @csspart queue - The composed prompt queue.
 * @csspart composer - The composed chat composer.
 * @csspart start - The composer's `start` attachment control, or its default attachment trigger.
 * @csspart chips - The attachment-chip tray.
 * @csspart footer - The footer slot.
 * @cssprop [--lr-prompt-input-control-width=--lr-size-12rem] - Preferred width of each generated
 *   model, voice, and source control before wrapping.
 * @status stable
 * @since 7.0.0
 */
export class LyraPromptInput extends LyraElement<LyraPromptInputEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    promptInputAttachments: LYRA_DEFAULT_promptInputAttachments,
    promptInputControls: LYRA_DEFAULT_promptInputControls,
    promptInputLabel: LYRA_DEFAULT_promptInputLabel,
    promptInputSources: LYRA_DEFAULT_promptInputSources,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  @property() value = "";
  @property() status: ChatComposerStatus = "idle";
  @property() placeholder = "";
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ type: Boolean, reflect: true, attribute: "readonly" }) readOnly =
    false;
  // numeric-guard-exempt: pure pass-through to <lr-chat-composer>, which rejects non-finite and
  // negative limits and finiteCount-normalizes integers before validation or native DOM use.
  @property({ type: Number, attribute: "minlength" }) minLength?: number;
  // numeric-guard-exempt: same guarded <lr-chat-composer> pass-through as minLength above.
  @property({ type: Number, attribute: "maxlength" }) maxLength?: number;
  @property({
    type: Boolean,
    attribute: "submit-on-enter",
    converter: trueDefaultBooleanConverter,
  })
  submitOnEnter = true;
  /** Forwarded to the composed native textarea. `spellcheck="false"` parses as `false`, matching
   * the textarea's true default while remaining usable from plain HTML. */
  @property({ converter: trueDefaultBooleanConverter }) override spellcheck =
    true;
  /** Forwarded to the composed native textarea's own `autocapitalize`. Empty string omits the
   * attribute and preserves the browser default. */
  @property() override autocapitalize = "";
  private autocorrectValue = true;
  /** Native autocorrect state forwarded through the composer. Reads are boolean; writes accept
   * boolean or the legacy `'off'`/`'false'` strings. */
  @property({ converter: autocorrectConverter })
  override get autocorrect(): boolean {
    return this.autocorrectValue;
  }
  override set autocorrect(next: boolean | string) {
    this.autocorrectValue = normalizeAutocorrect(next);
    this.requestUpdate();
  }
  /** Native wrapping behavior forwarded to the composed textarea. */
  @property() wrap: ChatComposerWrap = "soft";
  /** Native autocomplete hint forwarded to the composed textarea. */
  @property() autocomplete = "";
  /** Virtual-keyboard input hint forwarded to the composed textarea. */
  @property({ attribute: "inputmode" }) override inputMode = "";
  /** Virtual-keyboard enter-action hint forwarded to the composed textarea. */
  @property({ attribute: "enterkeyhint" }) override enterKeyHint = "";
  @property({ attribute: false })
  attachments: readonly LyraPromptInputAttachment[] = [];
  @property({ attribute: false })
  attachmentCapabilities: readonly LyraAttachmentCapability[] = [
    "files",
    "image",
    "audio",
  ];
  @property({ attribute: false }) mentionItems: LyraPromptSuggestion[] = [];
  @property({ attribute: false }) commandItems: LyraPromptSuggestion[] = [];
  @property({ attribute: false }) modelCatalog?: LyraCatalog<LyraModelCatalogEntry>;
  @property() model = "";
  @property({ attribute: false }) voiceCatalog?: LyraCatalog<LyraVoiceCatalogEntry>;
  @property() voice = "";
  @property({ attribute: false }) sources: LyraSourceEntry[] = [];
  @property({ attribute: false }) selectedSourceIds: string[] = [];
  @property({ attribute: false }) queue: PromptQueueItem[] = [];
  @property() label = "";
  @property({ attribute: "aria-label" }) accessibleLabel: string | null = null;

  @state() private activeSuggestion: ActiveSuggestion | null = null;
  private readonly slotPresence = new SlotPresenceController(this);
  @query("lr-chat-composer") private composer?: LyraChatComposer;
  @query("lr-mention-popover") private suggestionPopover?: LyraMentionPopover;
  private suggestionAnchor?: HTMLElement;
  private pendingSuggestionValue: string | undefined;
  private suggestionNavigationGeneration = 0;

  override focus(options?: FocusOptions): void {
    this.composer?.focus(options);
  }

  override blur(): void {
    this.composer?.blur();
  }

  override click(): void {
    if (this.disabled) return;
    this.composer?.click();
  }

  /** The composed native textarea, or `null` before it has rendered. */
  get input(): HTMLTextAreaElement | null {
    return this.composer?.input ?? null;
  }

  get selectionStart(): number | null {
    return this.composer?.selectionStart ?? null;
  }

  set selectionStart(value: number | null) {
    if (this.composer) this.composer.selectionStart = value;
  }

  get selectionEnd(): number | null {
    return this.composer?.selectionEnd ?? null;
  }

  set selectionEnd(value: number | null) {
    if (this.composer) this.composer.selectionEnd = value;
  }

  get selectionDirection(): ChatComposerSelectionDirection | null {
    return this.composer?.selectionDirection ?? null;
  }

  set selectionDirection(value: ChatComposerSelectionDirection | null) {
    if (this.composer) this.composer.selectionDirection = value;
  }

  select(): void {
    this.composer?.select();
  }

  /** Forwards the native selection range to the composed textarea; a pre-render call is a no-op. */
  setSelectionRange(
    start: number | null,
    end: number | null,
    direction?: ChatComposerSelectionDirection
  ): void {
    this.composer?.setSelectionRange(start, end, direction);
  }

  setRangeText(replacement: string): void;
  setRangeText(
    replacement: string,
    start: number,
    end: number,
    selectMode?: SelectionMode
  ): void;
  /**
   * Applies a silent range edit to the composed textarea and synchronizes this outer `value`.
   * Calls before render are no-ops and do not emit `lr-input`.
   */
  setRangeText(
    replacement: string,
    start?: number,
    end?: number,
    selectMode?: SelectionMode
  ): void {
    const composer = this.composer;
    if (!composer) return;
    if (start === undefined || end === undefined) {
      composer.setRangeText(replacement);
    } else {
      composer.setRangeText(replacement, start, end, selectMode);
    }
    this.value = composer.value;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    let invalidate =
      changed.has("mentionItems") ||
      changed.has("commandItems") ||
      changed.has("disabled") ||
      changed.has("readOnly");
    if (changed.has("value")) {
      const internal = this.pendingSuggestionValue === this.value;
      this.pendingSuggestionValue = undefined;
      invalidate ||= !internal;
    }
    if (invalidate) {
      this.suggestionNavigationGeneration += 1;
      this.activeSuggestion = null;
      this.suggestionAnchor = undefined;
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("focusout", this.onCompositeFocusOut);
  }

  override disconnectedCallback(): void {
    this.removeEventListener("focusout", this.onCompositeFocusOut);
    this.closeSuggestions();
    super.disconnectedCallback();
  }

  protected override updated(_changed: PropertyValues): void {
    super.updated(_changed);
    const popover = this.suggestionPopover;
    if (popover && this.suggestionAnchor) {
      popover.anchor = this.suggestionAnchor;
    }
    this.syncSuggestionAria();
    void popover?.updateComplete.then(() => {
      if (this.suggestionPopover === popover) this.syncSuggestionAria();
    });
  }

  private suggestions(): LyraPromptSuggestion[] {
    return this.activeSuggestion?.trigger === "/"
      ? this.commandItems
      : this.mentionItems;
  }

  private detectSuggestion(value: string): void {
    const caret = this.composer?.selectionStart ?? value.length;
    const prefix = value.slice(0, caret);
    const match = /(?:^|\s)([@/])([^\s@/]*)$/.exec(prefix);
    if (!match || (match[1] !== "@" && match[1] !== "/")) {
      this.activeSuggestion = null;
      return;
    }
    const start = caret - match[2]!.length - 1;
    const items = match[1] === "@" ? this.mentionItems : this.commandItems;
    this.activeSuggestion = items.length
      ? { trigger: match[1], start, query: match[2] ?? "" }
      : null;
  }

  private onInput(event: CustomEvent<{ value: string }>): void {
    event.stopPropagation();
    if (this.disabled || this.readOnly) return;
    const composer = event.currentTarget as LyraChatComposer | null;
    this.suggestionAnchor =
      composer?.input ?? this.composer?.input ?? undefined;
    this.pendingSuggestionValue = event.detail.value;
    this.value = event.detail.value;
    this.detectSuggestion(this.value);
    this.emit("lr-input", { value: this.value });
  }

  private onChange(event: CustomEvent<{ value: string }>): void {
    event.stopPropagation();
    if (this.disabled || this.readOnly) return;
    this.value = event.detail.value;
    this.emit("lr-change", { value: this.value });
  }

  private onSubmit(event: CustomEvent<{ value: string }>): void {
    event.stopPropagation();
    if (this.disabled) return;
    this.emit("lr-submit", event.detail);
  }

  private onStop(event: Event): void {
    event.stopPropagation();
    if (this.disabled) return;
    this.emit("lr-stop", null);
  }

  private onKeyDown(event: KeyboardEvent): void {
    const popover = this.suggestionPopover;
    if (
      this.disabled ||
      this.readOnly ||
      !this.activeSuggestion ||
      !popover?.open
    )
      return;
    if (popover.handleKeyDown(event)) {
      const shouldMoveFocus =
        event.key === "ArrowDown" || event.key === "ArrowUp";
      const generation = ++this.suggestionNavigationGeneration;
      void popover.updateComplete.then(async () => {
        const reflected = this.syncSuggestionAria();
        const focused = deepActiveElementIn(this.ownerDocument);
        if (
          shouldMoveFocus &&
          !reflected &&
          generation === this.suggestionNavigationGeneration &&
          this.isConnected &&
          !this.disabled &&
          !this.readOnly &&
          this.suggestionPopover === popover &&
          this.activeSuggestion &&
          popover.open &&
          focused !== null &&
          composedContains(this, focused)
        ) {
          await popover.focusActiveOption({
            ownsFocus: () => {
              const current = deepActiveElementIn(this.ownerDocument);
              return (
                generation === this.suggestionNavigationGeneration &&
                this.isConnected &&
                !this.disabled &&
                !this.readOnly &&
                this.suggestionPopover === popover &&
                this.activeSuggestion !== null &&
                popover.open &&
                current !== null &&
                composedContains(this, current)
              );
            },
          });
        }
      });
    }
  }

  private closeSuggestions(): void {
    this.suggestionNavigationGeneration += 1;
    this.activeSuggestion = null;
    this.suggestionAnchor = undefined;
    this.syncSuggestionAria();
  }

  private onCompositeFocusOut = (): void => {
    const generation = this.suggestionNavigationGeneration;
    queueMicrotask(() => {
      if (
        !this.isConnected ||
        generation !== this.suggestionNavigationGeneration
      )
        return;
      const focused = deepActiveElementIn(this.ownerDocument);
      if (!focused || !composedContains(this, focused)) this.closeSuggestions();
    });
  };

  private onNativeInput = (event: InputEvent): void => {
    if (
      this.disabled ||
      this.readOnly ||
      !this.composer ||
      !event.composedPath().includes(this.composer)
    ) {
      event.stopPropagation();
      return;
    }
    relayNativeEvent(this, event);
  };

  private onNativeChange = (event: Event): void => {
    if (
      this.disabled ||
      this.readOnly ||
      !this.composer ||
      !event.composedPath().includes(this.composer)
    ) {
      event.stopPropagation();
      return;
    }
    relayNativeEvent(this, event);
  };

  private syncSuggestionAria(): boolean {
    const input = this.composer?.input;
    const popover = this.suggestionPopover;
    if (!input) return false;
    // Neither aria-controls nor aria-activedescendant string IDREFs can cross
    // from the composer's shadow root into the mention popover's shadow root.
    // The popover uses element reflection when the platform accepts that
    // cross-root reference and otherwise fails closed so keyboard navigation
    // can transfer real focus into the popover's own tree.
    input.removeAttribute("aria-controls");
    if (popover) return popover.syncActiveDescendant(input);
    input.removeAttribute("aria-activedescendant");
    return false;
  }

  private onSuggestionSelect(
    event: CustomEvent<LyraMentionSelectDetail>
  ): void {
    event.stopPropagation();
    if (this.disabled || this.readOnly) return;
    const active = this.activeSuggestion;
    if (!active) return;
    const occurrence = this.suggestions()[event.detail.index];
    if (!occurrence || occurrence.suggestionId !== event.detail.suggestionId)
      return;
    const item = occurrence as LyraPromptSuggestion;
    const caret = this.composer?.selectionStart ?? this.value.length;
    const inserted = `${active.trigger}${
      item?.insertText ?? event.detail.label
    } `;
    this.value =
      this.value.slice(0, active.start) + inserted + this.value.slice(caret);
    const nextCaret = active.start + inserted.length;
    this.closeSuggestions();
    this.emit("lr-input", { value: this.value });
    this.emit("lr-mention-select", {
      suggestionId: event.detail.suggestionId,
      index: event.detail.index,
      label: event.detail.label,
      trigger: active.trigger,
    });
    void this.updateComplete.then(() => {
      this.composer?.setSelectionRange(nextCaret, nextCaret);
      this.syncSuggestionAria();
    });
  }

  private onFiles(event: CustomEvent<LyraAttachmentFilesDetail>): void {
    event.stopPropagation();
    if (this.disabled) return;
    this.emit("lr-attachments-add", event.detail);
  }

  private renderDefaultAttachmentTrigger(): TemplateResult {
    return html`<lr-attachment-trigger
      .capabilities=${this.attachmentCapabilities}
      .disabled=${this.disabled}
      @lr-files=${this.onFiles}
      @lr-camera-request=${(event: CustomEvent<null>) =>
        this.reemit(event, "lr-camera-request")}
      @lr-audio-request=${(event: CustomEvent<null>) =>
        this.reemit(event, "lr-audio-request")}
    ></lr-attachment-trigger>`;
  }

  private reemit<K extends LyraPromptInputCustomEventName>(
    event: LyraPromptInputEventMap[K] & CustomEvent<unknown>,
    name: K
  ): void {
    event.stopPropagation();
    if (this.disabled) return;
    // `event` and `name` are tied to the same `K`, so `event.detail` is by construction the detail
    // this event map declares for `name` -- but `LyraEmitArgs<…, K>` stays an unresolved
    // conditional while `K` is a type parameter, so the tie has to be asserted rather than proved.
    this.emit(
      name,
      ...([event.detail] as unknown as LyraEmitArgs<LyraPromptInputEventMap, K>)
    );
  }

  private renderAttachment(
    attachment: LyraPromptInputAttachment
  ): TemplateResult {
    return html`<lr-attachment-chip
      .attachmentId=${attachment.attachmentId}
      .file=${attachment.file}
      .name=${attachment.name}
      bytes=${ifDefined(attachment.bytes)}
      .mimeType=${attachment.mimeType ?? ""}
      .previewSrc=${attachment.uri ?? ""}
      .status=${attachment.status ?? "pending"}
      .progress=${attachment.progress ?? 0}
      .removable=${!this.disabled}
      .inert=${this.disabled}
      compact
      @lr-remove=${(event: Event) => {
        event.stopPropagation();
        if (this.disabled) return;
        this.emit("lr-attachment-remove", {
          attachmentId: attachment.attachmentId,
        });
      }}
      @lr-retry=${(event: CustomEvent<LyraAttachmentIdDetail>) =>
        this.reemit(event, "lr-attachment-retry")}
      @lr-preview-request=${this.onAttachmentPreviewRequest}
    ></lr-attachment-chip>`;
  }

  private onAttachmentPreviewRequest(
    event: CustomEvent<LyraAttachmentPreviewRequestDetail>
  ): void {
    event.stopPropagation();
    if (this.disabled) {
      event.preventDefault();
      return;
    }
    const request = this.emit("lr-attachment-preview-request", event.detail, {
      cancelable: true,
    });
    if (request.defaultPrevented) event.preventDefault();
  }

  private renderControls(): TemplateResult | typeof nothing {
    if (
      !this.modelCatalog?.length &&
      !this.voiceCatalog?.length &&
      !this.sources.length
    )
      return nothing;
    return html`<div
      part="controls"
      role="group"
      aria-label=${this.localize("promptInputControls")}
    >
      ${this.modelCatalog?.length
        ? html`<lr-model-select
            .catalog=${this.modelCatalog}
            .value=${this.model}
            .disabled=${this.disabled}
            @lr-change=${(
              event: CustomEvent<{ value: string; inCatalog: boolean }>
            ) => this.reemit(event, "lr-model-change")}
          ></lr-model-select>`
        : nothing}
      ${this.voiceCatalog?.length
        ? html`<lr-voice-picker
            .catalog=${this.voiceCatalog}
            .value=${this.voice}
            .disabled=${this.disabled}
            @lr-change=${(
              event: CustomEvent<{ value: string; inCatalog: boolean }>
            ) => this.reemit(event, "lr-voice-change")}
          ></lr-voice-picker>`
        : nothing}
      ${this.sources.length
        ? html`<details
            part="sources"
            .inert=${this.disabled}
            aria-disabled=${String(this.disabled)}
          >
            <summary part="sources-summary">
              ${this.localize("promptInputSources")}
            </summary>
            <lr-source-picker
              part="source-picker"
              .sources=${this.sources}
              .selectedIds=${this.selectedSourceIds}
              @lr-sources-change=${(
                event: CustomEvent<{ selectedIds: string[] }>
              ) => this.reemit(event, "lr-sources-change")}
            ></lr-source-picker>
          </details>`
        : nothing}
    </div>`;
  }

  override render(): TemplateResult {
    const label =
      this.accessibleLabel ?? (this.label || this.localize("promptInputLabel"));
    const hasChips =
      this.attachments.length > 0 || this.slotPresence.has("chips");
    return html`<section
      part="base"
      aria-label=${label}
      @input=${this.onNativeInput}
      @change=${this.onNativeChange}
    >
      ${this.queue.length
        ? html`<lr-prompt-queue
            part="queue"
            .items=${this.queue}
            .disabled=${this.disabled}
            @lr-queue-change=${(event: CustomEvent<PromptQueueChangeDetail>) =>
              this.reemit(event, "lr-queue-change")}
            @lr-send-now=${(event: CustomEvent<{ item: PromptQueueItem }>) =>
              this.reemit(event, "lr-send-now")}
          ></lr-prompt-queue>`
        : nothing}
      <slot name="controls">${this.renderControls()}</slot>
      <lr-chat-composer
        part="composer"
        .spellcheck=${this.spellcheck}
        .autocapitalize=${this.autocapitalize}
        autocorrect=${this.hasAttribute("autocorrect") || !this.autocorrect
          ? this.autocorrect
            ? "on"
            : "off"
          : nothing}
        .wrap=${this.wrap}
        .autocomplete=${this.autocomplete}
        .inputMode=${this.inputMode}
        .enterKeyHint=${this.enterKeyHint}
        .value=${this.value}
        .status=${this.status}
        .placeholder=${this.placeholder}
        .disabled=${this.disabled}
        .readOnly=${this.readOnly}
        .minLength=${this.minLength}
        .maxLength=${this.maxLength}
        .submitOnEnter=${this.submitOnEnter}
        .accessibleLabel=${label}
        @lr-input=${this.onInput}
        @lr-change=${this.onChange}
        @lr-submit=${this.onSubmit}
        @lr-stop=${this.onStop}
        @keydown=${this.onKeyDown}
      >
        <span slot="start" part="start">
          <slot name="start">${this.renderDefaultAttachmentTrigger()}</slot>
        </span>
        ${hasChips
          ? html`<div
              slot="chips"
              part="chips"
              role="group"
              aria-label=${this.localize("promptInputAttachments")}
            >
              <slot name="chips"
                >${this.attachments.map((attachment) =>
                  this.renderAttachment(attachment)
                )}</slot
              >
            </div>`
          : html`<slot name="chips" hidden aria-hidden="true"></slot>`}
        ${this.slotPresence.has("end")
          ? html`<slot name="end" slot="end"></slot>`
          : nothing}
      </lr-chat-composer>
      <lr-mention-popover
        .anchor=${this.suggestionAnchor}
        .items=${this.suggestions()}
        .query=${this.activeSuggestion?.query ?? ""}
        .open=${!this.disabled &&
        !this.readOnly &&
        this.activeSuggestion !== null}
        @lr-mention-select=${this.onSuggestionSelect}
        @lr-mention-close=${(event: Event) => {
          event.stopPropagation();
          this.closeSuggestions();
        }}
      ></lr-mention-popover>
      ${this.slotPresence.has("footer")
        ? html`<div part="footer"><slot name="footer"></slot></div>`
        : html`<slot name="footer" hidden aria-hidden="true"></slot>`}
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lr-prompt-input": LyraPromptInput;
  }
}
