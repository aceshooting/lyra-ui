/** @deprecated Import @aceshooting/lyra-ui/components/lr-condition-builder.js to register this component. */
export * from './condition-builder.class.js';
import { LyraConditionBuilder } from './condition-builder.class.js';
import { defineElement } from '../../../internal/prefix.js';
import { defineLazyChildren } from '../../../internal/lazy-children.js';
import '../../forms/select/select.js';
import '../../forms/button/button.js';
import '../../forms/icon-button/icon-button.js';

defineLazyChildren('condition-builder', {
  input: () => import('../../forms/input/input.js'),
  'date-input': () => import('../../forms/date-picker/date-input.js'),
  combobox: () => import('../../forms/combobox/combobox.js'),
});

defineElement('condition-builder', LyraConditionBuilder);
