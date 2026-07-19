export * from './icon-button.class.js';
import '../../utility/icon/icon.js';
import { LyraIconButton } from './icon-button.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('icon-button', LyraIconButton);
