import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../src/internal/announcer.js';

/** Reads messages in the document-level announcement sink. */
export function sinkTexts(politeness: 'polite' | 'assertive' = 'polite', doc: Document = document): string[] {
  return Array.from(doc.querySelectorAll<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="${politeness}"]`))
    .flatMap((sink) => Array.from(sink.children, (child) => child.textContent ?? ''));
}
