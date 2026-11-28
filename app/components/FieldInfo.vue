<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    text: string;
    icon?: string;
  }>(),
  { icon: "i-heroicons-information-circle" },
);

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
      :icon="icon"
      color="neutral"
      variant="ghost"
      size="xs"
      :aria-label="`About ${label}`"
      class="size-7 shrink-0 justify-center p-0 text-muted"
      @click="open = true"
    />
  </UTooltip>
</template>
