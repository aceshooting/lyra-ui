import type {
  DialogCloseReason,
  DocumentViewerCloseReason,
  LyraLightboxCloseReason,
  LyraResponsivePanelCloseReason,
  ToolApprovalDialogCloseReason,
  ToolResultDialogCloseReason,
  ToolSelectDialogCloseReason,
} from '../src/lyra.js';

type Assert<T extends true> = T;
type IsStringLike<T> = T extends string ? true : false;
// Exported so `noUnusedLocals` treats these compile-time assertions as used -- evaluating the
// alias IS the test (it fails to satisfy `Assert`'s `extends true` bound if the reason type ever
// stops being string-like), and the file is only ever type-checked, never imported.
export type _DialogReasonIsStringLike = Assert<IsStringLike<DialogCloseReason>>;
export type _DocumentViewerReasonIsStringLike = Assert<IsStringLike<DocumentViewerCloseReason>>;
export type _LightboxReasonIsStringLike = Assert<IsStringLike<LyraLightboxCloseReason>>;
export type _ResponsiveReasonIsStringLike = Assert<IsStringLike<LyraResponsivePanelCloseReason>>;
export type _ApprovalReasonIsStringLike = Assert<IsStringLike<ToolApprovalDialogCloseReason>>;
export type _SelectReasonIsStringLike = Assert<IsStringLike<ToolSelectDialogCloseReason>>;
export type _ResultReasonIsStringLike = Assert<IsStringLike<ToolResultDialogCloseReason>>;

const applicationReason: DialogCloseReason = 'application-timeout';
void applicationReason;
