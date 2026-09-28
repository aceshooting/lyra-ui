/** @deprecated Import @aceshooting/lyra-ui/components/lr-toggle-group.js to register this component. */
export * from './toggle-group.class.js';
import { LyraToggleGroup } from './toggle-group.class.js';
import { defineElement } from '../../../internal/prefix.js';

defineElement('toggle-group', LyraToggleGroup);
