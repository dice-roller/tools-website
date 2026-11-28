<script setup lang="ts">
const warning =
  "Includes variable data. Selecting this example will overwrite existing variable data.";

const open = ref(false);
const trigger = useTemplateRef<HTMLElement>("trigger");
let menuItem: HTMLElement | null = null;

function onFocus() {
  if (menuItem?.matches(":focus-visible")) {
    open.value = true;
  }
}

function onBlur() {
  open.value = false;
}

// Keep the menu item as the keyboard focus target, rather than nesting a
// second focusable button inside it.
onMounted(() => {
  menuItem = trigger.value?.closest<HTMLElement>('[role="menuitem"]') ?? null;
  menuItem?.addEventListener("focus", onFocus);
  menuItem?.addEventListener("blur", onBlur);
  onFocus();
});

onBeforeUnmount(() => {
  menuItem?.removeEventListener("focus", onFocus);
  menuItem?.removeEventListener("blur", onBlur);
});
</script>

<template>
  <UTooltip
    v-model:open="open"
    :text="warning"
    :delay-duration="200"
    :disable-closing-trigger="true"
    arrow
    :ui="{
      content: 'h-auto max-w-64 py-2',
      text: 'whitespace-normal',
    }"
  >
    <span
      ref="trigger"
      class="inline-flex min-h-6 min-w-6 items-center justify-center"
      data-testid="example-data-info"
      @pointerdown.stop
      @pointerup.stop
      @click.stop="open = true"
    >
      <UIcon
        name="i-lucide-braces"
        class="size-4 text-warning"
        aria-hidden="true"
      />
      <span class="sr-only">{{ warning }}</span>
    </span>
  </UTooltip>
</template>
