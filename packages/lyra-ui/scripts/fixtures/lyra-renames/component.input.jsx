export function Settings({ title, onClose, onItem, onOpen, onActivate, props }) {
  return (
    <>
      <lr-sample-panel heading-text="Settings" arrow="false" onlr-panel-open-change={onOpen} onlr-item-click={onItem} onlr-item-activate={onActivate} style={{ '--lr-panel-bg': 'white' }}>
        <h2 slot="title">{title}</h2>
      </lr-sample-panel>
      <lr-sample-panel headingText={title} {...props} />
      <div onlr-panel-close={onClose}></div>
    </>
  );
}
