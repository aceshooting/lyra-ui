import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { FormAssociated, isBarredFromValidation } from '../../../internal/form-associated.js';
import { SET_ANCHORED_VALIDITY } from '../../../internal/anchored-validity.js';
import {
  composedParentElement,
  isAccessibilitySubtreeExcluded,
  isAccessibilityVisible,
  isAccessibilityVisibilityHidden,
  nextId,
} from '../../../internal/a11y.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraAppearance, LyraSize, LyraSizeStep } from '../../../internal/variants.js';
import { styles } from './known-date.styles.js';
import { getDateTimeFormat, getNumberFormat } from '../../../internal/intl-cache.js';
import { activeElementIn } from '../../../internal/active-element.js';
import { isImplicitSubmission, submitOnEnter } from '../../../internal/submit-on-enter.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_date, LYRA_DEFAULT_dateInputInvalid, LYRA_DEFAULT_dateInputMaxMessage, LYRA_DEFAULT_dateInputMinMessage, LYRA_DEFAULT_details, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_knownDateDay, LYRA_DEFAULT_knownDateMonth, LYRA_DEFAULT_knownDateYear, LYRA_DEFAULT_open, LYRA_DEFAULT_restore, LYRA_DEFAULT_search } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** The canonical step a `<lr-known-date>` size resolves to. The library-wide
 *  {@linkcode LyraSizeStep} ladder under this component's own export name; the `size` property
 *  itself takes the wider {@linkcode LyraSize}, which also accepts `small`/`medium`/`large`. */
export type LyraKnownDateSize = LyraSizeStep;
export type LyraKnownDateField = 'day' | 'month' | 'year';
export type LyraKnownDateAppearance = Extract<LyraAppearance, 'filled' | 'outlined' | 'filled-outlined'>;

/** The three raw field strings exposed by `<lr-known-date>`. */
export interface DateParts {
  day: string;
  month: string;
  year: string;
}

const EMPTY_PARTS: Readonly<DateParts> = { day: '', month: '', year: '' };

/** Lyra-prefixed alias for consumers that keep all imported public types namespaced. */
export type LyraKnownDateParts = DateParts;

/** Parse `YYYY-MM-DD` into a local Date, or null if invalid (calendar-invalid
 *  combinations like Feb 30 are rejected, not silently rolled over). Local
 *  port of `date-picker/calendar-core.ts#parseISO` -- duplicated rather than
 *  imported so this component's own directory stays self-contained. */
function parseISO(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) return null;
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

/** Format a Date as local `YYYY-MM-DD`. Local port of
 *  `date-picker/calendar-core.ts#formatISO` -- see {@link parseISO}. */
