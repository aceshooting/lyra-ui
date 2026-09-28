/** @deprecated Import @aceshooting/lyra-ui/components/lr-widget.js to register this component. */
export * from './widget.class.js';
import { LyraWidget } from './widget.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('widget', LyraWidget);
