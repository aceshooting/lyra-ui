/** @deprecated Import @aceshooting/lyra-ui/components/lr-funnel.js to register this component. */
export * from './funnel.class.js';
import { LyraFunnel } from './funnel.class.js';
import { defineElement } from '../../../internal/prefix.js';

defineElement('funnel', LyraFunnel);