function formatISO(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/** Determines the locale's day/month/year field order from a real formatted
 *  sample (Jan 2, 2026 -- a date where day/month/year are all numerically
 *  distinguishable), instead of relying on `Date.parse()`'s implementation-
 *  defined (commonly mm/dd/yyyy-biased) heuristics for an ambiguous separated
 *  date. Local port of `date-picker/date-input.class.ts`'s own
 *  `localeDateOrder()` -- see {@link parseISO}'s doc comment for why it's
 *  duplicated rather than imported. */
function localeDateOrder(locale: string): LyraKnownDateField[] {
  try {
    const parts = getDateTimeFormat(locale || undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(2026, 0, 2));
    const order = parts
      .filter(
        (p): p is Intl.DateTimeFormatPart & { type: LyraKnownDateField } =>
          p.type === 'day' || p.type === 'month' || p.type === 'year',
      )
      .map((p) => p.type);
    return order.length === 3 ? order : ['month', 'day', 'year'];
  } catch {
    return ['month', 'day', 'year']; // Date.parse()'s own bias, as a last-resort fallback
  }
}

export interface LyraKnownDateEventDetail {
  /** Canonical ISO 8601 date (`YYYY-MM-DD`), or `''` while incomplete/invalid. Mirrors `value`. */
  value: string;
  /** Per-field raw text as currently typed, always present even while incomplete. */
  day: string;
  month: string;
  year: string;
  /** Which field the user was last editing when this event fired. */
  field: LyraKnownDateField;
}

export interface LyraKnownDateEventMap {
  'lr-invalid': CustomEvent<undefined>;
  input: InputEvent & { readonly detail: LyraKnownDateEventDetail };
  change: Event & { readonly detail: LyraKnownDateEventDetail };
  focus: CustomEvent<undefined>;
  blur: CustomEvent<undefined>;
}

class LyraKnownDateBase extends LyraElement<LyraKnownDateEventMap> {}

function addCompatibilityDetail<T extends Event>(event: T, detail: LyraKnownDateEventDetail): T {
  // v4-v7 exposed these two events as CustomEvents. v8 restores the upstream native constructor,
  // but an own `detail` value keeps existing JavaScript consumers working during the major-version
  // migration. The property is intentionally non-enumerable, matching platform event payloads.
  Object.defineProperty(event, 'detail', { configurable: true, value: detail });
  return event;
}

/**
 * `<lr-known-date>` — a date a user already knows (a birthdate, a passport
 * issue/expiry date) collected as three plain, labeled day/month/year number
 * fields in the locale's natural field order, rather than a calendar popup.
 * Form-associated; the submitted form value is always canonical ISO 8601
 * (`YYYY-MM-DD`), or `''` while any field is blank or the combination isn't a
 * real calendar date. Mirrors Web Awesome's `wa-known-date` API surface under
 * `lr-`. `appearance` and `pill` mirror its field treatments, while `size` uses this library's
 * shared `2xs`–`xl` ladder and also accepts the upstream `small`/`medium`/`large` spellings — the
 * same ladder every other Lyra form control sits on. The shared `FormAssociated` surface supplies
 * the upstream `form` owner contract.
 *
 * A field's own `<input>` shows exactly what was typed (never reformatted or
 * reverted) -- only the composite `value` is zero-padded. Auto-advance
 * (typing a field's last digit moves focus to the next field) and
 * backspace-to-previous-field-when-empty are this library's own additions on
 * top of Web Awesome's bare typing model, which documents no auto-advance;
 * don't remove them to "restore" WA parity. Arrow-key field-to-field
 * navigation at a field's text boundary is RTL-aware: the *physical* key that
 * means "toward the next field" flips under an inherited `dir="rtl"`, while
 * the field order itself (locale-derived) does not. Locale digits such as
 * Arabic-Indic and Persian numerals are accepted and normalized to the
 * canonical ASCII digits used by the ISO form value.
 *
 * Pressing Enter in any of the three fields performs the implicit form submission a native
 * `<input>` would (see `internal/submit-on-enter.ts` — the fields live in a shadow root and have no
 * form owner, so the platform can never do it here), flushing any pending `change` first.
 *
 * No resizable text-editing surface exists (three fixed-width digit fields),
 * so resize forwarding doesn't apply, and `spellcheck`/`autocapitalize`/
 * `autocorrect`/`wrap` don't meaningfully apply to 2–4-digit numeric fields
 * either -- the same carve-out `lr-input[type="number"]` already documents.
 * Visible validation-message changes are appended to a pre-mounted light-DOM assertive live
 * region. Hidden, inert, CSS-hidden, and `aria-hidden` slotted error content is excluded from the
 * announcement text, and no error is announced while the control or a composed ancestor is
 * hidden. Initial and reconnected validation state remains silent.
 *
 * @customElement lr-known-date
 * @event {InputEvent & { readonly detail: LyraKnownDateEventDetail }} input - A bubbling, composed
 *   native input event fired on every keystroke in
 *   any field. Its compatibility `detail.value` is the canonical ISO date
 *   only once all three fields resolve to a real calendar date, otherwise `''`; `detail.day`/
 *   `month`/`year` always carry the live raw typed text.
 * @event {Event & { readonly detail: LyraKnownDateEventDetail }} change - A bubbling, composed
 *   native change event fired when a field loses focus
 *   (including a Tab/auto-advance move away from it)
 *   and the composite value has newly transitioned to a different complete date, or from complete
 *   back to incomplete/blank. Programmatic `value`/`valueAsDate` assignment stays silent.
 * @event focus - Re-dispatched, bubbling and composed, when any of the three internal fields
 *   receives focus (native `focus` doesn't bubble or cross a shadow boundary).
 * @event blur - Re-dispatched, bubbling and composed, once when focus leaves all three internal
 *   fields for something outside the control -- not once per internal field-to-field Tab.
 * @event lr-invalid - The composite date failed a validity check; cancelable. Calling
 *   `preventDefault()` also cancels the native `invalid` event it aliases, suppressing the
 *   browser's own validation bubble and `reportValidity()`'s focus/scroll.
 * @slot label - Custom label/legend content, alongside the `label` attribute.
 * @slot hint - Custom hint content, alongside the `hint` attribute.
 * @slot error - Custom error content, alongside the `errorText` attribute.
 * @csspart base - Compatibility name for the outer wrapper; use `known-date`.
 * @csspart known-date - The outer wrapper around legend, fieldset, hint, and error. It is the same
 *   node as `base` and `form-control`.
 * @csspart form-control - The outer wrapper. It is the same node as `base` and `known-date`.
 * @csspart fieldset - The `<fieldset>` grouping the three fields.
 * @csspart legend - The `<legend>` element.
 * @csspart form-control-label - The visible label wrapper inside the legend.
 * @csspart label - Deprecated in 8.0.0; compatibility alias for `form-control-label`, retained
 *   until at least 10.0.0.
 * @csspart fields - The row wrapping the three field blocks.
 * @csspart form-control-input - Alias on the fields row matching other form controls.
 * @csspart field - Each field block (label + input), repeated three times; distinguished by
 *   `data-field="day"|"month"|"year"`.
 * @csspart field-day - Added to the day field block.
 * @csspart field-month - Added to the month field block.
 * @csspart field-year - Added to the year field block.
 * @csspart field-input - The native per-field `<input type="text" inputmode="numeric">`, repeated
 *   three times; distinguished by `data-field="day"|"month"|"year"`.
 * @csspart field-label - The small visible per-field text label ("Day"/"Month"/"Year").
 * @csspart hint - The hint message.
 * @csspart error - The validation message.
 * @cssprop [--lr-known-date-field-padding-block=var(--lr-form-control-padding-block)] - Block
 *   padding of each `field-input`, auto-swapped per `size` by the shared ladder.
 * @cssprop [--lr-known-date-field-padding-inline=var(--lr-form-control-padding-inline)] - Inline
 *   padding of each `field-input`, auto-swapped per `size` by the shared ladder.
 * @cssprop [--lr-known-date-field-font-size=var(--lr-form-control-font-size)] - Font size of each
 *   `field-input`, auto-swapped per `size` by the shared ladder.
 * @cssprop [--lr-known-date-field-min-height=max(var(--lr-form-control-height),var(--lr-size-24px))]
 *   - Minimum block size of each `field-input`, auto-swapped per `size` (`2xs`/`xs`→`24px`,
 *   `s`→`1.875rem`, `m`→`2.5rem`, `l`→`3rem`, `xl`→`3.5rem`) -- the same shared control-height
 *   ladder `lr-input`/`lr-date-input` sit on, so a birthdate field in a form row beside those
 *   controls renders at the same height. The `max()` floors the two smallest tiers at WCAG 2.2
 *   SC 2.5.8's 24px pointer-target minimum. At the small tiers the floor exceeds the field's own
 *   content height and actively pins the rendered box; at `l`/`xl` the content height stays under
 *   it, so those two tiers are unaffected.
 * @cssprop --lr-known-date-field-height - Exact block size of each `field-input`. Undeclared by
 *   default, so the field grows to fit its content, floored by `--lr-known-date-field-min-height`.
 *   Set it to pin a fixed height.
 * @cssprop [--lr-known-date-field-gap=var(--lr-space-s)] - Gap between the three field blocks.
 * @cssprop [--lr-known-date-day-field-width=var(--lr-size-3-5em)] - Inline size of the day field.
 * @cssprop [--lr-known-date-month-field-width=var(--lr-size-3-5em)] - Inline size of the month
 *   field.
 * @cssprop [--lr-known-date-year-field-width=var(--lr-size-5em)] - Inline size of the year field.
 * @cssprop [--lr-known-date-invalid-border-color=var(--lr-color-danger)] - Border color of each
 *   `field-input` while `:host([data-invalid])` is set.
 * @cssprop [--lr-form-control-required-content=' *'] - The required-field marker, rendered after
 * the fieldset `legend` here rather than after the inner label span, so it follows the whole label
 * rather than sitting inside it. Set it to `''` to suppress the marker, or to any other quoted
 * string (`' (required)'`, a localized word) to replace it. Caller-supplied content, so it is never
 * localized here.
 * @cssprop [--lr-form-control-required-color=var(--lr-color-danger)] - Color of that marker,
 * retunable without touching any other danger-coloured surface.
 * @cssprop [--lr-form-control-required-offset=0] - Inline space between the label text and the
 * marker.
 * @cssstate blank - The composite value is empty or incomplete.
 * @cssstate disabled - The control is disabled directly or through an ancestor fieldset.
 * @status stable
 * @since 4.0.0
 */
export class LyraKnownDate extends FormAssociated(LyraKnownDateBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    date: LYRA_DEFAULT_date,
    dateInputInvalid: LYRA_DEFAULT_dateInputInvalid,
    dateInputMaxMessage: LYRA_DEFAULT_dateInputMaxMessage,
    dateInputMinMessage: LYRA_DEFAULT_dateInputMinMessage,
    details: LYRA_DEFAULT_details,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    knownDateDay: LYRA_DEFAULT_knownDateDay,
    knownDateMonth: LYRA_DEFAULT_knownDateMonth,
    knownDateYear: LYRA_DEFAULT_knownDateYear,
    open: LYRA_DEFAULT_open,
    restore: LYRA_DEFAULT_restore,
    search: LYRA_DEFAULT_search,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  // The shared ladder sits before this component's own sheet so the per-tier `--lr-form-control-*`
  // knobs are already declared by the time the `--lr-known-date-field-*` surface reads them.
  static override styles = [LyraElement.styles, sizes, styles];

  static override properties = {
    min: { reflect: true, noAccessor: true },
    max: { reflect: true, noAccessor: true },
    readonly: { type: Boolean, reflect: true, noAccessor: true },
    parts: { attribute: false, noAccessor: true },
  };

  /** Control density, on the library's shared six-step ladder — `'m'` by default. Scales each
   *  field's height floor, padding, font size and corner radius together, so a birthdate field
   *  lines up with the `lr-input`/`lr-date-input` beside it at the same declared size.
   *  `'small'`/`'medium'`/`'large'` are accepted as synonyms of `'s'`/`'m'`/`'l'`. Every tier
   *  resolves to at least the 24px pointer-target floor, so even `'2xs'` stays usable. */
  @property({ reflect: true }) size: LyraSize = 'm';
  /** The field fill treatment. */
  @property({ reflect: true }) appearance: LyraKnownDateAppearance = 'outlined';
  /** Draws each field with fully rounded corners. */
  @property({ type: Boolean, reflect: true }) pill = false;
  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  /** BCP-47 override for field order and field-label localization sampling. Empty string falls
   *  back to `this.effectiveLocale` (inherited `lang`/ancestor), exactly like `lr-date-input`'s
   *  `locale`. Redeclared (non-reflecting) over `LyraElement`'s own reflecting `locale` for the
   *  same reason `lr-date-input` does. */
  @property() override locale = '';
  /** Browser autofill family. `'bday'` expands into the three field-specific birthday tokens;
   *  `'on'`/`'off'` apply to every field, and any other non-empty token is forwarded only to the
   *  year field, matching the mirrored control. */
  @property() autocomplete = '';
  /** SSR slot-presence hint for a slotted label. Runtime slot detection remains automatic. */
  @property({ type: Boolean, attribute: 'with-label' }) withLabel = false;
  /** SSR slot-presence hint for slotted hint content. Runtime slot detection remains automatic. */
  @property({ type: Boolean, attribute: 'with-hint' }) withHint = false;
  /** Overrides the fieldset's computed accessible name (normally the `<legend>`'s content). Applied
   *  as `aria-label` on the `part="fieldset"` element, which owns the role -- not just the host. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  /** Visible + accessible per-field label for the day field. Routes through
   *  `this.localize('knownDateDay', ...)`. */
  @property({ attribute: 'day-label' }) dayLabel = 'Day';
  /** Visible + accessible per-field label for the month field. Routes through
   *  `this.localize('knownDateMonth', ...)`. */
  @property({ attribute: 'month-label' }) monthLabel = 'Month';
  /** Visible + accessible per-field label for the year field. Routes through
   *  `this.localize('knownDateYear', ...)`. */
  @property({ attribute: 'year-label' }) yearLabel = 'Year';

  private _parts: DateParts = { ...EMPTY_PARTS };
  // Set on the first blur that leaves the whole control (not a field-to-field
  // Tab); gates the touched-only invalid presentation, same as every other
  // lyra form control.
  @state() private touched = false;
  @state() private hasLabelSlot = false;
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;

  private _min = '';
  private _max = '';
  private _readonly = false;
  /** The last value a `change` event was fired for (or the constructed initial value) -- lets
   *  `commitChangeIfNeeded()` fire `change` only on a real transition, matching `lr-date-input`'s
   *  own "input fires more often than change" contract. */
  private lastCommittedValue = '';
  private lastEditedField: LyraKnownDateField = 'day';
  private errorAnnouncementSink?: AnnouncementSink;
  private errorObserver?: MutationObserver;
  private errorAnnouncementsArmed = false;
  private lastVisibleError = '';
  private connectionGeneration = 0;
  private readonly onForwardedSlotChange = (event: Event): void => {
    const target = event.target as Element | null;
    if (target?.nodeType !== 1 || target.localName !== 'slot') return;
    this.bindErrorObserverTargets();
    this.announceVisibleError();
  };

  private readonly hintId = nextId('known-date-hint');
  private readonly errorId = nextId('known-date-error');
  private readonly dayId = nextId('known-date-day');
  private readonly monthId = nextId('known-date-month');
  private readonly yearId = nextId('known-date-year');

  /** Hidden native date mirror used by integrations that inspect native constraints directly. */
  @query('input[data-value-input]') valueInput!: HTMLInputElement;

  constructor() {
    super();
    this.addEventListener('invalid', () => {
      this.touched = true;
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.errorAnnouncementSink ??= acquireAnnouncementSink('assertive', {
      document: this.ownerDocument,
      source: this,
    });
    const MutationObserverCtor = this.ownerDocument.defaultView?.MutationObserver;
    this.errorObserver = MutationObserverCtor
      ? new MutationObserverCtor(() => {
          this.bindErrorObserverTargets();
          this.announceVisibleError();
        })
      : undefined;
    this.addEventListener('slotchange', this.onForwardedSlotChange);
    this.bindErrorObserverTargets();
    this.errorAnnouncementsArmed = false;
    const generation = ++this.connectionGeneration;
    void this.updateComplete
      .then(() => {
        const view = this.ownerDocument.defaultView;
        return typeof view?.requestAnimationFrame === 'function'
          ? new Promise<void>((resolve) => view.requestAnimationFrame(() => resolve()))
          : Promise.resolve();
      })
      .then(() => this.updateComplete)
      .then(() => {
        if (!this.isConnected || generation !== this.connectionGeneration) return;
        this.lastVisibleError = this.visibleErrorText();
        this.errorAnnouncementsArmed = true;
      });
  }

  private observeErrorNode(node: Node): void {
    if (!this.errorObserver) return;
    if (node.nodeType === 3) {
      this.errorObserver.observe(node, { characterData: true });
      return;
    }
    if (node.nodeType !== 1) return;
    this.errorObserver.observe(node, {
      attributes: true,
      attributeFilter: ['aria-hidden', 'aria-label', 'class', 'hidden', 'inert', 'slot', 'style'],
      characterData: true,
      childList: true,
      subtree: true,
    });
  }

  private bindErrorObserverTargets(): void {
    if (!this.errorObserver) return;
    this.errorObserver.disconnect();
    this.observeErrorNode(this);
    let ancestor = composedParentElement(this);
    while (ancestor) {
      this.errorObserver.observe(ancestor, {
        attributes: true,
        attributeFilter: ['aria-hidden', 'class', 'hidden', 'inert', 'style'],
      });
      ancestor = composedParentElement(ancestor);
    }

    const errorBranches = Array.from(this.children).filter(
      (element) => element.getAttribute('slot') === 'error',
    );
    const forwardedSlots = errorBranches.flatMap((branch) => [
      ...(branch.localName === 'slot' ? [branch as HTMLSlotElement] : []),
      ...branch.querySelectorAll<HTMLSlotElement>('slot'),
    ]);
    for (const slot of forwardedSlots) {
      for (const assigned of slot.assignedNodes({ flatten: true })) this.observeErrorNode(assigned);
    }
  }

  override disconnectedCallback(): void {
    this.connectionGeneration += 1;
    this.errorAnnouncementsArmed = false;
    this.lastVisibleError = '';
    this.removeEventListener('slotchange', this.onForwardedSlotChange);
    this.errorObserver?.disconnect();
    this.errorObserver = undefined;
    this.errorAnnouncementSink?.release();
    this.errorAnnouncementSink = undefined;
    super.disconnectedCallback();
  }

  get min(): string {
    return this._min;
  }

  set min(next: string) {
    const old = this._min;
    this._min = next ?? '';
    this.updateValidity();
    this.requestUpdate('min', old);
  }

  get max(): string {
    return this._max;
  }

  set max(next: string) {
    const old = this._max;
    this._max = next ?? '';
    this.updateValidity();
    this.requestUpdate('max', old);
  }

  get readonly(): boolean {
    return this._readonly;
  }

  set readonly(next: boolean) {
    const old = this._readonly;
    this._readonly = Boolean(next);
    this.toggleAttribute('readonly', this._readonly);
    this.updateValidity();
    this.requestUpdate('readonly', old);
  }

  /** The three raw day/month/year field strings. Assigning a complete valid set updates `value`. */
  get parts(): DateParts {
    return this._parts;
  }

  set parts(next: DateParts) {
    this.setParts(next, true);
  }

  private setParts(next: Partial<DateParts> | null | undefined, programmatic: boolean): void {
    const old = this._parts;
    this._parts = {
      day: String(next?.day ?? ''),
      month: String(next?.month ?? ''),
      year: String(next?.year ?? ''),
    };
    if (programmatic) {
      this.commitFromFields();
      this.lastCommittedValue = this.value;
    }
    this.requestUpdate('parts', old);
  }

  override get value(): string {
    return super.value;
  }

  /** Normalizes an assignment to the canonical ISO date or `''`, and repopulates the three raw
   *  field texts to match -- a declarative `value="2007-3-27"` (non-padded) or a calendar-invalid
   *  literal (`"2007-02-30"`) sanitizes to `''`, same strict-ISO gate as `lr-date-input`'s
   *  `parseStrictISO()`. Programmatic assignment stays silent (no `input`/`change`), matching every
   *  `FormAssociated` sibling's documented contract. */
  override set value(next: string) {
    const parsed = this.parseStrictISO(next ?? '');
    if (parsed) {
      this.setParts(
        {
          day: String(parsed.getDate()),
          month: String(parsed.getMonth() + 1),
          year: String(parsed.getFullYear()),
        },
        false,
      );
      super.value = formatISO(parsed);
    } else {
      this.setParts({ day: '', month: '', year: '' }, false);
      super.value = '';
    }
    this.lastCommittedValue = super.value;
  }

  /** The composite value as a local-midnight `Date`, or `null` while incomplete/invalid. */
  get valueAsDate(): Date | null {
    return this.value ? parseISO(this.value) : null;
  }

  set valueAsDate(next: Date | null) {
    this.value = next ? formatISO(next) : '';
  }

  private parseStrictISO(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    return parseISO(value);
  }

  private get fieldOrder(): LyraKnownDateField[] {
    return localeDateOrder(this.effectiveLocale);
  }

  private textFor(field: LyraKnownDateField): string {
    return this._parts[field];
  }

  private setFieldText(field: LyraKnownDateField, text: string): void {
    this.setParts({ ...this._parts, [field]: text }, false);
  }

  private idFor(field: LyraKnownDateField): string {
    if (field === 'day') return this.dayId;
    if (field === 'month') return this.monthId;
    return this.yearId;
  }

  private get effectiveDayLabel(): string {
    return this.localize('knownDateDay', this.dayLabel === 'Day' ? undefined : this.dayLabel);
  }

  private get effectiveMonthLabel(): string {
    return this.localize('knownDateMonth', this.monthLabel === 'Month' ? undefined : this.monthLabel);
  }

  private get effectiveYearLabel(): string {
    return this.localize('knownDateYear', this.yearLabel === 'Year' ? undefined : this.yearLabel);
  }

  private labelFor(field: LyraKnownDateField): string {
    if (field === 'day') return this.effectiveDayLabel;
    if (field === 'month') return this.effectiveMonthLabel;
    return this.effectiveYearLabel;
  }

  /** Resolves the public autocomplete family for one internal field. */
  private autocompleteFor(field: LyraKnownDateField): string {
    if (!this.autocomplete) return '';
    if (this.autocomplete === 'bday') return `bday-${field}`;
    if (this.autocomplete === 'on' || this.autocomplete === 'off') return this.autocomplete;
    return field === 'year' ? this.autocomplete : '';
  }

  /** Computes the canonical zero-padded ISO date from the three raw typed field texts, or `''`
   *  when any field is empty or the combination isn't a real calendar date. */
  private computeCanonicalValue(): string {
    if (!this._parts.day || !this._parts.month || !this._parts.year) return '';
    const iso = `${this._parts.year.padStart(4, '0')}-${this._parts.month.padStart(2, '0')}-${this._parts.day.padStart(
      2,
      '0',
    )}`;
    return parseISO(iso) ? iso : '';
  }

  /** Recomputes the composite value from the three field texts and pushes it through the base
   *  `FormAssociated` setter directly (bypassing this class's own `value` setter above, which
   *  would otherwise re-derive and clobber the raw per-field text this method is reading from). */
  private commitFromFields(): void {
    super.value = this.computeCanonicalValue();
  }

  private get eventDetail(): Omit<LyraKnownDateEventDetail, 'field'> {
    return { value: this.value, ...this._parts };
  }

  private detailFor(field: LyraKnownDateField): LyraKnownDateEventDetail {
    return { ...this.eventDetail, field };
  }

  /** Fires `change` only on a real transition of the composite value -- called on every field
   *  blur (whether that blur stays inside the control or leaves it), which also covers an
   *  auto-advance move since focusing another field synchronously blurs the current one first. */
  private commitChangeIfNeeded(): void {
    if (this.value === this.lastCommittedValue) return;
    this.lastCommittedValue = this.value;
    const EventConstructor = this.ownerDocument.defaultView?.Event ?? Event;
    const event = addCompatibilityDetail(
      new EventConstructor('change', { bubbles: true, composed: true }),
      this.detailFor(this.lastEditedField),
    );
    this.dispatchEvent(event);
  }

  private fieldInputElement(field: LyraKnownDateField): HTMLInputElement | null {
    return this.renderRoot.querySelector<HTMLInputElement>(`input[data-field="${field}"]`);
  }

  private isRenderedFieldTarget(target: EventTarget | null): boolean {
    if (!target || typeof target !== 'object') return false;
    const field = (target as EventTarget & { dataset?: { field?: string } }).dataset?.field;
    if (field !== 'day' && field !== 'month' && field !== 'year') return false;
    return this.fieldInputElement(field) === target;
  }

  /** Moves focus to the field `delta` steps away from `field` in locale field order; a no-op past
   *  either end (e.g. Backspace-empty on the first field, or auto-advance past the last field). */
  private focusAdjacentField(field: LyraKnownDateField, delta: number): void {
    const order = this.fieldOrder;
    const targetIndex = order.indexOf(field) + delta;
    if (targetIndex < 0 || targetIndex >= order.length) return;
    this.fieldInputElement(order[targetIndex]!)?.focus();
  }

  protected updateValidity(): void {
    // Every barring condition, not just `readonly`: an own/fieldset-cascaded `disabled` (and any
    // platform condition `willValidate` folds in) bars constraint validation exactly as `readonly`
    // does, and this override used to check only the one it happened to own — so a
    // `<lr-known-date required disabled>` kept publishing `valueMissing` and `:state(invalid)`.
    if (isBarredFromValidation(this, this.internals)) {
      this[SET_ANCHORED_VALIDITY]({});
      return;
    }
    const flags: ValidityStateFlags = {};
    let message = '';
    const blank = this._parts.day === '' && this._parts.month === '' && this._parts.year === '';

    if (this.value === '') {
      // A blank composite is `valueMissing` only when *all three* fields are
      // blank (native `<input required>`'s own "empty string" semantics
      // applied here) -- a partially filled required date is `badInput`
      // instead, since an incomplete date is bad input, not a missing one.
      if (this.required && blank) {
        flags.valueMissing = true;
        message = this.localize('fieldRequired');
      } else if (!blank) {
        flags.badInput = true;
        message = this.localize('dateInputInvalid');
      }
    } else {
      const date = parseISO(this.value)!;
      const min = this.parseStrictISO(this.min);
      const max = this.parseStrictISO(this.max);
      if (min && date < min) {
        flags.rangeUnderflow = true;
        message = this.localize('dateInputMinMessage', undefined, {
          min: this.min,
        });
      }
      if (max && date > max) {
        flags.rangeOverflow = true;
        message ||= this.localize('dateInputMaxMessage', undefined, {
          max: this.max,
        });
      }
    }
    this[SET_ANCHORED_VALIDITY](flags, message);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.hasUpdated) {
      this.hasLabelSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'label');
      this.hasHintSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'hint');
      this.hasErrorSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'error');
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    // Unconditional (not gated on `changed.has('value')`) -- `value` uses
    // `noAccessor` and its base setter is never invoked for a freshly
    // constructed, attribute-less instance (the constructor seeds the form
    // value directly via `internals.setFormValue('')`), so a `changed`-gated
    // check would leave `:state(blank)` never set at all for that common
    // case. Both branches are idempotent, so running this on every update is
    // cheap and always correct.
    setCustomState(this.internals, 'blank', this.value === '');
    setCustomState(this.internals, 'disabled', this.effectiveDisabled);
    if (
      changed.has('touched') ||
      changed.has('required') ||
      changed.has('value') ||
      changed.has('min') ||
      changed.has('max') ||
      changed.has('readonly')
    ) {
      this.toggleAttribute('data-invalid', this.touched && !this.internals.validity.valid);
    }
    this.announceVisibleError();
  }

  override formResetCallback(): void {
    super.formResetCallback();
    this.touched = false;
  }

  override formStateRestoreCallback(state: string | File | FormData | null): void {
    this.value = typeof state === 'string' ? state : '';
  }

  /** Sets consumer validity and schedules the validation message surface to refresh. */
  override setCustomValidity(message: string): void {
    super.setCustomValidity(message);
    this.requestUpdate();
  }

  /** Clears consumer-supplied validity and republishes the intrinsic date constraints. */
  override resetValidity(): void {
    this.setCustomValidity('');
    this.updateValidity();
  }

  private onLabelSlotChange = (e: Event): void => {
    this.hasLabelSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onHintSlotChange = (e: Event): void => {
    this.hasHintSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onErrorSlotChange = (e: Event): void => {
    this.hasErrorSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private visibleErrorText(): string {
    const slottedElements = Array.from(this.children).filter(
      (element) => element.getAttribute('slot') === 'error',
    );
    if (slottedElements.length > 0) {
      return slottedElements
        .map((element) => this.accessibleVisibleText(element))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    return (this.errorText || (this.touched ? this.validationMessage : '')).trim();
  }

  private accessibleVisibleText(node: Node): string {
    if (node.nodeType === 3) return node.textContent ?? '';
    if (node.nodeType !== 1) return '';

    const element = node as Element;
    if (isAccessibilitySubtreeExcluded(element)) return '';

    const visibilityHidden = isAccessibilityVisibilityHidden(element);
    const accessibleLabel = visibilityHidden ? null : element.getAttribute('aria-label');
    if (accessibleLabel?.trim()) return accessibleLabel;
    const assigned =
      element.localName === 'slot'
        ? (element as HTMLSlotElement).assignedNodes({ flatten: true })
        : [];
    const children = assigned.length > 0 ? assigned : Array.from(element.childNodes);
    return children.map((child) =>
      child.nodeType === 3 && visibilityHidden ? '' : this.accessibleVisibleText(child),
    ).join(' ');
  }

  private announceVisibleError(): void {
    if (!this.errorAnnouncementsArmed || !isAccessibilityVisible(this)) return;
    const message = this.visibleErrorText();
    if (message === this.lastVisibleError) return;
    this.lastVisibleError = message;
    if (message) this.errorAnnouncementSink?.announce(message);
  }

  private normalizeFieldDigits(value: string): string {
    const digitMap = new Map<string, string>([
      ['٠', '0'],
      ['١', '1'],
      ['٢', '2'],
      ['٣', '3'],
      ['٤', '4'],
      ['٥', '5'],
      ['٦', '6'],
      ['٧', '7'],
      ['٨', '8'],
      ['٩', '9'],
      ['۰', '0'],
      ['۱', '1'],
      ['۲', '2'],
      ['۳', '3'],
      ['۴', '4'],
      ['۵', '5'],
      ['۶', '6'],
      ['۷', '7'],
      ['۸', '8'],
      ['۹', '9'],
    ]);
    try {
      const formatter = getNumberFormat(this.effectiveLocale || undefined, {
        useGrouping: false,
      });
      for (let digit = 0; digit <= 9; digit++) digitMap.set(formatter.format(digit), String(digit));
    } catch {
      // The two Unicode decimal ranges above remain available if an invalid locale was assigned.
    }
    let normalized = '';
    for (const character of value) {
      if (character >= '0' && character <= '9') normalized += character;
      else normalized += digitMap.get(character) ?? '';
    }
    return normalized;
  }

  private onFieldInput = (field: LyraKnownDateField, e: Event): void => {
    e.stopPropagation();
    const input = e.target as HTMLInputElement;
    const maxLength = field === 'year' ? 4 : 2;
    const digits = this.normalizeFieldDigits(input.value).slice(0, maxLength);
    if (input.value !== digits) input.value = digits;
    this.setFieldText(field, digits);
    this.lastEditedField = field;
    this.commitFromFields();
    const InputEventConstructor = this.ownerDocument.defaultView?.InputEvent ?? InputEvent;
    const event = addCompatibilityDetail(
      new InputEventConstructor('input', {
        bubbles: true,
        composed: true,
        inputType: 'insertText',
      }),
      this.detailFor(field),
    );
    this.dispatchEvent(event);
    // Auto-advance is purely digit-count-based (length reaches the field's
    // own cap), not value-based -- this library's own addition layered on
    // top of Web Awesome's bare typing model, see the class doc comment.
    if (field !== 'year' && digits.length === maxLength) this.focusAdjacentField(field, 1);
  };

  private onFieldKeydown = (field: LyraKnownDateField, e: KeyboardEvent): void => {
    const input = e.currentTarget as HTMLInputElement;
    if (isImplicitSubmission(e)) {
      if (this.effectiveDisabled || this.readonly) return;
      // The composite value is already current (every keystroke re-runs `commitFromFields()`), but
      // `change` is normally deferred to a field blur -- and an Enter that submits the form is a
      // commit, so it is flushed here rather than left to fire after the submission, or not at all.
      submitOnEnter(this, e, {
        beforeSubmit: () => this.commitChangeIfNeeded(),
      });
      return;
    }
    if (e.key === 'Backspace' && this.textFor(field) === '') {
      e.preventDefault();
      this.focusAdjacentField(field, -1);
      return;
    }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
    const atEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
    const rtl = this.effectiveDirection === 'rtl';
    // The physical key that means "toward the next field" flips under an
    // inherited RTL direction; the field order itself does not.
    if (e.key === 'ArrowLeft' && atStart) {
      e.preventDefault();
      this.focusAdjacentField(field, rtl ? 1 : -1);
    } else if (e.key === 'ArrowRight' && atEnd) {
      e.preventDefault();
      this.focusAdjacentField(field, rtl ? -1 : 1);
    }
  };

  private onFieldFocus = (e: FocusEvent): void => {
    // Trusted composed focus can be retargeted to the host even though it does not bubble.
    // Suppress that private event before emitting the one documented public bridge.
    e.stopPropagation();
    this.emit('focus');
  };

  private onFieldBlur = (e: FocusEvent): void => {
    // Native blur can be observed at the shadow host in some engines even though it does not
    // bubble. Suppress that private field event so the public bridge below emits exactly one host
    // event when focus leaves the composite control.
    e.stopPropagation();
    this.commitChangeIfNeeded();
    const related = e.relatedTarget;
    const active = activeElementIn(this.shadowRoot);
    const staysInsideControl =
      e.isTrusted &&
      (this.isRenderedFieldTarget(related) ||
        (active !== e.target && this.isRenderedFieldTarget(active)));
    if (staysInsideControl) return;
    // A field's own `?disabled=${this.effectiveDisabled}` binding turning true force-blurs it if
    // it was focused -- a platform reaction to disablement, not a user interaction, so it must not
    // mark the control touched (fr_asxOgk4UhNB07xevCWwFVQ).
    if (!this.effectiveDisabled) this.touched = true;
    this.emit('blur');
  };

  /** Focuses the first field in locale order. */
  override focus(options?: FocusOptions): void {
    const target = this.fieldOrder.find((field) => this.textFor(field) === '') ?? this.fieldOrder[0]!;
    this.fieldInputElement(target)?.focus(options);
  }

  /** Blurs whichever internal field currently has focus, if any. */
  override blur(): void {
    (this.renderRoot.querySelector('input:focus') as HTMLInputElement | null)?.blur();
  }

  /** Activates the first native field in locale order. */
  override click(): void {
    this.fieldInputElement(this.fieldOrder[0]!)?.click();
  }

  private renderField(field: LyraKnownDateField, describedBy: string, invalid: boolean): TemplateResult {
    const id = this.idFor(field);
    const maxLength = field === 'year' ? 4 : 2;
    const fieldPart =
      field === 'day' ? 'field field-day' : field === 'month' ? 'field field-month' : 'field field-year';
    return html`
      <div part=${fieldPart} data-field=${field}>
        <label part="field-label" for=${id}>${this.labelFor(field)}</label>
        <input
          id=${id}
          part="field-input"
          data-field=${field}
          type="text"
          inputmode="numeric"
          maxlength=${maxLength}
          autocomplete=${this.autocompleteFor(field) || nothing}
          aria-describedby=${describedBy || nothing}
          aria-invalid=${invalid ? 'true' : 'false'}
          aria-required=${this.required ? 'true' : 'false'}
          aria-readonly=${this.readonly ? 'true' : 'false'}
          .value=${this.textFor(field)}
          ?required=${this.required}
          ?disabled=${this.effectiveDisabled}
          ?readonly=${this.readonly}
          @input=${(e: Event) => this.onFieldInput(field, e)}
          @change=${(e: Event) => e.stopPropagation()}
          @keydown=${(e: KeyboardEvent) => this.onFieldKeydown(field, e)}
          @focus=${this.onFieldFocus}
          @blur=${this.onFieldBlur}
        />
      </div>
    `;
  }

  override render(): TemplateResult {
    const hasLabel = this.withLabel || this.hasLabelSlot || this.label.length > 0;
    const validationError = this.touched ? this.validationMessage : '';
    const renderedError = this.errorText || validationError;
    const hasHint = this.withHint || this.hasHintSlot || this.hint.length > 0;
    const hasError = this.hasErrorSlot || renderedError.length > 0;
    const invalid = this.touched && !this.internals.validity.valid;
    const describedBy = [hasHint ? this.hintId : '', hasError ? this.errorId : ''].filter(Boolean).join(' ');

    return html`
      <div part="form-control base known-date">
        <input
          data-value-input
          type="date"
          hidden
          aria-hidden="true"
          tabindex="-1"
          .value=${this.value}
          min=${this.min || nothing}
          max=${this.max || nothing}
          ?required=${this.required}
          ?disabled=${this.effectiveDisabled}
          ?readonly=${this.readonly}
        />
        <fieldset part="fieldset" aria-label=${this.accessibleLabel ?? nothing}>
          <legend part="legend" ?hidden=${!hasLabel}>
            <span part="form-control-label label">
              <slot name="label" @slotchange=${this.onLabelSlotChange}>${this.label}</slot>
            </span>
          </legend>
          <div part="fields form-control-input">
            ${this.fieldOrder.map((field) => this.renderField(field, describedBy, invalid))}
          </div>
        </fieldset>
        <div id=${this.hintId} part="hint" ?hidden=${!hasHint}>
          <slot name="hint" @slotchange=${this.onHintSlotChange}>${this.hint}</slot>
        </div>
        <div id=${this.errorId} part="error" ?hidden=${!hasError}>
          <slot name="error" @slotchange=${this.onErrorSlotChange}>${renderedError}</slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-known-date': LyraKnownDate;
  }
}
