export * from './overlays/help/help.class.js';
// policy-allow(component-dependency: lr-icon): this entry composes <lr-icon-button> through its
// LEAN registration entry, which deliberately registers only that tag. <lr-icon> is reachable from
// lr-icon-button's class module only when its `icon`/`src` attribute is set, and this component
// never sets either -- it slots its own glyph instead.
import './forms/icon-button/icon-button-register.js';
import './lr-popover.js';
import { LyraHelp } from './overlays/help/help.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('help', LyraHelp);
