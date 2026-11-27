// GENERATED FILE — do not edit by hand. Per-event classes for `instanceof` narrowing.
// Regenerate with `pnpm --filter @aceshooting/lyra-ui run events`
// (`node scripts/generate-event-types.mjs`); `scripts/check-event-types.mjs` gates freshness.
// Side-effect free: components dispatch the shared `LyraEvent`, never these classes.

import { LyraEvent } from './internal/lyra-event.js';
import type { LyraEventDetailOf, LyraEventOptions } from './internal/lyra-event.js';
import type { LyraGlobalEventMap } from './events.js';

export { LyraEvent } from './internal/lyra-event.js';
export type { LyraEventDetailOf, LyraEventOptions } from './internal/lyra-event.js';

/**
 * Class of every `lr-activate` event; `event instanceof LyraActivateEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraActivateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-activate']>> {
  static override readonly eventName = 'lr-activate';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-activate']>, options?: LyraEventOptions) {
    super('lr-activate', detail, options);
  }
}

/**
 * Class of every `lr-add` event; `event instanceof LyraAddEvent` is true for the events components
 * dispatch and narrows `detail`.
 */
export class LyraAddEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-add']>> {
  static override readonly eventName = 'lr-add';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-add']>, options?: LyraEventOptions) {
    super('lr-add', detail, options);
  }
}

/**
 * Class of every `lr-add-condition` event; `event instanceof LyraAddConditionEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraAddConditionEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-add-condition']>> {
  static override readonly eventName = 'lr-add-condition';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-add-condition']>, options?: LyraEventOptions) {
    super('lr-add-condition', detail, options);
  }
}

/**
 * Class of every `lr-after-collapse` event; `event instanceof LyraAfterCollapseEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraAfterCollapseEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-after-collapse']>> {
  static override readonly eventName = 'lr-after-collapse';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-after-collapse']>, options?: LyraEventOptions) {
    super('lr-after-collapse', detail, options);
  }
}

/**
 * Class of every `lr-after-expand` event; `event instanceof LyraAfterExpandEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraAfterExpandEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-after-expand']>> {
  static override readonly eventName = 'lr-after-expand';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-after-expand']>, options?: LyraEventOptions) {
    super('lr-after-expand', detail, options);
  }
}

/**
 * Class of every `lr-after-hide` event; `event instanceof LyraAfterHideEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraAfterHideEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-after-hide']>> {
  static override readonly eventName = 'lr-after-hide';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-after-hide']>, options?: LyraEventOptions) {
    super('lr-after-hide', detail, options);
  }
}

/**
 * Class of every `lr-after-maximize-change` event; `event instanceof LyraAfterMaximizeChangeEvent`
 * is true for the events components dispatch and narrows `detail`.
 */
export class LyraAfterMaximizeChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-after-maximize-change']>> {
  static override readonly eventName = 'lr-after-maximize-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-after-maximize-change']>, options?: LyraEventOptions) {
    super('lr-after-maximize-change', detail, options);
  }
}

/**
 * Class of every `lr-after-show` event; `event instanceof LyraAfterShowEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraAfterShowEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-after-show']>> {
  static override readonly eventName = 'lr-after-show';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-after-show']>, options?: LyraEventOptions) {
    super('lr-after-show', detail, options);
  }
}

/**
 * Class of every `lr-anchor-result` event; `event instanceof LyraAnchorResultEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraAnchorResultEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-anchor-result']>> {
  static override readonly eventName = 'lr-anchor-result';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-anchor-result']>, options?: LyraEventOptions) {
    super('lr-anchor-result', detail, options);
  }
}

/**
 * Class of every `lr-annotatable-change` event; `event instanceof LyraAnnotatableChangeEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraAnnotatableChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-annotatable-change']>> {
  static override readonly eventName = 'lr-annotatable-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-annotatable-change']>, options?: LyraEventOptions) {
    super('lr-annotatable-change', detail, options);
  }
}

/**
 * Class of every `lr-annotation-create` event; `event instanceof LyraAnnotationCreateEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraAnnotationCreateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-annotation-create']>> {
  static override readonly eventName = 'lr-annotation-create';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-annotation-create']>, options?: LyraEventOptions) {
    super('lr-annotation-create', detail, options);
  }
}

/**
 * Class of every `lr-approval-close` event; `event instanceof LyraApprovalCloseEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraApprovalCloseEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-approval-close']>> {
  static override readonly eventName = 'lr-approval-close';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-approval-close']>, options?: LyraEventOptions) {
    super('lr-approval-close', detail, options);
  }
}

/**
 * Class of every `lr-approval-decision-request` event; `event instanceof
 * LyraApprovalDecisionRequestEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraApprovalDecisionRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-approval-decision-request']>> {
  static override readonly eventName = 'lr-approval-decision-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-approval-decision-request']>, options?: LyraEventOptions) {
    super('lr-approval-decision-request', detail, options);
  }
}

/**
 * Class of every `lr-approval-open` event; `event instanceof LyraApprovalOpenEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraApprovalOpenEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-approval-open']>> {
  static override readonly eventName = 'lr-approval-open';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-approval-open']>, options?: LyraEventOptions) {
    super('lr-approval-open', detail, options);
  }
}

/**
 * Class of every `lr-approval-select` event; `event instanceof LyraApprovalSelectEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraApprovalSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-approval-select']>> {
  static override readonly eventName = 'lr-approval-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-approval-select']>, options?: LyraEventOptions) {
    super('lr-approval-select', detail, options);
  }
}

/**
 * Class of every `lr-approve-request` event; `event instanceof LyraApproveRequestEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraApproveRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-approve-request']>> {
  static override readonly eventName = 'lr-approve-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-approve-request']>, options?: LyraEventOptions) {
    super('lr-approve-request', detail, options);
  }
}

/**
 * Class of every `lr-artifact-view-change` event; `event instanceof LyraArtifactViewChangeEvent`
 * is true for the events components dispatch and narrows `detail`.
 */
export class LyraArtifactViewChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-artifact-view-change']>> {
  static override readonly eventName = 'lr-artifact-view-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-artifact-view-change']>, options?: LyraEventOptions) {
    super('lr-artifact-view-change', detail, options);
  }
}

/**
 * Class of every `lr-artifact-view-change-request` event; `event instanceof
 * LyraArtifactViewChangeRequestEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraArtifactViewChangeRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-artifact-view-change-request']>> {
  static override readonly eventName = 'lr-artifact-view-change-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-artifact-view-change-request']>, options?: LyraEventOptions) {
    super('lr-artifact-view-change-request', detail, options);
  }
}

/**
 * Class of every `lr-attachment-open` event; `event instanceof LyraAttachmentOpenEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraAttachmentOpenEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-attachment-open']>> {
  static override readonly eventName = 'lr-attachment-open';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-attachment-open']>, options?: LyraEventOptions) {
    super('lr-attachment-open', detail, options);
  }
}

/**
 * Class of every `lr-attachment-preview-request` event; `event instanceof
 * LyraAttachmentPreviewRequestEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraAttachmentPreviewRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-attachment-preview-request']>> {
  static override readonly eventName = 'lr-attachment-preview-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-attachment-preview-request']>, options?: LyraEventOptions) {
    super('lr-attachment-preview-request', detail, options);
  }
}

/**
 * Class of every `lr-attachment-remove` event; `event instanceof LyraAttachmentRemoveEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraAttachmentRemoveEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-attachment-remove']>> {
  static override readonly eventName = 'lr-attachment-remove';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-attachment-remove']>, options?: LyraEventOptions) {
    super('lr-attachment-remove', detail, options);
  }
}

/**
 * Class of every `lr-attachment-retry` event; `event instanceof LyraAttachmentRetryEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraAttachmentRetryEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-attachment-retry']>> {
  static override readonly eventName = 'lr-attachment-retry';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-attachment-retry']>, options?: LyraEventOptions) {
    super('lr-attachment-retry', detail, options);
  }
}

/**
 * Class of every `lr-attachments-add` event; `event instanceof LyraAttachmentsAddEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraAttachmentsAddEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-attachments-add']>> {
  static override readonly eventName = 'lr-attachments-add';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-attachments-add']>, options?: LyraEventOptions) {
    super('lr-attachments-add', detail, options);
  }
}

/**
 * Class of every `lr-audio-request` event; `event instanceof LyraAudioRequestEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraAudioRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-audio-request']>> {
  static override readonly eventName = 'lr-audio-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-audio-request']>, options?: LyraEventOptions) {
    super('lr-audio-request', detail, options);
  }
}

/**
 * Class of every `lr-autoload-error` event; `event instanceof LyraAutoloadErrorEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraAutoloadErrorEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-autoload-error']>> {
  static override readonly eventName = 'lr-autoload-error';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-autoload-error']>, options?: LyraEventOptions) {
    super('lr-autoload-error', detail, options);
  }
}

/**
 * Class of every `lr-autoload-loaded` event; `event instanceof LyraAutoloadLoadedEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraAutoloadLoadedEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-autoload-loaded']>> {
  static override readonly eventName = 'lr-autoload-loaded';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-autoload-loaded']>, options?: LyraEventOptions) {
    super('lr-autoload-loaded', detail, options);
  }
}

/**
 * Class of every `lr-autoload-preload` event; `event instanceof LyraAutoloadPreloadEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraAutoloadPreloadEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-autoload-preload']>> {
  static override readonly eventName = 'lr-autoload-preload';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-autoload-preload']>, options?: LyraEventOptions) {
    super('lr-autoload-preload', detail, options);
  }
}

/**
 * Class of every `lr-autoload-traversal-error` event; `event instanceof
 * LyraAutoloadTraversalErrorEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraAutoloadTraversalErrorEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-autoload-traversal-error']>> {
  static override readonly eventName = 'lr-autoload-traversal-error';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-autoload-traversal-error']>, options?: LyraEventOptions) {
    super('lr-autoload-traversal-error', detail, options);
  }
}

/**
 * Class of every `lr-before-page-change` event; `event instanceof LyraBeforePageChangeEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraBeforePageChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-before-page-change']>> {
  static override readonly eventName = 'lr-before-page-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-before-page-change']>, options?: LyraEventOptions) {
    super('lr-before-page-change', detail, options);
  }
}

/**
 * Class of every `lr-before-page-size-change` event; `event instanceof
 * LyraBeforePageSizeChangeEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraBeforePageSizeChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-before-page-size-change']>> {
  static override readonly eventName = 'lr-before-page-size-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-before-page-size-change']>, options?: LyraEventOptions) {
    super('lr-before-page-size-change', detail, options);
  }
}

/**
 * Class of every `lr-before-step-change` event; `event instanceof LyraBeforeStepChangeEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraBeforeStepChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-before-step-change']>> {
  static override readonly eventName = 'lr-before-step-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-before-step-change']>, options?: LyraEventOptions) {
    super('lr-before-step-change', detail, options);
  }
}

/**
 * Class of every `lr-branch-change` event; `event instanceof LyraBranchChangeEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraBranchChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-branch-change']>> {
  static override readonly eventName = 'lr-branch-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-branch-change']>, options?: LyraEventOptions) {
    super('lr-branch-change', detail, options);
  }
}

/**
 * Class of every `lr-bulk-toggle` event; `event instanceof LyraBulkToggleEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraBulkToggleEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-bulk-toggle']>> {
  static override readonly eventName = 'lr-bulk-toggle';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-bulk-toggle']>, options?: LyraEventOptions) {
    super('lr-bulk-toggle', detail, options);
  }
}

/**
 * Class of every `lr-calendar-geometry-change` event; `event instanceof
 * LyraCalendarGeometryChangeEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraCalendarGeometryChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-calendar-geometry-change']>> {
  static override readonly eventName = 'lr-calendar-geometry-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-calendar-geometry-change']>, options?: LyraEventOptions) {
    super('lr-calendar-geometry-change', detail, options);
  }
}

/**
 * Class of every `lr-camera-change` event; `event instanceof LyraCameraChangeEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraCameraChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-camera-change']>> {
  static override readonly eventName = 'lr-camera-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-camera-change']>, options?: LyraEventOptions) {
    super('lr-camera-change', detail, options);
  }
}

/**
 * Class of every `lr-camera-request` event; `event instanceof LyraCameraRequestEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraCameraRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-camera-request']>> {
  static override readonly eventName = 'lr-camera-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-camera-request']>, options?: LyraEventOptions) {
    super('lr-camera-request', detail, options);
  }
}

/**
 * Class of every `lr-cancel` event; `event instanceof LyraCancelEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraCancelEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-cancel']>> {
  static override readonly eventName = 'lr-cancel';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-cancel']>, options?: LyraEventOptions) {
    super('lr-cancel', detail, options);
  }
}

/**
 * Class of every `lr-card-activate` event; `event instanceof LyraCardActivateEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraCardActivateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-card-activate']>> {
  static override readonly eventName = 'lr-card-activate';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-card-activate']>, options?: LyraEventOptions) {
    super('lr-card-activate', detail, options);
  }
}

/**
 * Class of every `lr-cell-activate` event; `event instanceof LyraCellActivateEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraCellActivateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-cell-activate']>> {
  static override readonly eventName = 'lr-cell-activate';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-cell-activate']>, options?: LyraEventOptions) {
    super('lr-cell-activate', detail, options);
  }
}

/**
 * Class of every `lr-cell-click` event; `event instanceof LyraCellClickEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraCellClickEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-cell-click']>> {
  static override readonly eventName = 'lr-cell-click';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-cell-click']>, options?: LyraEventOptions) {
    super('lr-cell-click', detail, options);
  }
}

/**
 * Class of every `lr-cell-contextmenu` event; `event instanceof LyraCellContextmenuEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraCellContextmenuEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-cell-contextmenu']>> {
  static override readonly eventName = 'lr-cell-contextmenu';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-cell-contextmenu']>, options?: LyraEventOptions) {
    super('lr-cell-contextmenu', detail, options);
  }
}

/**
 * Class of every `lr-cell-edit` event; `event instanceof LyraCellEditEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraCellEditEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-cell-edit']>> {
  static override readonly eventName = 'lr-cell-edit';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-cell-edit']>, options?: LyraEventOptions) {
    super('lr-cell-edit', detail, options);
  }
}

/**
 * Class of every `lr-cell-move` event; `event instanceof LyraCellMoveEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraCellMoveEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-cell-move']>> {
  static override readonly eventName = 'lr-cell-move';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-cell-move']>, options?: LyraEventOptions) {
    super('lr-cell-move', detail, options);
  }
}

/**
 * Class of every `lr-cell-resize` event; `event instanceof LyraCellResizeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraCellResizeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-cell-resize']>> {
  static override readonly eventName = 'lr-cell-resize';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-cell-resize']>, options?: LyraEventOptions) {
    super('lr-cell-resize', detail, options);
  }
}

/**
 * Class of every `lr-change` event; `event instanceof LyraChangeEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-change']>> {
  static override readonly eventName = 'lr-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-change']>, options?: LyraEventOptions) {
    super('lr-change', detail, options);
  }
}

/**
 * Class of every `lr-change-decision-request` event; `event instanceof
 * LyraChangeDecisionRequestEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraChangeDecisionRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-change-decision-request']>> {
  static override readonly eventName = 'lr-change-decision-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-change-decision-request']>, options?: LyraEventOptions) {
    super('lr-change-decision-request', detail, options);
  }
}

/**
 * Class of every `lr-change-request` event; `event instanceof LyraChangeRequestEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraChangeRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-change-request']>> {
  static override readonly eventName = 'lr-change-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-change-request']>, options?: LyraEventOptions) {
    super('lr-change-request', detail, options);
  }
}

/**
 * Class of every `lr-chart-row-select` event; `event instanceof LyraChartRowSelectEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraChartRowSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-chart-row-select']>> {
  static override readonly eventName = 'lr-chart-row-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-chart-row-select']>, options?: LyraEventOptions) {
    super('lr-chart-row-select', detail, options);
  }
}

/**
 * Class of every `lr-chart-row-select-request` event; `event instanceof
 * LyraChartRowSelectRequestEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraChartRowSelectRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-chart-row-select-request']>> {
  static override readonly eventName = 'lr-chart-row-select-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-chart-row-select-request']>, options?: LyraEventOptions) {
    super('lr-chart-row-select-request', detail, options);
  }
}

/**
 * Class of every `lr-checkbox-group-toggle-request` event; `event instanceof
 * LyraCheckboxGroupToggleRequestEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraCheckboxGroupToggleRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-checkbox-group-toggle-request']>> {
  static override readonly eventName = 'lr-checkbox-group-toggle-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-checkbox-group-toggle-request']>, options?: LyraEventOptions) {
    super('lr-checkbox-group-toggle-request', detail, options);
  }
}

/**
 * Class of every `lr-checkbox-toggle-request` event; `event instanceof
 * LyraCheckboxToggleRequestEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraCheckboxToggleRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-checkbox-toggle-request']>> {
  static override readonly eventName = 'lr-checkbox-toggle-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-checkbox-toggle-request']>, options?: LyraEventOptions) {
    super('lr-checkbox-toggle-request', detail, options);
  }
}

/**
 * Class of every `lr-chip-change` event; `event instanceof LyraChipChangeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraChipChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-chip-change']>> {
  static override readonly eventName = 'lr-chip-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-chip-change']>, options?: LyraEventOptions) {
    super('lr-chip-change', detail, options);
  }
}

/**
 * Class of every `lr-chip-toggle-request` event; `event instanceof LyraChipToggleRequestEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraChipToggleRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-chip-toggle-request']>> {
  static override readonly eventName = 'lr-chip-toggle-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-chip-toggle-request']>, options?: LyraEventOptions) {
    super('lr-chip-toggle-request', detail, options);
  }
}

/**
 * Class of every `lr-chunk-open` event; `event instanceof LyraChunkOpenEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraChunkOpenEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-chunk-open']>> {
  static override readonly eventName = 'lr-chunk-open';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-chunk-open']>, options?: LyraEventOptions) {
    super('lr-chunk-open', detail, options);
  }
}

/**
 * Class of every `lr-chunk-select` event; `event instanceof LyraChunkSelectEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraChunkSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-chunk-select']>> {
  static override readonly eventName = 'lr-chunk-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-chunk-select']>, options?: LyraEventOptions) {
    super('lr-chunk-select', detail, options);
  }
}

/**
 * Class of every `lr-citation-activate` event; `event instanceof LyraCitationActivateEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraCitationActivateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-citation-activate']>> {
  static override readonly eventName = 'lr-citation-activate';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-citation-activate']>, options?: LyraEventOptions) {
    super('lr-citation-activate', detail, options);
  }
}

/**
 * Class of every `lr-citation-open` event; `event instanceof LyraCitationOpenEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraCitationOpenEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-citation-open']>> {
  static override readonly eventName = 'lr-citation-open';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-citation-open']>, options?: LyraEventOptions) {
    super('lr-citation-open', detail, options);
  }
}

/**
 * Class of every `lr-citation-select` event; `event instanceof LyraCitationSelectEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraCitationSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-citation-select']>> {
  static override readonly eventName = 'lr-citation-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-citation-select']>, options?: LyraEventOptions) {
    super('lr-citation-select', detail, options);
  }
}

/**
 * Class of every `lr-claim-select` event; `event instanceof LyraClaimSelectEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraClaimSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-claim-select']>> {
  static override readonly eventName = 'lr-claim-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-claim-select']>, options?: LyraEventOptions) {
    super('lr-claim-select', detail, options);
  }
}

/**
 * Class of every `lr-clear` event; `event instanceof LyraClearEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraClearEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-clear']>> {
  static override readonly eventName = 'lr-clear';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-clear']>, options?: LyraEventOptions) {
    super('lr-clear', detail, options);
  }
}

/**
 * Class of every `lr-close` event; `event instanceof LyraCloseEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraCloseEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-close']>> {
  static override readonly eventName = 'lr-close';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-close']>, options?: LyraEventOptions) {
    super('lr-close', detail, options);
  }
}

/**
 * Class of every `lr-close-request` event; `event instanceof LyraCloseRequestEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraCloseRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-close-request']>> {
  static override readonly eventName = 'lr-close-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-close-request']>, options?: LyraEventOptions) {
    super('lr-close-request', detail, options);
  }
}

/**
 * Class of every `lr-cluster-activate` event; `event instanceof LyraClusterActivateEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraClusterActivateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-cluster-activate']>> {
  static override readonly eventName = 'lr-cluster-activate';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-cluster-activate']>, options?: LyraEventOptions) {
    super('lr-cluster-activate', detail, options);
  }
}

/**
 * Class of every `lr-collapse` event; `event instanceof LyraCollapseEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraCollapseEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-collapse']>> {
  static override readonly eventName = 'lr-collapse';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-collapse']>, options?: LyraEventOptions) {
    super('lr-collapse', detail, options);
  }
}

/**
 * Class of every `lr-collision` event; `event instanceof LyraCollisionEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraCollisionEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-collision']>> {
  static override readonly eventName = 'lr-collision';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-collision']>, options?: LyraEventOptions) {
    super('lr-collision', detail, options);
  }
}

/**
 * Class of every `lr-column-move` event; `event instanceof LyraColumnMoveEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraColumnMoveEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-column-move']>> {
  static override readonly eventName = 'lr-column-move';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-column-move']>, options?: LyraEventOptions) {
    super('lr-column-move', detail, options);
  }
}

/**
 * Class of every `lr-column-pin` event; `event instanceof LyraColumnPinEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraColumnPinEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-column-pin']>> {
  static override readonly eventName = 'lr-column-pin';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-column-pin']>, options?: LyraEventOptions) {
    super('lr-column-pin', detail, options);
  }
}

/**
 * Class of every `lr-column-resize` event; `event instanceof LyraColumnResizeEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraColumnResizeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-column-resize']>> {
  static override readonly eventName = 'lr-column-resize';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-column-resize']>, options?: LyraEventOptions) {
    super('lr-column-resize', detail, options);
  }
}

/**
 * Class of every `lr-column-resize-request` event; `event instanceof LyraColumnResizeRequestEvent`
 * is true for the events components dispatch and narrows `detail`.
 */
