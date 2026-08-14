// Generated from scripts/fixtures/component-inventory.json by generate-autoloader-manifest.mjs.
// Literal imports are intentional: they preserve per-component code splitting. Do not edit by hand.

import type { AutoloadableTagName } from './autoloader-tags.js';

export interface AutoloaderManifestEntry {
  readonly optionalPeers: readonly string[];
  readonly load: () => Promise<CustomElementConstructor>;
}

export const AUTOLOADER_MANIFEST: Readonly<Record<AutoloadableTagName, AutoloaderManifestEntry>> = {
  'lr-accordion': {
    optionalPeers: [],
    load: () => import('../components/layout/details/accordion.class.js').then((module) => module.LyraAccordion),
  },
  'lr-accordion-item': {
    optionalPeers: [],
    load: () => import('../components/layout/details/accordion-item.class.js').then((module) => module.LyraAccordionItem),
  },
  'lr-activity-feed': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/activity-feed/activity-feed.class.js').then((module) => module.LyraActivityFeed),
  },
  'lr-agent-eval-dashboard': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/agent-eval-dashboard/agent-eval-dashboard.class.js').then((module) => module.LyraAgentEvalDashboard),
  },
  'lr-agent-run': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/agent-run/agent-run.class.js').then((module) => module.LyraAgentRun),
  },
  'lr-agent-trace': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/agent-trace/agent-trace.class.js').then((module) => module.LyraAgentTrace),
  },
  'lr-agent-workspace': {
    optionalPeers: [],
    load: () => import('../components/conversation/agent-workspace/agent-workspace.class.js').then((module) => module.LyraAgentWorkspace),
  },
  'lr-alert': {
    optionalPeers: [],
    load: () => import('../components/overlays/alert/alert.class.js').then((module) => module.LyraAlert),
  },
  'lr-animated-image': {
    optionalPeers: [],
    load: () => import('../components/media/animated-image/animated-image.class.js').then((module) => module.LyraAnimatedImage),
  },
  'lr-animation': {
    optionalPeers: [],
    load: () => import('../components/media/animation/animation.class.js').then((module) => module.LyraAnimation),
  },
  'lr-app-rail': {
    optionalPeers: [],
    load: () => import('../components/layout/app-rail/app-rail.class.js').then((module) => module.LyraAppRail),
  },
  'lr-app-rail-item': {
    optionalPeers: [],
    load: () => import('../components/layout/app-rail/app-rail-item.class.js').then((module) => module.LyraAppRailItem),
  },
  'lr-approval-queue': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/approval-queue/approval-queue.class.js').then((module) => module.LyraApprovalQueue),
  },
  'lr-archive-viewer': {
    optionalPeers: [],
    load: () => import('../components/viewers/archive-viewer/archive-viewer.class.js').then((module) => module.LyraArchiveViewer),
  },
  'lr-artifact-panel': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/artifact-panel/artifact-panel.class.js').then((module) => module.LyraArtifactPanel),
  },
  'lr-attachment-chip': {
    optionalPeers: [],
    load: () => import('../components/media/attachment-chip/attachment-chip.class.js').then((module) => module.LyraAttachmentChip),
  },
  'lr-attachment-trigger': {
    optionalPeers: [],
    load: () => import('../components/media/attachment-trigger/attachment-trigger.class.js').then((module) => module.LyraAttachmentTrigger),
  },
  'lr-audio-visualizer': {
    optionalPeers: [],
    load: () => import('../components/conversation/audio-visualizer/audio-visualizer.class.js').then((module) => module.LyraAudioVisualizer),
  },
  'lr-av-player': {
    optionalPeers: [],
    load: () => import('../components/media/av-player/av-player.class.js').then((module) => module.LyraAvPlayer),
  },
  'lr-avatar': {
    optionalPeers: [],
    load: () => import('../components/media/avatar/avatar.class.js').then((module) => module.LyraAvatar),
  },
  'lr-avatar-group': {
    optionalPeers: [],
    load: () => import('../components/media/avatar-group/avatar-group.class.js').then((module) => module.LyraAvatarGroup),
  },
  'lr-badge': {
    optionalPeers: [],
    load: () => import('../components/overlays/badge/badge.class.js').then((module) => module.LyraBadge),
  },
  'lr-bar-chart': {
    optionalPeers: ['chart.js', 'chartjs-plugin-datalabels', 'chartjs-plugin-zoom'],
    load: () => import('../components/charts/chart/bar-chart.class.js').then((module) => module.LyraBarChart),
  },
  'lr-box-plot': {
    optionalPeers: ['@sgratzl/chartjs-chart-boxplot', 'chart.js'],
    load: () => import('../components/charts/chart/box-plot.class.js').then((module) => module.LyraBoxPlot),
  },
  'lr-branch-picker': {
    optionalPeers: [],
    load: () => import('../components/conversation/branch-picker/branch-picker.class.js').then((module) => module.LyraBranchPicker),
  },
  'lr-breadcrumb': {
    optionalPeers: [],
    load: () => import('../components/layout/breadcrumb/breadcrumb.class.js').then((module) => module.LyraBreadcrumb),
  },
  'lr-breadcrumb-item': {
    optionalPeers: [],
    load: () => import('../components/layout/breadcrumb/breadcrumb-item.class.js').then((module) => module.LyraBreadcrumbItem),
  },
  'lr-browser-frame': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/browser-frame/browser-frame.class.js').then((module) => module.LyraBrowserFrame),
  },
  'lr-bubble-chart': {
    optionalPeers: ['chart.js', 'chartjs-plugin-datalabels', 'chartjs-plugin-zoom'],
    load: () => import('../components/charts/chart/bubble-chart.class.js').then((module) => module.LyraBubbleChart),
  },
  'lr-button': {
    optionalPeers: [],
    load: () => import('../components/forms/button/button.class.js').then((module) => module.LyraButton),
  },
  'lr-button-group': {
    optionalPeers: [],
    load: () => import('../components/layout/button-group/button-group.class.js').then((module) => module.LyraButtonGroup),
  },
  'lr-calendar': {
    optionalPeers: [],
    load: () => import('../components/data/calendar/calendar.class.js').then((module) => module.LyraCalendar),
  },
  'lr-calendar-viewer': {
    optionalPeers: ['ical.js'],
    load: () => import('../components/viewers/calendar-viewer/calendar-viewer.class.js').then((module) => module.LyraCalendarViewer),
  },
  'lr-callout': {
    optionalPeers: [],
    load: () => import('../components/overlays/callout/callout.class.js').then((module) => module.LyraCallout),
  },
  'lr-card': {
    optionalPeers: [],
    load: () => import('../components/layout/card/card.class.js').then((module) => module.LyraCard),
  },
  'lr-carousel': {
    optionalPeers: [],
    load: () => import('../components/layout/carousel/carousel.class.js').then((module) => module.LyraCarousel),
  },
  'lr-carousel-item': {
    optionalPeers: [],
    load: () => import('../components/layout/carousel/carousel-item.class.js').then((module) => module.LyraCarouselItem),
  },
  'lr-chart': {
    optionalPeers: ['chart.js', 'chartjs-plugin-datalabels', 'chartjs-plugin-zoom'],
    load: () => import('../components/charts/chart/chart.class.js').then((module) => module.LyraChart),
  },
  'lr-chat-composer': {
    optionalPeers: [],
    load: () => import('../components/conversation/chat-composer/chat-composer.class.js').then((module) => module.LyraChatComposer),
  },
  'lr-chat-message': {
    optionalPeers: [],
    load: () => import('../components/conversation/chat-message/chat-message.class.js').then((module) => module.LyraChatMessage),
  },
  'lr-chat-viewport': {
    optionalPeers: [],
    load: () => import('../components/conversation/chat-viewport/chat-viewport.class.js').then((module) => module.LyraChatViewport),
  },
  'lr-checkbox': {
    optionalPeers: [],
    load: () => import('../components/forms/checkbox/checkbox.class.js').then((module) => module.LyraCheckbox),
  },
  'lr-checkbox-group': {
    optionalPeers: [],
    load: () => import('../components/forms/checkbox-group/checkbox-group.class.js').then((module) => module.LyraCheckboxGroup),
  },
  'lr-checkpoint': {
    optionalPeers: [],
    load: () => import('../components/conversation/checkpoint/checkpoint.class.js').then((module) => module.LyraCheckpoint),
  },
  'lr-chip': {
    optionalPeers: [],
    load: () => import('../components/overlays/chip/chip.class.js').then((module) => module.LyraChip),
  },
  'lr-chip-group': {
    optionalPeers: [],
    load: () => import('../components/overlays/chip/chip-group.class.js').then((module) => module.LyraChipGroup),
  },
  'lr-chunk-inspector': {
    optionalPeers: [],
    load: () => import('../components/retrieval/chunk-inspector/chunk-inspector.class.js').then((module) => module.LyraChunkInspector),
  },
  'lr-citation-badge': {
    optionalPeers: [],
    load: () => import('../components/retrieval/citation-badge/citation-badge.class.js').then((module) => module.LyraCitationBadge),
  },
  'lr-claim-evidence': {
    optionalPeers: [],
    load: () => import('../components/retrieval/claim-evidence/claim-evidence.class.js').then((module) => module.LyraClaimEvidence),
  },
  'lr-code-block': {
    optionalPeers: ['shiki'],
    load: () => import('../components/conversation/code-block/code-block.class.js').then((module) => module.LyraCodeBlock),
  },
  'lr-code-block-core': {
    optionalPeers: ['shiki'],
    load: () => import('../components/conversation/code-block/code-block-core.class.js').then((module) => module.LyraCodeBlockCore),
  },
  'lr-code-editor': {
    optionalPeers: [],
    load: () => import('../components/forms/code-editor/code-editor.class.js').then((module) => module.LyraCodeEditor),
  },
  'lr-color-picker': {
    optionalPeers: [],
    load: () => import('../components/forms/color-picker/color-picker.class.js').then((module) => module.LyraColorPicker),
  },
  'lr-combobox': {
    optionalPeers: [],
    load: () => import('../components/forms/combobox/combobox.class.js').then((module) => module.LyraCombobox),
  },
  'lr-command-palette': {
    optionalPeers: [],
    load: () => import('../components/layout/command-palette/command-palette.class.js').then((module) => module.LyraCommandPalette),
  },
  'lr-commit-card': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/commit-card/commit-card.class.js').then((module) => module.LyraCommitCard),
  },
  'lr-community-card': {
    optionalPeers: [],
    load: () => import('../components/retrieval/community-card/community-card.class.js').then((module) => module.LyraCommunityCard),
  },
  'lr-compare-panel': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/compare-panel/compare-panel.class.js').then((module) => module.LyraComparePanel),
  },
  'lr-confirm-bar': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/confirm-bar/confirm-bar.class.js').then((module) => module.LyraConfirmBar),
  },
  'lr-contact-viewer': {
    optionalPeers: [],
    load: () => import('../components/viewers/contact-viewer/contact-viewer.class.js').then((module) => module.LyraContactViewer),
  },
  'lr-context-inspector': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/context-inspector/context-inspector.class.js').then((module) => module.LyraContextInspector),
  },
  'lr-context-meter': {
    optionalPeers: [],
    load: () => import('../components/data/context-meter/context-meter.class.js').then((module) => module.LyraContextMeter),
  },
  'lr-control-group': {
    optionalPeers: [],
    load: () => import('../components/layout/control-group/control-group.class.js').then((module) => module.LyraControlGroup),
  },
  'lr-conversation-item': {
    optionalPeers: [],
    load: () => import('../components/conversation/conversation-item/conversation-item.class.js').then((module) => module.LyraConversationItem),
  },
  'lr-copy-button': {
    optionalPeers: [],
    load: () => import('../components/utility/copy-button/copy-button.class.js').then((module) => module.LyraCopyButton),
  },
  'lr-csv-viewer': {
    optionalPeers: ['papaparse'],
    load: () => import('../components/viewers/csv-viewer/csv-viewer.class.js').then((module) => module.LyraCsvViewer),
  },
  'lr-dashboard-grid': {
    optionalPeers: [],
    load: () => import('../components/layout/dashboard-grid/dashboard-grid.class.js').then((module) => module.LyraDashboardGrid),
  },
  'lr-data-grid': {
    optionalPeers: [],
    load: () => import('../components/data/data-grid/data-grid.class.js').then((module) => module.LyraDataGrid),
  },
  'lr-dataset-viewer': {
    optionalPeers: ['papaparse'],
    load: () => import('../components/viewers/dataset-viewer/dataset-viewer.class.js').then((module) => module.LyraDatasetViewer),
  },
  'lr-date-input': {
    optionalPeers: [],
    load: () => import('../components/forms/date-picker/date-input.class.js').then((module) => module.LyraDateInput),
  },
  'lr-date-picker': {
    optionalPeers: [],
    load: () => import('../components/forms/date-picker/date-picker.class.js').then((module) => module.LyraDatePicker),
  },
  'lr-details': {
    optionalPeers: [],
    load: () => import('../components/layout/details/details.class.js').then((module) => module.LyraDetails),
  },
  'lr-dialog': {
    optionalPeers: [],
    load: () => import('../components/overlays/dialog/dialog.class.js').then((module) => module.LyraDialog),
  },
  'lr-diff-view': {
    optionalPeers: ['shiki'],
    load: () => import('../components/utility/diff-view/diff-view.class.js').then((module) => module.LyraDiffView),
  },
  'lr-divider': {
    optionalPeers: [],
    load: () => import('../components/utility/divider/divider.class.js').then((module) => module.LyraDivider),
  },
  'lr-dock-panel': {
    optionalPeers: [],
    load: () => import('../components/layout/dock-panel/dock-panel.class.js').then((module) => module.LyraDockPanel),
  },
  'lr-document-compare': {
    optionalPeers: ['shiki'],
    load: () => import('../components/viewers/document-compare/document-compare.class.js').then((module) => module.LyraDocumentCompare),
  },
  'lr-document-library': {
    optionalPeers: [],
    load: () => import('../components/data/document-library/document-library.class.js').then((module) => module.LyraDocumentLibrary),
  },
  'lr-document-preview': {
    optionalPeers: [],
    load: () => import('../components/viewers/document-preview/document-preview.class.js').then((module) => module.LyraDocumentPreview),
  },
  'lr-document-viewer': {
    optionalPeers: [],
    load: () => import('../components/viewers/document-viewer/document-viewer.class.js').then((module) => module.LyraDocumentViewer),
  },
  'lr-docx-viewer': {
    optionalPeers: ['dompurify', 'mammoth'],
    load: () => import('../components/viewers/docx-viewer/docx-viewer.class.js').then((module) => module.LyraDocxViewer),
  },
  'lr-doughnut-chart': {
    optionalPeers: ['chart.js', 'chartjs-plugin-datalabels', 'chartjs-plugin-zoom'],
    load: () => import('../components/charts/chart/doughnut-chart.class.js').then((module) => module.LyraDoughnutChart),
  },
  'lr-drawer': {
    optionalPeers: [],
    load: () => import('../components/overlays/drawer/drawer.class.js').then((module) => module.LyraDrawer),
  },
  'lr-drilldown-panel': {
    optionalPeers: [],
    load: () => import('../components/layout/drilldown-panel/drilldown-panel.class.js').then((module) => module.LyraDrilldownPanel),
  },
  'lr-dropdown': {
    optionalPeers: [],
    load: () => import('../components/overlays/overlay/dropdown.class.js').then((module) => module.LyraDropdown),
  },
  'lr-dropdown-item': {
    optionalPeers: [],
    load: () => import('../components/layout/menu/dropdown-item.class.js').then((module) => module.LyraDropdownItem),
  },
  'lr-ebook-viewer': {
    optionalPeers: ['epubjs'],
    load: () => import('../components/viewers/ebook-viewer/ebook-viewer.class.js').then((module) => module.LyraEbookViewer),
  },
  'lr-email-viewer': {
    optionalPeers: ['dompurify', 'postal-mime'],
    load: () => import('../components/viewers/email-viewer/email-viewer.class.js').then((module) => module.LyraEmailViewer),
  },
  'lr-embedding-explorer': {
    optionalPeers: [],
    load: () => import('../components/retrieval/embedding-explorer/embedding-explorer.class.js').then((module) => module.LyraEmbeddingExplorer),
  },
  'lr-emoji-picker': {
    optionalPeers: ['emoji-picker-element-data'],
    load: () => import('../components/forms/emoji-picker/emoji-picker.class.js').then((module) => module.LyraEmojiPicker),
  },
  'lr-empty': {
    optionalPeers: [],
    load: () => import('../components/overlays/empty/empty.class.js').then((module) => module.LyraEmpty),
  },
  'lr-entity-card': {
    optionalPeers: [],
    load: () => import('../components/retrieval/entity-card/entity-card.class.js').then((module) => module.LyraEntityCard),
  },
  'lr-entity-chip': {
    optionalPeers: [],
    load: () => import('../components/retrieval/entity-chip/entity-chip.class.js').then((module) => module.LyraEntityChip),
  },
  'lr-entity-dossier': {
    optionalPeers: [],
    load: () => import('../components/retrieval/entity-dossier/entity-dossier.class.js').then((module) => module.LyraEntityDossier),
  },
  'lr-env-list': {
    optionalPeers: [],
    load: () => import('../components/data/env-list/env-list.class.js').then((module) => module.LyraEnvList),
  },
  'lr-eval-dataset': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/eval-dataset/eval-dataset.class.js').then((module) => module.LyraEvalDataset),
  },
  'lr-eval-result': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/eval-result/eval-result.class.js').then((module) => module.LyraEvalResult),
  },
  'lr-evaluation-run': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/evaluation-run/evaluation-run.class.js').then((module) => module.LyraEvaluationRun),
  },
  'lr-export-button': {
    optionalPeers: [],
    load: () => import('../components/utility/export-button/export-button.class.js').then((module) => module.LyraExportButton),
  },
  'lr-file-icon': {
    optionalPeers: [],
    load: () => import('../components/media/file-icon/file-icon.class.js').then((module) => module.LyraFileIcon),
  },
  'lr-file-input': {
    optionalPeers: [],
    load: () => import('../components/media/file-input/file-input.class.js').then((module) => module.LyraFileInput),
  },
  'lr-file-tree': {
    optionalPeers: [],
    load: () => import('../components/data/file-tree/file-tree.class.js').then((module) => module.LyraFileTree),
  },
  'lr-filter-bar': {
    optionalPeers: [],
    load: () => import('../components/layout/filter-bar/filter-bar.class.js').then((module) => module.LyraFilterBar),
  },
  'lr-flag': {
    optionalPeers: ['@aceshooting/lyra-flags'],
    load: () => import('../components/media/flag/flag.class.js').then((module) => module.LyraFlag),
  },
  'lr-flow-canvas': {
    optionalPeers: [],
    load: () => import('../components/data/flow-canvas/flow-canvas.class.js').then((module) => module.LyraFlowCanvas),
  },
  'lr-flow-controls': {
    optionalPeers: [],
    load: () => import('../components/data/flow-controls/flow-controls.class.js').then((module) => module.LyraFlowControls),
  },
  'lr-flow-minimap': {
    optionalPeers: [],
    load: () => import('../components/data/flow-minimap/flow-minimap.class.js').then((module) => module.LyraFlowMinimap),
  },
  'lr-flow-node': {
    optionalPeers: [],
    load: () => import('../components/data/flow-node/flow-node.class.js').then((module) => module.LyraFlowNode),
  },
  'lr-flow-run-status': {
    optionalPeers: [],
    load: () => import('../components/data/flow-run-status/flow-run-status.class.js').then((module) => module.LyraFlowRunStatus),
  },
  'lr-format-bytes': {
    optionalPeers: [],
    load: () => import('../components/utility/format/format-bytes.class.js').then((module) => module.LyraFormatBytes),
  },
  'lr-format-date': {
    optionalPeers: [],
    load: () => import('../components/utility/format/format-date.class.js').then((module) => module.LyraFormatDate),
  },
  'lr-format-number': {
    optionalPeers: [],
    load: () => import('../components/utility/format/format-number.class.js').then((module) => module.LyraFormatNumber),
  },
  'lr-gauge': {
    optionalPeers: [],
    load: () => import('../components/data/gauge/gauge.class.js').then((module) => module.LyraGauge),
  },
  'lr-generation-metrics': {
    optionalPeers: [],
    load: () => import('../components/conversation/generation-metrics/generation-metrics.class.js').then((module) => module.LyraGenerationMetrics),
  },
  'lr-geojson-view': {
    optionalPeers: ['maplibre-gl'],
    load: () => import('../components/viewers/geojson-view/geojson-view.class.js').then((module) => module.LyraGeojsonView),
  },
  'lr-graph': {
    optionalPeers: ['d3-drag', 'd3-force', 'd3-selection', 'd3-zoom'],
    load: () => import('../components/retrieval/graph/graph.class.js').then((module) => module.LyraGraph),
  },
  'lr-graph-legend': {
    optionalPeers: [],
    load: () => import('../components/retrieval/graph-legend/graph-legend.class.js').then((module) => module.LyraGraphLegend),
  },
  'lr-graph-query-builder': {
    optionalPeers: [],
    load: () => import('../components/data/graph-query-builder/graph-query-builder.class.js').then((module) => module.LyraGraphQueryBuilder),
  },
  'lr-grounding-summary': {
    optionalPeers: [],
    load: () => import('../components/retrieval/grounding-summary/grounding-summary.class.js').then((module) => module.LyraGroundingSummary),
  },
  'lr-handoff-divider': {
    optionalPeers: [],
    load: () => import('../components/conversation/handoff-divider/handoff-divider.class.js').then((module) => module.LyraHandoffDivider),
  },
  'lr-heatmap': {
    optionalPeers: [],
    load: () => import('../components/data/heatmap/heatmap.class.js').then((module) => module.LyraHeatmap),
  },
  'lr-highlight-layer': {
    optionalPeers: [],
    load: () => import('../components/viewers/highlight-layer/highlight-layer.class.js').then((module) => module.LyraHighlightLayer),
  },
  'lr-histogram': {
    optionalPeers: ['chart.js', 'chartjs-plugin-datalabels', 'chartjs-plugin-zoom'],
    load: () => import('../components/charts/chart/histogram.class.js').then((module) => module.LyraHistogram),
  },
  'lr-html-viewer': {
    optionalPeers: ['dompurify'],
    load: () => import('../components/viewers/html-viewer/html-viewer.class.js').then((module) => module.LyraHtmlViewer),
  },
  'lr-icon': {
    optionalPeers: ['dompurify'],
    load: () => import('../components/utility/icon/icon.class.js').then((module) => module.LyraIcon),
  },
  'lr-icon-button': {
    optionalPeers: [],
    load: () => import('../components/forms/icon-button/icon-button.class.js').then((module) => module.LyraIconButton),
  },
  'lr-image-comparer': {
    optionalPeers: [],
    load: () => import('../components/media/image-comparer/image-comparer.class.js').then((module) => module.LyraImageComparer),
  },
  'lr-image-viewer': {
    optionalPeers: [],
    load: () => import('../components/media/image-viewer/image-viewer.class.js').then((module) => module.LyraImageViewer),
  },
  'lr-include': {
    optionalPeers: ['dompurify'],
    load: () => import('../components/viewers/include/include.class.js').then((module) => module.LyraInclude),
  },
  'lr-ingestion-queue': {
    optionalPeers: [],
    load: () => import('../components/retrieval/ingestion-queue/ingestion-queue.class.js').then((module) => module.LyraIngestionQueue),
  },
  'lr-input': {
    optionalPeers: [],
    load: () => import('../components/forms/input/input.class.js').then((module) => module.LyraInput),
  },
  'lr-intersection-observer': {
    optionalPeers: [],
    load: () => import('../components/utility/intersection-observer/intersection-observer.class.js').then((module) => module.LyraIntersectionObserver),
  },
  'lr-json-viewer': {
    optionalPeers: [],
    load: () => import('../components/utility/json-viewer/json-viewer.class.js').then((module) => module.LyraJsonViewer),
  },
  'lr-kbd': {
    optionalPeers: [],
    load: () => import('../components/overlays/kbd/kbd.class.js').then((module) => module.LyraKbd),
  },
  'lr-knowledge-base': {
    optionalPeers: [],
    load: () => import('../components/retrieval/knowledge-base/knowledge-base.class.js').then((module) => module.LyraKnowledgeBase),
  },
  'lr-knowledge-base-admin': {
    optionalPeers: [],
    load: () => import('../components/retrieval/knowledge-base-admin/knowledge-base-admin.class.js').then((module) => module.LyraKnowledgeBaseAdmin),
  },
  'lr-knowledge-graph-explorer': {
    optionalPeers: ['d3-drag', 'd3-force', 'd3-selection', 'd3-zoom'],
    load: () => import('../components/retrieval/knowledge-graph-explorer/knowledge-graph-explorer.class.js').then((module) => module.LyraKnowledgeGraphExplorer),
  },
  'lr-known-date': {
    optionalPeers: [],
    load: () => import('../components/utility/known-date/known-date.class.js').then((module) => module.LyraKnownDate),
  },
  'lr-lightbox': {
    optionalPeers: [],
    load: () => import('../components/media/lightbox/lightbox.class.js').then((module) => module.LyraLightbox),
  },
  'lr-line-chart': {
    optionalPeers: ['chart.js', 'chartjs-plugin-datalabels', 'chartjs-plugin-zoom'],
    load: () => import('../components/charts/chart/line-chart.class.js').then((module) => module.LyraLineChart),
  },
  'lr-lite-chart': {
    optionalPeers: [],
    load: () => import('../components/charts/chart/lite-chart.class.js').then((module) => module.LyraLiteChart),
  },
  'lr-live-region': {
    optionalPeers: [],
    load: () => import('../components/utility/live-region/live-region.class.js').then((module) => module.LyraLiveRegion),
  },
  'lr-locale-picker': {
    optionalPeers: [],
    load: () => import('../components/forms/locale-picker/locale-picker.class.js').then((module) => module.LyraLocalePicker),
  },
  'lr-map': {
    optionalPeers: ['maplibre-gl'],
    load: () => import('../components/media/map/map.class.js').then((module) => module.LyraMap),
  },
  'lr-markdown': {
    optionalPeers: ['dompurify', 'katex', 'marked', 'shiki'],
    load: () => import('../components/conversation/markdown/markdown.class.js').then((module) => module.LyraMarkdown),
  },
  'lr-markdown-core': {
    optionalPeers: ['dompurify', 'katex', 'marked', 'shiki'],
    load: () => import('../components/conversation/markdown/markdown-core.class.js').then((module) => module.LyraMarkdownCore),
  },
  'lr-mcp-app': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/mcp-app/mcp-app.class.js').then((module) => module.LyraMcpApp),
  },
  'lr-media-card': {
    optionalPeers: [],
    load: () => import('../components/media/media-card/media-card.class.js').then((module) => module.LyraMediaCard),
  },
  'lr-memory-panel': {
    optionalPeers: [],
    load: () => import('../components/retrieval/memory-panel/memory-panel.class.js').then((module) => module.LyraMemoryPanel),
  },
  'lr-mention-popover': {
    optionalPeers: [],
    load: () => import('../components/utility/mention-popover/mention-popover.class.js').then((module) => module.LyraMentionPopover),
  },
  'lr-menu': {
    optionalPeers: [],
    load: () => import('../components/layout/menu/menu.class.js').then((module) => module.LyraMenu),
  },
  'lr-menu-item': {
    optionalPeers: [],
    load: () => import('../components/layout/menu/menu-item.class.js').then((module) => module.LyraMenuItem),
  },
  'lr-menu-label': {
    optionalPeers: [],
    load: () => import('../components/layout/menu/menu-label.class.js').then((module) => module.LyraMenuLabel),
  },
  'lr-message-actions': {
    optionalPeers: [],
    load: () => import('../components/conversation/message-actions/message-actions.class.js').then((module) => module.LyraMessageActions),
  },
  'lr-message-feedback': {
    optionalPeers: [],
    load: () => import('../components/conversation/message-feedback/message-feedback.class.js').then((module) => module.LyraMessageFeedback),
  },
  'lr-message-parts': {
    optionalPeers: ['dompurify', 'katex', 'marked', 'shiki'],
    load: () => import('../components/conversation/message-parts/message-parts.class.js').then((module) => module.LyraMessageParts),
  },
  'lr-mind-map': {
    optionalPeers: [],
    load: () => import('../components/retrieval/mind-map/mind-map.class.js').then((module) => module.LyraMindMap),
  },
  'lr-model-select': {
    optionalPeers: [],
    load: () => import('../components/conversation/model-select/model-select.class.js').then((module) => module.LyraModelSelect),
  },
  'lr-model-settings-panel': {
    optionalPeers: [],
    load: () => import('../components/conversation/model-settings-panel/model-settings-panel.class.js').then((module) => module.LyraModelSettingsPanel),
  },
  'lr-mutation-observer': {
    optionalPeers: [],
    load: () => import('../components/utility/mutation-observer/mutation-observer.class.js').then((module) => module.LyraMutationObserver),
  },
  'lr-native-time-input': {
    optionalPeers: [],
    load: () => import('../components/forms/input/native-time-input.class.js').then((module) => module.LyraNativeTimeInput),
  },
  'lr-neighbor-list': {
    optionalPeers: [],
    load: () => import('../components/retrieval/neighbor-list/neighbor-list.class.js').then((module) => module.LyraNeighborList),
  },
  'lr-node-palette': {
    optionalPeers: [],
    load: () => import('../components/retrieval/node-palette/node-palette.class.js').then((module) => module.LyraNodePalette),
  },
  'lr-notebook-viewer': {
    optionalPeers: ['dompurify'],
    load: () => import('../components/viewers/notebook-viewer/notebook-viewer.class.js').then((module) => module.LyraNotebookViewer),
  },
  'lr-number-input': {
    optionalPeers: [],
    load: () => import('../components/forms/input/number-input.class.js').then((module) => module.LyraNumberInput),
  },
  'lr-option': {
    optionalPeers: [],
    load: () => import('../components/forms/combobox/option.class.js').then((module) => module.LyraOption),
  },
  'lr-otp-input': {
    optionalPeers: [],
    load: () => import('../components/forms/otp-input/otp-input.class.js').then((module) => module.LyraOtpInput),
  },
  'lr-page': {
    optionalPeers: [],
    load: () => import('../components/layout/page/page.class.js').then((module) => module.LyraPage),
  },
  'lr-page-rail': {
    optionalPeers: [],
    load: () => import('../components/viewers/page-rail/page-rail.class.js').then((module) => module.LyraPageRail),
  },
  'lr-pagination': {
    optionalPeers: [],
    load: () => import('../components/data/pagination/pagination.class.js').then((module) => module.LyraPagination),
  },
  'lr-pan-zoom': {
    optionalPeers: [],
    load: () => import('../components/media/pan-zoom/pan-zoom.class.js').then((module) => module.LyraPanZoom),
  },
  'lr-path-strip': {
    optionalPeers: [],
    load: () => import('../components/retrieval/path-strip/path-strip.class.js').then((module) => module.LyraPathStrip),
  },
  'lr-pdf-viewer': {
    optionalPeers: ['pdfjs-dist'],
    load: () => import('../components/viewers/pdf-viewer/pdf-viewer.class.js').then((module) => module.LyraPdfViewer),
  },
  'lr-phone-input': {
    optionalPeers: ['@aceshooting/lyra-flags', 'libphonenumber-js'],
    load: () => import('../components/forms/phone-input/phone-input.class.js').then((module) => module.LyraPhoneInput),
  },
  'lr-pie-chart': {
    optionalPeers: ['chart.js', 'chartjs-plugin-datalabels', 'chartjs-plugin-zoom'],
    load: () => import('../components/charts/chart/pie-chart.class.js').then((module) => module.LyraPieChart),
  },
  'lr-sequence-playback': {
    optionalPeers: [],
    load: () => import('../components/media/sequence-playback/sequence-playback.class.js').then((module) => module.LyraSequencePlayback),
  },
  'lr-polar-area-chart': {
    optionalPeers: ['chart.js', 'chartjs-plugin-datalabels', 'chartjs-plugin-zoom'],
    load: () => import('../components/charts/chart/polar-area-chart.class.js').then((module) => module.LyraPolarAreaChart),
  },
  'lr-policy-summary': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/policy-summary/policy-summary.class.js').then((module) => module.LyraPolicySummary),
  },
  'lr-poll-status': {
    optionalPeers: [],
    load: () => import('../components/utility/poll-status/poll-status.class.js').then((module) => module.LyraPollStatus),
  },
  'lr-popover': {
    optionalPeers: [],
    load: () => import('../components/overlays/overlay/popover.class.js').then((module) => module.LyraPopover),
  },
  'lr-popup': {
    optionalPeers: [],
    load: () => import('../components/overlays/popup/popup.class.js').then((module) => module.LyraPopup),
  },
  'lr-pptx-viewer': {
    optionalPeers: ['@aiden0z/pptx-renderer'],
    load: () => import('../components/viewers/pptx-viewer/pptx-viewer.class.js').then((module) => module.LyraPptxViewer),
  },
  'lr-progress-bar': {
    optionalPeers: [],
    load: () => import('../components/overlays/progress/progress-bar.class.js').then((module) => module.LyraProgressBar),
  },
  'lr-progress-ring': {
    optionalPeers: [],
    load: () => import('../components/overlays/progress/progress-ring.class.js').then((module) => module.LyraProgressRing),
  },
  'lr-prompt-input': {
    optionalPeers: [],
    load: () => import('../components/conversation/prompt-input/prompt-input.class.js').then((module) => module.LyraPromptInput),
  },
  'lr-prompt-queue': {
    optionalPeers: [],
    load: () => import('../components/conversation/prompt-queue/prompt-queue.class.js').then((module) => module.LyraPromptQueue),
  },
  'lr-prompt-studio': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/prompt-studio/prompt-studio.class.js').then((module) => module.LyraPromptStudio),
  },
  'lr-provenance-panel': {
    optionalPeers: [],
    load: () => import('../components/retrieval/provenance-panel/provenance-panel.class.js').then((module) => module.LyraProvenancePanel),
  },
  'lr-push-to-talk': {
    optionalPeers: [],
    load: () => import('../components/conversation/push-to-talk/push-to-talk.class.js').then((module) => module.LyraPushToTalk),
  },
  'lr-qr-code': {
    optionalPeers: ['qrcode'],
    load: () => import('../components/media/qr-code/qr-code.class.js').then((module) => module.LyraQrCode),
  },
  'lr-condition-builder': {
    optionalPeers: [],
    load: () => import('../components/data/condition-builder/condition-builder.class.js').then((module) => module.LyraConditionBuilder),
  },
  'lr-radar-chart': {
    optionalPeers: ['chart.js', 'chartjs-plugin-datalabels', 'chartjs-plugin-zoom'],
    load: () => import('../components/charts/chart/radar-chart.class.js').then((module) => module.LyraRadarChart),
  },
  'lr-radio': {
    optionalPeers: [],
    load: () => import('../components/forms/radio/radio.class.js').then((module) => module.LyraRadio),
  },
  'lr-radio-button': {
    optionalPeers: [],
    load: () => import('../components/forms/radio/radio-button.class.js').then((module) => module.LyraRadioButton),
  },
  'lr-radio-group': {
    optionalPeers: [],
    load: () => import('../components/forms/radio/radio-group.class.js').then((module) => module.LyraRadioGroup),
  },
  'lr-rag-answer': {
    optionalPeers: [],
    load: () => import('../components/retrieval/rag-answer/rag-answer.class.js').then((module) => module.LyraRagAnswer),
  },
  'lr-rag-eval-dashboard': {
    optionalPeers: [],
    load: () => import('../components/retrieval/rag-eval-dashboard/rag-eval-dashboard.class.js').then((module) => module.LyraRagEvalDashboard),
  },
  'lr-random-content': {
    optionalPeers: [],
    load: () => import('../components/utility/random-content/random-content.class.js').then((module) => module.LyraRandomContent),
  },
  'lr-rating': {
    optionalPeers: [],
    load: () => import('../components/overlays/rating/rating.class.js').then((module) => module.LyraRating),
  },
  'lr-realtime-session': {
    optionalPeers: [],
    load: () => import('../components/conversation/realtime-session/realtime-session.class.js').then((module) => module.LyraRealtimeSession),
  },
  'lr-relative-time': {
    optionalPeers: [],
    load: () => import('../components/utility/format/relative-time.class.js').then((module) => module.LyraRelativeTime),
  },
  'lr-reorder-item': {
    optionalPeers: [],
    load: () => import('../components/layout/reorder-list/reorder-item.class.js').then((module) => module.LyraReorderItem),
  },
  'lr-reorder-list': {
    optionalPeers: [],
    load: () => import('../components/layout/reorder-list/reorder-list.class.js').then((module) => module.LyraReorderList),
  },
  'lr-resize-observer': {
    optionalPeers: [],
    load: () => import('../components/utility/resize-observer/resize-observer.class.js').then((module) => module.LyraResizeObserver),
  },
  'lr-responsive-panel': {
    optionalPeers: [],
    load: () => import('../components/layout/responsive-panel/responsive-panel.class.js').then((module) => module.LyraResponsivePanel),
  },
  'lr-result-card': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/result-card/result-card.class.js').then((module) => module.LyraResultCard),
  },
  'lr-result-field': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/result-card/result-field.class.js').then((module) => module.LyraResultField),
  },
  'lr-retrieval-compare': {
    optionalPeers: [],
    load: () => import('../components/retrieval/retrieval-compare/retrieval-compare.class.js').then((module) => module.LyraRetrievalCompare),
  },
  'lr-retrieval-results': {
    optionalPeers: [],
    load: () => import('../components/retrieval/retrieval-results/retrieval-results.class.js').then((module) => module.LyraRetrievalResults),
  },
  'lr-retrieval-search': {
    optionalPeers: [],
    load: () => import('../components/retrieval/retrieval-search/retrieval-search.class.js').then((module) => module.LyraRetrievalSearch),
  },
  'lr-retrieval-trace': {
    optionalPeers: [],
    load: () => import('../components/retrieval/retrieval-trace/retrieval-trace.class.js').then((module) => module.LyraRetrievalTrace),
  },
  'lr-rubric-form': {
    optionalPeers: [],
    load: () => import('../components/forms/rubric-form/rubric-form.class.js').then((module) => module.LyraRubricForm),
  },
  'lr-scatter-chart': {
    optionalPeers: ['chart.js', 'chartjs-plugin-datalabels', 'chartjs-plugin-zoom'],
    load: () => import('../components/charts/chart/scatter-chart.class.js').then((module) => module.LyraScatterChart),
  },
  'lr-schema-viewer': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/schema-viewer/schema-viewer.class.js').then((module) => module.LyraSchemaViewer),
  },
  'lr-scroller': {
    optionalPeers: [],
    load: () => import('../components/layout/scroller/scroller.class.js').then((module) => module.LyraScroller),
  },
  'lr-segmented': {
    optionalPeers: [],
    load: () => import('../components/layout/segmented/segmented.class.js').then((module) => module.LyraSegmented),
  },
  'lr-select': {
    optionalPeers: [],
    load: () => import('../components/forms/select/select.class.js').then((module) => module.LyraSelect),
  },
  'lr-selection-toolbar': {
    optionalPeers: [],
    load: () => import('../components/conversation/selection-toolbar/selection-toolbar.class.js').then((module) => module.LyraSelectionToolbar),
  },
  'lr-sequence-strip': {
    optionalPeers: [],
    load: () => import('../components/data/sequence-strip/sequence-strip.class.js').then((module) => module.LyraSequenceStrip),
  },
  'lr-skeleton': {
    optionalPeers: [],
    load: () => import('../components/overlays/skeleton/skeleton.class.js').then((module) => module.LyraSkeleton),
  },
  'lr-slider': {
    optionalPeers: [],
    load: () => import('../components/forms/slider/slider.class.js').then((module) => module.LyraSlider),
  },
  'lr-source-card': {
    optionalPeers: [],
    load: () => import('../components/retrieval/source-card/source-card.class.js').then((module) => module.LyraSourceCard),
  },
  'lr-source-list': {
    optionalPeers: [],
    load: () => import('../components/retrieval/source-list/source-list.class.js').then((module) => module.LyraSourceList),
  },
  'lr-source-picker': {
    optionalPeers: [],
    load: () => import('../components/retrieval/source-picker/source-picker.class.js').then((module) => module.LyraSourcePicker),
  },
  'lr-span-waterfall': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/span-waterfall/span-waterfall.class.js').then((module) => module.LyraSpanWaterfall),
  },
  'lr-sparkline': {
    optionalPeers: [],
    load: () => import('../components/data/sparkline/sparkline.class.js').then((module) => module.LyraSparkline),
  },
  'lr-spinner': {
    optionalPeers: [],
    load: () => import('../components/overlays/spinner/spinner.class.js').then((module) => module.LyraSpinner),
  },
  'lr-split': {
    optionalPeers: [],
    load: () => import('../components/layout/split/split.class.js').then((module) => module.LyraSplit),
  },
  'lr-split-panel': {
    optionalPeers: [],
    load: () => import('../components/layout/split-panel/split-panel.class.js').then((module) => module.LyraSplitPanel),
  },
  'lr-spreadsheet-viewer': {
    optionalPeers: ['xlsx'],
    load: () => import('../components/viewers/spreadsheet-viewer/spreadsheet-viewer.class.js').then((module) => module.LyraSpreadsheetViewer),
  },
  'lr-stack-trace': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/stack-trace/stack-trace.class.js').then((module) => module.LyraStackTrace),
  },
  'lr-stat': {
    optionalPeers: [],
    load: () => import('../components/data/stat/stat.class.js').then((module) => module.LyraStat),
  },
  'lr-stepper': {
    optionalPeers: [],
    load: () => import('../components/layout/stepper/stepper.class.js').then((module) => module.LyraStepper),
  },
  'lr-stream-status': {
    optionalPeers: [],
    load: () => import('../components/conversation/stream-status/stream-status.class.js').then((module) => module.LyraStreamStatus),
  },
  'lr-streaming-text': {
    optionalPeers: [],
    load: () => import('../components/conversation/streaming-text/streaming-text.class.js').then((module) => module.LyraStreamingText),
  },
  'lr-subagent-panel': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/subagent-panel/subagent-panel.class.js').then((module) => module.LyraSubagentPanel),
  },
  'lr-suggestion-chips': {
    optionalPeers: [],
    load: () => import('../components/conversation/suggestion-chips/suggestion-chips.class.js').then((module) => module.LyraSuggestionChips),
  },
  'lr-svg-viewer': {
    optionalPeers: ['dompurify'],
    load: () => import('../components/viewers/svg-viewer/svg-viewer.class.js').then((module) => module.LyraSvgViewer),
  },
  'lr-swatch-picker': {
    optionalPeers: [],
    load: () => import('../components/forms/swatch-picker/swatch-picker.class.js').then((module) => module.LyraSwatchPicker),
  },
  'lr-switch': {
    optionalPeers: [],
    load: () => import('../components/forms/switch/switch.class.js').then((module) => module.LyraSwitch),
  },
  'lr-tab': {
    optionalPeers: [],
    load: () => import('../components/layout/tab-group/tab.class.js').then((module) => module.LyraTab),
  },
  'lr-tab-group': {
    optionalPeers: [],
    load: () => import('../components/layout/tab-group/tab-group.class.js').then((module) => module.LyraTabGroup),
  },
  'lr-tab-panel': {
    optionalPeers: [],
    load: () => import('../components/layout/tab-group/tab-panel.class.js').then((module) => module.LyraTabPanel),
  },
  'lr-table': {
    optionalPeers: [],
    load: () => import('../components/data/table/table.class.js').then((module) => module.LyraTable),
  },
  'lr-tag': {
    optionalPeers: [],
    load: () => import('../components/overlays/badge/tag.class.js').then((module) => module.LyraTag),
  },
  'lr-task-list': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/task-list/task-list.class.js').then((module) => module.LyraTaskList),
  },
  'lr-terminal': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/terminal/terminal.class.js').then((module) => module.LyraTerminal),
  },
  'lr-test-results': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/test-results/test-results.class.js').then((module) => module.LyraTestResults),
  },
  'lr-textarea': {
    optionalPeers: [],
    load: () => import('../components/forms/textarea/textarea.class.js').then((module) => module.LyraTextarea),
  },
  'lr-thinking-panel': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/thinking-panel/thinking-panel.class.js').then((module) => module.LyraThinkingPanel),
  },
  'lr-thread-list': {
    optionalPeers: [],
    load: () => import('../components/conversation/thread-list/thread-list.class.js').then((module) => module.LyraThreadList),
  },
  'lr-time-input': {
    optionalPeers: [],
    load: () => import('../components/forms/input/time-input.class.js').then((module) => module.LyraTimeInput),
  },
  'lr-time-range': {
    optionalPeers: [],
    load: () => import('../components/forms/time-range/time-range.class.js').then((module) => module.LyraTimeRange),
  },
  'lr-timeline': {
    optionalPeers: [],
    load: () => import('../components/data/timeline/timeline.class.js').then((module) => module.LyraTimeline),
  },
  'lr-timeline-item': {
    optionalPeers: [],
    load: () => import('../components/data/timeline/timeline-item.class.js').then((module) => module.LyraTimelineItem),
  },
  'lr-toast': {
    optionalPeers: [],
    load: () => import('../components/overlays/toast/toast.class.js').then((module) => module.LyraToast),
  },
  'lr-toast-item': {
    optionalPeers: [],
    load: () => import('../components/overlays/toast/toast-item.class.js').then((module) => module.LyraToastItem),
  },
  'lr-token-input': {
    optionalPeers: [],
    load: () => import('../components/forms/token-input/token-input.class.js').then((module) => module.LyraTokenInput),
  },
  'lr-tool-approval-dialog': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/tool-approval-dialog/tool-approval-dialog.class.js').then((module) => module.LyraToolApprovalDialog),
  },
  'lr-tool-call-chip': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/tool-call-chip/tool-call-chip.class.js').then((module) => module.LyraToolCallChip),
  },
  'lr-tool-param-form': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/tool-param-form/tool-param-form.class.js').then((module) => module.LyraToolParamForm),
  },
  'lr-tool-result-dialog': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/tool-result-dialog/tool-result-dialog.class.js').then((module) => module.LyraToolResultDialog),
  },
  'lr-tool-result-view': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/tool-result-view/tool-result-view.class.js').then((module) => module.LyraToolResultView),
  },
  'lr-tool-select-dialog': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/tool-select-dialog/tool-select-dialog.class.js').then((module) => module.LyraToolSelectDialog),
  },
  'lr-tool-timeline': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/tool-timeline/tool-timeline.class.js').then((module) => module.LyraToolTimeline),
  },
  'lr-tooltip': {
    optionalPeers: [],
    load: () => import('../components/overlays/overlay/tooltip.class.js').then((module) => module.LyraTooltip),
  },
  'lr-tour': {
    optionalPeers: [],
    load: () => import('../components/utility/tour/tour.class.js').then((module) => module.LyraTour),
  },
  'lr-trace-tree': {
    optionalPeers: [],
    load: () => import('../components/agent-tools/trace-tree/trace-tree.class.js').then((module) => module.LyraTraceTree),
  },
  'lr-transcript-feed': {
    optionalPeers: [],
    load: () => import('../components/conversation/transcript-feed/transcript-feed.class.js').then((module) => module.LyraTranscriptFeed),
  },
  'lr-tree': {
    optionalPeers: [],
    load: () => import('../components/data/tree/tree.class.js').then((module) => module.LyraTree),
  },
  'lr-tree-item': {
    optionalPeers: [],
    load: () => import('../components/data/tree/tree-item.class.js').then((module) => module.LyraTreeItem),
  },
  'lr-typing-indicator': {
    optionalPeers: [],
    load: () => import('../components/conversation/typing-indicator/typing-indicator.class.js').then((module) => module.LyraTypingIndicator),
  },
  'lr-usage-badge': {
    optionalPeers: [],
    load: () => import('../components/conversation/usage-badge/usage-badge.class.js').then((module) => module.LyraUsageBadge),
  },
  'lr-video': {
    optionalPeers: [],
    load: () => import('../components/media/video/video.class.js').then((module) => module.LyraVideo),
  },
  'lr-video-playlist': {
    optionalPeers: [],
    load: () => import('../components/media/video-playlist/video-playlist.class.js').then((module) => module.LyraVideoPlaylist),
  },
  'lr-virtual-list': {
    optionalPeers: [],
    load: () => import('../components/layout/virtual-list/virtual-list.class.js').then((module) => module.LyraVirtualList),
  },
  'lr-visually-hidden': {
    optionalPeers: [],
    load: () => import('../components/utility/visually-hidden/visually-hidden.class.js').then((module) => module.LyraVisuallyHidden),
  },
  'lr-voice-picker': {
    optionalPeers: [],
    load: () => import('../components/conversation/voice-picker/voice-picker.class.js').then((module) => module.LyraVoicePicker),
  },
  'lr-widget': {
    optionalPeers: [],
    load: () => import('../components/layout/widget/widget.class.js').then((module) => module.LyraWidget),
  },
  'lr-widget-renderer': {
    optionalPeers: ['dompurify', 'katex', 'marked', 'shiki'],
    load: () => import('../components/conversation/widget-renderer/widget-renderer.class.js').then((module) => module.LyraWidgetRenderer),
  },
  'lr-word-cloud': {
    optionalPeers: [],
    load: () => import('../components/data/word-cloud/word-cloud.class.js').then((module) => module.LyraWordCloud),
  },
  'lr-xml-viewer': {
    optionalPeers: [],
    load: () => import('../components/viewers/xml-viewer/xml-viewer.class.js').then((module) => module.LyraXmlViewer),
  },
  'lr-zoomable-frame': {
    optionalPeers: [],
    load: () => import('../components/media/zoomable-frame/zoomable-frame.class.js').then((module) => module.LyraZoomableFrame),
  },
};
