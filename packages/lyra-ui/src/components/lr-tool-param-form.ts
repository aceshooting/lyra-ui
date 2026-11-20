export type { FormOwnerValue } from '../internal/direct-form-associated.js';
export * from './agent-tools/tool-param-form/tool-param-form.class.js';
import { LyraToolParamForm } from './agent-tools/tool-param-form/tool-param-form.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-select.js';
import './lr-number-input.js';
defineElement('tool-param-form', LyraToolParamForm);
