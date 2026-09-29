/** @deprecated Import @aceshooting/lyra-ui/components/lr-random-content.js to register this component. */
export * from './random-content.class.js';
import { LyraRandomContent } from './random-content.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../icon/icon.js';
defineElement('random-content', LyraRandomContent);