export class LyraColumnResizeRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-column-resize-request']>> {
  static override readonly eventName = 'lr-column-resize-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-column-resize-request']>, options?: LyraEventOptions) {
    super('lr-column-resize-request', detail, options);
  }
}

/**
 * Class of every `lr-column-visibility-change` event; `event instanceof
 * LyraColumnVisibilityChangeEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraColumnVisibilityChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-column-visibility-change']>> {
  static override readonly eventName = 'lr-column-visibility-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-column-visibility-change']>, options?: LyraEventOptions) {
    super('lr-column-visibility-change', detail, options);
  }
}

/**
 * Class of every `lr-community-activate` event; `event instanceof LyraCommunityActivateEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraCommunityActivateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-community-activate']>> {
  static override readonly eventName = 'lr-community-activate';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-community-activate']>, options?: LyraEventOptions) {
    super('lr-community-activate', detail, options);
  }
}

/**
 * Class of every `lr-complete` event; `event instanceof LyraCompleteEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraCompleteEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-complete']>> {
  static override readonly eventName = 'lr-complete';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-complete']>, options?: LyraEventOptions) {
    super('lr-complete', detail, options);
  }
}

/**
 * Class of every `lr-connect` event; `event instanceof LyraConnectEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraConnectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-connect']>> {
  static override readonly eventName = 'lr-connect';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-connect']>, options?: LyraEventOptions) {
    super('lr-connect', detail, options);
  }
}

/**
 * Class of every `lr-connector-action` event; `event instanceof LyraConnectorActionEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraConnectorActionEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-connector-action']>> {
  static override readonly eventName = 'lr-connector-action';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-connector-action']>, options?: LyraEventOptions) {
    super('lr-connector-action', detail, options);
  }
}

/**
 * Class of every `lr-content-change` event; `event instanceof LyraContentChangeEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraContentChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-content-change']>> {
  static override readonly eventName = 'lr-content-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-content-change']>, options?: LyraEventOptions) {
    super('lr-content-change', detail, options);
  }
}

/**
 * Class of every `lr-content-settled` event; `event instanceof LyraContentSettledEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraContentSettledEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-content-settled']>> {
  static override readonly eventName = 'lr-content-settled';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-content-settled']>, options?: LyraEventOptions) {
    super('lr-content-settled', detail, options);
  }
}

/**
 * Class of every `lr-copy` event; `event instanceof LyraCopyEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraCopyEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-copy']>> {
  static override readonly eventName = 'lr-copy';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-copy']>, options?: LyraEventOptions) {
    super('lr-copy', detail, options);
  }
}

/**
 * Class of every `lr-copy-error` event; `event instanceof LyraCopyErrorEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraCopyErrorEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-copy-error']>> {
  static override readonly eventName = 'lr-copy-error';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-copy-error']>, options?: LyraEventOptions) {
    super('lr-copy-error', detail, options);
  }
}

/**
 * Class of every `lr-create` event; `event instanceof LyraCreateEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraCreateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-create']>> {
  static override readonly eventName = 'lr-create';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-create']>, options?: LyraEventOptions) {
    super('lr-create', detail, options);
  }
}

/**
 * Class of every `lr-cue-change` event; `event instanceof LyraCueChangeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraCueChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-cue-change']>> {
  static override readonly eventName = 'lr-cue-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-cue-change']>, options?: LyraEventOptions) {
    super('lr-cue-change', detail, options);
  }
}

/**
 * Class of every `lr-data-error` event; `event instanceof LyraDataErrorEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraDataErrorEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-data-error']>> {
  static override readonly eventName = 'lr-data-error';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-data-error']>, options?: LyraEventOptions) {
    super('lr-data-error', detail, options);
  }
}

/**
 * Class of every `lr-date-select` event; `event instanceof LyraDateSelectEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraDateSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-date-select']>> {
  static override readonly eventName = 'lr-date-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-date-select']>, options?: LyraEventOptions) {
    super('lr-date-select', detail, options);
  }
}

/**
 * Class of every `lr-datum-activate` event; `event instanceof LyraDatumActivateEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraDatumActivateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-datum-activate']>> {
  static override readonly eventName = 'lr-datum-activate';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-datum-activate']>, options?: LyraEventOptions) {
    super('lr-datum-activate', detail, options);
  }
}

/**
 * Class of every `lr-datum-visibility-change` event; `event instanceof
 * LyraDatumVisibilityChangeEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraDatumVisibilityChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-datum-visibility-change']>> {
  static override readonly eventName = 'lr-datum-visibility-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-datum-visibility-change']>, options?: LyraEventOptions) {
    super('lr-datum-visibility-change', detail, options);
  }
}

/**
 * Class of every `lr-datum-visibility-change-request` event; `event instanceof
 * LyraDatumVisibilityChangeRequestEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraDatumVisibilityChangeRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-datum-visibility-change-request']>> {
  static override readonly eventName = 'lr-datum-visibility-change-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-datum-visibility-change-request']>, options?: LyraEventOptions) {
    super('lr-datum-visibility-change-request', detail, options);
  }
}

/**
 * Class of every `lr-decision-settled` event; `event instanceof LyraDecisionSettledEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraDecisionSettledEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-decision-settled']>> {
  static override readonly eventName = 'lr-decision-settled';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-decision-settled']>, options?: LyraEventOptions) {
    super('lr-decision-settled', detail, options);
  }
}

/**
 * Class of every `lr-deny-request` event; `event instanceof LyraDenyRequestEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraDenyRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-deny-request']>> {
  static override readonly eventName = 'lr-deny-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-deny-request']>, options?: LyraEventOptions) {
    super('lr-deny-request', detail, options);
  }
}

/**
 * Class of every `lr-disconnect` event; `event instanceof LyraDisconnectEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraDisconnectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-disconnect']>> {
  static override readonly eventName = 'lr-disconnect';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-disconnect']>, options?: LyraEventOptions) {
    super('lr-disconnect', detail, options);
  }
}

/**
 * Class of every `lr-dismiss` event; `event instanceof LyraDismissEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraDismissEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-dismiss']>> {
  static override readonly eventName = 'lr-dismiss';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-dismiss']>, options?: LyraEventOptions) {
    super('lr-dismiss', detail, options);
  }
}

/**
 * Class of every `lr-download` event; `event instanceof LyraDownloadEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraDownloadEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-download']>> {
  static override readonly eventName = 'lr-download';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-download']>, options?: LyraEventOptions) {
    super('lr-download', detail, options);
  }
}

/**
 * Class of every `lr-download-request` event; `event instanceof LyraDownloadRequestEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraDownloadRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-download-request']>> {
  static override readonly eventName = 'lr-download-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-download-request']>, options?: LyraEventOptions) {
    super('lr-download-request', detail, options);
  }
}

/**
 * Class of every `lr-drill` event; `event instanceof LyraDrillEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraDrillEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-drill']>> {
  static override readonly eventName = 'lr-drill';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-drill']>, options?: LyraEventOptions) {
    super('lr-drill', detail, options);
  }
}

/**
 * Class of every `lr-drilldown-category-change` event; `event instanceof
 * LyraDrilldownCategoryChangeEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraDrilldownCategoryChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-drilldown-category-change']>> {
  static override readonly eventName = 'lr-drilldown-category-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-drilldown-category-change']>, options?: LyraEventOptions) {
    super('lr-drilldown-category-change', detail, options);
  }
}

/**
 * Class of every `lr-drilldown-document-download` event; `event instanceof
 * LyraDrilldownDocumentDownloadEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraDrilldownDocumentDownloadEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-drilldown-document-download']>> {
  static override readonly eventName = 'lr-drilldown-document-download';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-drilldown-document-download']>, options?: LyraEventOptions) {
    super('lr-drilldown-document-download', detail, options);
  }
}

/**
 * Class of every `lr-drilldown-document-highlight-activate` event; `event instanceof
 * LyraDrilldownDocumentHighlightActivateEvent` is true for the events components dispatch and
 * narrows `detail`.
 */
export class LyraDrilldownDocumentHighlightActivateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-drilldown-document-highlight-activate']>> {
  static override readonly eventName = 'lr-drilldown-document-highlight-activate';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-drilldown-document-highlight-activate']>, options?: LyraEventOptions) {
    super('lr-drilldown-document-highlight-activate', detail, options);
  }
}

/**
 * Class of every `lr-drilldown-document-render-error` event; `event instanceof
 * LyraDrilldownDocumentRenderErrorEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraDrilldownDocumentRenderErrorEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-drilldown-document-render-error']>> {
  static override readonly eventName = 'lr-drilldown-document-render-error';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-drilldown-document-render-error']>, options?: LyraEventOptions) {
    super('lr-drilldown-document-render-error', detail, options);
  }
}

/**
 * Class of every `lr-drilldown-entity-activate` event; `event instanceof
 * LyraDrilldownEntityActivateEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraDrilldownEntityActivateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-drilldown-entity-activate']>> {
  static override readonly eventName = 'lr-drilldown-entity-activate';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-drilldown-entity-activate']>, options?: LyraEventOptions) {
    super('lr-drilldown-entity-activate', detail, options);
  }
}

/**
 * Class of every `lr-drilldown-evidence-expand` event; `event instanceof
 * LyraDrilldownEvidenceExpandEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraDrilldownEvidenceExpandEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-drilldown-evidence-expand']>> {
  static override readonly eventName = 'lr-drilldown-evidence-expand';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-drilldown-evidence-expand']>, options?: LyraEventOptions) {
    super('lr-drilldown-evidence-expand', detail, options);
  }
}

/**
 * Class of every `lr-drilldown-evidence-open` event; `event instanceof
 * LyraDrilldownEvidenceOpenEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraDrilldownEvidenceOpenEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-drilldown-evidence-open']>> {
  static override readonly eventName = 'lr-drilldown-evidence-open';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-drilldown-evidence-open']>, options?: LyraEventOptions) {
    super('lr-drilldown-evidence-open', detail, options);
  }
}

/**
 * Class of every `lr-drilldown-navigate` event; `event instanceof LyraDrilldownNavigateEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraDrilldownNavigateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-drilldown-navigate']>> {
  static override readonly eventName = 'lr-drilldown-navigate';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-drilldown-navigate']>, options?: LyraEventOptions) {
    super('lr-drilldown-navigate', detail, options);
  }
}

/**
 * Class of every `lr-edge-activate` event; `event instanceof LyraEdgeActivateEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraEdgeActivateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-edge-activate']>> {
  static override readonly eventName = 'lr-edge-activate';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-edge-activate']>, options?: LyraEventOptions) {
    super('lr-edge-activate', detail, options);
  }
}

/**
 * Class of every `lr-edge-enter` event; `event instanceof LyraEdgeEnterEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraEdgeEnterEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-edge-enter']>> {
  static override readonly eventName = 'lr-edge-enter';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-edge-enter']>, options?: LyraEventOptions) {
    super('lr-edge-enter', detail, options);
  }
}

/**
 * Class of every `lr-edge-leave` event; `event instanceof LyraEdgeLeaveEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraEdgeLeaveEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-edge-leave']>> {
  static override readonly eventName = 'lr-edge-leave';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-edge-leave']>, options?: LyraEventOptions) {
    super('lr-edge-leave', detail, options);
  }
}

/**
 * Class of every `lr-edit` event; `event instanceof LyraEditEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraEditEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-edit']>> {
  static override readonly eventName = 'lr-edit';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-edit']>, options?: LyraEventOptions) {
    super('lr-edit', detail, options);
  }
}

/**
 * Class of every `lr-engine-fallback` event; `event instanceof LyraEngineFallbackEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraEngineFallbackEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-engine-fallback']>> {
  static override readonly eventName = 'lr-engine-fallback';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-engine-fallback']>, options?: LyraEventOptions) {
    super('lr-engine-fallback', detail, options);
  }
}

/**
 * Class of every `lr-entity-open` event; `event instanceof LyraEntityOpenEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraEntityOpenEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-entity-open']>> {
  static override readonly eventName = 'lr-entity-open';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-entity-open']>, options?: LyraEventOptions) {
    super('lr-entity-open', detail, options);
  }
}

/**
 * Class of every `lr-entity-select` event; `event instanceof LyraEntitySelectEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraEntitySelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-entity-select']>> {
  static override readonly eventName = 'lr-entity-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-entity-select']>, options?: LyraEventOptions) {
    super('lr-entity-select', detail, options);
  }
}

/**
 * Class of every `lr-error` event; `event instanceof LyraErrorEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraErrorEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-error']>> {
  static override readonly eventName = 'lr-error';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-error']>, options?: LyraEventOptions) {
    super('lr-error', detail, options);
  }
}

/**
 * Class of every `lr-event-select` event; `event instanceof LyraEventSelectEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraEventSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-event-select']>> {
  static override readonly eventName = 'lr-event-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-event-select']>, options?: LyraEventOptions) {
    super('lr-event-select', detail, options);
  }
}

/**
 * Class of every `lr-example-add-request` event; `event instanceof LyraExampleAddRequestEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraExampleAddRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-example-add-request']>> {
  static override readonly eventName = 'lr-example-add-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-example-add-request']>, options?: LyraEventOptions) {
    super('lr-example-add-request', detail, options);
  }
}

/**
 * Class of every `lr-example-citation-open` event; `event instanceof LyraExampleCitationOpenEvent`
 * is true for the events components dispatch and narrows `detail`.
 */
export class LyraExampleCitationOpenEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-example-citation-open']>> {
  static override readonly eventName = 'lr-example-citation-open';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-example-citation-open']>, options?: LyraEventOptions) {
    super('lr-example-citation-open', detail, options);
  }
}

/**
 * Class of every `lr-example-citation-select` event; `event instanceof
 * LyraExampleCitationSelectEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraExampleCitationSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-example-citation-select']>> {
  static override readonly eventName = 'lr-example-citation-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-example-citation-select']>, options?: LyraEventOptions) {
    super('lr-example-citation-select', detail, options);
  }
}

/**
 * Class of every `lr-example-claim-select` event; `event instanceof LyraExampleClaimSelectEvent`
 * is true for the events components dispatch and narrows `detail`.
 */
export class LyraExampleClaimSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-example-claim-select']>> {
  static override readonly eventName = 'lr-example-claim-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-example-claim-select']>, options?: LyraEventOptions) {
    super('lr-example-claim-select', detail, options);
  }
}

