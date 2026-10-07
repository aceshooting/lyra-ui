// Catalog pickers own their option registration through the full entry or the caller's imports.
// Keep their deferred filter control independent of the ordinary option registration bundle.
import { LyraCombobox } from './combobox.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../overlays/empty/empty.js';

defineElement('combobox', LyraCombobox);
