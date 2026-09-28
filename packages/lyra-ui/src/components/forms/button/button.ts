/** @deprecated Import @aceshooting/lyra-ui/components/lr-button.js to register this component. */
export * from './button.class.js';
import { LyraButton } from './button.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('button', LyraButton);
