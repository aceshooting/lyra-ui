/** @deprecated Import @aceshooting/lyra-ui/components/lr-split-panel.js to register this component. */
export * from './split-panel.class.js';
import { LyraSplitPanel } from './split-panel.class.js';
import { defineElement } from '../../../internal/prefix.js';

defineElement('split-panel', LyraSplitPanel);
