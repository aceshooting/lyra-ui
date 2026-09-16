// Lean registration entry for `<lr-filter-bar>`: it registers the tag and nothing else.
//
// `./filter-bar.js` (the default entry) additionally imports every composed control this
// component could possibly render -- `<lr-select>`, `<lr-combobox>`, `<lr-dropdown>` +
// `<lr-dropdown-item>` (the `'checkbox-menu'` branch), `<lr-date-input>`, `<lr-input>`,
// `<lr-chip>`/`<lr-chip-group>` (the active-filter row) and `<lr-button>`/`<lr-spinner>` (the
// reset action and the loading status) -- because `filters` is a runtime value this component
// cannot inspect ahead of time. A bar that only ever declares `'select'`/`'text'` filters still
// pays for `<lr-combobox>` and `<lr-date-input>` through that entry, a measured ~+69.5 kB gzip for
// a consumer who never renders either.
//
// This entry is the explicit opt-out. Import it INSTEAD of `./filter-bar.js`, then import each
// composed control's own registration entry for the filter `type`s actually declared:
//
//   import '@aceshooting/lyra-ui/components/layout/filter-bar/filter-bar-register.js';
//   import '@aceshooting/lyra-ui/components/forms/select/select.js';      // type: 'select'
//   import '@aceshooting/lyra-ui/components/forms/combobox/combobox.js';  // type: 'combobox'
//   import '@aceshooting/lyra-ui/components/overlays/overlay/dropdown.js';     // type: 'checkbox-menu'
//   import '@aceshooting/lyra-ui/components/layout/menu/dropdown-item.js';     // type: 'checkbox-menu'
//   import '@aceshooting/lyra-ui/components/forms/date-picker/date-input.js';  // type: 'date' | 'date-range'
//   import '@aceshooting/lyra-ui/components/forms/input/input.js';             // type: 'text'
//
// Two more are unconditional regardless of which filter `type`s are declared, so a lean consumer
// still needs both: `<lr-button>` renders the reset action on every bar, and
// `<lr-chip>`/`<lr-chip-group>` render the active-filter row whenever any filter has a value
// (gated further by `activeFiltersDisplay`, but never provably absent for a generic bar):
//
//   import '@aceshooting/lyra-ui/components/forms/button/button.js';
//   import '@aceshooting/lyra-ui/components/overlays/chip/chip.js';
//   import '@aceshooting/lyra-ui/components/overlays/chip/chip-group.js';
//
// `<lr-spinner>` (the `loading` status) is the one built-in dependency this entry omits even
// though every filter bar could use it: `loading` is a plain boolean any consumer can leave unset
// entirely, unlike a filter `type`, which the `filters` array always names outright. Import
// `.../overlays/spinner/spinner.js` too if the bar ever sets `loading`.
//
// A filter definition whose `type` has no matching import above renders no usable control until
// something else registers it -- the same trade `icon-button-register.ts` documents for
// `<lr-icon-button>`'s own `icon`/`src` attribute.
export * from './filter-bar.class.js';
import { LyraFilterBar } from './filter-bar.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('filter-bar', LyraFilterBar);
