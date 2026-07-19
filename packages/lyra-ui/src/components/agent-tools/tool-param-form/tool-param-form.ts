export * from './tool-param-form.class.js';
import { LyraToolParamForm } from './tool-param-form.class.js';
import { defineElement } from '../../../internal/prefix.js';
import "../../forms/checkbox/checkbox.js";
import "../../forms/combobox/option.js";
import "../../forms/select/select.js";
defineElement('tool-param-form', LyraToolParamForm);
