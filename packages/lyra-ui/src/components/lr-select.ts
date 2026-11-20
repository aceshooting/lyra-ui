export type { FormOwnerValue } from '../internal/direct-form-associated.js';
export type { PlaceSync } from '../internal/positioner.js';
export * from './forms/select/select.class.js';
import { LyraSelect } from './forms/select/select.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-option.js';
defineElement('select', LyraSelect);
