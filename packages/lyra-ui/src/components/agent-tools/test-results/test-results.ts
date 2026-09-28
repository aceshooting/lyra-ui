/** @deprecated Import @aceshooting/lyra-ui/components/lr-test-results.js to register this component. */
export * from './test-results.class.js';
import '../../overlays/empty/empty.js';
import '../../overlays/spinner/spinner.js';
import '../../utility/live-region/live-region.js';
import { LyraTestResults } from './test-results.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('test-results', LyraTestResults);
