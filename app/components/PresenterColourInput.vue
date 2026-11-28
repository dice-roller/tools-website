<script setup lang="ts">
const props = defineProps<{ label: string; disabled?: boolean }>();
const model = defineModel<string>({ required: true });
const draft = ref(model.value);
const validHex = (value: string) => /^#[0-9a-f]{6}$/i.test(value);
watch(model, (value) => {
  draft.value = value;
});

function updateColour(value: string) {
  draft.value = value;
  if (validHex(value)) model.value = value;
}
</script>

<template>
  <UInput
    :model-value="draft"
    :disabled="disabled"
    :aria-invalid="!validHex(draft) || undefined"
    class="w-full font-mono"
    @update:model-value="updateColour"
    @blur="draft = model"
    @keydown.enter.prevent
  >
    <template #trailing>
      <UPopover>
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          size="xs"
          :disabled="props.disabled"
          :aria-label="'Pick ' + label.toLowerCase()"
          class="size-7 justify-center p-0"
        >
          <span
            aria-hidden="true"
            class="size-4 rounded-sm ring ring-default"
            :style="{ backgroundColor: model }"
          />
        </UButton>
        <template #content="{ close }">
          <div class="space-y-3 p-3">
            <UColorPicker v-model="model" format="hex" size="sm" />
            <UButton label="Done" type="button" block @click="close" />
          </div>
        </template>
      </UPopover>
    </template>
  </UInput>
</template>