/**
 * Class of every `lr-example-remove-request` event; `event instanceof
 * LyraExampleRemoveRequestEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraExampleRemoveRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-example-remove-request']>> {
  static override readonly eventName = 'lr-example-remove-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-example-remove-request']>, options?: LyraEventOptions) {
    super('lr-example-remove-request', detail, options);
  }
}

/**
 * Class of every `lr-example-select` event; `event instanceof LyraExampleSelectEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraExampleSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-example-select']>> {
  static override readonly eventName = 'lr-example-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-example-select']>, options?: LyraEventOptions) {
    super('lr-example-select', detail, options);
  }
}

/**
 * Class of every `lr-example-select-request` event; `event instanceof
 * LyraExampleSelectRequestEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraExampleSelectRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-example-select-request']>> {
  static override readonly eventName = 'lr-example-select-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-example-select-request']>, options?: LyraEventOptions) {
    super('lr-example-select-request', detail, options);
  }
}

/**
 * Class of every `lr-example-toggle` event; `event instanceof LyraExampleToggleEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraExampleToggleEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-example-toggle']>> {
  static override readonly eventName = 'lr-example-toggle';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-example-toggle']>, options?: LyraEventOptions) {
    super('lr-example-toggle', detail, options);
  }
}

/**
 * Class of every `lr-example-tool-activate` event; `event instanceof LyraExampleToolActivateEvent`
 * is true for the events components dispatch and narrows `detail`.
 */
export class LyraExampleToolActivateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-example-tool-activate']>> {
  static override readonly eventName = 'lr-example-tool-activate';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-example-tool-activate']>, options?: LyraEventOptions) {
    super('lr-example-tool-activate', detail, options);
  }
}

/**
 * Class of every `lr-example-tool-approval-decide-request` event; `event instanceof
 * LyraExampleToolApprovalDecideRequestEvent` is true for the events components dispatch and
 * narrows `detail`.
 */
export class LyraExampleToolApprovalDecideRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-example-tool-approval-decide-request']>> {
  static override readonly eventName = 'lr-example-tool-approval-decide-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-example-tool-approval-decide-request']>, options?: LyraEventOptions) {
    super('lr-example-tool-approval-decide-request', detail, options);
  }
}

/**
 * Class of every `lr-example-tool-render-error` event; `event instanceof
 * LyraExampleToolRenderErrorEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraExampleToolRenderErrorEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-example-tool-render-error']>> {
  static override readonly eventName = 'lr-example-tool-render-error';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-example-tool-render-error']>, options?: LyraEventOptions) {
    super('lr-example-tool-render-error', detail, options);
  }
}

/**
 * Class of every `lr-expand` event; `event instanceof LyraExpandEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraExpandEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-expand']>> {
  static override readonly eventName = 'lr-expand';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-expand']>, options?: LyraEventOptions) {
    super('lr-expand', detail, options);
  }
}

/**
 * Class of every `lr-export` event; `event instanceof LyraExportEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraExportEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-export']>> {
  static override readonly eventName = 'lr-export';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-export']>, options?: LyraEventOptions) {
    super('lr-export', detail, options);
  }
}

/**
 * Class of every `lr-export-complete` event; `event instanceof LyraExportCompleteEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraExportCompleteEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-export-complete']>> {
  static override readonly eventName = 'lr-export-complete';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-export-complete']>, options?: LyraEventOptions) {
    super('lr-export-complete', detail, options);
  }
}

/**
 * Class of every `lr-export-error` event; `event instanceof LyraExportErrorEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraExportErrorEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-export-error']>> {
  static override readonly eventName = 'lr-export-error';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-export-error']>, options?: LyraEventOptions) {
    super('lr-export-error', detail, options);
  }
}

/**
 * Class of every `lr-export-request` event; `event instanceof LyraExportRequestEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraExportRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-export-request']>> {
  static override readonly eventName = 'lr-export-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-export-request']>, options?: LyraEventOptions) {
    super('lr-export-request', detail, options);
  }
}

/**
 * Class of every `lr-feedback-change` event; `event instanceof LyraFeedbackChangeEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraFeedbackChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-feedback-change']>> {
  static override readonly eventName = 'lr-feedback-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-feedback-change']>, options?: LyraEventOptions) {
    super('lr-feedback-change', detail, options);
  }
}

/**
 * Class of every `lr-feedback-submit-request` event; `event instanceof
 * LyraFeedbackSubmitRequestEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraFeedbackSubmitRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-feedback-submit-request']>> {
  static override readonly eventName = 'lr-feedback-submit-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-feedback-submit-request']>, options?: LyraEventOptions) {
    super('lr-feedback-submit-request', detail, options);
  }
}

/**
 * Class of every `lr-file-open` event; `event instanceof LyraFileOpenEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraFileOpenEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-file-open']>> {
  static override readonly eventName = 'lr-file-open';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-file-open']>, options?: LyraEventOptions) {
    super('lr-file-open', detail, options);
  }
}

/**
 * Class of every `lr-file-select` event; `event instanceof LyraFileSelectEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraFileSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-file-select']>> {
  static override readonly eventName = 'lr-file-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-file-select']>, options?: LyraEventOptions) {
    super('lr-file-select', detail, options);
  }
}

/**
 * Class of every `lr-files` event; `event instanceof LyraFilesEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraFilesEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-files']>> {
  static override readonly eventName = 'lr-files';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-files']>, options?: LyraEventOptions) {
    super('lr-files', detail, options);
  }
}

/**
 * Class of every `lr-filter` event; `event instanceof LyraFilterEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraFilterEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-filter']>> {
  static override readonly eventName = 'lr-filter';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-filter']>, options?: LyraEventOptions) {
    super('lr-filter', detail, options);
  }
}

/**
 * Class of every `lr-filter-change` event; `event instanceof LyraFilterChangeEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraFilterChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-filter-change']>> {
  static override readonly eventName = 'lr-filter-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-filter-change']>, options?: LyraEventOptions) {
    super('lr-filter-change', detail, options);
  }
}

/**
 * Class of every `lr-filter-request` event; `event instanceof LyraFilterRequestEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraFilterRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-filter-request']>> {
  static override readonly eventName = 'lr-filter-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-filter-request']>, options?: LyraEventOptions) {
    super('lr-filter-request', detail, options);
  }
}

/**
 * Class of every `lr-filters-change` event; `event instanceof LyraFiltersChangeEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraFiltersChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-filters-change']>> {
  static override readonly eventName = 'lr-filters-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-filters-change']>, options?: LyraEventOptions) {
    super('lr-filters-change', detail, options);
  }
}

/**
 * Class of every `lr-finish` event; `event instanceof LyraFinishEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraFinishEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-finish']>> {
  static override readonly eventName = 'lr-finish';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-finish']>, options?: LyraEventOptions) {
    super('lr-finish', detail, options);
  }
}

/**
 * Class of every `lr-fit-change` event; `event instanceof LyraFitChangeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraFitChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-fit-change']>> {
  static override readonly eventName = 'lr-fit-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-fit-change']>, options?: LyraEventOptions) {
    super('lr-fit-change', detail, options);
  }
}

/**
 * Class of every `lr-focus-day` event; `event instanceof LyraFocusDayEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraFocusDayEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-focus-day']>> {
  static override readonly eventName = 'lr-focus-day';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-focus-day']>, options?: LyraEventOptions) {
    super('lr-focus-day', detail, options);
  }
}

/**
 * Class of every `lr-follow-change` event; `event instanceof LyraFollowChangeEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraFollowChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-follow-change']>> {
  static override readonly eventName = 'lr-follow-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-follow-change']>, options?: LyraEventOptions) {
    super('lr-follow-change', detail, options);
  }
}

/**
 * Class of every `lr-forget` event; `event instanceof LyraForgetEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraForgetEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-forget']>> {
  static override readonly eventName = 'lr-forget';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-forget']>, options?: LyraEventOptions) {
    super('lr-forget', detail, options);
  }
}

/**
 * Class of every `lr-frame-select` event; `event instanceof LyraFrameSelectEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraFrameSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-frame-select']>> {
  static override readonly eventName = 'lr-frame-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-frame-select']>, options?: LyraEventOptions) {
    super('lr-frame-select', detail, options);
  }
}

/**
 * Class of every `lr-fullscreen-change` event; `event instanceof LyraFullscreenChangeEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraFullscreenChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-fullscreen-change']>> {
  static override readonly eventName = 'lr-fullscreen-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-fullscreen-change']>, options?: LyraEventOptions) {
    super('lr-fullscreen-change', detail, options);
  }
}

/**
 * Class of every `lr-fullscreen-request` event; `event instanceof LyraFullscreenRequestEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraFullscreenRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-fullscreen-request']>> {
  static override readonly eventName = 'lr-fullscreen-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-fullscreen-request']>, options?: LyraEventOptions) {
    super('lr-fullscreen-request', detail, options);
  }
}

/**
 * Class of every `lr-graph-view-change` event; `event instanceof LyraGraphViewChangeEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraGraphViewChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-graph-view-change']>> {
  static override readonly eventName = 'lr-graph-view-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-graph-view-change']>, options?: LyraEventOptions) {
    super('lr-graph-view-change', detail, options);
  }
}

/**
 * Class of every `lr-group-collapse` event; `event instanceof LyraGroupCollapseEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraGroupCollapseEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-group-collapse']>> {
  static override readonly eventName = 'lr-group-collapse';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-group-collapse']>, options?: LyraEventOptions) {
    super('lr-group-collapse', detail, options);
  }
}

/**
 * Class of every `lr-group-expand` event; `event instanceof LyraGroupExpandEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraGroupExpandEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-group-expand']>> {
  static override readonly eventName = 'lr-group-expand';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-group-expand']>, options?: LyraEventOptions) {
    super('lr-group-expand', detail, options);
  }
}

/**
 * Class of every `lr-group-toggle` event; `event instanceof LyraGroupToggleEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraGroupToggleEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-group-toggle']>> {
  static override readonly eventName = 'lr-group-toggle';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-group-toggle']>, options?: LyraEventOptions) {
    super('lr-group-toggle', detail, options);
  }
}

/**
 * Class of every `lr-group-toggle-request` event; `event instanceof LyraGroupToggleRequestEvent`
 * is true for the events components dispatch and narrows `detail`.
 */
export class LyraGroupToggleRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-group-toggle-request']>> {
  static override readonly eventName = 'lr-group-toggle-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-group-toggle-request']>, options?: LyraEventOptions) {
    super('lr-group-toggle-request', detail, options);
  }
}

/**
 * Class of every `lr-hidden-types-change` event; `event instanceof LyraHiddenTypesChangeEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraHiddenTypesChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-hidden-types-change']>> {
  static override readonly eventName = 'lr-hidden-types-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-hidden-types-change']>, options?: LyraEventOptions) {
    super('lr-hidden-types-change', detail, options);
  }
}

/**
 * Class of every `lr-hidden-types-change-request` event; `event instanceof
 * LyraHiddenTypesChangeRequestEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraHiddenTypesChangeRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-hidden-types-change-request']>> {
  static override readonly eventName = 'lr-hidden-types-change-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-hidden-types-change-request']>, options?: LyraEventOptions) {
    super('lr-hidden-types-change-request', detail, options);
  }
}

/**
 * Class of every `lr-hide` event; `event instanceof LyraHideEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraHideEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-hide']>> {
  static override readonly eventName = 'lr-hide';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-hide']>, options?: LyraEventOptions) {
    super('lr-hide', detail, options);
  }
}

/**
 * Class of every `lr-highlight-activate` event; `event instanceof LyraHighlightActivateEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraHighlightActivateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-highlight-activate']>> {
  static override readonly eventName = 'lr-highlight-activate';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-highlight-activate']>, options?: LyraEventOptions) {
    super('lr-highlight-activate', detail, options);
  }
}

/**
 * Class of every `lr-hover` event; `event instanceof LyraHoverEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraHoverEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-hover']>> {
  static override readonly eventName = 'lr-hover';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-hover']>, options?: LyraEventOptions) {
    super('lr-hover', detail, options);
  }
}

/**
 * Class of every `lr-import-request` event; `event instanceof LyraImportRequestEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraImportRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-import-request']>> {
  static override readonly eventName = 'lr-import-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-import-request']>, options?: LyraEventOptions) {
    super('lr-import-request', detail, options);
  }
}

/**
 * Class of every `lr-include-error` event; `event instanceof LyraIncludeErrorEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraIncludeErrorEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-include-error']>> {
  static override readonly eventName = 'lr-include-error';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-include-error']>, options?: LyraEventOptions) {
    super('lr-include-error', detail, options);
  }
}

/**
 * Class of every `lr-index-change` event; `event instanceof LyraIndexChangeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraIndexChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-index-change']>> {
  static override readonly eventName = 'lr-index-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-index-change']>, options?: LyraEventOptions) {
    super('lr-index-change', detail, options);
  }
}

/**
 * Class of every `lr-ingestion-cancel` event; `event instanceof LyraIngestionCancelEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraIngestionCancelEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-ingestion-cancel']>> {
  static override readonly eventName = 'lr-ingestion-cancel';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-ingestion-cancel']>, options?: LyraEventOptions) {
    super('lr-ingestion-cancel', detail, options);
  }
}

/**
 * Class of every `lr-ingestion-retry` event; `event instanceof LyraIngestionRetryEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraIngestionRetryEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-ingestion-retry']>> {
  static override readonly eventName = 'lr-ingestion-retry';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-ingestion-retry']>, options?: LyraEventOptions) {
    super('lr-ingestion-retry', detail, options);
  }
}

/**
 * Class of every `lr-initial-focus` event; `event instanceof LyraInitialFocusEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraInitialFocusEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-initial-focus']>> {
  static override readonly eventName = 'lr-initial-focus';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-initial-focus']>, options?: LyraEventOptions) {
    super('lr-initial-focus', detail, options);
  }
}

/**
 * Class of every `lr-input` event; `event instanceof LyraInputEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraInputEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-input']>> {
  static override readonly eventName = 'lr-input';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-input']>, options?: LyraEventOptions) {
    super('lr-input', detail, options);
  }
}

/**
 * Class of every `lr-input-settled` event; `event instanceof LyraInputSettledEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraInputSettledEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-input-settled']>> {
  static override readonly eventName = 'lr-input-settled';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-input-settled']>, options?: LyraEventOptions) {
    super('lr-input-settled', detail, options);
  }
}

/**
 * Class of every `lr-interrupt` event; `event instanceof LyraInterruptEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraInterruptEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-interrupt']>> {
  static override readonly eventName = 'lr-interrupt';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-interrupt']>, options?: LyraEventOptions) {
    super('lr-interrupt', detail, options);
  }
}

/**
 * Class of every `lr-intersect` event; `event instanceof LyraIntersectEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraIntersectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-intersect']>> {
  static override readonly eventName = 'lr-intersect';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-intersect']>, options?: LyraEventOptions) {
    super('lr-intersect', detail, options);
  }
}

/**
 * Class of every `lr-intersection` event; `event instanceof LyraIntersectionEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraIntersectionEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-intersection']>> {
  static override readonly eventName = 'lr-intersection';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-intersection']>, options?: LyraEventOptions) {
    super('lr-intersection', detail, options);
  }
}

/**
 * Class of every `lr-invalid` event; `event instanceof LyraInvalidEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraInvalidEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-invalid']>> {
  static override readonly eventName = 'lr-invalid';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-invalid']>, options?: LyraEventOptions) {
    super('lr-invalid', detail, options);
  }
}

/**
 * Class of every `lr-item-action` event; `event instanceof LyraItemActionEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraItemActionEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-item-action']>> {
  static override readonly eventName = 'lr-item-action';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-item-action']>, options?: LyraEventOptions) {
    super('lr-item-action', detail, options);
  }
}

/**
 * Class of every `lr-item-activate` event; `event instanceof LyraItemActivateEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraItemActivateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-item-activate']>> {
  static override readonly eventName = 'lr-item-activate';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-item-activate']>, options?: LyraEventOptions) {
    super('lr-item-activate', detail, options);
  }
}

/**
 * Class of every `lr-item-change` event; `event instanceof LyraItemChangeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraItemChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-item-change']>> {
  static override readonly eventName = 'lr-item-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-item-change']>, options?: LyraEventOptions) {
    super('lr-item-change', detail, options);
  }
}

/**
 * Class of every `lr-layout-change` event; `event instanceof LyraLayoutChangeEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraLayoutChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-layout-change']>> {
  static override readonly eventName = 'lr-layout-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-layout-change']>, options?: LyraEventOptions) {
    super('lr-layout-change', detail, options);
  }
}

/**
 * Class of every `lr-lazy-change` event; `event instanceof LyraLazyChangeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraLazyChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-lazy-change']>> {
  static override readonly eventName = 'lr-lazy-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-lazy-change']>, options?: LyraEventOptions) {
    super('lr-lazy-change', detail, options);
  }
}

/**
 * Class of every `lr-lazy-load` event; `event instanceof LyraLazyLoadEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraLazyLoadEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-lazy-load']>> {
  static override readonly eventName = 'lr-lazy-load';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-lazy-load']>, options?: LyraEventOptions) {
    super('lr-lazy-load', detail, options);
  }
}

/**
 * Class of every `lr-legend-visibility-change` event; `event instanceof
 * LyraLegendVisibilityChangeEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraLegendVisibilityChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-legend-visibility-change']>> {
  static override readonly eventName = 'lr-legend-visibility-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-legend-visibility-change']>, options?: LyraEventOptions) {
    super('lr-legend-visibility-change', detail, options);
  }
}

/**
 * Class of every `lr-legend-visibility-change-request` event; `event instanceof
 * LyraLegendVisibilityChangeRequestEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraLegendVisibilityChangeRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-legend-visibility-change-request']>> {
  static override readonly eventName = 'lr-legend-visibility-change-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-legend-visibility-change-request']>, options?: LyraEventOptions) {
    super('lr-legend-visibility-change-request', detail, options);
  }
}

/**
 * Class of every `lr-level` event; `event instanceof LyraLevelEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraLevelEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-level']>> {
  static override readonly eventName = 'lr-level';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-level']>, options?: LyraEventOptions) {
    super('lr-level', detail, options);
  }
}

/**
 * Class of every `lr-line-activate` event; `event instanceof LyraLineActivateEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraLineActivateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-line-activate']>> {
  static override readonly eventName = 'lr-line-activate';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-line-activate']>, options?: LyraEventOptions) {
    super('lr-line-activate', detail, options);
  }
}

/**
 * Class of every `lr-link-activate` event; `event instanceof LyraLinkActivateEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraLinkActivateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-link-activate']>> {
  static override readonly eventName = 'lr-link-activate';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-link-activate']>, options?: LyraEventOptions) {
    super('lr-link-activate', detail, options);
  }
}

/**
 * Class of every `lr-load` event; `event instanceof LyraLoadEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraLoadEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-load']>> {
  static override readonly eventName = 'lr-load';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-load']>, options?: LyraEventOptions) {
    super('lr-load', detail, options);
  }
}

/**
 * Class of every `lr-load-children` event; `event instanceof LyraLoadChildrenEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraLoadChildrenEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-load-children']>> {
  static override readonly eventName = 'lr-load-children';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-load-children']>, options?: LyraEventOptions) {
    super('lr-load-children', detail, options);
  }
}

/**
 * Class of every `lr-load-error` event; `event instanceof LyraLoadErrorEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraLoadErrorEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-load-error']>> {
  static override readonly eventName = 'lr-load-error';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-load-error']>, options?: LyraEventOptions) {
    super('lr-load-error', detail, options);
  }
}

/**
 * Class of every `lr-load-more` event; `event instanceof LyraLoadMoreEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraLoadMoreEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-load-more']>> {
  static override readonly eventName = 'lr-load-more';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-load-more']>, options?: LyraEventOptions) {
    super('lr-load-more', detail, options);
  }
}

/**
 * Class of every `lr-location-change` event; `event instanceof LyraLocationChangeEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraLocationChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-location-change']>> {
  static override readonly eventName = 'lr-location-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-location-change']>, options?: LyraEventOptions) {
    super('lr-location-change', detail, options);
  }
}

/**
 * Class of every `lr-map-anchor-close` event; `event instanceof LyraMapAnchorCloseEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraMapAnchorCloseEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-anchor-close']>> {
  static override readonly eventName = 'lr-map-anchor-close';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-anchor-close']>, options?: LyraEventOptions) {
    super('lr-map-anchor-close', detail, options);
  }
}

/**
 * Class of every `lr-map-anchor-close-request` event; `event instanceof
 * LyraMapAnchorCloseRequestEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraMapAnchorCloseRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-anchor-close-request']>> {
  static override readonly eventName = 'lr-map-anchor-close-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-anchor-close-request']>, options?: LyraEventOptions) {
    super('lr-map-anchor-close-request', detail, options);
  }
}

/**
 * Class of every `lr-map-anchor-dismiss` event; `event instanceof LyraMapAnchorDismissEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraMapAnchorDismissEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-anchor-dismiss']>> {
  static override readonly eventName = 'lr-map-anchor-dismiss';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-anchor-dismiss']>, options?: LyraEventOptions) {
    super('lr-map-anchor-dismiss', detail, options);
  }
}

/**
 * Class of every `lr-map-anchor-dismiss-request` event; `event instanceof
 * LyraMapAnchorDismissRequestEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraMapAnchorDismissRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-anchor-dismiss-request']>> {
  static override readonly eventName = 'lr-map-anchor-dismiss-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-anchor-dismiss-request']>, options?: LyraEventOptions) {
    super('lr-map-anchor-dismiss-request', detail, options);
  }
}

/**
 * Class of every `lr-map-attribution-toggle` event; `event instanceof
 * LyraMapAttributionToggleEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraMapAttributionToggleEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-attribution-toggle']>> {
  static override readonly eventName = 'lr-map-attribution-toggle';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-attribution-toggle']>, options?: LyraEventOptions) {
    super('lr-map-attribution-toggle', detail, options);
  }
}

/**
 * Class of every `lr-map-camera-interrupt` event; `event instanceof LyraMapCameraInterruptEvent`
 * is true for the events components dispatch and narrows `detail`.
 */
export class LyraMapCameraInterruptEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-camera-interrupt']>> {
  static override readonly eventName = 'lr-map-camera-interrupt';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-camera-interrupt']>, options?: LyraEventOptions) {
    super('lr-map-camera-interrupt', detail, options);
  }
}

/**
 * Class of every `lr-map-click` event; `event instanceof LyraMapClickEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraMapClickEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-click']>> {
  static override readonly eventName = 'lr-map-click';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-click']>, options?: LyraEventOptions) {
    super('lr-map-click', detail, options);
  }
}

/**
 * Class of every `lr-map-contextmenu` event; `event instanceof LyraMapContextmenuEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraMapContextmenuEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-contextmenu']>> {
  static override readonly eventName = 'lr-map-contextmenu';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-contextmenu']>, options?: LyraEventOptions) {
    super('lr-map-contextmenu', detail, options);
  }
}

/**
 * Class of every `lr-map-draw-cancel` event; `event instanceof LyraMapDrawCancelEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraMapDrawCancelEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-draw-cancel']>> {
  static override readonly eventName = 'lr-map-draw-cancel';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-draw-cancel']>, options?: LyraEventOptions) {
    super('lr-map-draw-cancel', detail, options);
  }
}

/**
 * Class of every `lr-map-draw-change` event; `event instanceof LyraMapDrawChangeEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraMapDrawChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-draw-change']>> {
  static override readonly eventName = 'lr-map-draw-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-draw-change']>, options?: LyraEventOptions) {
    super('lr-map-draw-change', detail, options);
  }
}

/**
 * Class of every `lr-map-draw-complete` event; `event instanceof LyraMapDrawCompleteEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraMapDrawCompleteEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-draw-complete']>> {
  static override readonly eventName = 'lr-map-draw-complete';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-draw-complete']>, options?: LyraEventOptions) {
    super('lr-map-draw-complete', detail, options);
  }
}

/**
 * Class of every `lr-map-draw-start` event; `event instanceof LyraMapDrawStartEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraMapDrawStartEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-draw-start']>> {
  static override readonly eventName = 'lr-map-draw-start';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-draw-start']>, options?: LyraEventOptions) {
    super('lr-map-draw-start', detail, options);
  }
}

/**
 * Class of every `lr-map-draw-vertex-end` event; `event instanceof LyraMapDrawVertexEndEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraMapDrawVertexEndEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-draw-vertex-end']>> {
  static override readonly eventName = 'lr-map-draw-vertex-end';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-draw-vertex-end']>, options?: LyraEventOptions) {
    super('lr-map-draw-vertex-end', detail, options);
  }
}

/**
 * Class of every `lr-map-export-error` event; `event instanceof LyraMapExportErrorEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraMapExportErrorEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-export-error']>> {
  static override readonly eventName = 'lr-map-export-error';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-export-error']>, options?: LyraEventOptions) {
    super('lr-map-export-error', detail, options);
  }
}

/**
 * Class of every `lr-map-feature-enter` event; `event instanceof LyraMapFeatureEnterEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraMapFeatureEnterEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-feature-enter']>> {
  static override readonly eventName = 'lr-map-feature-enter';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-feature-enter']>, options?: LyraEventOptions) {
    super('lr-map-feature-enter', detail, options);
  }
}

/**
 * Class of every `lr-map-feature-leave` event; `event instanceof LyraMapFeatureLeaveEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraMapFeatureLeaveEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-feature-leave']>> {
  static override readonly eventName = 'lr-map-feature-leave';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-feature-leave']>, options?: LyraEventOptions) {
    super('lr-map-feature-leave', detail, options);
  }
}

/**
 * Class of every `lr-map-geolocate` event; `event instanceof LyraMapGeolocateEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraMapGeolocateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-geolocate']>> {
  static override readonly eventName = 'lr-map-geolocate';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-geolocate']>, options?: LyraEventOptions) {
    super('lr-map-geolocate', detail, options);
  }
}

/**
 * Class of every `lr-map-geolocate-error` event; `event instanceof LyraMapGeolocateErrorEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraMapGeolocateErrorEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-geolocate-error']>> {
  static override readonly eventName = 'lr-map-geolocate-error';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-geolocate-error']>, options?: LyraEventOptions) {
    super('lr-map-geolocate-error', detail, options);
  }
}

/**
 * Class of every `lr-map-geolocate-out-of-bounds` event; `event instanceof
 * LyraMapGeolocateOutOfBoundsEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraMapGeolocateOutOfBoundsEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-geolocate-out-of-bounds']>> {
  static override readonly eventName = 'lr-map-geolocate-out-of-bounds';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-geolocate-out-of-bounds']>, options?: LyraEventOptions) {
    super('lr-map-geolocate-out-of-bounds', detail, options);
  }
}

/**
 * Class of every `lr-map-idle` event; `event instanceof LyraMapIdleEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraMapIdleEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-idle']>> {
  static override readonly eventName = 'lr-map-idle';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-idle']>, options?: LyraEventOptions) {
    super('lr-map-idle', detail, options);
  }
}

/**
 * Class of every `lr-map-legend-panel-toggle-request` event; `event instanceof
 * LyraMapLegendPanelToggleRequestEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraMapLegendPanelToggleRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-legend-panel-toggle-request']>> {
  static override readonly eventName = 'lr-map-legend-panel-toggle-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-legend-panel-toggle-request']>, options?: LyraEventOptions) {
    super('lr-map-legend-panel-toggle-request', detail, options);
  }
}

/**
 * Class of every `lr-map-legend-toggle-request` event; `event instanceof
 * LyraMapLegendToggleRequestEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraMapLegendToggleRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-legend-toggle-request']>> {
  static override readonly eventName = 'lr-map-legend-toggle-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-legend-toggle-request']>, options?: LyraEventOptions) {
    super('lr-map-legend-toggle-request', detail, options);
  }
}

/**
 * Class of every `lr-map-load` event; `event instanceof LyraMapLoadEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraMapLoadEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-load']>> {
  static override readonly eventName = 'lr-map-load';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-load']>, options?: LyraEventOptions) {
    super('lr-map-load', detail, options);
  }
}

/**
 * Class of every `lr-map-marker-activate` event; `event instanceof LyraMapMarkerActivateEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraMapMarkerActivateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-marker-activate']>> {
  static override readonly eventName = 'lr-map-marker-activate';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-marker-activate']>, options?: LyraEventOptions) {
    super('lr-map-marker-activate', detail, options);
  }
}

/**
 * Class of every `lr-map-move` event; `event instanceof LyraMapMoveEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraMapMoveEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-move']>> {
  static override readonly eventName = 'lr-map-move';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-move']>, options?: LyraEventOptions) {
    super('lr-map-move', detail, options);
  }
}

/**
 * Class of every `lr-map-pick` event; `event instanceof LyraMapPickEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraMapPickEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-pick']>> {
  static override readonly eventName = 'lr-map-pick';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-pick']>, options?: LyraEventOptions) {
    super('lr-map-pick', detail, options);
  }
}

/**
 * Class of every `lr-map-pick-cancel` event; `event instanceof LyraMapPickCancelEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraMapPickCancelEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-pick-cancel']>> {
  static override readonly eventName = 'lr-map-pick-cancel';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-pick-cancel']>, options?: LyraEventOptions) {
    super('lr-map-pick-cancel', detail, options);
  }
}

/**
 * Class of every `lr-map-pick-cancel-request` event; `event instanceof
 * LyraMapPickCancelRequestEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraMapPickCancelRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-pick-cancel-request']>> {
  static override readonly eventName = 'lr-map-pick-cancel-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-pick-cancel-request']>, options?: LyraEventOptions) {
    super('lr-map-pick-cancel-request', detail, options);
  }
}

/**
 * Class of every `lr-map-pointer-leave` event; `event instanceof LyraMapPointerLeaveEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraMapPointerLeaveEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-pointer-leave']>> {
  static override readonly eventName = 'lr-map-pointer-leave';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-pointer-leave']>, options?: LyraEventOptions) {
    super('lr-map-pointer-leave', detail, options);
  }
}

/**
 * Class of every `lr-map-pointer-move` event; `event instanceof LyraMapPointerMoveEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraMapPointerMoveEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-pointer-move']>> {
  static override readonly eventName = 'lr-map-pointer-move';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-pointer-move']>, options?: LyraEventOptions) {
    super('lr-map-pointer-move', detail, options);
  }
}

/**
 * Class of every `lr-map-projection-change` event; `event instanceof LyraMapProjectionChangeEvent`
 * is true for the events components dispatch and narrows `detail`.
 */
export class LyraMapProjectionChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-projection-change']>> {
  static override readonly eventName = 'lr-map-projection-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-projection-change']>, options?: LyraEventOptions) {
    super('lr-map-projection-change', detail, options);
  }
}

/**
 * Class of every `lr-map-projection-change-request` event; `event instanceof
 * LyraMapProjectionChangeRequestEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraMapProjectionChangeRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-projection-change-request']>> {
  static override readonly eventName = 'lr-map-projection-change-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-projection-change-request']>, options?: LyraEventOptions) {
    super('lr-map-projection-change-request', detail, options);
  }
}

/**
 * Class of every `lr-map-scene-activate` event; `event instanceof LyraMapSceneActivateEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraMapSceneActivateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-scene-activate']>> {
  static override readonly eventName = 'lr-map-scene-activate';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-scene-activate']>, options?: LyraEventOptions) {
    super('lr-map-scene-activate', detail, options);
  }
}

/**
 * Class of every `lr-map-scene-state` event; `event instanceof LyraMapSceneStateEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraMapSceneStateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-scene-state']>> {
  static override readonly eventName = 'lr-map-scene-state';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-scene-state']>, options?: LyraEventOptions) {
    super('lr-map-scene-state', detail, options);
  }
}

/**
 * Class of every `lr-map-style-load` event; `event instanceof LyraMapStyleLoadEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraMapStyleLoadEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-style-load']>> {
  static override readonly eventName = 'lr-map-style-load';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-style-load']>, options?: LyraEventOptions) {
    super('lr-map-style-load', detail, options);
  }
}

/**
 * Class of every `lr-map-terrain-change` event; `event instanceof LyraMapTerrainChangeEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraMapTerrainChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-terrain-change']>> {
  static override readonly eventName = 'lr-map-terrain-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-terrain-change']>, options?: LyraEventOptions) {
    super('lr-map-terrain-change', detail, options);
  }
}

/**
 * Class of every `lr-map-terrain-change-request` event; `event instanceof
 * LyraMapTerrainChangeRequestEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraMapTerrainChangeRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-terrain-change-request']>> {
  static override readonly eventName = 'lr-map-terrain-change-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-terrain-change-request']>, options?: LyraEventOptions) {
    super('lr-map-terrain-change-request', detail, options);
  }
}

/**
 * Class of every `lr-map-view-change` event; `event instanceof LyraMapViewChangeEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraMapViewChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-map-view-change']>> {
  static override readonly eventName = 'lr-map-view-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-map-view-change']>, options?: LyraEventOptions) {
    super('lr-map-view-change', detail, options);
  }
}

/**
 * Class of every `lr-matrix-geometry-change` event; `event instanceof
 * LyraMatrixGeometryChangeEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraMatrixGeometryChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-matrix-geometry-change']>> {
  static override readonly eventName = 'lr-matrix-geometry-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-matrix-geometry-change']>, options?: LyraEventOptions) {
    super('lr-matrix-geometry-change', detail, options);
  }
}

/**
 * Class of every `lr-matrix-range-select` event; `event instanceof LyraMatrixRangeSelectEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraMatrixRangeSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-matrix-range-select']>> {
  static override readonly eventName = 'lr-matrix-range-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-matrix-range-select']>, options?: LyraEventOptions) {
    super('lr-matrix-range-select', detail, options);
  }
}

/**
 * Class of every `lr-maximize-change-request` event; `event instanceof
 * LyraMaximizeChangeRequestEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraMaximizeChangeRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-maximize-change-request']>> {
  static override readonly eventName = 'lr-maximize-change-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-maximize-change-request']>, options?: LyraEventOptions) {
    super('lr-maximize-change-request', detail, options);
  }
}

/**
 * Class of every `lr-mcp-initialized` event; `event instanceof LyraMcpInitializedEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraMcpInitializedEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-mcp-initialized']>> {
  static override readonly eventName = 'lr-mcp-initialized';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-mcp-initialized']>, options?: LyraEventOptions) {
    super('lr-mcp-initialized', detail, options);
  }
}

/**
 * Class of every `lr-mcp-log` event; `event instanceof LyraMcpLogEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraMcpLogEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-mcp-log']>> {
  static override readonly eventName = 'lr-mcp-log';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-mcp-log']>, options?: LyraEventOptions) {
    super('lr-mcp-log', detail, options);
  }
}

/**
 * Class of every `lr-mcp-open-link` event; `event instanceof LyraMcpOpenLinkEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraMcpOpenLinkEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-mcp-open-link']>> {
  static override readonly eventName = 'lr-mcp-open-link';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-mcp-open-link']>, options?: LyraEventOptions) {
    super('lr-mcp-open-link', detail, options);
  }
}

/**
 * Class of every `lr-mcp-ready` event; `event instanceof LyraMcpReadyEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraMcpReadyEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-mcp-ready']>> {
  static override readonly eventName = 'lr-mcp-ready';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-mcp-ready']>, options?: LyraEventOptions) {
    super('lr-mcp-ready', detail, options);
  }
}

/**
 * Class of every `lr-mcp-request` event; `event instanceof LyraMcpRequestEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraMcpRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-mcp-request']>> {
  static override readonly eventName = 'lr-mcp-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-mcp-request']>, options?: LyraEventOptions) {
    super('lr-mcp-request', detail, options);
  }
}

/**
 * Class of every `lr-mcp-resize` event; `event instanceof LyraMcpResizeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraMcpResizeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-mcp-resize']>> {
  static override readonly eventName = 'lr-mcp-resize';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-mcp-resize']>, options?: LyraEventOptions) {
    super('lr-mcp-resize', detail, options);
  }
}

/**
 * Class of every `lr-mcp-send-message` event; `event instanceof LyraMcpSendMessageEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraMcpSendMessageEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-mcp-send-message']>> {
  static override readonly eventName = 'lr-mcp-send-message';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-mcp-send-message']>, options?: LyraEventOptions) {
    super('lr-mcp-send-message', detail, options);
  }
}

/**
 * Class of every `lr-mcp-tool-call` event; `event instanceof LyraMcpToolCallEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraMcpToolCallEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-mcp-tool-call']>> {
  static override readonly eventName = 'lr-mcp-tool-call';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-mcp-tool-call']>, options?: LyraEventOptions) {
    super('lr-mcp-tool-call', detail, options);
  }
}

/**
 * Class of every `lr-media-download-request` event; `event instanceof
 * LyraMediaDownloadRequestEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraMediaDownloadRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-media-download-request']>> {
  static override readonly eventName = 'lr-media-download-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-media-download-request']>, options?: LyraEventOptions) {
    super('lr-media-download-request', detail, options);
  }
}

/**
 * Class of every `lr-media-open` event; `event instanceof LyraMediaOpenEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraMediaOpenEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-media-open']>> {
  static override readonly eventName = 'lr-media-open';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-media-open']>, options?: LyraEventOptions) {
    super('lr-media-open', detail, options);
  }
}

/**
 * Class of every `lr-mention-close` event; `event instanceof LyraMentionCloseEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraMentionCloseEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-mention-close']>> {
  static override readonly eventName = 'lr-mention-close';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-mention-close']>, options?: LyraEventOptions) {
    super('lr-mention-close', detail, options);
  }
}

/**
 * Class of every `lr-mention-select` event; `event instanceof LyraMentionSelectEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraMentionSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-mention-select']>> {
  static override readonly eventName = 'lr-mention-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-mention-select']>, options?: LyraEventOptions) {
    super('lr-mention-select', detail, options);
  }
}

/**
 * Class of every `lr-menu-item-change-request` event; `event instanceof
 * LyraMenuItemChangeRequestEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraMenuItemChangeRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-menu-item-change-request']>> {
  static override readonly eventName = 'lr-menu-item-change-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-menu-item-change-request']>, options?: LyraEventOptions) {
    super('lr-menu-item-change-request', detail, options);
  }
}

/**
 * Class of every `lr-menu-item-state-change` event; `event instanceof
 * LyraMenuItemStateChangeEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraMenuItemStateChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-menu-item-state-change']>> {
  static override readonly eventName = 'lr-menu-item-state-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-menu-item-state-change']>, options?: LyraEventOptions) {
    super('lr-menu-item-state-change', detail, options);
  }
}

/**
 * Class of every `lr-message-reorder-request` event; `event instanceof
 * LyraMessageReorderRequestEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraMessageReorderRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-message-reorder-request']>> {
  static override readonly eventName = 'lr-message-reorder-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-message-reorder-request']>, options?: LyraEventOptions) {
    super('lr-message-reorder-request', detail, options);
  }
}

/**
 * Class of every `lr-message-retry` event; `event instanceof LyraMessageRetryEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraMessageRetryEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-message-retry']>> {
  static override readonly eventName = 'lr-message-retry';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-message-retry']>, options?: LyraEventOptions) {
    super('lr-message-retry', detail, options);
  }
}

/**
 * Class of every `lr-metric-change-request` event; `event instanceof LyraMetricChangeRequestEvent`
 * is true for the events components dispatch and narrows `detail`.
 */
