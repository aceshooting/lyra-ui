export * from './agent-tools/permission-grant/permission-grant.class.js';
import './lr-button.js';
import { LyraPermissionGrant } from './agent-tools/permission-grant/permission-grant.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('permission-grant', LyraPermissionGrant);
