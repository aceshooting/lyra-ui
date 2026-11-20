export * from './forms/checkbox-group/checkbox-group.class.js';
import { LyraCheckboxGroup } from './forms/checkbox-group/checkbox-group.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('checkbox-group', LyraCheckboxGroup);
