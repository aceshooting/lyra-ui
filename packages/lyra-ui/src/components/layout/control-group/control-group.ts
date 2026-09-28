/** @deprecated Import @aceshooting/lyra-ui/components/lr-control-group.js to register this component. */
export * from './control-group.class.js';
import { LyraControlGroup } from './control-group.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('control-group', LyraControlGroup);
