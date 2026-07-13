export * from './avatar.class.js';
import { LyraAvatar } from './avatar.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('avatar', LyraAvatar);
