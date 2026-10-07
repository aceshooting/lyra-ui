import { html, nothing, type TemplateResult } from 'lit';
import { getOwnDataDescriptor, MISSING_OWN_DATA_DESCRIPTOR, UNSAFE_OWN_DATA_DESCRIPTOR } from '../../internal/data-descriptors.js';
import { formatBoundedRetrievalValue } from './retrieval-value-format.js';

const MAX_METADATA_ENTRIES = 32;
const MAX_METADATA_SCAN = 128;

/** Detect metadata without materializing an unbounded key array. */
export function hasRetrievalMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  try {
    let scanned = 0;
    for (const key in metadata) {
      if (scanned++ >= MAX_METADATA_SCAN) return true;
      if (getOwnDataDescriptor(metadata, key) !== MISSING_OWN_DATA_DESCRIPTOR) return true;
    }
  } catch {
    return true;
  }
  return false;
}

/** One bounded metadata list for retrieval rows and stage evidence. The trace keeps its original
 * `evidence-metadata*` part tokens alongside the shared `metadata*` vocabulary. */
export function renderRetrievalMetadata(
  metadata: Record<string, unknown> | undefined,
  locale: string,
  invalid: string,
  truncated: string,
  traceAliases = false
): TemplateResult | typeof nothing {
  const entries: [string, unknown][] = [];
  let wasTruncated = false;
  if (metadata && typeof metadata === 'object') {
    try {
      let scanned = 0;
      for (const key in metadata) {
        if (scanned++ >= MAX_METADATA_SCAN) {
          wasTruncated = true;
          break;
        }
        const descriptor = getOwnDataDescriptor(metadata, key);
        if (descriptor === MISSING_OWN_DATA_DESCRIPTOR) continue;
        if (entries.length >= MAX_METADATA_ENTRIES) {
          wasTruncated = true;
          break;
        }
        entries.push([key, descriptor === UNSAFE_OWN_DATA_DESCRIPTOR ? invalid : descriptor.value]);
      }
    } catch {
      wasTruncated = true;
    }
  }
  if (entries.length === 0 && !wasTruncated) return nothing;
  const listPart = traceAliases ? 'metadata evidence-metadata' : 'metadata';
  const rowPart = traceAliases ? 'metadata-entry evidence-metadata-row' : 'metadata-entry';
  const termPart = traceAliases ? 'metadata-term evidence-metadata-key' : 'metadata-term';
  const valuePart = traceAliases ? 'metadata-value evidence-metadata-value' : 'metadata-value';
  return html`
    <dl part=${listPart}>
      ${entries.map(([key, value]) => html`
        <div part=${rowPart}>
          <dt part=${termPart}>${key}</dt>
          <dd part=${valuePart}>${formatBoundedRetrievalValue(value, {
            locale,
            invalid,
            truncated,
          })}</dd>
        </div>
      `)}
      ${wasTruncated
        ? html`<div part=${rowPart}><dt part=${termPart}>${truncated}</dt></div>`
        : nothing}
    </dl>
  `;
}
