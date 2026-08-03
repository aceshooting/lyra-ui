import type { LyraVoicePickerEventMap } from '../src/components/conversation/voice-picker/voice-picker.class.js';
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

export type EventDetailContractAssertions =
  | _VoiceInputUsesNativeConstructor
  | _VoiceChangeUsesNativeConstructor
  | _KnownDateInputIsNative
  | _KnownDateChangeIsNative
  | _KnownDateInputKeepsCompatibilityDetail
  | _KnownDateChangeKeepsCompatibilityDetail;
