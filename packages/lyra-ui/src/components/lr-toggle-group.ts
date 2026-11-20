export * from './forms/toggle-group/toggle-group.class.js';
import { LyraToggleGroup } from './forms/toggle-group/toggle-group.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('toggle-group', LyraToggleGroup);
