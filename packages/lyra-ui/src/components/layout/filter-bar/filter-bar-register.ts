// Lean registration entry for `<lr-filter-bar>`: it registers the tag and nothing else.
//
// `./filter-bar.js` (the default entry) registers `<lr-button>` and `<lr-chip>`/`<lr-chip-group>`
// up front and each filter type's control -- `<lr-select>`, `<lr-combobox>`, `<lr-dropdown>` +
// `<lr-dropdown-item>` (the `'checkbox-menu'` branch), `<lr-date-input>`, `<lr-input>` -- plus
// `<lr-spinner>` (the `loading` status) the first time a bar renders it, because `filters` is a
// runtime value this component cannot inspect ahead of time.
//
// This entry registers nothing on demand. Import it INSTEAD of `./filter-bar.js` when every control
// must be defined synchronously (or a bundler must not see the deferred imports), then import each
// composed control's own registration entry for the filter `type`s actually declared:
//
//   import '@aceshooting/lyra-ui/components/layout/filter-bar/filter-bar-register.js';
//   import '@aceshooting/lyra-ui/components/lr-select.js';         // type: 'select'
//   import '@aceshooting/lyra-ui/components/lr-combobox.js';      // type: 'combobox'
//   import '@aceshooting/lyra-ui/components/lr-dropdown.js';      // type: 'checkbox-menu'
//   import '@aceshooting/lyra-ui/components/lr-dropdown-item.js'; // type: 'checkbox-menu'
//   import '@aceshooting/lyra-ui/components/lr-date-input.js';    // type: 'date' | 'date-range'
//   import '@aceshooting/lyra-ui/components/lr-input.js';         // type: 'text'
//
// `type: 'chip'` needs no registration entry at all -- it renders no control, only its own
// active-filter chip, which the unconditional `<lr-chip>`/`<lr-chip-group>` imports below already
// cover.
//
// Two more are unconditional regardless of which filter `type`s are declared, so a lean consumer
// still needs both: `<lr-button>` renders the reset action on every bar, and
// `<lr-chip>`/`<lr-chip-group>` render the active-filter row whenever any filter has a value
// (gated further by `activeFiltersDisplay`, but never provably absent for a generic bar):
//
//   import '@aceshooting/lyra-ui/components/lr-button.js';
//   import '@aceshooting/lyra-ui/components/lr-chip.js';
//   import '@aceshooting/lyra-ui/components/lr-chip-group.js';
//
// `<lr-spinner>` (the `loading` status) is the one built-in dependency this entry omits even
// though every filter bar could use it: `loading` is a plain boolean any consumer can leave unset
// entirely, unlike a filter `type`, which the `filters` array always names outright. Import
// `@aceshooting/lyra-ui/components/lr-spinner.js` too if the bar ever sets `loading`.
//
// A filter definition whose `type` has no matching import above renders no usable control until
// something else registers it -- the same trade `icon-button-register.ts` documents for
// `<lr-icon-button>`'s own `icon`/`src` attribute.
export * from './filter-bar.class.js';
import { LyraFilterBar } from './filter-bar.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('filter-bar', LyraFilterBar);
