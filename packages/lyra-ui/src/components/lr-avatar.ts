export * from './media/avatar/avatar.class.js';
import { LyraAvatar } from './media/avatar/avatar.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('avatar', LyraAvatar);
