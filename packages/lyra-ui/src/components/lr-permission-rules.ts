export * from './agent-tools/permission-rules/permission-rules.class.js';
import { LyraPermissionRules } from './agent-tools/permission-rules/permission-rules.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('permission-rules', LyraPermissionRules);
