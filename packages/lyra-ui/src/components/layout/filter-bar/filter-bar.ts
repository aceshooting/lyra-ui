/** @deprecated Import @aceshooting/lyra-ui/components/lr-filter-bar.js to register this component. */
export * from './filter-bar.class.js';
import { LyraFilterBar } from './filter-bar.class.js';
import { defineElement } from '../../../internal/prefix.js';
import { defineLazyChildren } from '../../../internal/lazy-children.js';
import '../../overlays/chip/chip.js';
import '../../overlays/chip/chip-group.js';
import '../../forms/button/button.js';

// Each filter type's control registers the first time a bar renders it.
defineLazyChildren('filter-bar', {
  select: () => import('../../forms/select/select.js'),
  combobox: () => import('../../forms/combobox/combobox.js'),
  option: () => import('../../forms/combobox/option.js'),
  'date-input': () => import('../../forms/date-picker/date-input.js'),
  input: () => import('../../forms/input/input.js'),
  dropdown: () => import('../../overlays/overlay/dropdown.js'),
  'dropdown-item': () => import('../menu/dropdown-item.js'),
  spinner: () => import('../../overlays/spinner/spinner.js'),
});
defineElement('filter-bar', LyraFilterBar);
