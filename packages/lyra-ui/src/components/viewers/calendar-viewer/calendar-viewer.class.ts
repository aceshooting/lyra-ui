import { utcDate } from '../../forms/date-picker/calendar-core.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { srOnly } from '../../../internal/a11y.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { TextViewerTarget, type LyraSearchChangeDetail, type LyraTextViewerTargetEventMap } from '../../../internal/text-viewer-target.js';
import {
  isAbortError,
  isResourceLimitError,
  LyraResourceLimitError,
  LyraUserFacingError,
  readResponseText,
  resolveOwnerFetchTarget,
} from '../../../internal/resource-loader.js';
import { loadIcal, type IcalTimeApi } from './calendar-loader.js';
import { styles } from './calendar-viewer.styles.js';
import { getDateTimeFormat } from '../../../internal/intl-cache.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
import { ViewerAnnouncementController } from '../viewer-announcements.js';
import { renderViewerLoading, viewerLoadingStyles } from '../viewer-loading.js';
import { viewerSemanticLabel, viewerSemanticRole } from '../viewer-semantic-owner.js';
import type { AnchorResultDetail, TextSelectDetail } from '../document-viewer/anchors.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_calendarViewerEmpty, LYRA_DEFAULT_calendarViewerLabel, LYRA_DEFAULT_calendarViewerMissingParser, LYRA_DEFAULT_calendarViewerNoSummary, LYRA_DEFAULT_documentPreviewEmpty, LYRA_DEFAULT_documentPreviewFailedToLoad, LYRA_DEFAULT_documentPreviewResourceTooLarge, LYRA_DEFAULT_documentPreviewTypeCalendar, LYRA_DEFAULT_documentPreviewUrlNotAllowed, LYRA_DEFAULT_loadingDocument } from '../../../internal/default-strings.generated.js';
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
type CalendarFetchState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'loaded'; events: ParsedCalendarEvent[] } | { kind: 'error'; message: string };
export interface LyraCalendarViewerEventMap extends LyraTextViewerTargetEventMap {
  'lr-render-error': CustomEvent<{ error: unknown }>;
  'lr-search-change': CustomEvent<LyraSearchChangeDetail>;
  'lr-anchor-result': CustomEvent<AnchorResultDetail>;
  'lr-text-select': CustomEvent<TextSelectDetail>;
}
const MAX_CALENDAR_EVENTS = 250;
const MAX_CALENDAR_RENDERED_CHARS = 2 * 1024 * 1024;

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

class LyraCalendarViewerBase extends LyraElement<LyraCalendarViewerEventMap> {}

