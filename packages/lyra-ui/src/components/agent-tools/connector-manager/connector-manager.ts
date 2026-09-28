/** @deprecated Import @aceshooting/lyra-ui/components/lr-connector-manager.js to register this component. */
export * from './connector-manager.class.js';
import { LyraConnectorManager } from './connector-manager.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('connector-manager', LyraConnectorManager);
