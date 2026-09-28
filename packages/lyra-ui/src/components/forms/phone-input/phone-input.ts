/** @deprecated Import @aceshooting/lyra-ui/components/lr-phone-input.js to register this component. */
export * from './phone-input.class.js';
import { LyraPhoneInput } from './phone-input.class.js';
import { defineElement } from '../../../internal/prefix.js';

defineElement('phone-input', LyraPhoneInput);