export class LyraMetricChangeRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-metric-change-request']>> {
  static override readonly eventName = 'lr-metric-change-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-metric-change-request']>, options?: LyraEventOptions) {
    super('lr-metric-change-request', detail, options);
  }
}

/**
 * Class of every `lr-mode-change` event; `event instanceof LyraModeChangeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraModeChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-mode-change']>> {
  static override readonly eventName = 'lr-mode-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-mode-change']>, options?: LyraEventOptions) {
    super('lr-mode-change', detail, options);
  }
}

/**
 * Class of every `lr-model-change` event; `event instanceof LyraModelChangeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraModelChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-model-change']>> {
  static override readonly eventName = 'lr-model-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-model-change']>, options?: LyraEventOptions) {
    super('lr-model-change', detail, options);
  }
}

/**
 * Class of every `lr-month-change` event; `event instanceof LyraMonthChangeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraMonthChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-month-change']>> {
  static override readonly eventName = 'lr-month-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-month-change']>, options?: LyraEventOptions) {
    super('lr-month-change', detail, options);
  }
}

/**
 * Class of every `lr-move-request` event; `event instanceof LyraMoveRequestEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraMoveRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-move-request']>> {
  static override readonly eventName = 'lr-move-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-move-request']>, options?: LyraEventOptions) {
    super('lr-move-request', detail, options);
  }
}

/**
 * Class of every `lr-multi-split-collapse-change` event; `event instanceof
 * LyraMultiSplitCollapseChangeEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraMultiSplitCollapseChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-multi-split-collapse-change']>> {
  static override readonly eventName = 'lr-multi-split-collapse-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-multi-split-collapse-change']>, options?: LyraEventOptions) {
    super('lr-multi-split-collapse-change', detail, options);
  }
}

/**
 * Class of every `lr-multi-split-constraints-invalid` event; `event instanceof
 * LyraMultiSplitConstraintsInvalidEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraMultiSplitConstraintsInvalidEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-multi-split-constraints-invalid']>> {
  static override readonly eventName = 'lr-multi-split-constraints-invalid';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-multi-split-constraints-invalid']>, options?: LyraEventOptions) {
    super('lr-multi-split-constraints-invalid', detail, options);
  }
}

/**
 * Class of every `lr-multi-split-orientation-change` event; `event instanceof
 * LyraMultiSplitOrientationChangeEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraMultiSplitOrientationChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-multi-split-orientation-change']>> {
  static override readonly eventName = 'lr-multi-split-orientation-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-multi-split-orientation-change']>, options?: LyraEventOptions) {
    super('lr-multi-split-orientation-change', detail, options);
  }
}

/**
 * Class of every `lr-multi-split-panel-collapse-change` event; `event instanceof
 * LyraMultiSplitPanelCollapseChangeEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraMultiSplitPanelCollapseChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-multi-split-panel-collapse-change']>> {
  static override readonly eventName = 'lr-multi-split-panel-collapse-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-multi-split-panel-collapse-change']>, options?: LyraEventOptions) {
    super('lr-multi-split-panel-collapse-change', detail, options);
  }
}

/**
 * Class of every `lr-mutation` event; `event instanceof LyraMutationEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraMutationEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-mutation']>> {
  static override readonly eventName = 'lr-mutation';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-mutation']>, options?: LyraEventOptions) {
    super('lr-mutation', detail, options);
  }
}

/**
 * Class of every `lr-mute-change` event; `event instanceof LyraMuteChangeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraMuteChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-mute-change']>> {
  static override readonly eventName = 'lr-mute-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-mute-change']>, options?: LyraEventOptions) {
    super('lr-mute-change', detail, options);
  }
}

/**
 * Class of every `lr-nav-open-change` event; `event instanceof LyraNavOpenChangeEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraNavOpenChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-nav-open-change']>> {
  static override readonly eventName = 'lr-nav-open-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-nav-open-change']>, options?: LyraEventOptions) {
    super('lr-nav-open-change', detail, options);
  }
}

/**
 * Class of every `lr-nav-toggle-request` event; `event instanceof LyraNavToggleRequestEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraNavToggleRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-nav-toggle-request']>> {
  static override readonly eventName = 'lr-nav-toggle-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-nav-toggle-request']>, options?: LyraEventOptions) {
    super('lr-nav-toggle-request', detail, options);
  }
}

/**
 * Class of every `lr-node-activate` event; `event instanceof LyraNodeActivateEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraNodeActivateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-node-activate']>> {
  static override readonly eventName = 'lr-node-activate';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-node-activate']>, options?: LyraEventOptions) {
    super('lr-node-activate', detail, options);
  }
}

/**
 * Class of every `lr-node-add` event; `event instanceof LyraNodeAddEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraNodeAddEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-node-add']>> {
  static override readonly eventName = 'lr-node-add';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-node-add']>, options?: LyraEventOptions) {
    super('lr-node-add', detail, options);
  }
}

/**
 * Class of every `lr-node-enter` event; `event instanceof LyraNodeEnterEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraNodeEnterEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-node-enter']>> {
  static override readonly eventName = 'lr-node-enter';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-node-enter']>, options?: LyraEventOptions) {
    super('lr-node-enter', detail, options);
  }
}

/**
 * Class of every `lr-node-expand` event; `event instanceof LyraNodeExpandEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraNodeExpandEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-node-expand']>> {
  static override readonly eventName = 'lr-node-expand';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-node-expand']>, options?: LyraEventOptions) {
    super('lr-node-expand', detail, options);
  }
}

/**
 * Class of every `lr-node-leave` event; `event instanceof LyraNodeLeaveEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraNodeLeaveEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-node-leave']>> {
  static override readonly eventName = 'lr-node-leave';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-node-leave']>, options?: LyraEventOptions) {
    super('lr-node-leave', detail, options);
  }
}

/**
 * Class of every `lr-node-move` event; `event instanceof LyraNodeMoveEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraNodeMoveEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-node-move']>> {
  static override readonly eventName = 'lr-node-move';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-node-move']>, options?: LyraEventOptions) {
    super('lr-node-move', detail, options);
  }
}

/**
 * Class of every `lr-node-render-error` event; `event instanceof LyraNodeRenderErrorEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraNodeRenderErrorEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-node-render-error']>> {
  static override readonly eventName = 'lr-node-render-error';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-node-render-error']>, options?: LyraEventOptions) {
    super('lr-node-render-error', detail, options);
  }
}

/**
 * Class of every `lr-node-select` event; `event instanceof LyraNodeSelectEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraNodeSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-node-select']>> {
  static override readonly eventName = 'lr-node-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-node-select']>, options?: LyraEventOptions) {
    super('lr-node-select', detail, options);
  }
}

/**
 * Class of every `lr-node-toggle` event; `event instanceof LyraNodeToggleEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraNodeToggleEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-node-toggle']>> {
  static override readonly eventName = 'lr-node-toggle';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-node-toggle']>, options?: LyraEventOptions) {
    super('lr-node-toggle', detail, options);
  }
}

/**
 * Class of every `lr-open` event; `event instanceof LyraOpenEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraOpenEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-open']>> {
  static override readonly eventName = 'lr-open';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-open']>, options?: LyraEventOptions) {
    super('lr-open', detail, options);
  }
}

/**
 * Class of every `lr-option-change` event; `event instanceof LyraOptionChangeEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraOptionChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-option-change']>> {
  static override readonly eventName = 'lr-option-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-option-change']>, options?: LyraEventOptions) {
    super('lr-option-change', detail, options);
  }
}

/**
 * Class of every `lr-options-error` event; `event instanceof LyraOptionsErrorEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraOptionsErrorEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-options-error']>> {
  static override readonly eventName = 'lr-options-error';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-options-error']>, options?: LyraEventOptions) {
    super('lr-options-error', detail, options);
  }
}

/**
 * Class of every `lr-options-request` event; `event instanceof LyraOptionsRequestEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraOptionsRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-options-request']>> {
  static override readonly eventName = 'lr-options-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-options-request']>, options?: LyraEventOptions) {
    super('lr-options-request', detail, options);
  }
}

/**
 * Class of every `lr-overflow` event; `event instanceof LyraOverflowEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraOverflowEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-overflow']>> {
  static override readonly eventName = 'lr-overflow';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-overflow']>, options?: LyraEventOptions) {
    super('lr-overflow', detail, options);
  }
}

/**
 * Class of every `lr-overflow-activate` event; `event instanceof LyraOverflowActivateEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraOverflowActivateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-overflow-activate']>> {
  static override readonly eventName = 'lr-overflow-activate';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-overflow-activate']>, options?: LyraEventOptions) {
    super('lr-overflow-activate', detail, options);
  }
}

/**
 * Class of every `lr-overflow-toggle` event; `event instanceof LyraOverflowToggleEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraOverflowToggleEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-overflow-toggle']>> {
  static override readonly eventName = 'lr-overflow-toggle';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-overflow-toggle']>, options?: LyraEventOptions) {
    super('lr-overflow-toggle', detail, options);
  }
}

/**
 * Class of every `lr-page-change` event; `event instanceof LyraPageChangeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraPageChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-page-change']>> {
  static override readonly eventName = 'lr-page-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-page-change']>, options?: LyraEventOptions) {
    super('lr-page-change', detail, options);
  }
}

/**
 * Class of every `lr-page-select` event; `event instanceof LyraPageSelectEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraPageSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-page-select']>> {
  static override readonly eventName = 'lr-page-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-page-select']>, options?: LyraEventOptions) {
    super('lr-page-select', detail, options);
  }
}

/**
 * Class of every `lr-page-size-change` event; `event instanceof LyraPageSizeChangeEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraPageSizeChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-page-size-change']>> {
  static override readonly eventName = 'lr-page-size-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-page-size-change']>, options?: LyraEventOptions) {
    super('lr-page-size-change', detail, options);
  }
}

/**
 * Class of every `lr-page-viewer-state-change` event; `event instanceof
 * LyraPageViewerStateChangeEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraPageViewerStateChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-page-viewer-state-change']>> {
  static override readonly eventName = 'lr-page-viewer-state-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-page-viewer-state-change']>, options?: LyraEventOptions) {
    super('lr-page-viewer-state-change', detail, options);
  }
}

/**
 * Class of every `lr-palette-place` event; `event instanceof LyraPalettePlaceEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraPalettePlaceEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-palette-place']>> {
  static override readonly eventName = 'lr-palette-place';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-palette-place']>, options?: LyraEventOptions) {
    super('lr-palette-place', detail, options);
  }
}

/**
 * Class of every `lr-panorama-camera-change` event; `event instanceof
 * LyraPanoramaCameraChangeEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraPanoramaCameraChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-panorama-camera-change']>> {
  static override readonly eventName = 'lr-panorama-camera-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-panorama-camera-change']>, options?: LyraEventOptions) {
    super('lr-panorama-camera-change', detail, options);
  }
}

/**
 * Class of every `lr-panorama-hotspot-select` event; `event instanceof
 * LyraPanoramaHotspotSelectEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraPanoramaHotspotSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-panorama-hotspot-select']>> {
  static override readonly eventName = 'lr-panorama-hotspot-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-panorama-hotspot-select']>, options?: LyraEventOptions) {
    super('lr-panorama-hotspot-select', detail, options);
  }
}

/**
 * Class of every `lr-part-resume` event; `event instanceof LyraPartResumeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraPartResumeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-part-resume']>> {
  static override readonly eventName = 'lr-part-resume';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-part-resume']>, options?: LyraEventOptions) {
    super('lr-part-resume', detail, options);
  }
}

/**
 * Class of every `lr-part-retry` event; `event instanceof LyraPartRetryEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraPartRetryEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-part-retry']>> {
  static override readonly eventName = 'lr-part-retry';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-part-retry']>, options?: LyraEventOptions) {
    super('lr-part-retry', detail, options);
  }
}

/**
 * Class of every `lr-path-request` event; `event instanceof LyraPathRequestEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraPathRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-path-request']>> {
  static override readonly eventName = 'lr-path-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-path-request']>, options?: LyraEventOptions) {
    super('lr-path-request', detail, options);
  }
}

/**
 * Class of every `lr-pause` event; `event instanceof LyraPauseEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraPauseEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-pause']>> {
  static override readonly eventName = 'lr-pause';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-pause']>, options?: LyraEventOptions) {
    super('lr-pause', detail, options);
  }
}

/**
 * Class of every `lr-pause-change` event; `event instanceof LyraPauseChangeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraPauseChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-pause-change']>> {
  static override readonly eventName = 'lr-pause-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-pause-change']>, options?: LyraEventOptions) {
    super('lr-pause-change', detail, options);
  }
}

/**
 * Class of every `lr-peek-change` event; `event instanceof LyraPeekChangeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraPeekChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-peek-change']>> {
  static override readonly eventName = 'lr-peek-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-peek-change']>, options?: LyraEventOptions) {
    super('lr-peek-change', detail, options);
  }
}

/**
 * Class of every `lr-permission-decision` event; `event instanceof LyraPermissionDecisionEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraPermissionDecisionEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-permission-decision']>> {
  static override readonly eventName = 'lr-permission-decision';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-permission-decision']>, options?: LyraEventOptions) {
    super('lr-permission-decision', detail, options);
  }
}

/**
 * Class of every `lr-permission-rule-change` event; `event instanceof
 * LyraPermissionRuleChangeEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraPermissionRuleChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-permission-rule-change']>> {
  static override readonly eventName = 'lr-permission-rule-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-permission-rule-change']>, options?: LyraEventOptions) {
    super('lr-permission-rule-change', detail, options);
  }
}

/**
 * Class of every `lr-permission-rule-change-request` event; `event instanceof
 * LyraPermissionRuleChangeRequestEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraPermissionRuleChangeRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-permission-rule-change-request']>> {
  static override readonly eventName = 'lr-permission-rule-change-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-permission-rule-change-request']>, options?: LyraEventOptions) {
    super('lr-permission-rule-change-request', detail, options);
  }
}

/**
 * Class of every `lr-pin-change` event; `event instanceof LyraPinChangeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraPinChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-pin-change']>> {
  static override readonly eventName = 'lr-pin-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-pin-change']>, options?: LyraEventOptions) {
    super('lr-pin-change', detail, options);
  }
}

/**
 * Class of every `lr-pin-change-request` event; `event instanceof LyraPinChangeRequestEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraPinChangeRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-pin-change-request']>> {
  static override readonly eventName = 'lr-pin-change-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-pin-change-request']>, options?: LyraEventOptions) {
    super('lr-pin-change-request', detail, options);
  }
}

/**
 * Class of every `lr-play` event; `event instanceof LyraPlayEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraPlayEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-play']>> {
  static override readonly eventName = 'lr-play';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-play']>, options?: LyraEventOptions) {
    super('lr-play', detail, options);
  }
}

/**
 * Class of every `lr-point-activate` event; `event instanceof LyraPointActivateEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraPointActivateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-point-activate']>> {
  static override readonly eventName = 'lr-point-activate';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-point-activate']>, options?: LyraEventOptions) {
    super('lr-point-activate', detail, options);
  }
}

/**
 * Class of every `lr-point-select` event; `event instanceof LyraPointSelectEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraPointSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-point-select']>> {
  static override readonly eventName = 'lr-point-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-point-select']>, options?: LyraEventOptions) {
    super('lr-point-select', detail, options);
  }
}

/**
 * Class of every `lr-pointer-reorder` event; `event instanceof LyraPointerReorderEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraPointerReorderEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-pointer-reorder']>> {
  static override readonly eventName = 'lr-pointer-reorder';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-pointer-reorder']>, options?: LyraEventOptions) {
    super('lr-pointer-reorder', detail, options);
  }
}

/**
 * Class of every `lr-poll-due` event; `event instanceof LyraPollDueEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraPollDueEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-poll-due']>> {
  static override readonly eventName = 'lr-poll-due';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-poll-due']>, options?: LyraEventOptions) {
    super('lr-poll-due', detail, options);
  }
}

/**
 * Class of every `lr-preview-change` event; `event instanceof LyraPreviewChangeEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraPreviewChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-preview-change']>> {
  static override readonly eventName = 'lr-preview-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-preview-change']>, options?: LyraEventOptions) {
    super('lr-preview-change', detail, options);
  }
}

/**
 * Class of every `lr-preview-request` event; `event instanceof LyraPreviewRequestEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraPreviewRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-preview-request']>> {
  static override readonly eventName = 'lr-preview-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-preview-request']>, options?: LyraEventOptions) {
    super('lr-preview-request', detail, options);
  }
}

/**
 * Class of every `lr-priority-columns-visibility-change` event; `event instanceof
 * LyraPriorityColumnsVisibilityChangeEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraPriorityColumnsVisibilityChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-priority-columns-visibility-change']>> {
  static override readonly eventName = 'lr-priority-columns-visibility-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-priority-columns-visibility-change']>, options?: LyraEventOptions) {
    super('lr-priority-columns-visibility-change', detail, options);
  }
}

/**
 * Class of every `lr-query-change` event; `event instanceof LyraQueryChangeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraQueryChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-query-change']>> {
  static override readonly eventName = 'lr-query-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-query-change']>, options?: LyraEventOptions) {
    super('lr-query-change', detail, options);
  }
}

/**
 * Class of every `lr-query-delete` event; `event instanceof LyraQueryDeleteEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraQueryDeleteEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-query-delete']>> {
  static override readonly eventName = 'lr-query-delete';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-query-delete']>, options?: LyraEventOptions) {
    super('lr-query-delete', detail, options);
  }
}

/**
 * Class of every `lr-query-delete-request` event; `event instanceof LyraQueryDeleteRequestEvent`
 * is true for the events components dispatch and narrows `detail`.
 */
