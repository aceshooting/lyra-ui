export function Settings({ title, onClose, onItem, onOpen, onActivate, props }) {
  return (
    <>
      <lr-sample-panel heading="Settings" arrow="false" onlr-open-change={onOpen} onlr-item-click={onItem} onlr-item-activate={onActivate} style={{ '--lr-sample-panel-background': 'white' }}>
        <h2 slot="heading">{title}</h2>
      </lr-sample-panel>
      <lr-sample-panel heading={title} {...props} />
      <div onlr-panel-close={onClose}></div>
    </>
  );
}
