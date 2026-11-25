import { finiteCount } from '../../../internal/numbers.js';
import { normalizeLabel } from '../../../internal/accessible-name.js';
import { makeScrollRegionFocusable } from '../../../internal/scroll-region.js';
import { ViewerSourceController, ViewerSourceUrlNotAllowedError, type ViewerSourceToken } from '../../../internal/viewer-source-controller.js';
import { bdi } from '../../../internal/bidi.js';
import { utcDate } from '../../../internal/calendar-date.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { srOnly } from '../../../internal/a11y.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { TextViewerTarget, type LyraSearchChangeDetail, type LyraTextViewerTargetEventMap } from '../../../internal/text-viewer-target.js';
import {
  LyraResourceLimitError,
  LyraUserFacingError,
} from '../../../internal/resource-loader.js';
import { viewerFailureMessage } from '../../../internal/viewer-failure-message.js';
import { loadIcal, type IcalTimeApi } from './calendar-loader.js';
import { styles } from './calendar-viewer.styles.js';
import { viewerFrameStyles } from '../viewer-frame.js';
import { getDateTimeFormat } from '../../../internal/intl-cache.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
import { ViewerAnnouncementController } from '../viewer-announcements.js';
import { renderViewerLoading, viewerLoadingStyles } from '../viewer-loading.js';
import { viewerSemanticLabel, viewerSemanticRole } from '../viewer-semantic-owner.js';
import type { AnchorResultDetail, TextSelectDetail } from '../../../internal/document-anchors.js';
import { DeferredTeardown } from '../../../internal/deferred-teardown.js';
import { blankNumberConverter } from '../../../internal/converters.js';
import { isRuntimeArray, isSafeNonArrayObject } from '../../../internal/object-guards.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_documentPreviewEmpty, LYRA_DEFAULT_scrollerLabel } from '../../../internal/default-strings/shared.generated.js';
import { LYRA_DEFAULT_calendarViewerEmpty, LYRA_DEFAULT_calendarViewerLabel, LYRA_DEFAULT_calendarViewerMissingParser, LYRA_DEFAULT_calendarViewerNoSummary, LYRA_DEFAULT_documentPreviewFailedToLoad, LYRA_DEFAULT_documentPreviewResourceTooLarge, LYRA_DEFAULT_documentPreviewTypeCalendar, LYRA_DEFAULT_documentPreviewUrlNotAllowed, LYRA_DEFAULT_loadingDocument } from '../../../internal/default-strings/viewers.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type ParsedCalendarTimeKind = 'date' | 'date-time';
export interface ParsedCalendarEvent {
  uid: string;
  summary: string;
  start: Date | null;
  end: Date | null;
  /** Preserves RFC 5545 DATE versus DATE-TIME semantics through the parse model. */
  startKind: ParsedCalendarTimeKind | null;
  /** Preserves the end value's type; DATE ends are exclusive when formatted. */
  endKind: ParsedCalendarTimeKind | null;
  location: string;
  description: string;
}
/**
 * One host-supplied calendar event for {@link LyraCalendarViewer.events}. Every field is plain
 * text rendered without markup. `start`/`end` are ISO 8601 strings: a `YYYY-MM-DD` date is an
 * all-day date, and a date-time without an offset is local time. With `allDay: true`, only the
 * leading `YYYY-MM-DD` of each value is used and `end` is the exclusive day after the last one,
 * as in iCalendar. An invalid, reversed, or kind-mismatched date is ignored for that field only.
 */
export interface LyraCalendarViewerEventRecord {
  id?: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  location?: string;
  description?: string;
}
type CalendarFetchState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'loaded'; events: ParsedCalendarEvent[] } | { kind: 'error'; message: () => string };
export interface LyraCalendarViewerEventMap extends LyraTextViewerTargetEventMap {
  'lr-load': CustomEvent<null>;
  'lr-render-error': CustomEvent<{ error: unknown }>;
  'lr-search-change': CustomEvent<LyraSearchChangeDetail>;
  'lr-anchor-result': CustomEvent<AnchorResultDetail>;
  'lr-text-select': CustomEvent<TextSelectDetail>;
}
const DEFAULT_MAX_CALENDAR_EVENTS = 250;
const MAX_CALENDAR_EVENTS = 2500;
const MAX_CALENDAR_RENDERED_CHARS = 2 * 1024 * 1024;