export class LyraQueryDeleteRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-query-delete-request']>> {
  static override readonly eventName = 'lr-query-delete-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-query-delete-request']>, options?: LyraEventOptions) {
    super('lr-query-delete-request', detail, options);
  }
}

/**
 * Class of every `lr-query-load` event; `event instanceof LyraQueryLoadEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraQueryLoadEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-query-load']>> {
  static override readonly eventName = 'lr-query-load';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-query-load']>, options?: LyraEventOptions) {
    super('lr-query-load', detail, options);
  }
}

/**
 * Class of every `lr-query-load-request` event; `event instanceof LyraQueryLoadRequestEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraQueryLoadRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-query-load-request']>> {
  static override readonly eventName = 'lr-query-load-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-query-load-request']>, options?: LyraEventOptions) {
    super('lr-query-load-request', detail, options);
  }
}

/**
 * Class of every `lr-query-run` event; `event instanceof LyraQueryRunEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraQueryRunEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-query-run']>> {
  static override readonly eventName = 'lr-query-run';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-query-run']>, options?: LyraEventOptions) {
    super('lr-query-run', detail, options);
  }
}

/**
 * Class of every `lr-query-run-request` event; `event instanceof LyraQueryRunRequestEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraQueryRunRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-query-run-request']>> {
  static override readonly eventName = 'lr-query-run-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-query-run-request']>, options?: LyraEventOptions) {
    super('lr-query-run-request', detail, options);
  }
}

/**
 * Class of every `lr-query-save` event; `event instanceof LyraQuerySaveEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraQuerySaveEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-query-save']>> {
  static override readonly eventName = 'lr-query-save';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-query-save']>, options?: LyraEventOptions) {
    super('lr-query-save', detail, options);
  }
}

/**
 * Class of every `lr-query-save-request` event; `event instanceof LyraQuerySaveRequestEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraQuerySaveRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-query-save-request']>> {
  static override readonly eventName = 'lr-query-save-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-query-save-request']>, options?: LyraEventOptions) {
    super('lr-query-save-request', detail, options);
  }
}

/**
 * Class of every `lr-question-input` event; `event instanceof LyraQuestionInputEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraQuestionInputEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-question-input']>> {
  static override readonly eventName = 'lr-question-input';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-question-input']>, options?: LyraEventOptions) {
    super('lr-question-input', detail, options);
  }
}

/**
 * Class of every `lr-question-response` event; `event instanceof LyraQuestionResponseEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraQuestionResponseEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-question-response']>> {
  static override readonly eventName = 'lr-question-response';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-question-response']>, options?: LyraEventOptions) {
    super('lr-question-response', detail, options);
  }
}

/**
 * Class of every `lr-queue-change` event; `event instanceof LyraQueueChangeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraQueueChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-queue-change']>> {
  static override readonly eventName = 'lr-queue-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-queue-change']>, options?: LyraEventOptions) {
    super('lr-queue-change', detail, options);
  }
}

/**
 * Class of every `lr-radio-select-request` event; `event instanceof LyraRadioSelectRequestEvent`
 * is true for the events components dispatch and narrows `detail`.
 */
export class LyraRadioSelectRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-radio-select-request']>> {
  static override readonly eventName = 'lr-radio-select-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-radio-select-request']>, options?: LyraEventOptions) {
    super('lr-radio-select-request', detail, options);
  }
}

/**
 * Class of every `lr-rail-resize` event; `event instanceof LyraRailResizeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraRailResizeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-rail-resize']>> {
  static override readonly eventName = 'lr-rail-resize';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-rail-resize']>, options?: LyraEventOptions) {
    super('lr-rail-resize', detail, options);
  }
}

/**
 * Class of every `lr-rail-resize-request` event; `event instanceof LyraRailResizeRequestEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraRailResizeRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-rail-resize-request']>> {
  static override readonly eventName = 'lr-rail-resize-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-rail-resize-request']>, options?: LyraEventOptions) {
    super('lr-rail-resize-request', detail, options);
  }
}

/**
 * Class of every `lr-rate-change` event; `event instanceof LyraRateChangeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraRateChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-rate-change']>> {
  static override readonly eventName = 'lr-rate-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-rate-change']>, options?: LyraEventOptions) {
    super('lr-rate-change', detail, options);
  }
}

/**
 * Class of every `lr-readonly-change` event; `event instanceof LyraReadonlyChangeEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraReadonlyChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-readonly-change']>> {
  static override readonly eventName = 'lr-readonly-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-readonly-change']>, options?: LyraEventOptions) {
    super('lr-readonly-change', detail, options);
  }
}

/**
 * Class of every `lr-record-cancel` event; `event instanceof LyraRecordCancelEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraRecordCancelEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-record-cancel']>> {
  static override readonly eventName = 'lr-record-cancel';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-record-cancel']>, options?: LyraEventOptions) {
    super('lr-record-cancel', detail, options);
  }
}

/**
 * Class of every `lr-record-chunk` event; `event instanceof LyraRecordChunkEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraRecordChunkEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-record-chunk']>> {
  static override readonly eventName = 'lr-record-chunk';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-record-chunk']>, options?: LyraEventOptions) {
    super('lr-record-chunk', detail, options);
  }
}

/**
 * Class of every `lr-record-error` event; `event instanceof LyraRecordErrorEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraRecordErrorEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-record-error']>> {
  static override readonly eventName = 'lr-record-error';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-record-error']>, options?: LyraEventOptions) {
    super('lr-record-error', detail, options);
  }
}

/**
 * Class of every `lr-record-start` event; `event instanceof LyraRecordStartEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraRecordStartEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-record-start']>> {
  static override readonly eventName = 'lr-record-start';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-record-start']>, options?: LyraEventOptions) {
    super('lr-record-start', detail, options);
  }
}

/**
 * Class of every `lr-record-state-change` event; `event instanceof LyraRecordStateChangeEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraRecordStateChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-record-state-change']>> {
  static override readonly eventName = 'lr-record-state-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-record-state-change']>, options?: LyraEventOptions) {
    super('lr-record-state-change', detail, options);
  }
}

/**
 * Class of every `lr-record-stop` event; `event instanceof LyraRecordStopEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraRecordStopEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-record-stop']>> {
  static override readonly eventName = 'lr-record-stop';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-record-stop']>, options?: LyraEventOptions) {
    super('lr-record-stop', detail, options);
  }
}

/**
 * Class of every `lr-recover` event; `event instanceof LyraRecoverEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraRecoverEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-recover']>> {
  static override readonly eventName = 'lr-recover';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-recover']>, options?: LyraEventOptions) {
    super('lr-recover', detail, options);
  }
}

/**
 * Class of every `lr-regenerate` event; `event instanceof LyraRegenerateEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraRegenerateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-regenerate']>> {
  static override readonly eventName = 'lr-regenerate';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-regenerate']>, options?: LyraEventOptions) {
    super('lr-regenerate', detail, options);
  }
}

/**
 * Class of every `lr-relation-activate` event; `event instanceof LyraRelationActivateEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraRelationActivateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-relation-activate']>> {
  static override readonly eventName = 'lr-relation-activate';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-relation-activate']>, options?: LyraEventOptions) {
    super('lr-relation-activate', detail, options);
  }
}

/**
 * Class of every `lr-remove` event; `event instanceof LyraRemoveEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraRemoveEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-remove']>> {
  static override readonly eventName = 'lr-remove';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-remove']>, options?: LyraEventOptions) {
    super('lr-remove', detail, options);
  }
}

/**
 * Class of every `lr-remove-condition` event; `event instanceof LyraRemoveConditionEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraRemoveConditionEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-remove-condition']>> {
  static override readonly eventName = 'lr-remove-condition';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-remove-condition']>, options?: LyraEventOptions) {
    super('lr-remove-condition', detail, options);
  }
}

/**
 * Class of every `lr-rename` event; `event instanceof LyraRenameEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraRenameEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-rename']>> {
  static override readonly eventName = 'lr-rename';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-rename']>, options?: LyraEventOptions) {
    super('lr-rename', detail, options);
  }
}

/**
 * Class of every `lr-render-error` event; `event instanceof LyraRenderErrorEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraRenderErrorEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-render-error']>> {
  static override readonly eventName = 'lr-render-error';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-render-error']>, options?: LyraEventOptions) {
    super('lr-render-error', detail, options);
  }
}

/**
 * Class of every `lr-reorder` event; `event instanceof LyraReorderEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraReorderEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-reorder']>> {
  static override readonly eventName = 'lr-reorder';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-reorder']>, options?: LyraEventOptions) {
    super('lr-reorder', detail, options);
  }
}

/**
 * Class of every `lr-reorder-request` event; `event instanceof LyraReorderRequestEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraReorderRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-reorder-request']>> {
  static override readonly eventName = 'lr-reorder-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-reorder-request']>, options?: LyraEventOptions) {
    super('lr-reorder-request', detail, options);
  }
}

/**
 * Class of every `lr-reposition` event; `event instanceof LyraRepositionEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraRepositionEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-reposition']>> {
  static override readonly eventName = 'lr-reposition';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-reposition']>, options?: LyraEventOptions) {
    super('lr-reposition', detail, options);
  }
}

/**
 * Class of every `lr-reposition-request` event; `event instanceof LyraRepositionRequestEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraRepositionRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-reposition-request']>> {
  static override readonly eventName = 'lr-reposition-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-reposition-request']>, options?: LyraEventOptions) {
    super('lr-reposition-request', detail, options);
  }
}

/**
 * Class of every `lr-request` event; `event instanceof LyraRequestEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-request']>> {
  static override readonly eventName = 'lr-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-request']>, options?: LyraEventOptions) {
    super('lr-request', detail, options);
  }
}

/**
 * Class of every `lr-request-close` event; `event instanceof LyraRequestCloseEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraRequestCloseEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-request-close']>> {
  static override readonly eventName = 'lr-request-close';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-request-close']>, options?: LyraEventOptions) {
    super('lr-request-close', detail, options);
  }
}

/**
 * Class of every `lr-reset` event; `event instanceof LyraResetEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraResetEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-reset']>> {
  static override readonly eventName = 'lr-reset';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-reset']>, options?: LyraEventOptions) {
    super('lr-reset', detail, options);
  }
}

/**
 * Class of every `lr-resize` event; `event instanceof LyraResizeEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraResizeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-resize']>> {
  static override readonly eventName = 'lr-resize';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-resize']>, options?: LyraEventOptions) {
    super('lr-resize', detail, options);
  }
}

/**
 * Class of every `lr-resize-change` event; `event instanceof LyraResizeChangeEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraResizeChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-resize-change']>> {
  static override readonly eventName = 'lr-resize-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-resize-change']>, options?: LyraEventOptions) {
    super('lr-resize-change', detail, options);
  }
}

/**
 * Class of every `lr-resize-input` event; `event instanceof LyraResizeInputEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraResizeInputEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-resize-input']>> {
  static override readonly eventName = 'lr-resize-input';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-resize-input']>, options?: LyraEventOptions) {
    super('lr-resize-input', detail, options);
  }
}

/**
 * Class of every `lr-resize-request` event; `event instanceof LyraResizeRequestEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraResizeRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-resize-request']>> {
  static override readonly eventName = 'lr-resize-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-resize-request']>, options?: LyraEventOptions) {
    super('lr-resize-request', detail, options);
  }
}

/**
 * Class of every `lr-restore` event; `event instanceof LyraRestoreEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraRestoreEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-restore']>> {
  static override readonly eventName = 'lr-restore';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-restore']>, options?: LyraEventOptions) {
    super('lr-restore', detail, options);
  }
}

/**
 * Class of every `lr-resume` event; `event instanceof LyraResumeEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraResumeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-resume']>> {
  static override readonly eventName = 'lr-resume';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-resume']>, options?: LyraEventOptions) {
    super('lr-resume', detail, options);
  }
}

/**
 * Class of every `lr-retrieval-disclosure-change` event; `event instanceof
 * LyraRetrievalDisclosureChangeEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraRetrievalDisclosureChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-retrieval-disclosure-change']>> {
  static override readonly eventName = 'lr-retrieval-disclosure-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-retrieval-disclosure-change']>, options?: LyraEventOptions) {
    super('lr-retrieval-disclosure-change', detail, options);
  }
}

/**
 * Class of every `lr-retrieval-select` event; `event instanceof LyraRetrievalSelectEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraRetrievalSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-retrieval-select']>> {
  static override readonly eventName = 'lr-retrieval-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-retrieval-select']>, options?: LyraEventOptions) {
    super('lr-retrieval-select', detail, options);
  }
}

/**
 * Class of every `lr-retry` event; `event instanceof LyraRetryEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraRetryEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-retry']>> {
  static override readonly eventName = 'lr-retry';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-retry']>, options?: LyraEventOptions) {
    super('lr-retry', detail, options);
  }
}

/**
 * Class of every `lr-retry-request` event; `event instanceof LyraRetryRequestEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraRetryRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-retry-request']>> {
  static override readonly eventName = 'lr-retry-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-retry-request']>, options?: LyraEventOptions) {
    super('lr-retry-request', detail, options);
  }
}

/**
 * Class of every `lr-reveal-change` event; `event instanceof LyraRevealChangeEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraRevealChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-reveal-change']>> {
  static override readonly eventName = 'lr-reveal-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-reveal-change']>, options?: LyraEventOptions) {
    super('lr-reveal-change', detail, options);
  }
}

/**
 * Class of every `lr-review-input` event; `event instanceof LyraReviewInputEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraReviewInputEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-review-input']>> {
  static override readonly eventName = 'lr-review-input';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-review-input']>, options?: LyraEventOptions) {
    super('lr-review-input', detail, options);
  }
}

/**
 * Class of every `lr-review-skip` event; `event instanceof LyraReviewSkipEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraReviewSkipEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-review-skip']>> {
  static override readonly eventName = 'lr-review-skip';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-review-skip']>, options?: LyraEventOptions) {
    super('lr-review-skip', detail, options);
  }
}

/**
 * Class of every `lr-review-submit` event; `event instanceof LyraReviewSubmitEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraReviewSubmitEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-review-submit']>> {
  static override readonly eventName = 'lr-review-submit';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-review-submit']>, options?: LyraEventOptions) {
    super('lr-review-submit', detail, options);
  }
}

/**
 * Class of every `lr-review-validity-change` event; `event instanceof
 * LyraReviewValidityChangeEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraReviewValidityChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-review-validity-change']>> {
  static override readonly eventName = 'lr-review-validity-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-review-validity-change']>, options?: LyraEventOptions) {
    super('lr-review-validity-change', detail, options);
  }
}

/**
 * Class of every `lr-rotation-change` event; `event instanceof LyraRotationChangeEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraRotationChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-rotation-change']>> {
  static override readonly eventName = 'lr-rotation-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-rotation-change']>, options?: LyraEventOptions) {
    super('lr-rotation-change', detail, options);
  }
}

/**
 * Class of every `lr-row-activate` event; `event instanceof LyraRowActivateEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraRowActivateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-row-activate']>> {
  static override readonly eventName = 'lr-row-activate';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-row-activate']>, options?: LyraEventOptions) {
    super('lr-row-activate', detail, options);
  }
}

/**
 * Class of every `lr-row-collapse` event; `event instanceof LyraRowCollapseEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraRowCollapseEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-row-collapse']>> {
  static override readonly eventName = 'lr-row-collapse';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-row-collapse']>, options?: LyraEventOptions) {
    super('lr-row-collapse', detail, options);
  }
}

/**
 * Class of every `lr-row-expand` event; `event instanceof LyraRowExpandEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraRowExpandEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-row-expand']>> {
  static override readonly eventName = 'lr-row-expand';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-row-expand']>, options?: LyraEventOptions) {
    super('lr-row-expand', detail, options);
  }
}

/**
 * Class of every `lr-row-expand-request` event; `event instanceof LyraRowExpandRequestEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraRowExpandRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-row-expand-request']>> {
  static override readonly eventName = 'lr-row-expand-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-row-expand-request']>, options?: LyraEventOptions) {
    super('lr-row-expand-request', detail, options);
  }
}

/**
 * Class of every `lr-row-expand-toggle` event; `event instanceof LyraRowExpandToggleEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraRowExpandToggleEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-row-expand-toggle']>> {
  static override readonly eventName = 'lr-row-expand-toggle';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-row-expand-toggle']>, options?: LyraEventOptions) {
    super('lr-row-expand-toggle', detail, options);
  }
}

/**
 * Class of every `lr-row-select` event; `event instanceof LyraRowSelectEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraRowSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-row-select']>> {
  static override readonly eventName = 'lr-row-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-row-select']>, options?: LyraEventOptions) {
    super('lr-row-select', detail, options);
  }
}

/**
 * Class of every `lr-row-select-request` event; `event instanceof LyraRowSelectRequestEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraRowSelectRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-row-select-request']>> {
  static override readonly eventName = 'lr-row-select-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-row-select-request']>, options?: LyraEventOptions) {
    super('lr-row-select-request', detail, options);
  }
}

/**
 * Class of every `lr-run` event; `event instanceof LyraRunEvent` is true for the events components
 * dispatch and narrows `detail`.
 */
