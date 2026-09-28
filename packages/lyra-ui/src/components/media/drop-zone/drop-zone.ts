/** @deprecated Import @aceshooting/lyra-ui/components/lr-drop-zone.js to register this component. */
export * from './drop-zone.class.js';
import { LyraDropZone } from './drop-zone.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('drop-zone', LyraDropZone);
