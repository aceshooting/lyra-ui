import '../src/components/agent-tools/agent-eval-dashboard/agent-eval-dashboard.class.js';
import '../src/components/agent-tools/agent-run/agent-run.class.js';
import '../src/components/agent-tools/background-runs/background-runs.class.js';
import '../src/components/agent-tools/change-review/change-review.class.js';
import '../src/components/retrieval/community-card/community-card.class.js';
import '../src/components/layout/dock-panel/dock-panel.class.js';
import '../src/components/layout/navigation-menu/navigation-menu.class.js';
import '../src/components/retrieval/path-strip/path-strip.class.js';
import '../src/components/retrieval/rag-eval-dashboard/rag-eval-dashboard.class.js';
import '../src/components/retrieval/source-picker/source-picker.class.js';
import '../src/components/agent-tools/subagent-panel/subagent-panel.class.js';

// Migrated exact-event fixtures.
document.querySelector('lr-agent-eval-dashboard')!.addEventListener('lr-metric-change-request', event => { void event.detail; });
document.querySelector('lr-change-review')!.addEventListener('lr-change-decision-request', event => { void event.detail; });
document.querySelector('lr-rag-eval-dashboard')!.addEventListener('lr-metric-change-request', event => { void event.detail; });
document.querySelector('lr-rag-eval-dashboard')!.addEventListener('lr-slice-change-request', event => { void event.detail; });

// Reviewed shared-target replacement fixtures.
document.querySelector('lr-agent-run')!.addEventListener('lr-run-cancel', event => { void event.detail; });
document.querySelector('lr-background-runs')!.addEventListener('lr-run-activate', event => { void event.detail; });
document.querySelector('lr-community-card')!.addEventListener('lr-entity-select', event => { void event.detail; });
document.querySelector('lr-dock-panel')!.addEventListener('lr-toggle', event => { void event.detail; });
document.querySelector('lr-dock-panel')!.addEventListener('lr-toggle-request', event => { void event.detail; });
document.querySelector('lr-navigation-menu')!.addEventListener('lr-toggle', event => { void event.detail; });
document.querySelector('lr-path-strip')!.addEventListener('lr-entity-select', event => { void event.detail; });
document.querySelector('lr-source-picker')!.addEventListener('lr-selection-change', event => { void event.detail; });
document.querySelector('lr-subagent-panel')!.addEventListener('lr-run-cancel', event => { void event.detail; });