export class LyraRunEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-run']>> {
  static override readonly eventName = 'lr-run';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-run']>, options?: LyraEventOptions) {
    super('lr-run', detail, options);
  }
}

/**
 * Class of every `lr-run-activate` event; `event instanceof LyraRunActivateEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraRunActivateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-run-activate']>> {
  static override readonly eventName = 'lr-run-activate';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-run-activate']>, options?: LyraEventOptions) {
    super('lr-run-activate', detail, options);
  }
}

/**
 * Class of every `lr-run-cancel` event; `event instanceof LyraRunCancelEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraRunCancelEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-run-cancel']>> {
  static override readonly eventName = 'lr-run-cancel';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-run-cancel']>, options?: LyraEventOptions) {
    super('lr-run-cancel', detail, options);
  }
}

/**
 * Class of every `lr-run-retry` event; `event instanceof LyraRunRetryEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraRunRetryEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-run-retry']>> {
  static override readonly eventName = 'lr-run-retry';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-run-retry']>, options?: LyraEventOptions) {
    super('lr-run-retry', detail, options);
  }
}

/**
 * Class of every `lr-save` event; `event instanceof LyraSaveEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraSaveEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-save']>> {
  static override readonly eventName = 'lr-save';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-save']>, options?: LyraEventOptions) {
    super('lr-save', detail, options);
  }
}

/**
 * Class of every `lr-schema-select` event; `event instanceof LyraSchemaSelectEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraSchemaSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-schema-select']>> {
  static override readonly eventName = 'lr-schema-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-schema-select']>, options?: LyraEventOptions) {
    super('lr-schema-select', detail, options);
  }
}

/**
 * Class of every `lr-scroll` event; `event instanceof LyraScrollEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraScrollEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-scroll']>> {
  static override readonly eventName = 'lr-scroll';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-scroll']>, options?: LyraEventOptions) {
    super('lr-scroll', detail, options);
  }
}

/**
 * Class of every `lr-search` event; `event instanceof LyraSearchEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraSearchEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-search']>> {
  static override readonly eventName = 'lr-search';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-search']>, options?: LyraEventOptions) {
    super('lr-search', detail, options);
  }
}

/**
 * Class of every `lr-search-change` event; `event instanceof LyraSearchChangeEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraSearchChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-search-change']>> {
  static override readonly eventName = 'lr-search-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-search-change']>, options?: LyraEventOptions) {
    super('lr-search-change', detail, options);
  }
}

/**
 * Class of every `lr-segment-activate-request` event; `event instanceof
 * LyraSegmentActivateRequestEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraSegmentActivateRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-segment-activate-request']>> {
  static override readonly eventName = 'lr-segment-activate-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-segment-activate-request']>, options?: LyraEventOptions) {
    super('lr-segment-activate-request', detail, options);
  }
}

/**
 * Class of every `lr-segment-selection-change` event; `event instanceof
 * LyraSegmentSelectionChangeEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraSegmentSelectionChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-segment-selection-change']>> {
  static override readonly eventName = 'lr-segment-selection-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-segment-selection-change']>, options?: LyraEventOptions) {
    super('lr-segment-selection-change', detail, options);
  }
}

/**
 * Class of every `lr-select` event; `event instanceof LyraSelectEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-select']>> {
  static override readonly eventName = 'lr-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-select']>, options?: LyraEventOptions) {
    super('lr-select', detail, options);
  }
}

/**
 * Class of every `lr-selection-action` event; `event instanceof LyraSelectionActionEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraSelectionActionEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-selection-action']>> {
  static override readonly eventName = 'lr-selection-action';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-selection-action']>, options?: LyraEventOptions) {
    super('lr-selection-action', detail, options);
  }
}

/**
 * Class of every `lr-selection-change` event; `event instanceof LyraSelectionChangeEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraSelectionChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-selection-change']>> {
  static override readonly eventName = 'lr-selection-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-selection-change']>, options?: LyraEventOptions) {
    super('lr-selection-change', detail, options);
  }
}

/**
 * Class of every `lr-selection-change-request` event; `event instanceof
 * LyraSelectionChangeRequestEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraSelectionChangeRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-selection-change-request']>> {
  static override readonly eventName = 'lr-selection-change-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-selection-change-request']>, options?: LyraEventOptions) {
    super('lr-selection-change-request', detail, options);
  }
}

/**
 * Class of every `lr-selection-delete` event; `event instanceof LyraSelectionDeleteEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraSelectionDeleteEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-selection-delete']>> {
  static override readonly eventName = 'lr-selection-delete';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-selection-delete']>, options?: LyraEventOptions) {
    super('lr-selection-delete', detail, options);
  }
}

/**
 * Class of every `lr-send-now` event; `event instanceof LyraSendNowEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraSendNowEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-send-now']>> {
  static override readonly eventName = 'lr-send-now';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-send-now']>, options?: LyraEventOptions) {
    super('lr-send-now', detail, options);
  }
}

/**
 * Class of every `lr-sequence-step` event; `event instanceof LyraSequenceStepEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraSequenceStepEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-sequence-step']>> {
  static override readonly eventName = 'lr-sequence-step';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-sequence-step']>, options?: LyraEventOptions) {
    super('lr-sequence-step', detail, options);
  }
}

/**
 * Class of every `lr-show` event; `event instanceof LyraShowEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraShowEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-show']>> {
  static override readonly eventName = 'lr-show';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-show']>, options?: LyraEventOptions) {
    super('lr-show', detail, options);
  }
}

/**
 * Class of every `lr-skip` event; `event instanceof LyraSkipEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraSkipEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-skip']>> {
  static override readonly eventName = 'lr-skip';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-skip']>, options?: LyraEventOptions) {
    super('lr-skip', detail, options);
  }
}

/**
 * Class of every `lr-slice-change-request` event; `event instanceof LyraSliceChangeRequestEvent`
 * is true for the events components dispatch and narrows `detail`.
 */
export class LyraSliceChangeRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-slice-change-request']>> {
  static override readonly eventName = 'lr-slice-change-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-slice-change-request']>, options?: LyraEventOptions) {
    super('lr-slice-change-request', detail, options);
  }
}

/**
 * Class of every `lr-slide-change` event; `event instanceof LyraSlideChangeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraSlideChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-slide-change']>> {
  static override readonly eventName = 'lr-slide-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-slide-change']>, options?: LyraEventOptions) {
    super('lr-slide-change', detail, options);
  }
}

/**
 * Class of every `lr-sort` event; `event instanceof LyraSortEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraSortEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-sort']>> {
  static override readonly eventName = 'lr-sort';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-sort']>, options?: LyraEventOptions) {
    super('lr-sort', detail, options);
  }
}

/**
 * Class of every `lr-sort-change` event; `event instanceof LyraSortChangeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraSortChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-sort-change']>> {
  static override readonly eventName = 'lr-sort-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-sort-change']>, options?: LyraEventOptions) {
    super('lr-sort-change', detail, options);
  }
}

/**
 * Class of every `lr-sort-request` event; `event instanceof LyraSortRequestEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraSortRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-sort-request']>> {
  static override readonly eventName = 'lr-sort-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-sort-request']>, options?: LyraEventOptions) {
    super('lr-sort-request', detail, options);
  }
}

/**
 * Class of every `lr-source-category-select` event; `event instanceof
 * LyraSourceCategorySelectEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraSourceCategorySelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-source-category-select']>> {
  static override readonly eventName = 'lr-source-category-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-source-category-select']>, options?: LyraEventOptions) {
    super('lr-source-category-select', detail, options);
  }
}

/**
 * Class of every `lr-source-create` event; `event instanceof LyraSourceCreateEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraSourceCreateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-source-create']>> {
  static override readonly eventName = 'lr-source-create';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-source-create']>, options?: LyraEventOptions) {
    super('lr-source-create', detail, options);
  }
}

/**
 * Class of every `lr-source-delete` event; `event instanceof LyraSourceDeleteEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraSourceDeleteEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-source-delete']>> {
  static override readonly eventName = 'lr-source-delete';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-source-delete']>, options?: LyraEventOptions) {
    super('lr-source-delete', detail, options);
  }
}

/**
 * Class of every `lr-source-error` event; `event instanceof LyraSourceErrorEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraSourceErrorEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-source-error']>> {
  static override readonly eventName = 'lr-source-error';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-source-error']>, options?: LyraEventOptions) {
    super('lr-source-error', detail, options);
  }
}

/**
 * Class of every `lr-source-page-change` event; `event instanceof LyraSourcePageChangeEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraSourcePageChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-source-page-change']>> {
  static override readonly eventName = 'lr-source-page-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-source-page-change']>, options?: LyraEventOptions) {
    super('lr-source-page-change', detail, options);
  }
}

/**
 * Class of every `lr-source-page-change-request` event; `event instanceof
 * LyraSourcePageChangeRequestEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraSourcePageChangeRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-source-page-change-request']>> {
  static override readonly eventName = 'lr-source-page-change-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-source-page-change-request']>, options?: LyraEventOptions) {
    super('lr-source-page-change-request', detail, options);
  }
}

/**
 * Class of every `lr-source-pause` event; `event instanceof LyraSourcePauseEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraSourcePauseEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-source-pause']>> {
  static override readonly eventName = 'lr-source-pause';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-source-pause']>, options?: LyraEventOptions) {
    super('lr-source-pause', detail, options);
  }
}

/**
 * Class of every `lr-source-point-select` event; `event instanceof LyraSourcePointSelectEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraSourcePointSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-source-point-select']>> {
  static override readonly eventName = 'lr-source-point-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-source-point-select']>, options?: LyraEventOptions) {
    super('lr-source-point-select', detail, options);
  }
}

/**
 * Class of every `lr-source-selection-change` event; `event instanceof
 * LyraSourceSelectionChangeEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraSourceSelectionChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-source-selection-change']>> {
  static override readonly eventName = 'lr-source-selection-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-source-selection-change']>, options?: LyraEventOptions) {
    super('lr-source-selection-change', detail, options);
  }
}

/**
 * Class of every `lr-source-sync` event; `event instanceof LyraSourceSyncEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraSourceSyncEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-source-sync']>> {
  static override readonly eventName = 'lr-source-sync';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-source-sync']>, options?: LyraEventOptions) {
    super('lr-source-sync', detail, options);
  }
}

/**
 * Class of every `lr-sources-change` event; `event instanceof LyraSourcesChangeEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraSourcesChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-sources-change']>> {
  static override readonly eventName = 'lr-sources-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-sources-change']>, options?: LyraEventOptions) {
    super('lr-sources-change', detail, options);
  }
}

/**
 * Class of every `lr-span-select` event; `event instanceof LyraSpanSelectEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraSpanSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-span-select']>> {
  static override readonly eventName = 'lr-span-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-span-select']>, options?: LyraEventOptions) {
    super('lr-span-select', detail, options);
  }
}

/**
 * Class of every `lr-span-toggle` event; `event instanceof LyraSpanToggleEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraSpanToggleEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-span-toggle']>> {
  static override readonly eventName = 'lr-span-toggle';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-span-toggle']>, options?: LyraEventOptions) {
    super('lr-span-toggle', detail, options);
  }
}

/**
 * Class of every `lr-span-visibility-change` event; `event instanceof
 * LyraSpanVisibilityChangeEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraSpanVisibilityChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-span-visibility-change']>> {
  static override readonly eventName = 'lr-span-visibility-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-span-visibility-change']>, options?: LyraEventOptions) {
    super('lr-span-visibility-change', detail, options);
  }
}

/**
 * Class of every `lr-spatial-bin-select` event; `event instanceof LyraSpatialBinSelectEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraSpatialBinSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-spatial-bin-select']>> {
  static override readonly eventName = 'lr-spatial-bin-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-spatial-bin-select']>, options?: LyraEventOptions) {
    super('lr-spatial-bin-select', detail, options);
  }
}

/**
 * Class of every `lr-spatial-point-select` event; `event instanceof LyraSpatialPointSelectEvent`
 * is true for the events components dispatch and narrows `detail`.
 */
export class LyraSpatialPointSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-spatial-point-select']>> {
  static override readonly eventName = 'lr-spatial-point-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-spatial-point-select']>, options?: LyraEventOptions) {
    super('lr-spatial-point-select', detail, options);
  }
}

/**
 * Class of every `lr-stage-chunk-action` event; `event instanceof LyraStageChunkActionEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraStageChunkActionEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-stage-chunk-action']>> {
  static override readonly eventName = 'lr-stage-chunk-action';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-stage-chunk-action']>, options?: LyraEventOptions) {
    super('lr-stage-chunk-action', detail, options);
  }
}

/**
 * Class of every `lr-stage-select` event; `event instanceof LyraStageSelectEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraStageSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-stage-select']>> {
  static override readonly eventName = 'lr-stage-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-stage-select']>, options?: LyraEventOptions) {
    super('lr-stage-select', detail, options);
  }
}

/**
 * Class of every `lr-stall` event; `event instanceof LyraStallEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraStallEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-stall']>> {
  static override readonly eventName = 'lr-stall';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-stall']>, options?: LyraEventOptions) {
    super('lr-stall', detail, options);
  }
}

/**
 * Class of every `lr-start` event; `event instanceof LyraStartEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraStartEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-start']>> {
  static override readonly eventName = 'lr-start';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-start']>, options?: LyraEventOptions) {
    super('lr-start', detail, options);
  }
}

/**
 * Class of every `lr-status-change` event; `event instanceof LyraStatusChangeEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraStatusChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-status-change']>> {
  static override readonly eventName = 'lr-status-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-status-change']>, options?: LyraEventOptions) {
    super('lr-status-change', detail, options);
  }
}

/**
 * Class of every `lr-step-change` event; `event instanceof LyraStepChangeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraStepChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-step-change']>> {
  static override readonly eventName = 'lr-step-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-step-change']>, options?: LyraEventOptions) {
    super('lr-step-change', detail, options);
  }
}

/**
 * Class of every `lr-step-select` event; `event instanceof LyraStepSelectEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraStepSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-step-select']>> {
  static override readonly eventName = 'lr-step-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-step-select']>, options?: LyraEventOptions) {
    super('lr-step-select', detail, options);
  }
}

/**
 * Class of every `lr-stepper-orientation-change` event; `event instanceof
 * LyraStepperOrientationChangeEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraStepperOrientationChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-stepper-orientation-change']>> {
  static override readonly eventName = 'lr-stepper-orientation-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-stepper-orientation-change']>, options?: LyraEventOptions) {
    super('lr-stepper-orientation-change', detail, options);
  }
}

/**
 * Class of every `lr-stop` event; `event instanceof LyraStopEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraStopEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-stop']>> {
  static override readonly eventName = 'lr-stop';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-stop']>, options?: LyraEventOptions) {
    super('lr-stop', detail, options);
  }
}

/**
 * Class of every `lr-submit` event; `event instanceof LyraSubmitEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraSubmitEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-submit']>> {
  static override readonly eventName = 'lr-submit';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-submit']>, options?: LyraEventOptions) {
    super('lr-submit', detail, options);
  }
}

/**
 * Class of every `lr-suggestion-select` event; `event instanceof LyraSuggestionSelectEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraSuggestionSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-suggestion-select']>> {
  static override readonly eventName = 'lr-suggestion-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-suggestion-select']>, options?: LyraEventOptions) {
    super('lr-suggestion-select', detail, options);
  }
}

/**
 * Class of every `lr-switch-toggle-request` event; `event instanceof LyraSwitchToggleRequestEvent`
 * is true for the events components dispatch and narrows `detail`.
 */
export class LyraSwitchToggleRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-switch-toggle-request']>> {
  static override readonly eventName = 'lr-switch-toggle-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-switch-toggle-request']>, options?: LyraEventOptions) {
    super('lr-switch-toggle-request', detail, options);
  }
}