function exceedsEventCount(source: string, limit: number): boolean {
  const pattern = /^BEGIN:VEVENT\r?$/gim;
  let count = 0;
  while (pattern.exec(source)) if (++count > limit) return true;
  return false;
}

function formatEventTime(event: ParsedCalendarEvent, locale: string): string {
  if (!event.start) return '';
  if (event.startKind === 'date') {
    const formatter = getDateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' });
    if (!event.end || event.endKind !== 'date') return formatter.format(event.start);
    // RFC 5545 DTEND on a DATE is exclusive. Convert it to the inclusive displayed final date;
    // a same-day/reversed end is invalid and therefore collapses to the start date.
    const inclusiveEnd = new Date(event.end.getTime());
    inclusiveEnd.setUTCDate(inclusiveEnd.getUTCDate() - 1);
    if (inclusiveEnd.getTime() <= event.start.getTime()) return formatter.format(event.start);
    return formatter.formatRange(event.start, inclusiveEnd);
  }
  const formatter = getDateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  return event.end && event.endKind === 'date-time'
    ? formatter.formatRange(event.start, event.end)
    : formatter.format(event.start);
}

type IcalLibrary = NonNullable<Awaited<ReturnType<typeof loadIcal>>>;

function parseCalendarTime(time: IcalTimeApi | undefined): {
  value: Date;
  kind: ParsedCalendarTimeKind;
} | null {
  if (!time) return null;
  let value: Date;
  if (
    time.isDate === true
    && Number.isInteger(time.year)
    && Number.isInteger(time.month)
    && Number.isInteger(time.day)
  ) {
    value = utcDate(time.year!, time.month! - 1, time.day!);
    if (
      value.getUTCFullYear() !== time.year
      || value.getUTCMonth() + 1 !== time.month
      || value.getUTCDate() !== time.day
    ) throw new Error('Invalid all-day calendar date.');
  } else {
    value = time.toJSDate();
  }
  if (!Number.isFinite(value.getTime())) throw new Error('Invalid calendar date.');
  return { value, kind: time.isDate === true ? 'date' : 'date-time' };
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})?$/;

/** Parses one record date under the same DATE/DATE-TIME model as the `.ics` path; null when invalid. */
function parseRecordTime(value: unknown, allDay: boolean): ReturnType<typeof parseCalendarTime> {
  if (typeof value !== 'string' || value.length > 64) return null;
  const dateOnly = ISO_DATE_ONLY.test(value);
  const date = dateOnly || ISO_DATE_TIME.test(value) ? ISO_DATE.exec(value) : null;
  if (!date) return null;
  const [year, month, day] = [Number(date[1]), Number(date[2]), Number(date[3])];
  const calendarDay = utcDate(year, month - 1, day);
  if (
    calendarDay.getUTCFullYear() !== year
    || calendarDay.getUTCMonth() + 1 !== month
    || calendarDay.getUTCDate() !== day
  ) return null;
  if (allDay || dateOnly) return { value: calendarDay, kind: 'date' };
  const instant = new Date(value);
  return Number.isFinite(instant.getTime()) ? { value: instant, kind: 'date-time' } : null;
}

/** Reads a record member only when it is a string own data property; getters and inherited
 *  values are never invoked or trusted. */
function recordText(record: object, key: string): string {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor && 'value' in descriptor && typeof descriptor.value === 'string' ? descriptor.value : '';
}

/** A malformed date drops only that event's time, not the whole calendar. */
function eventTime(read: () => IcalTimeApi | undefined): ReturnType<typeof parseCalendarTime> {
  try { return parseCalendarTime(read()); } catch { return null; }
}

type CalendarEventFields = Omit<ParsedCalendarEvent, 'start' | 'end' | 'startKind' | 'endKind'> & {
  start: ReturnType<typeof parseCalendarTime>;
  end: ReturnType<typeof parseCalendarTime>;
};

/** Builds the shared render model for both sources under one rendered-text ceiling. An end of a
 *  different DATE/DATE-TIME kind than the start, or before it, is dropped. */
function retainCalendarEvents(fields: readonly CalendarEventFields[]): ParsedCalendarEvent[] {
  let renderedChars = 0;
  return fields.map(({ uid, summary, start, end: rawEnd, location, description }) => {
    const end = start && rawEnd && (
      start.kind !== rawEnd.kind
      || rawEnd.value.getTime() < start.value.getTime()
    ) ? null : rawEnd;
    renderedChars += uid.length + summary.length + location.length + description.length;
    if (renderedChars > MAX_CALENDAR_RENDERED_CHARS) {
      throw new LyraResourceLimitError('The calendar contains too much rendered text.');
    }
    return {
      uid,
      summary,
      start: start?.value ?? null,
      end: end?.value ?? null,
      startKind: start?.kind ?? null,
      endKind: end?.kind ?? null,
      location,
      description,
    };
  });
}

