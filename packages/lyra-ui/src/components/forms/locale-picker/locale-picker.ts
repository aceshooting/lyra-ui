/** @deprecated Import @aceshooting/lyra-ui/components/lr-locale-picker.js to register this component. */
export * from './locale-picker.class.js';
import { LyraLocalePicker } from './locale-picker.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../media/flag/flag.js';
defineElement('locale-picker', LyraLocalePicker);
