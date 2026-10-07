import { AnnouncementSinkController } from '../../internal/announcer.js';

/** Viewer-compatible wrapper: its manual connect/disconnect hooks pre-mount both live regions. */
export class ViewerAnnouncementController extends AnnouncementSinkController {
  constructor(host: HTMLElement) {
    super(host, { register: false, eager: ['polite', 'assertive'] });
  }
}
