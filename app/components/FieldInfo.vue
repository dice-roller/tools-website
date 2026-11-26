<script setup lang="ts">
defineProps<{
  label: string;
  text: string;
}>();

const open = ref(false);
</script>

<template>
  <UTooltip
    v-model:open="open"
    :text="text"
    :delay-duration="200"
    :disable-closing-trigger="true"
    arrow
    :ui="{
      content: 'h-auto max-w-64 py-2',
      text: 'whitespace-normal',
    }"
  >
    <UButton
      type="button"
      icon="i-heroicons-information-circle"
      color="neutral"
      variant="ghost"
      size="xs"
      :aria-label="`About ${label}`"
      class="p-1 text-muted"
      @click="open = true"
    />
  </UTooltip>
</template>
