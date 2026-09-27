// This file never uses a component that renames anything, so every same-named member, string and
// selector below belongs to something else and must stay exactly as written.
const config = { arrow: true, compact: false, headingText: 'x' };
config.compact = true;
config.headingText = 'y';
config.arrow = false;
settings.refresh();
element.setAttribute('heading-text', 'x');
document.createElement('lr-panel-close');
customElements.whenDefined('lr-item-click');
const markup = html`<details open><summary>Summary</summary></details><input size="3" />`;
const styles = css`.card { gap: var(--lr-other-gap); } lr-sample-other::part(body) { margin: 0; }`;
/* lr-sample-panel::part(body) and --lr-shared-gap inside a comment */
// lr-sample-panel heading-text="x" arrow @lr-panel-close
