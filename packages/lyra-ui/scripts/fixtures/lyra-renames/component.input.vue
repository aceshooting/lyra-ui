<template>
  <lr-sample-panel :heading-text="title" v-bind:arrow="showArrow" @lr-panel-close="onClose" v-on:lr-item-click.once="onItem" size="m">
    <template #title>{{ title }}</template>
  </lr-sample-panel>
  <!-- lyra-migrate-reviewed: POLARITY_REVIEW:arrow -->
  <lr-sample-panel
    arrow="false"
    v-bind="attrs"
    size="m"
  ></lr-sample-panel>
</template>

<script setup>
import { ref } from 'vue';
const title = ref('Settings');
</script>

<style scoped>
lr-sample-panel::part(body) { padding: 0; }
</style>
