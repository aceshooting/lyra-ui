/** @deprecated Import @aceshooting/lyra-ui/components/lr-drilldown-panel.js to register this component. */
export * from './drilldown-panel.class.js';
import { LyraDrilldownPanel } from './drilldown-panel.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../breadcrumb/breadcrumb.js';
import '../breadcrumb/breadcrumb-item.js';
import '../tab-group/tab-group.js';
import '../tab-group/tab.js';
import '../tab-group/tab-panel.js';
import '../../forms/button/button.js';
import '../../overlays/empty/empty.js';
defineElement('drilldown-panel', LyraDrilldownPanel);
