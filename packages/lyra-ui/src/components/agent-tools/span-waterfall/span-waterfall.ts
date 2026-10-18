/** @deprecated Import @aceshooting/lyra-ui/components/lr-span-waterfall.js to register this component. */
export * from './span-waterfall.class.js';
import { LyraSpanWaterfall } from './span-waterfall.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../overlays/empty/empty.js';
import '../../layout/virtual-list/virtual-list.js';

defineElement('span-waterfall', LyraSpanWaterfall);
