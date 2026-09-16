import type { LyraDateRangePreset } from '../src/components/forms/date-picker/date-picker.class.js';
import type { TimeRangePreset } from '../src/components/forms/time-range/time-range.class.js';
import type { LyraFilterBarDateRangeDefinition } from '../src/components/layout/filter-bar/filter-bar.class.js';

// A caller-owned correlation key must satisfy both preset interfaces without a cast or an
// intersection-type workaround -- the whole point is that the widened `appliedPreset` readback
// keeps whatever extra identity the caller tagged the object with.
const datePreset: LyraDateRangePreset = {
  label: 'Last 7 days',
  start: '2026-08-13',
  end: '2026-08-19',
  id: 'last-7-days',
};
void datePreset;

const openDatePreset: LyraDateRangePreset = { label: 'All time', id: 'all-time' };
void openDatePreset;

const timePreset: TimeRangePreset = { label: 'Last hour', start: 0, end: 3600, id: 'last-hour' };
void timePreset;

// `id` is optional -- an existing preset with no identity still satisfies both interfaces.
const untaggedDatePreset: LyraDateRangePreset = { label: 'Untagged', start: '2026-08-13' };
void untaggedDatePreset;
const untaggedTimePreset: TimeRangePreset = { label: 'Untagged', start: 0, end: 1 };
void untaggedTimePreset;

// lr-filter-bar's `'date-range'` filter definition forwards `presets` straight through, so its own
// declared element type reaches the same `id`-carrying shape with no separate declaration to keep
// in sync.
declare const definitionPresets: NonNullable<LyraFilterBarDateRangeDefinition['presets']>;
const definitionPreset: (typeof definitionPresets)[number] = {
  label: 'Last 7 days',
  start: '2026-08-13',
  end: '2026-08-19',
  id: 'last-7-days',
};
void definitionPreset;
