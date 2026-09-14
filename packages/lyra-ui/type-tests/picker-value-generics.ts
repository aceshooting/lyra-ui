import type {
  LyraSelect,
  LyraSelectChangeEvent,
  LyraSelectEventMap,
} from '../src/components/forms/select/select.class.js';
import type {
  LyraCombobox,
  LyraComboboxChangeEvent,
  LyraComboboxEventMap,
} from '../src/components/forms/combobox/combobox.class.js';
import type { LyraPickerValue } from '../src/internal/picker-value.js';

// --- narrowed single-select ------------------------------------------------
declare const singleSelect: LyraSelect<false>;

const singleValue: string = singleSelect.value;
const singleDefault: string = singleSelect.defaultValue;
void singleValue;
void singleDefault;
singleSelect.value = 'a';
singleSelect.value = null;
singleSelect.value = undefined;

// @ts-expect-error a single-select never carries an array value
const singleAsArray: string[] = singleSelect.value;
void singleAsArray;
// @ts-expect-error and never accepts one either
singleSelect.value = ['a'];

// --- narrowed multi-select -------------------------------------------------
declare const multiSelect: LyraSelect<true>;

const multiValue: string[] = multiSelect.value;
void multiValue;
multiSelect.value = ['a', 'b'];

// @ts-expect-error a multi-select's value is never a bare string
const multiAsString: string = multiSelect.value;
void multiAsString;
// @ts-expect-error and never accepts one either
multiSelect.value = 'a';

// --- the untyped default keeps today's widened union -----------------------
declare const untypedSelect: LyraSelect;

const widened: string | string[] = untypedSelect.value;
void widened;
untypedSelect.value = 'a';
untypedSelect.value = ['a'];

// @ts-expect-error the widened union still refuses a non-value type
untypedSelect.value = 42;

// The tag map keeps the un-narrowed element type, so `document.querySelector('lr-select')` and
// every shipped `.value` read compile exactly as they did before this parameter existed.
declare const fromTagMap: HTMLElementTagNameMap['lr-select'];
const fromTagMapValue: string | string[] = fromTagMap.value;
void fromTagMapValue;

// --- event details narrow with the same parameter --------------------------
declare const singleChange: LyraSelectEventMap<false>['lr-change'];
const singleDetail: string = singleChange.detail.value;
void singleDetail;

declare const multiChange: LyraSelectEventMap<true>['lr-change'];
const multiDetail: readonly string[] = multiChange.detail.value;
void multiDetail;

declare const widenedChange: LyraSelectEventMap['lr-change'];
const widenedDetail: string | readonly string[] = widenedChange.detail.value;
void widenedDetail;

// @ts-expect-error a single-select change detail is never an array
const singleDetailAsArray: readonly string[] = singleChange.detail.value;
void singleDetailAsArray;

// --- lr-combobox carries the identical contract ----------------------------
declare const singleCombobox: LyraCombobox<false>;
declare const multiCombobox: LyraCombobox<true>;
declare const untypedCombobox: LyraCombobox;

const comboboxSingle: string = singleCombobox.value;
const comboboxMulti: string[] = multiCombobox.value;
const comboboxWidened: string | string[] = untypedCombobox.value;
void comboboxSingle;
void comboboxMulti;
void comboboxWidened;

// @ts-expect-error a single-select combobox never carries an array value
const comboboxSingleAsArray: string[] = singleCombobox.value;
void comboboxSingleAsArray;

declare const comboboxChange: LyraComboboxEventMap<true>['lr-change'];
const comboboxDetail: readonly string[] = comboboxChange.detail.value;
void comboboxDetail;

// --- the alias itself ------------------------------------------------------
const aliasSingle: LyraPickerValue<false> = 'a';
const aliasMulti: LyraPickerValue<true> = ['a'];
const aliasWidened: LyraPickerValue<boolean> = Math.random() > 0.5 ? 'a' : ['a'];
void aliasSingle;
void aliasMulti;
void aliasWidened;

// --- the exported per-event aliases narrow identically ---------------------
declare const aliasedSingleChange: LyraSelectChangeEvent<false>;
const aliasedSingleDetail: string = aliasedSingleChange.detail.value;
void aliasedSingleDetail;

declare const aliasedComboboxChange: LyraComboboxChangeEvent<true>;
const aliasedComboboxDetail: readonly string[] = aliasedComboboxChange.detail.value;
void aliasedComboboxDetail;

declare const aliasedWidenedChange: LyraSelectChangeEvent;
const aliasedWidenedDetail: string | readonly string[] =
  aliasedWidenedChange.detail.value;
void aliasedWidenedDetail;

// @ts-expect-error the alias narrows just as tightly as the map it reads
const aliasedSingleAsArray: readonly string[] = aliasedSingleChange.detail.value;
void aliasedSingleAsArray;