/** Validates host-supplied records against the same count ceiling as a fetched document. */
function recordEvents(records: unknown, limit: number): ParsedCalendarEvent[] {
  if (!isRuntimeArray(records)) throw new Error('Calendar events must be an array.');
  if (records.length > limit) throw new LyraResourceLimitError('The calendar contains too many events.');
  const fields: CalendarEventFields[] = [];
  for (let index = 0; index < records.length; index++) {
    const record: unknown = records[index];
    if (!isSafeNonArrayObject(record)) continue;
    const allDay = Object.getOwnPropertyDescriptor(record, 'allDay')?.value === true;
    const title = recordText(record, 'title');
    fields.push({
      uid: recordText(record, 'id'),
      summary: title.trim() ? title : '',
      start: parseRecordTime(Object.getOwnPropertyDescriptor(record, 'start')?.value, allDay),
      end: parseRecordTime(Object.getOwnPropertyDescriptor(record, 'end')?.value, allDay),
      location: recordText(record, 'location'),
      description: recordText(record, 'description'),
    });
  }
  return retainCalendarEvents(fields);
}

class LyraCalendarViewerBase extends LyraElement<LyraCalendarViewerEventMap> {}

/**
 * Parses `.ics` calendars with the optional `ical.js` peer and renders each
 * VEVENT as plain text, preserving summaries, DATE/DATE-TIME semantics, locations, and details.
 * A host that already holds the data assigns plain `events` records instead; they render through
 * the same text-only model and bounds, take precedence over `src`, and need no peer.
 * Early all-day years retain UTC calendar semantics and the exclusive DTEND display boundary.
 * By default, at most 250 events and 2 MiB of rendered event text are retained so search, selection and
 * text-quote anchors continue to cover the complete accepted document without eager 10k-row DOM.
 * The inherited fragment path performs an exact DOM `id` lookup, but generated event markup has
 * no fragment ids; such a jump reports `found: false`. Use a text-quote anchor for event content.
 *
 * @customElement lr-calendar-viewer
 * @event lr-load - Fired after rendering a successfully parsed document. Bubbles and is composed with a `null` detail.
 * @event lr-render-error - Fired when fetching or parsing the calendar fails.
 * @event {CustomEvent<LyraSearchChangeDetail>} lr-search-change - Fired whenever search state
 *   changes. `matchCountExact=false` makes the retained count a lower bound. Bubbling, composed,
 *   and non-cancelable.
 * @event {CustomEvent<AnchorResultDetail>} lr-anchor-result - Fired after an `anchor` assignment or
 *   `scrollToAnchor()` call is applied. `detail: { found: boolean }`. Bubbling, composed, and
 *   non-cancelable.
 * @event {CustomEvent<TextSelectDetail>} lr-text-select - Fired after a selection ends inside the
 *   rendered calendar. `detail: { text: string; anchor: LyraAnchor | null; rects: DOMRect[] }`.
 *   Bubbling, composed, and non-cancelable.
 * @csspart base - The root container with explicit `aria-busy` loading state.
 * @csspart body - The scrollable calendar body.
 * @csspart event-list - The event list.
 * @csspart event - One calendar event.
 * @csspart event-summary - The event title.
 * @csspart event-time - The formatted event time.
 * @csspart event-location - The event location.
 * @csspart event-description - The event description.
 * @csspart error - The error region.
 * @csspart spinner - The visible tokenized loading treatment and ordinary text label.
 * @cssprop [--lr-calendar-viewer-max-height=none] - Maximum block size of `[part="body"]` before it
 *   scrolls internally. The `maxHeight` property sets this token inline on `[part="base"]`.
 * @status stable
 * @since 4.0.0
 */
