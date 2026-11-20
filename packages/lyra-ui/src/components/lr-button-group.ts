export * from './layout/button-group/button-group.class.js';
import { LyraButtonGroup } from './layout/button-group/button-group.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('button-group', LyraButtonGroup);
