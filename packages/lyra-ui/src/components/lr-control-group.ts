export * from './layout/control-group/control-group.class.js';
import { LyraControlGroup } from './layout/control-group/control-group.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('control-group', LyraControlGroup);
