import type { LyraVoicePickerEventMap } from '../src/components/conversation/voice-picker/voice-picker.class.js';
import type { LyraModelSelectEventMap } from '../src/components/conversation/model-select/model-select.class.js';
import type { LyraPushToTalkEventMap } from '../src/components/conversation/push-to-talk/push-to-talk.class.js';
import type { LyraRealtimeSessionEventMap } from '../src/components/conversation/realtime-session/realtime-session.class.js';
import type { LyraToolResultDialogEventMap } from '../src/components/agent-tools/tool-result-dialog/tool-result-dialog.class.js';
import type { LyraPollStatusEventMap } from '../src/components/utility/poll-status/poll-status.class.js';
import type { LyraRandomContentEventMap } from '../src/components/utility/random-content/random-content.class.js';
import type {
  LyraKnownDateEventDetail,
  LyraKnownDateEventMap,
} from '../src/components/utility/known-date/known-date.class.js';

type AssertTrue<Value extends true> = Value;
type AssertFalse<Value extends false> = Value;

type _VoiceInputUsesNativeConstructor = AssertFalse<
  LyraVoicePickerEventMap['input'] extends CustomEvent<unknown> ? true : false
>;
type _VoiceChangeUsesNativeConstructor = AssertFalse<
  LyraVoicePickerEventMap['change'] extends CustomEvent<unknown> ? true : false
>;
type _ModelFocusUsesNativeConstructor = AssertTrue<
  LyraModelSelectEventMap['focus'] extends FocusEvent ? true : false
>;
type _ModelBlurUsesNativeConstructor = AssertTrue<
  LyraModelSelectEventMap['blur'] extends FocusEvent ? true : false
>;
type _VoiceFocusUsesNativeConstructor = AssertTrue<
  LyraVoicePickerEventMap['focus'] extends FocusEvent ? true : false
>;
type _VoiceBlurUsesNativeConstructor = AssertTrue<
  LyraVoicePickerEventMap['blur'] extends FocusEvent ? true : false
>;
type _VoiceFocusAliasIsCustom = AssertTrue<
  LyraVoicePickerEventMap['lr-focus'] extends CustomEvent<null> ? true : false
>;
type _VoiceBlurAliasIsCustom = AssertTrue<
  LyraVoicePickerEventMap['lr-blur'] extends CustomEvent<null> ? true : false
>;
type _KnownDateInputIsNative = AssertTrue<
  LyraKnownDateEventMap['input'] extends InputEvent ? true : false
>;
type _KnownDateChangeIsNative = AssertTrue<
  LyraKnownDateEventMap['change'] extends Event ? true : false
>;
type _KnownDateInputKeepsCompatibilityDetail = AssertTrue<
  LyraKnownDateEventMap['input']['detail'] extends LyraKnownDateEventDetail ? true : false
>;
type _KnownDateChangeKeepsCompatibilityDetail = AssertTrue<
  LyraKnownDateEventMap['change']['detail'] extends LyraKnownDateEventDetail ? true : false
>;
type _RealtimeSessionIncludesCaptureEvents = AssertTrue<
  LyraRealtimeSessionEventMap extends LyraPushToTalkEventMap ? true : false
>;
type ToolResultMaximizeDetail = LyraToolResultDialogEventMap['lr-maximize-change']['detail'];
type PollStatusPauseDetail = LyraPollStatusEventMap['lr-pause-change']['detail'];
type RandomContentPauseDetail = LyraRandomContentEventMap['lr-pause-change']['detail'];
type _ToolResultMaximizeIsNamed = AssertTrue<
  ToolResultMaximizeDetail extends { readonly maximized: boolean } ? true : false
>;
type _ToolResultMaximizeIsNotPrimitive = AssertFalse<
  ToolResultMaximizeDetail extends boolean ? true : false
>;
type _PollStatusPauseIsNamed = AssertTrue<
  PollStatusPauseDetail extends { readonly paused: boolean } ? true : false
>;
type _RandomContentPauseIsNamed = AssertTrue<
  RandomContentPauseDetail extends { readonly paused: boolean } ? true : false
>;

declare const toolResultMaximizeDetail: ToolResultMaximizeDetail;
declare const pollStatusPauseDetail: PollStatusPauseDetail;
declare const randomContentPauseDetail: RandomContentPauseDetail;
// @ts-expect-error event detail snapshots are readonly.
toolResultMaximizeDetail.maximized = false;
// @ts-expect-error event detail snapshots are readonly.
pollStatusPauseDetail.paused = false;
// @ts-expect-error event detail snapshots are readonly.
randomContentPauseDetail.paused = false;

export type EventDetailContractAssertions =
  | _VoiceInputUsesNativeConstructor
  | _VoiceChangeUsesNativeConstructor
  | _ModelFocusUsesNativeConstructor
  | _ModelBlurUsesNativeConstructor
  | _VoiceFocusUsesNativeConstructor
  | _VoiceBlurUsesNativeConstructor
  | _VoiceFocusAliasIsCustom
  | _VoiceBlurAliasIsCustom
  | _KnownDateInputIsNative
  | _KnownDateChangeIsNative
  | _KnownDateInputKeepsCompatibilityDetail
  | _KnownDateChangeKeepsCompatibilityDetail
  | _RealtimeSessionIncludesCaptureEvents
  | _ToolResultMaximizeIsNamed
  | _ToolResultMaximizeIsNotPrimitive
  | _PollStatusPauseIsNamed
  | _RandomContentPauseIsNamed;
