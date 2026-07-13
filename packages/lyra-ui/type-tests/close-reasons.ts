import type {
  DialogCloseReason,
  ResponsivePanelCloseReason,
  ToolApprovalDialogCloseReason,
  ToolSelectDialogCloseReason,
} from '../src/lyra.js';

type Assert<T extends true> = T;
type IsStringLike<T> = T extends string ? true : false;
type _DialogReasonIsStringLike = Assert<IsStringLike<DialogCloseReason>>;
type _ResponsiveReasonIsStringLike = Assert<IsStringLike<ResponsivePanelCloseReason>>;
type _ApprovalReasonIsStringLike = Assert<IsStringLike<ToolApprovalDialogCloseReason>>;
type _SelectReasonIsStringLike = Assert<IsStringLike<ToolSelectDialogCloseReason>>;

const applicationReason: DialogCloseReason = 'application-timeout';
void applicationReason;
