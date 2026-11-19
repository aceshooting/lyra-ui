/** @deprecated Import @aceshooting/lyra-ui/components/lr-condition-builder.js to register this component. */
export * from './condition-builder.class.js';
import { LyraConditionBuilder } from './condition-builder.class.js';
import { defineElement, tag } from '../../../internal/prefix.js';
import { setConditionBuilderEditorLoader } from './condition-builder-editor-loader.js';
import '../../forms/select/select.js';
import '../../forms/button/button.js';
import '../../forms/icon-button/icon-button.js';

setConditionBuilderEditorLoader(root => {
  const registrations = [];
  if (root.querySelector(`${tag('input')}:not(:defined)`)) registrations.push(import('../../forms/input/input.js'));
  if (root.querySelector(`${tag('date-input')}:not(:defined)`)) registrations.push(import('../../forms/date-picker/date-input.js'));
  if (root.querySelector(`${tag('combobox')}:not(:defined)`)) registrations.push(import('../../forms/combobox/combobox.js'));
  return registrations.length > 0 ? Promise.all(registrations) : undefined;
});

defineElement('condition-builder', LyraConditionBuilder);