export class LyraCalendarViewer extends TextViewerTarget(LyraCalendarViewerBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    anchorJumped: LYRA_DEFAULT_anchorJumped,
    anchorJumpedToPage: LYRA_DEFAULT_anchorJumpedToPage,
    anchorNotFound: LYRA_DEFAULT_anchorNotFound,
    calendarViewerEmpty: LYRA_DEFAULT_calendarViewerEmpty,
    calendarViewerLabel: LYRA_DEFAULT_calendarViewerLabel,
    calendarViewerMissingParser: LYRA_DEFAULT_calendarViewerMissingParser,
    calendarViewerNoSummary: LYRA_DEFAULT_calendarViewerNoSummary,
    documentPreviewEmpty: LYRA_DEFAULT_documentPreviewEmpty,
    documentPreviewFailedToLoad: LYRA_DEFAULT_documentPreviewFailedToLoad,
    documentPreviewResourceTooLarge: LYRA_DEFAULT_documentPreviewResourceTooLarge,
    documentPreviewTypeCalendar: LYRA_DEFAULT_documentPreviewTypeCalendar,
    documentPreviewUrlNotAllowed: LYRA_DEFAULT_documentPreviewUrlNotAllowed,
    loadingDocument: LYRA_DEFAULT_loadingDocument,
    scrollerLabel: LYRA_DEFAULT_scrollerLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, viewerFrameStyles, srOnly, viewerLoadingStyles];
  /** URL to fetch and parse as an iCalendar document. Ignored while `events` is set. */
  @property() src = '';
  /**
   * Already-loaded plain events, rendered in array order through the same text-only model as a
   * parsed `.ics` document. When set (including an empty array), it takes precedence over `src`,
   * which is neither fetched nor parsed and needs no `ical.js` peer; `null` restores `src`.
   * The array is bounded by `maxEvents` and the 2 MiB rendered-text ceiling, and is read once per
   * assignment: reassign a new array to change the view. Non-object entries are skipped.
   */
  @property({ attribute: false }) events: readonly LyraCalendarViewerEventRecord[] | null = null;
  /** Maximum admitted events (0–2,500, default 250). A larger document shows the resource-limit message. */
  @property({ converter: blankNumberConverter(250), attribute: 'max-events' }) maxEvents = 250;
  /** Display name associated with the calendar. It names `[part='base']` when host `aria-label` is
   *  absent, before the localized fallback. A non-empty host label remains on the host; an
   *  explicitly empty one is preserved on the shadow owner. */
  @property() name = '';
  /** CSS length that caps the scrollable event body; invalid values are ignored. */
  @property({ attribute: 'max-height' }) maxHeight = '';
  @state() private fetchState: CalendarFetchState = { kind: 'idle' };
  private readonly transport = new ViewerSourceController(this, {
    load: (response, token) => this.readDocument(response, token),
    onError: error => {
      const failure = error instanceof ViewerSourceUrlNotAllowedError
        ? new LyraUserFacingError(this.localize('documentPreviewUrlNotAllowed'), localize => localize('documentPreviewUrlNotAllowed'))
        : error;
      this.fetchState = { kind: 'error', message: viewerFailureMessage(failure, this.localize.bind(this)) };
      this.emit('lr-render-error', { error: failure });
    },
  });
  private lastLoadSrc = '';
  private readonly announcements = new ViewerAnnouncementController(this);

  private releaseScrollRegion?: () => void;

  private syncScrollRegion(): void {
    this.releaseScrollRegion?.();
    const body = this.renderRoot.querySelector<HTMLElement>('[part="body"]');
    this.releaseScrollRegion = body && this.isConnected
      ? makeScrollRegionFocusable(body, this.localize('scrollerLabel'))
      : undefined;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.syncScrollRegion();
    this.announcements.connect();
    if (this.detached.cancel() && this.fetchState.kind !== 'loading') return;
    if (this.hasUpdated && this.src) {
      this.requestUpdate();
      if (this.src === this.lastLoadSrc) this.scheduleAfterUpdate(() => { void this.load(); });
    }
  }

  /** A same-task DOM move keeps the loaded document; a genuine disconnect invalidates its load. */
  private readonly detached = new DeferredTeardown(() => this.transport.cancel());

  override disconnectedCallback(): void {
    this.announcements.disconnect();
    this.releaseScrollRegion?.();
    this.releaseScrollRegion = undefined;
    super.disconnectedCallback();
    this.detached.schedule();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.detached.flush();
    this.announcements.adopted();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.syncScrollRegion();
    this.announcements.transition(
      'load',
      this.fetchState.kind,
      this.fetchState.kind === 'error' ? this.fetchState.message() : this.localize('loadingDocument'),
    );
    if (changed.has('src') || changed.has('maxEvents') || changed.has('events')) this.scheduleAfterUpdate(() => { void this.load(); });
    if (this.isConnected && changed.has('fetchState') && this.fetchState.kind === 'loaded') this.emit('lr-load', null);
  }

  private load(): Promise<void> {
    this.lastLoadSrc = this.src;
    if (this.events != null) {
      this.transport.cancel();
      try {
        const limit = finiteCount(this.maxEvents, DEFAULT_MAX_CALENDAR_EVENTS, MAX_CALENDAR_EVENTS);
        this.fetchState = { kind: 'loaded', events: recordEvents(this.events, limit) };
      } catch (error) {
        this.fetchState = { kind: 'error', message: viewerFailureMessage(error, this.localize.bind(this)) };
        this.emit('lr-render-error', { error });
      }
      return Promise.resolve();
    }
    this.fetchState = this.src ? { kind: 'loading' } : { kind: 'idle' };
    return this.transport.begin(this.src);
  }

  private async readDocument(response: Response, token: ViewerSourceToken): Promise<void> {
    const ical = await loadIcal();
    if (this.transport.isStale(token)) return;
    if (!ical) throw new LyraUserFacingError(this.localize('calendarViewerMissingParser'), localize => localize('calendarViewerMissingParser'));
    const source = await this.transport.readText(response);
    if (this.transport.isStale(token)) return;
    const events = this.parse(source, ical);
    this.fetchState = { kind: 'loaded', events };
  }

  private parse(source: string, ical: IcalLibrary): ParsedCalendarEvent[] {
    // Count events before the peer materializes the whole (up to 25 MB) calendar tree.
    const limit = finiteCount(this.maxEvents, DEFAULT_MAX_CALENDAR_EVENTS, MAX_CALENDAR_EVENTS);
    if (exceedsEventCount(source, limit)) {
      throw new LyraResourceLimitError('The calendar contains too many events.');
    }
    const component = new ical.Component(ical.parse(source));
    const subcomponents = component.getAllSubcomponents('vevent') as unknown[];
    if (subcomponents.length > limit) {
      throw new LyraResourceLimitError('The calendar contains too many events.');
    }
    const text = (value: unknown): string => typeof value === 'string' ? value : '';
    return retainCalendarEvents(subcomponents.map((subcomponent) => {
      const event = new ical.Event(subcomponent);
      return {
        uid: text(event.uid),
        summary: text(event.summary),
        start: eventTime(() => event.startDate),
        end: eventTime(() => event.endDate),
        location: text(event.location),
        description: text(event.description),
      };
    }));
  }

  private renderEvent(event: ParsedCalendarEvent): TemplateResult {
    return html`<li part="event"><span part="event-summary">${bdi(event.summary || this.localize('calendarViewerNoSummary'))}</span><span part="event-time">${bdi(formatEventTime(event, this.effectiveLocale))}</span>${event.location ? html`<span part="event-location">${bdi(event.location)}</span>` : nothing}${event.description ? html`<p part="event-description">${bdi(event.description)}</p>` : nothing}</li>`;
  }

  private renderBody(): TemplateResult {
    switch (this.fetchState.kind) {
      case 'loaded': return this.fetchState.events.length ? html`<ul part="event-list">${this.fetchState.events.map((event) => this.renderEvent(event))}</ul>` : html`<p class="empty-note">${this.localize('calendarViewerEmpty')}</p>`;
      case 'loading': return renderViewerLoading(this.localize('loadingDocument'));
      case 'error': return html`<div part="error">${this.fetchState.message()}</div>`;
      case 'idle': default: return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeCalendar') })}</p>`;
    }
  }

  /** Only the loaded content is searchable and quotable, never the empty-note, spinner or error text. */
  protected override textContentRoot(): Element | null {
    return this.fetchState.kind === 'loaded' && this.fetchState.events.length > 0 ? super.textContentRoot() : null;
  }

  override render(): TemplateResult {
    const maxHeight = sanitizeCssLength(this.maxHeight);
    return html`<div part="base" role=${viewerSemanticRole(this, 'region') ?? nothing} style=${maxHeight ? styleMap({ '--lr-calendar-viewer-max-height': maxHeight }) : nothing} aria-label=${viewerSemanticLabel(this, normalizeLabel(this.name) ?? this.localize('calendarViewerLabel')) ?? nothing} aria-busy=${this.fetchState.kind === 'loading' ? 'true' : 'false'}><div part="body">${this.renderBody()}</div>${this.renderAnchorLiveRegion()}</div>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-calendar-viewer': LyraCalendarViewer; } }
