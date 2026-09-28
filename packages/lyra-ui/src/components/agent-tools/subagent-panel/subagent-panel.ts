/** @deprecated Import @aceshooting/lyra-ui/components/lr-subagent-panel.js to register this component. */
export * from './subagent-panel.class.js';
import { LyraSubagentPanel } from './subagent-panel.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../overlays/badge/badge.js';
import '../../overlays/empty/empty.js';

defineElement('subagent-panel', LyraSubagentPanel);

