import { css } from 'lit';

export const styles = css`
  /* The host and its region wrapper are layout-transparent: the slotted region lays out in the
     host's parent exactly as it would without the component. */
  :host {
    display: contents;
  }

  .trigger {
    display: contents;
  }

  /* Inherited by every region descendant. It suppresses the iOS link and image callout so a
     press-and-hold can open the menu instead; a consumer restores the native callout on specific
     elements by setting -webkit-touch-callout: default on them and vetoing lr-show there. */
  :host(:not([disabled])) .trigger {
    -webkit-touch-callout: none;
  }

  /* The composed dropdown is only a positioning shell: this outer rule beats its own inline-block
     host display so it never becomes a flex or grid item of the host's parent. */
  .shell {
    display: contents;
    /* The menu's own floor, ahead of the shared --lr-overlay-min-inline-size the composed popup
       reads. Declared as a bare var() so that, while the public token is unset, the private
       property is guaranteed-invalid and the popup falls through to the shared floor. */
    --_lr-popup-min-inline-size: var(--lr-context-menu-min-inline-size);
  }

  /* The shell has no trigger; its empty trigger wrapper must not produce a line box. */
  .shell::part(trigger) {
    display: none;
  }
`;
