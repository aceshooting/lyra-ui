/** @deprecated Import @aceshooting/lyra-ui/components/lr-env-list.js to register this component. */
export * from './env-list.class.js';
import '../../overlays/empty/empty.js';
import { LyraEnvList } from './env-list.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('env-list', LyraEnvList);
