<template>
  <lr-widget :new-property="value" mode="condensed" @lr-new-event="onChange" placement="start">
    <template #new-slot>Content</template>
  </lr-widget>
</template>

<style>
lr-widget::part(new-part) { color: var(--lr-new-color); }
</style>
