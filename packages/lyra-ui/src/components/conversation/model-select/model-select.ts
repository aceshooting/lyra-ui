/** @deprecated Import @aceshooting/lyra-ui/components/lr-model-select.js to register this component. */
export * from './model-select.class.js';
import { LyraModelSelect } from './model-select.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('model-select', LyraModelSelect);
