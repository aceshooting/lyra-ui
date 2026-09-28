/** @deprecated Import @aceshooting/lyra-ui/components/lr-toggle.js to register this component. */
export * from './toggle.class.js';
import { LyraToggle } from './toggle.class.js';
import { defineElement } from '../../../internal/prefix.js';

defineElement('toggle', LyraToggle);