/**
 * Parses `.ics` calendars with the optional `ical.js` peer and renders each
 * VEVENT as plain text, preserving summaries, DATE/DATE-TIME semantics, locations, and details.
 * Early all-day years retain UTC calendar semantics and the exclusive DTEND display boundary.
 * At most 250 events and 2 MiB of rendered event text are retained so search, selection and
 * text-quote anchors continue to cover the complete accepted document without eager 10k-row DOM.
 * The inherited fragment path performs an exact DOM `id` lookup, but generated event markup has
 * no fragment ids; such a jump reports `found: false`. Use a text-quote anchor for event content.
 *
 * @customElement lr-calendar-viewer
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
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly, viewerLoadingStyles];
  /** URL to fetch and parse as an iCalendar document. */
  @property() src = '';
  /** Display name associated with the calendar. It names `[part='base']` when host `aria-label` is
   *  absent, before the localized fallback. A non-empty host label remains on the host; an
   *  explicitly empty one is preserved on the shadow owner. */
  @property() name = '';
  /** CSS length that caps the scrollable event body. */
  /** A CSS `max-height`; invalid values are ignored. */
  @property({ attribute: 'max-height' }) maxHeight = '';
  /** Shared text search and anchor-target API for the rendered calendar body. */
  override async search(query: string): Promise<number> { return super.search(query); }
  override async searchNext(): Promise<boolean> { return super.searchNext(); }
  override async searchPrevious(): Promise<boolean> { return super.searchPrevious(); }
  override clearSearch(): void { super.clearSearch(); }
  @state() private fetchState: CalendarFetchState = { kind: 'idle' };
  private generation = 0;
  private lastLoadSrc = '';
  private readonly announcements = new ViewerAnnouncementController(this);

  override connectedCallback(): void {
    super.connectedCallback();
    this.announcements.connect();
    if (this.hasUpdated && this.src) {
      this.requestUpdate();
      if (this.src === this.lastLoadSrc) this.scheduleAfterUpdate(() => { void this.load(); });
    }
  }

  override disconnectedCallback(): void {
    this.generation++;
    this.announcements.disconnect();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.announcements.adopted();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.announcements.transition(
      'load',
      this.fetchState.kind,
      this.fetchState.kind === 'error' ? this.fetchState.message : this.localize('loadingDocument'),
    );
    if (changed.has('src')) this.scheduleAfterUpdate(() => { void this.load(); });
  }

  private async load(): Promise<void> {
    this.lastLoadSrc = this.src;
    const generation = ++this.generation;
    const signal = this.beginAbortableLoad();
    if (!this.src) { this.fetchState = { kind: 'idle' }; return; }
    const fetchTarget = resolveOwnerFetchTarget(this, this.src);
    if (!fetchTarget) {
      const error = new LyraUserFacingError(this.localize('documentPreviewUrlNotAllowed'));
      this.fetchState = { kind: 'error', message: error.message };
      this.emit('lr-render-error', { error });
      return;
    }
    this.fetchState = { kind: 'loading' };
    try {
      const response = await fetchTarget.view.fetch(fetchTarget.url, signal ? { signal } : undefined);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const source = await readResponseText(response);
      if (!this.isConnected || generation !== this.generation) return;
      const events = await this.parse(source, generation);
      if (!this.isConnected || generation !== this.generation) return;
      if (!events) return;
      if (generation === this.generation) this.fetchState = { kind: 'loaded', events };
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.fetchState = { kind: 'error', message: error instanceof LyraUserFacingError ? error.message : this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad') };
      this.emit('lr-render-error', { error });
    }
  }

  private async parse(source: string, generation: number): Promise<ParsedCalendarEvent[] | undefined> {
    const ical = await loadIcal();
    if (!this.isConnected || generation !== this.generation) return undefined;
    if (!ical) throw new LyraUserFacingError(this.localize('calendarViewerMissingParser'));
    const component = new ical.Component(ical.parse(source));
    const subcomponents = component.getAllSubcomponents('vevent') as unknown[];
    if (subcomponents.length > MAX_CALENDAR_EVENTS) {
      throw new LyraResourceLimitError('The calendar contains too many events.');
    }
    let renderedChars = 0;
    const events = subcomponents.map((subcomponent) => {
      const event = new ical.Event(subcomponent);
      const parsedStart = parseCalendarTime(event.startDate);
      const parsedEnd = parseCalendarTime(event.endDate);
      const end = parsedStart && parsedEnd && (
        parsedStart.kind !== parsedEnd.kind
        || parsedEnd.value.getTime() < parsedStart.value.getTime()
      ) ? null : parsedEnd;
      const uid = event.uid ?? '';
      const summary = event.summary ?? '';
      const location = event.location ?? '';
      const description = event.description ?? '';
      renderedChars += uid.length + summary.length + location.length + description.length;
      if (renderedChars > MAX_CALENDAR_RENDERED_CHARS) {
        throw new LyraResourceLimitError('The calendar contains too much rendered text.');
      }
      return {
        uid,
        summary,
        start: parsedStart?.value ?? null,
        end: end?.value ?? null,
        startKind: parsedStart?.kind ?? null,
        endKind: end?.kind ?? null,
        location,
        description,
      } as ParsedCalendarEvent;
    });
    return events;
  }

  private renderEvent(event: ParsedCalendarEvent): TemplateResult {
    return html`<li part="event"><span part="event-summary">${event.summary || this.localize('calendarViewerNoSummary')}</span><span part="event-time">${formatEventTime(event, this.effectiveLocale)}</span>${event.location ? html`<span part="event-location">${event.location}</span>` : nothing}${event.description ? html`<p part="event-description">${event.description}</p>` : nothing}</li>`;
  }

  private renderBody(): TemplateResult {
    switch (this.fetchState.kind) {
      case 'loaded': return this.fetchState.events.length ? html`<ul part="event-list">${this.fetchState.events.map((event) => this.renderEvent(event))}</ul>` : html`<p class="empty-note">${this.localize('calendarViewerEmpty')}</p>`;
      case 'loading': return renderViewerLoading(this.localize('loadingDocument'));
      case 'error': return html`<div part="error">${this.fetchState.message}</div>`;
      case 'idle': default: return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeCalendar') })}</p>`;
    }
  }

  override render(): TemplateResult {
    const maxHeight = sanitizeCssLength(this.maxHeight);
    return html`<div part="base" role=${viewerSemanticRole(this, 'region') ?? nothing} style=${maxHeight ? styleMap({ '--lr-calendar-viewer-max-height': maxHeight }) : nothing} aria-label=${viewerSemanticLabel(this, this.name || this.localize('calendarViewerLabel')) ?? nothing} aria-busy=${this.fetchState.kind === 'loading' ? 'true' : 'false'}><div part="body">${this.renderBody()}</div>${this.renderAnchorLiveRegion()}</div>`;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-calendar-viewer': LyraCalendarViewer; } }
