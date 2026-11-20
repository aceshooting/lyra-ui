import '../src/components/data/calendar/calendar.class.js';
import '../src/components/data/flow-canvas/flow-canvas.class.js';
import '../src/components/forms/token-input/token-input.class.js';
import '../src/components/media/map/map-anchor.class.js';
import '../src/components/retrieval/entity-dossier/entity-dossier.class.js';
import '../src/components/retrieval/memory-panel/memory-panel.class.js';
import '../src/components/retrieval/provenance-panel/provenance-panel.class.js';
import '../src/components/retrieval/retrieval-trace/retrieval-trace.class.js';

// Resolved Lyra 31 to Lyra 32 fixtures.
document.querySelector('lr-calendar')!.addEventListener('lr-month-change', event => { void event.detail.viewDate; });
document.querySelector('lr-entity-dossier')!.addEventListener('lr-retrieval-disclosure-change', event => { void [event.detail.origin, event.detail.kind]; });
document.querySelector('lr-map-anchor')!.addEventListener('lr-map-anchor-dismiss', event => { void event.detail.reason; });
document.querySelector('lr-map-anchor')!.addEventListener('lr-map-anchor-dismiss-request', event => { void event.preventDefault(); });
document.querySelector('lr-memory-panel')!.addEventListener('lr-retrieval-disclosure-change', event => { void [event.detail.memoryId, event.detail.scope, event.detail.kind]; });
document.querySelector('lr-provenance-panel')!.addEventListener('lr-retrieval-disclosure-change', event => { void [event.detail.kind, event.detail.section]; });
document.querySelector('lr-retrieval-trace')!.addEventListener('lr-retrieval-disclosure-change', event => { void [event.detail.kind, event.detail.stageId]; });
// lyra-migrate-reviewed: DETAIL_SHAPE_REVIEW:lr-edge-activate
document.querySelector('lr-flow-canvas')!.addEventListener('lr-edge-activate', event => { void event.detail.sourceNodeId; });
// lyra-migrate-reviewed: PROPERTY_CHANGE_REVIEW:maxTokensVisible
document.querySelector('lr-token-input')!.maxTokensVisible = 0;