/**
 * Class of every `lr-tab-change` event; `event instanceof LyraTabChangeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraTabChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-tab-change']>> {
  static override readonly eventName = 'lr-tab-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-tab-change']>, options?: LyraEventOptions) {
    super('lr-tab-change', detail, options);
  }
}

/**
 * Class of every `lr-tab-group-select-request` event; `event instanceof
 * LyraTabGroupSelectRequestEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraTabGroupSelectRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-tab-group-select-request']>> {
  static override readonly eventName = 'lr-tab-group-select-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-tab-group-select-request']>, options?: LyraEventOptions) {
    super('lr-tab-group-select-request', detail, options);
  }
}

/**
 * Class of every `lr-tab-hide` event; `event instanceof LyraTabHideEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraTabHideEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-tab-hide']>> {
  static override readonly eventName = 'lr-tab-hide';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-tab-hide']>, options?: LyraEventOptions) {
    super('lr-tab-hide', detail, options);
  }
}

/**
 * Class of every `lr-tab-show` event; `event instanceof LyraTabShowEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraTabShowEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-tab-show']>> {
  static override readonly eventName = 'lr-tab-show';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-tab-show']>, options?: LyraEventOptions) {
    super('lr-tab-show', detail, options);
  }
}

/**
 * Class of every `lr-take-over` event; `event instanceof LyraTakeOverEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraTakeOverEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-take-over']>> {
  static override readonly eventName = 'lr-take-over';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-take-over']>, options?: LyraEventOptions) {
    super('lr-take-over', detail, options);
  }
}

/**
 * Class of every `lr-test-select` event; `event instanceof LyraTestSelectEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraTestSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-test-select']>> {
  static override readonly eventName = 'lr-test-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-test-select']>, options?: LyraEventOptions) {
    super('lr-test-select', detail, options);
  }
}

/**
 * Class of every `lr-text-select` event; `event instanceof LyraTextSelectEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraTextSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-text-select']>> {
  static override readonly eventName = 'lr-text-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-text-select']>, options?: LyraEventOptions) {
    super('lr-text-select', detail, options);
  }
}

/**
 * Class of every `lr-thread-archive` event; `event instanceof LyraThreadArchiveEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraThreadArchiveEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-thread-archive']>> {
  static override readonly eventName = 'lr-thread-archive';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-thread-archive']>, options?: LyraEventOptions) {
    super('lr-thread-archive', detail, options);
  }
}

/**
 * Class of every `lr-thread-delete` event; `event instanceof LyraThreadDeleteEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraThreadDeleteEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-thread-delete']>> {
  static override readonly eventName = 'lr-thread-delete';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-thread-delete']>, options?: LyraEventOptions) {
    super('lr-thread-delete', detail, options);
  }
}

/**
 * Class of every `lr-thread-pin` event; `event instanceof LyraThreadPinEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraThreadPinEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-thread-pin']>> {
  static override readonly eventName = 'lr-thread-pin';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-thread-pin']>, options?: LyraEventOptions) {
    super('lr-thread-pin', detail, options);
  }
}

/**
 * Class of every `lr-thread-rename` event; `event instanceof LyraThreadRenameEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraThreadRenameEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-thread-rename']>> {
  static override readonly eventName = 'lr-thread-rename';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-thread-rename']>, options?: LyraEventOptions) {
    super('lr-thread-rename', detail, options);
  }
}

/**
 * Class of every `lr-time-change` event; `event instanceof LyraTimeChangeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraTimeChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-time-change']>> {
  static override readonly eventName = 'lr-time-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-time-change']>, options?: LyraEventOptions) {
    super('lr-time-change', detail, options);
  }
}

/**
 * Class of every `lr-toast-overflow` event; `event instanceof LyraToastOverflowEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraToastOverflowEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-toast-overflow']>> {
  static override readonly eventName = 'lr-toast-overflow';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-toast-overflow']>, options?: LyraEventOptions) {
    super('lr-toast-overflow', detail, options);
  }
}

/**
 * Class of every `lr-toggle` event; `event instanceof LyraToggleEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraToggleEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-toggle']>> {
  static override readonly eventName = 'lr-toggle';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-toggle']>, options?: LyraEventOptions) {
    super('lr-toggle', detail, options);
  }
}

/**
 * Class of every `lr-toggle-group-toggle-request` event; `event instanceof
 * LyraToggleGroupToggleRequestEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraToggleGroupToggleRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-toggle-group-toggle-request']>> {
  static override readonly eventName = 'lr-toggle-group-toggle-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-toggle-group-toggle-request']>, options?: LyraEventOptions) {
    super('lr-toggle-group-toggle-request', detail, options);
  }
}

/**
 * Class of every `lr-toggle-request` event; `event instanceof LyraToggleRequestEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraToggleRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-toggle-request']>> {
  static override readonly eventName = 'lr-toggle-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-toggle-request']>, options?: LyraEventOptions) {
    super('lr-toggle-request', detail, options);
  }
}

/**
 * Class of every `lr-toggle-toggle-request` event; `event instanceof LyraToggleToggleRequestEvent`
 * is true for the events components dispatch and narrows `detail`.
 */
export class LyraToggleToggleRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-toggle-toggle-request']>> {
  static override readonly eventName = 'lr-toggle-toggle-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-toggle-toggle-request']>, options?: LyraEventOptions) {
    super('lr-toggle-toggle-request', detail, options);
  }
}

/**
 * Class of every `lr-token-add-request` event; `event instanceof LyraTokenAddRequestEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraTokenAddRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-token-add-request']>> {
  static override readonly eventName = 'lr-token-add-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-token-add-request']>, options?: LyraEventOptions) {
    super('lr-token-add-request', detail, options);
  }
}

/**
 * Class of every `lr-token-edit-request` event; `event instanceof LyraTokenEditRequestEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraTokenEditRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-token-edit-request']>> {
  static override readonly eventName = 'lr-token-edit-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-token-edit-request']>, options?: LyraEventOptions) {
    super('lr-token-edit-request', detail, options);
  }
}

/**
 * Class of every `lr-token-remove-request` event; `event instanceof LyraTokenRemoveRequestEvent`
 * is true for the events components dispatch and narrows `detail`.
 */
export class LyraTokenRemoveRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-token-remove-request']>> {
  static override readonly eventName = 'lr-token-remove-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-token-remove-request']>, options?: LyraEventOptions) {
    super('lr-token-remove-request', detail, options);
  }
}

/**
 * Class of every `lr-tool-activate` event; `event instanceof LyraToolActivateEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraToolActivateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-tool-activate']>> {
  static override readonly eventName = 'lr-tool-activate';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-tool-activate']>, options?: LyraEventOptions) {
    super('lr-tool-activate', detail, options);
  }
}

/**
 * Class of every `lr-tool-approval-close` event; `event instanceof LyraToolApprovalCloseEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraToolApprovalCloseEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-tool-approval-close']>> {
  static override readonly eventName = 'lr-tool-approval-close';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-tool-approval-close']>, options?: LyraEventOptions) {
    super('lr-tool-approval-close', detail, options);
  }
}

/**
 * Class of every `lr-tool-approval-decide-request` event; `event instanceof
 * LyraToolApprovalDecideRequestEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraToolApprovalDecideRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-tool-approval-decide-request']>> {
  static override readonly eventName = 'lr-tool-approval-decide-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-tool-approval-decide-request']>, options?: LyraEventOptions) {
    super('lr-tool-approval-decide-request', detail, options);
  }
}

/**
 * Class of every `lr-tool-approval-open` event; `event instanceof LyraToolApprovalOpenEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraToolApprovalOpenEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-tool-approval-open']>> {
  static override readonly eventName = 'lr-tool-approval-open';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-tool-approval-open']>, options?: LyraEventOptions) {
    super('lr-tool-approval-open', detail, options);
  }
}

/**
 * Class of every `lr-tool-call-chip-select` event; `event instanceof LyraToolCallChipSelectEvent`
 * is true for the events components dispatch and narrows `detail`.
 */
export class LyraToolCallChipSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-tool-call-chip-select']>> {
  static override readonly eventName = 'lr-tool-call-chip-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-tool-call-chip-select']>, options?: LyraEventOptions) {
    super('lr-tool-call-chip-select', detail, options);
  }
}

/**
 * Class of every `lr-tool-render-error` event; `event instanceof LyraToolRenderErrorEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraToolRenderErrorEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-tool-render-error']>> {
  static override readonly eventName = 'lr-tool-render-error';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-tool-render-error']>, options?: LyraEventOptions) {
    super('lr-tool-render-error', detail, options);
  }
}

/**
 * Class of every `lr-toolbar-actions-change` event; `event instanceof
 * LyraToolbarActionsChangeEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraToolbarActionsChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-toolbar-actions-change']>> {
  static override readonly eventName = 'lr-toolbar-actions-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-toolbar-actions-change']>, options?: LyraEventOptions) {
    super('lr-toolbar-actions-change', detail, options);
  }
}

/**
 * Class of every `lr-topic-select` event; `event instanceof LyraTopicSelectEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraTopicSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-topic-select']>> {
  static override readonly eventName = 'lr-topic-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-topic-select']>, options?: LyraEventOptions) {
    super('lr-topic-select', detail, options);
  }
}

/**
 * Class of every `lr-topic-toggle` event; `event instanceof LyraTopicToggleEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraTopicToggleEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-topic-toggle']>> {
  static override readonly eventName = 'lr-topic-toggle';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-topic-toggle']>, options?: LyraEventOptions) {
    super('lr-topic-toggle', detail, options);
  }
}

/**
 * Class of every `lr-tour-end` event; `event instanceof LyraTourEndEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraTourEndEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-tour-end']>> {
  static override readonly eventName = 'lr-tour-end';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-tour-end']>, options?: LyraEventOptions) {
    super('lr-tour-end', detail, options);
  }
}

/**
 * Class of every `lr-tour-end-request` event; `event instanceof LyraTourEndRequestEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraTourEndRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-tour-end-request']>> {
  static override readonly eventName = 'lr-tour-end-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-tour-end-request']>, options?: LyraEventOptions) {
    super('lr-tour-end-request', detail, options);
  }
}

/**
 * Class of every `lr-tour-start` event; `event instanceof LyraTourStartEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraTourStartEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-tour-start']>> {
  static override readonly eventName = 'lr-tour-start';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-tour-start']>, options?: LyraEventOptions) {
    super('lr-tour-start', detail, options);
  }
}

/**
 * Class of every `lr-tour-step-activate` event; `event instanceof LyraTourStepActivateEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraTourStepActivateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-tour-step-activate']>> {
  static override readonly eventName = 'lr-tour-step-activate';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-tour-step-activate']>, options?: LyraEventOptions) {
    super('lr-tour-step-activate', detail, options);
  }
}

/**
 * Class of every `lr-tour-step-change-request` event; `event instanceof
 * LyraTourStepChangeRequestEvent` is true for the events components dispatch and narrows `detail`.
 */
export class LyraTourStepChangeRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-tour-step-change-request']>> {
  static override readonly eventName = 'lr-tour-step-change-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-tour-step-change-request']>, options?: LyraEventOptions) {
    super('lr-tour-step-change-request', detail, options);
  }
}

/**
 * Class of every `lr-tour-target-missing` event; `event instanceof LyraTourTargetMissingEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraTourTargetMissingEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-tour-target-missing']>> {
  static override readonly eventName = 'lr-tour-target-missing';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-tour-target-missing']>, options?: LyraEventOptions) {
    super('lr-tour-target-missing', detail, options);
  }
}

/**
 * Class of every `lr-transfer-cancel` event; `event instanceof LyraTransferCancelEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraTransferCancelEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-transfer-cancel']>> {
  static override readonly eventName = 'lr-transfer-cancel';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-transfer-cancel']>, options?: LyraEventOptions) {
    super('lr-transfer-cancel', detail, options);
  }
}

/**
 * Class of every `lr-transfer-pause` event; `event instanceof LyraTransferPauseEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraTransferPauseEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-transfer-pause']>> {
  static override readonly eventName = 'lr-transfer-pause';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-transfer-pause']>, options?: LyraEventOptions) {
    super('lr-transfer-pause', detail, options);
  }
}

/**
 * Class of every `lr-transfer-resume` event; `event instanceof LyraTransferResumeEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraTransferResumeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-transfer-resume']>> {
  static override readonly eventName = 'lr-transfer-resume';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-transfer-resume']>, options?: LyraEventOptions) {
    super('lr-transfer-resume', detail, options);
  }
}

/**
 * Class of every `lr-transfer-retry` event; `event instanceof LyraTransferRetryEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraTransferRetryEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-transfer-retry']>> {
  static override readonly eventName = 'lr-transfer-retry';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-transfer-retry']>, options?: LyraEventOptions) {
    super('lr-transfer-retry', detail, options);
  }
}

/**
 * Class of every `lr-validity-change` event; `event instanceof LyraValidityChangeEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraValidityChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-validity-change']>> {
  static override readonly eventName = 'lr-validity-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-validity-change']>, options?: LyraEventOptions) {
    super('lr-validity-change', detail, options);
  }
}

/**
 * Class of every `lr-version-change` event; `event instanceof LyraVersionChangeEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraVersionChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-version-change']>> {
  static override readonly eventName = 'lr-version-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-version-change']>, options?: LyraEventOptions) {
    super('lr-version-change', detail, options);
  }
}

/**
 * Class of every `lr-version-select` event; `event instanceof LyraVersionSelectEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraVersionSelectEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-version-select']>> {
  static override readonly eventName = 'lr-version-select';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-version-select']>, options?: LyraEventOptions) {
    super('lr-version-select', detail, options);
  }
}

/**
 * Class of every `lr-video-change` event; `event instanceof LyraVideoChangeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraVideoChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-video-change']>> {
  static override readonly eventName = 'lr-video-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-video-change']>, options?: LyraEventOptions) {
    super('lr-video-change', detail, options);
  }
}

/**
 * Class of every `lr-view-change` event; `event instanceof LyraViewChangeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraViewChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-view-change']>> {
  static override readonly eventName = 'lr-view-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-view-change']>, options?: LyraEventOptions) {
    super('lr-view-change', detail, options);
  }
}

/**
 * Class of every `lr-viewer-diagnostic` event; `event instanceof LyraViewerDiagnosticEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraViewerDiagnosticEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-viewer-diagnostic']>> {
  static override readonly eventName = 'lr-viewer-diagnostic';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-viewer-diagnostic']>, options?: LyraEventOptions) {
    super('lr-viewer-diagnostic', detail, options);
  }
}

/**
 * Class of every `lr-viewport-change` event; `event instanceof LyraViewportChangeEvent` is true
 * for the events components dispatch and narrows `detail`.
 */
export class LyraViewportChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-viewport-change']>> {
  static override readonly eventName = 'lr-viewport-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-viewport-change']>, options?: LyraEventOptions) {
    super('lr-viewport-change', detail, options);
  }
}

/**
 * Class of every `lr-virtual-scroll` event; `event instanceof LyraVirtualScrollEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraVirtualScrollEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-virtual-scroll']>> {
  static override readonly eventName = 'lr-virtual-scroll';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-virtual-scroll']>, options?: LyraEventOptions) {
    super('lr-virtual-scroll', detail, options);
  }
}

/**
 * Class of every `lr-visibility-change` event; `event instanceof LyraVisibilityChangeEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraVisibilityChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-visibility-change']>> {
  static override readonly eventName = 'lr-visibility-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-visibility-change']>, options?: LyraEventOptions) {
    super('lr-visibility-change', detail, options);
  }
}

/**
 * Class of every `lr-visibility-change-request` event; `event instanceof
 * LyraVisibilityChangeRequestEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraVisibilityChangeRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-visibility-change-request']>> {
  static override readonly eventName = 'lr-visibility-change-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-visibility-change-request']>, options?: LyraEventOptions) {
    super('lr-visibility-change-request', detail, options);
  }
}

/**
 * Class of every `lr-visible-range-change` event; `event instanceof LyraVisibleRangeChangeEvent`
 * is true for the events components dispatch and narrows `detail`.
 */
export class LyraVisibleRangeChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-visible-range-change']>> {
  static override readonly eventName = 'lr-visible-range-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-visible-range-change']>, options?: LyraEventOptions) {
    super('lr-visible-range-change', detail, options);
  }
}

/**
 * Class of every `lr-voice-change` event; `event instanceof LyraVoiceChangeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraVoiceChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-voice-change']>> {
  static override readonly eventName = 'lr-voice-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-voice-change']>, options?: LyraEventOptions) {
    super('lr-voice-change', detail, options);
  }
}

/**
 * Class of every `lr-vote-change` event; `event instanceof LyraVoteChangeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraVoteChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-vote-change']>> {
  static override readonly eventName = 'lr-vote-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-vote-change']>, options?: LyraEventOptions) {
    super('lr-vote-change', detail, options);
  }
}

/**
 * Class of every `lr-vote-request` event; `event instanceof LyraVoteRequestEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraVoteRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-vote-request']>> {
  static override readonly eventName = 'lr-vote-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-vote-request']>, options?: LyraEventOptions) {
    super('lr-vote-request', detail, options);
  }
}

/**
 * Class of every `lr-widget-action` event; `event instanceof LyraWidgetActionEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraWidgetActionEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-widget-action']>> {
  static override readonly eventName = 'lr-widget-action';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-widget-action']>, options?: LyraEventOptions) {
    super('lr-widget-action', detail, options);
  }
}

/**
 * Class of every `lr-widget-state-change` event; `event instanceof LyraWidgetStateChangeEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraWidgetStateChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-widget-state-change']>> {
  static override readonly eventName = 'lr-widget-state-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-widget-state-change']>, options?: LyraEventOptions) {
    super('lr-widget-state-change', detail, options);
  }
}

/**
 * Class of every `lr-widget-view-change` event; `event instanceof LyraWidgetViewChangeEvent` is
 * true for the events components dispatch and narrows `detail`.
 */
export class LyraWidgetViewChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-widget-view-change']>> {
  static override readonly eventName = 'lr-widget-view-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-widget-view-change']>, options?: LyraEventOptions) {
    super('lr-widget-view-change', detail, options);
  }
}

/**
 * Class of every `lr-widget-view-change-request` event; `event instanceof
 * LyraWidgetViewChangeRequestEvent` is true for the events components dispatch and narrows
 * `detail`.
 */
export class LyraWidgetViewChangeRequestEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-widget-view-change-request']>> {
  static override readonly eventName = 'lr-widget-view-change-request';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-widget-view-change-request']>, options?: LyraEventOptions) {
    super('lr-widget-view-change-request', detail, options);
  }
}

/**
 * Class of every `lr-word-activate` event; `event instanceof LyraWordActivateEvent` is true for
 * the events components dispatch and narrows `detail`.
 */
export class LyraWordActivateEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-word-activate']>> {
  static override readonly eventName = 'lr-word-activate';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-word-activate']>, options?: LyraEventOptions) {
    super('lr-word-activate', detail, options);
  }
}

/**
 * Class of every `lr-zoom` event; `event instanceof LyraZoomEvent` is true for the events
 * components dispatch and narrows `detail`.
 */
export class LyraZoomEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-zoom']>> {
  static override readonly eventName = 'lr-zoom';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-zoom']>, options?: LyraEventOptions) {
    super('lr-zoom', detail, options);
  }
}

/**
 * Class of every `lr-zoom-change` event; `event instanceof LyraZoomChangeEvent` is true for the
 * events components dispatch and narrows `detail`.
 */
export class LyraZoomChangeEvent extends LyraEvent<LyraEventDetailOf<LyraGlobalEventMap['lr-zoom-change']>> {
  static override readonly eventName = 'lr-zoom-change';
  constructor(detail: LyraEventDetailOf<LyraGlobalEventMap['lr-zoom-change']>, options?: LyraEventOptions) {
    super('lr-zoom-change', detail, options);
  }
}
