export * from './utility/divider/divider.class.js';
import { LyraDivider } from './utility/divider/divider.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('divider', LyraDivider);
