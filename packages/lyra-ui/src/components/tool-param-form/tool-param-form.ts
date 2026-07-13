export * from './tool-param-form.class.js';
import { LyraToolParamForm } from './tool-param-form.class.js';
import { defineElement } from '../../internal/prefix.js';
import "../checkbox/checkbox.js";
import "../combobox/option.js";
import "../select/select.js";
defineElement('tool-param-form', LyraToolParamForm);
