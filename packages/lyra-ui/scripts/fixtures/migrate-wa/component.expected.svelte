<lr-widget bind:new-property={value} mode="condensed" on:lr-new-event={onChange} placement="start">
  <span slot="new-slot">Content</span>
</lr-widget>

<style>
  lr-widget::part(new-part) { --lr-new-color: red; }
</style>
