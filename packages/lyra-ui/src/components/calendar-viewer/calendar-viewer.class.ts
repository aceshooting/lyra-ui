import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { srOnly } from '../../internal/a11y.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { safeFetchUrl } from '../../internal/safe-url.js';
import { isAbortError, isResourceLimitError, LyraUserFacingError, readResponseText } from '../../internal/resource-loader.js';
import { loadIcal } from './calendar-loader.js';
import { styles } from './calendar-viewer.styles.js';

export interface ParsedCalendarEvent { uid: string; summary: string; start: Date | null; end: Date | null; location: string; description: string; }
type CalendarFetchState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'loaded'; events: ParsedCalendarEvent[] } | { kind: 'error'; message: string };
export interface LyraCalendarViewerEventMap { 'lyra-render-error': CustomEvent<{ error: unknown }>; }

function formatEventTime(start: Date | null, end: Date | null, locale: string): string {
  if (!start) return '';
  const formatter = new Intl.DateTimeFormat(locale || undefined, { dateStyle: 'medium', timeStyle: 'short' });
  return end ? `${formatter.format(start)} – ${formatter.format(end)}` : formatter.format(start);
}

/**
 * Parses `.ics` calendars with the optional `ical.js` peer and renders each
 * VEVENT as plain text, preserving summaries, times, locations, and details.
 *
 * @customElement lyra-calendar-viewer
 * @event lyra-render-error - Fired when fetching or parsing the calendar fails.
 * @csspart base - The root container.
 * @csspart body - The scrollable calendar body.
 * @csspart event-list - The event list.
 * @csspart event - One calendar event.
 * @csspart event-summary - The event title.
 * @csspart event-time - The formatted event time.
 * @csspart event-location - The event location.
 * @csspart event-description - The event description.
 * @csspart error - The error region.
 * @csspart spinner - The loading region.
 */
export class LyraCalendarViewer extends LyraElement<LyraCalendarViewerEventMap> {
  static styles = [LyraElement.styles, styles, srOnly];
  /** URL to fetch and parse as an iCalendar document. */
  @property() src = '';
  /** Display name associated with the calendar. */
  @property() name = '';
  /** CSS length that caps the scrollable event body. */
  @property({ attribute: 'max-height' }) maxHeight = '';
  @state() private fetchState: CalendarFetchState = { kind: 'idle' };
  private generation = 0;

  protected updated(changed: PropertyValues): void {
    if (changed.has('src')) this.scheduleAfterUpdate(() => { void this.load(); });
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    const signal = this.beginAbortableLoad();
    if (!this.src) { this.fetchState = { kind: 'idle' }; return; }
    const url = safeFetchUrl(this.src);
    if (!url) { this.fetchState = { kind: 'error', message: this.localize('documentPreviewUrlNotAllowed') }; return; }
    this.fetchState = { kind: 'loading' };
    try {
      const response = await fetch(url, signal ? { signal } : undefined);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const events = await this.parse(await readResponseText(response));
      if (generation === this.generation) this.fetchState = { kind: 'loaded', events };
    } catch (error) {
      if (isAbortError(error) || !this.isConnected || generation !== this.generation) return;
      this.fetchState = { kind: 'error', message: error instanceof LyraUserFacingError ? error.message : this.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad') };
      this.emit('lyra-render-error', { error });
    }
  }

  private async parse(source: string): Promise<ParsedCalendarEvent[]> {
    const ical = await loadIcal();
    if (!ical) throw new LyraUserFacingError(this.localize('calendarViewerMissingParser'));
    const component = new ical.Component(ical.parse(source));
    const events = (component.getAllSubcomponents('vevent') as unknown[]).map((subcomponent) => {
      const event = new ical.Event(subcomponent);
      return {
        uid: event.uid ?? '', summary: event.summary ?? '',
        start: event.startDate ? event.startDate.toJSDate() : null,
        end: event.endDate ? event.endDate.toJSDate() : null,
        location: event.location ?? '', description: event.description ?? '',
      } as ParsedCalendarEvent;
    });
    if (!events.length) throw new LyraUserFacingError(this.localize('calendarViewerEmpty'));
    return events;
  }

  private renderEvent(event: ParsedCalendarEvent): TemplateResult {
    return html`<li part="event"><span part="event-summary">${event.summary || this.localize('calendarViewerNoSummary')}</span><span part="event-time">${formatEventTime(event.start, event.end, this.effectiveLocale)}</span>${event.location ? html`<span part="event-location">${event.location}</span>` : nothing}${event.description ? html`<p part="event-description">${event.description}</p>` : nothing}</li>`;
  }

  private renderBody(): TemplateResult {
    switch (this.fetchState.kind) {
      case 'loaded': return html`<ul part="event-list">${this.fetchState.events.map((event) => this.renderEvent(event))}</ul>`;
      case 'loading': return html`<div part="spinner" role="status"><span class="sr-only">${this.localize('loadingDocument')}</span></div>`;
      case 'error': return html`<div part="error" role="alert">${this.fetchState.message}</div>`;
      case 'idle': default: return html`<p class="empty-note">${this.localize('documentPreviewEmpty', undefined, { type: this.localize('documentPreviewTypeCalendar') })}</p>`;
    }
  }

  render(): TemplateResult { return html`<div part="base" style=${this.maxHeight ? `--lyra-calendar-viewer-max-height:${this.maxHeight}` : nothing}><div part="body">${this.renderBody()}</div></div>`; }
}

declare global { interface HTMLElementTagNameMap { 'lyra-calendar-viewer': LyraCalendarViewer; } }
