/** @deprecated Import @aceshooting/lyra-ui/components/lr-permission-rules.js to register this component. */
export * from './permission-rules.class.js';
import { LyraPermissionRules } from './permission-rules.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('permission-rules', LyraPermissionRules);
