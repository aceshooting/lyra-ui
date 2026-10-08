/** @deprecated Import @aceshooting/lyra-ui/components/lr-permission-grant.js to register this component. */
export * from './permission-grant.class.js';
import '../../forms/button/button.js';
import { LyraPermissionGrant } from './permission-grant.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('permission-grant', LyraPermissionGrant);
