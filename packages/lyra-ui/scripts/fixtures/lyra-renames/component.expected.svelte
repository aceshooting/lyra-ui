<script>
  let panel;
  export let title = 'Settings';
  export let headingText = 'Settings';
</script>

<lr-sample-panel bind:this={panel} heading={title} on:lr-panel-close={close} onlr-item-activate={activate} size="m">
  <h2 slot="heading">{title}</h2>
</lr-sample-panel>
<lr-sample-panel {headingText} arrow="false" size="m"></lr-sample-panel>

<style>
  :global(lr-sample-panel)::part(close-button) { color: red; }
</style>
