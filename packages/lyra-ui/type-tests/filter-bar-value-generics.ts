import type {
  LyraFilterBar,
  LyraFilterBarFilterDefinition,
  LyraFilterBarValue,
  LyraFilterBarValueFor,
  LyraFilterBarInputEvent,
  LyraFilterBarResetEvent,
} from '../src/components/layout/filter-bar/filter-bar.class.js';

// --- a literal filter schema, narrowed per-filterId -------------------------
const FILTERS = [
  { filterId: 'status', label: 'Status', type: 'select', options: [] },
  { filterId: 'tags', label: 'Tags', type: 'combobox', multiple: true, options: [] },
  { filterId: 'owner', label: 'Owner', type: 'combobox', options: [] },
  { filterId: 'query', label: 'Query', type: 'text' },
  { filterId: 'day', label: 'Day', type: 'chip' },
  {
    filterId: 'archived',
    label: 'Archived',
    type: 'custom',
    custom: {
      render: () => {
        throw new Error('unused in a type test');
      },
      adapter: { valueFromEvent: () => undefined, clearValue: false },
    },
  },
] as const satisfies readonly LyraFilterBarFilterDefinition[];

declare const narrowed: LyraFilterBar<typeof FILTERS>;

// A 'select' filter (and a non-multiple 'combobox' filter) narrow to a bare string.
const statusValue: string | undefined = narrowed.value.status;
const ownerValue: string | undefined = narrowed.value.owner;
void statusValue;
void ownerValue;

// A `multiple: true` 'combobox' filter narrows to a readonly string array, like 'checkbox-menu'.
const tagsValue: readonly string[] | undefined = narrowed.value.tags;
void tagsValue;

// 'text'/'date'/'date-range' narrow to a bare string, same as 'select'.
const queryValue: string | undefined = narrowed.value.query;
void queryValue;

// 'custom' keeps the full unconstrained field value -- its adapter may use either boolean meaning.
const archivedValue: string | readonly string[] | boolean | undefined = narrowed.value.archived;
void archivedValue;

// A 'chip' filter keeps the full unconstrained field value -- its value is owned elsewhere.
const dayValue: string | readonly string[] | boolean | undefined = narrowed.value.day;
void dayValue;
type ChipNarrowed = LyraFilterBarValueFor<typeof FILTERS>;
const chipAcceptsBoolean: ChipNarrowed = { day: true };
void chipAcceptsBoolean;

// @ts-expect-error a single-value ('select'/non-multiple 'combobox') filter's value is never an array
const statusAsArray: readonly string[] = narrowed.value.status;
void statusAsArray;

// @ts-expect-error a `multiple: true` 'combobox' filter's value is never a bare string
const tagsAsString: string = narrowed.value.tags;
void tagsAsString;

// --- the untyped default keeps today's widened record -----------------------
declare const untyped: LyraFilterBar;
const widened: LyraFilterBarValue = untyped.value;
void widened;
const anyField: string | readonly string[] | boolean | undefined = widened['anything'];
void anyField;

// The tag map keeps the un-narrowed element type, so `document.querySelector('lr-filter-bar')`
// and every shipped `.value` read compile exactly as they did before this parameter existed.
declare const fromTagMap: HTMLElementTagNameMap['lr-filter-bar'];
const fromTagMapValue: LyraFilterBarValue = fromTagMap.value;
void fromTagMapValue;

// --- event details narrow with the same parameter ---------------------------
declare const narrowedInput: LyraFilterBarInputEvent<typeof FILTERS>;
const narrowedInputStatus: string | undefined = narrowedInput.detail.value.status;
void narrowedInputStatus;

// @ts-expect-error the input detail narrows just as tightly as `value` does
const narrowedInputTagsAsString: string = narrowedInput.detail.value.tags;
void narrowedInputTagsAsString;

declare const narrowedReset: LyraFilterBarResetEvent<typeof FILTERS>;
const narrowedResetTags: readonly string[] | undefined = narrowedReset.detail.value.tags;
void narrowedResetTags;

declare const widenedInput: LyraFilterBarInputEvent;
const widenedInputValue: LyraFilterBarValue = widenedInput.detail.value;
void widenedInputValue;

// --- the alias itself --------------------------------------------------------
type NarrowedValue = LyraFilterBarValueFor<typeof FILTERS>;
const aliasStatus: string | undefined = ({} as NarrowedValue).status;
void aliasStatus;
const aliasTags: readonly string[] | undefined = ({} as NarrowedValue).tags;
void aliasTags;
